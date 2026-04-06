import { create } from 'zustand';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { Profile } from '../types';
import { useDataStore } from './dataStore';
import * as AuthSession from 'expo-auth-session';
import * as Notifications from 'expo-notifications';
import { changeLanguage } from '../i18n';

// Référence au listener onAuthStateChange pour éviter les fuites mémoire.
// Variable module-level : un seul listener actif à la fois.
let _authUnsubscribe: (() => void) | null = null;

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ userId: string }>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<{ url: string } | null>;
  handleOAuthCallback: (url: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    // Désabonner le listener précédent pour éviter les fuites mémoire
    // si initialize() est appelé plusieurs fois (ex: hot reload).
    if (_authUnsubscribe) {
      _authUnsubscribe();
      _authUnsubscribe = null;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        // Token invalide ou expiré → on purge la session locale
        await supabase.auth.signOut();
      } else if (session?.user) {
        set({ user: session.user });
        await get().fetchProfile(session.user.id);
      }
    } catch (e: any) {
      console.error('[authStore] Initialize error:', e);
      // Refresh token introuvable → purger pour ne pas boucler
      if (e?.message?.includes('Refresh Token')) {
        await supabase.auth.signOut();
      }
    } finally {
      set({ initialized: true });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        set({ user: session.user });
        await get().fetchProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null });
      }
      // INITIAL_SESSION / TOKEN_REFRESHED sans session = confirmation email en attente
      // On ne vide pas l'user pour ne pas casser l'onboarding post-signup
    });
    _authUnsubscribe = () => subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        set({ user: data.user });
        await get().fetchProfile(data.user.id);
      }
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email, password) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Erreur lors de la création du compte');
      set({ user: data.user });
      // Si pas de session → confirmation email requise dans Supabase
      if (!data.session) throw new Error('CONFIRM_EMAIL');
      return { userId: data.user.id };
    } finally {
      set({ loading: false });
    }
  },

  // Retourne l'URL OAuth à ouvrir dans le navigateur
  signInWithOAuth: async (provider) => {
    set({ loading: true });
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'factume',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      return data; // { url, provider }
    } catch (e) {
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  // Appeler quand l'app reçoit le deep link après OAuth
  handleOAuthCallback: async (url: string) => {
    try {
      // Extraire les tokens du fragment (#access_token=...&refresh_token=...)
      const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] || '';
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
        if (data.user) {
          set({ user: data.user });
          await get().fetchProfile(data.user.id);
        }
      }
    } catch (e) {
      console.error('[authStore] handleOAuthCallback error:', e);
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null });
    useDataStore.getState().clearData();
  },

  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[authStore] fetchProfile error:', error);
      return;
    }
    if (data) {
      set({ profile: data });
      // Sync language from profile
      if (data.language) {
        changeLanguage(data.language).catch(() => {});
      }
      // Register push token
      registerPushToken(userId).catch(() => {});
    }
  },

  updateProfile: async (updates) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? get().user;
    if (!user) throw new Error('Non authentifié');

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, email: user.email ?? '', ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;
    if (data) set({ profile: data });
  },
}));

// Register Expo push token and save to profile
async function registerPushToken(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('recurring', {
        name: 'Factures récurrentes',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    await supabase.from('profiles').update({ expo_push_token: token }).eq('id', userId);
  } catch {
    // Push notifications are optional — ignore errors
  }
}

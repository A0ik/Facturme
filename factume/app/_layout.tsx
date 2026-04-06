import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { exchangeStripeCode } from '../lib/api';
import ErrorBoundary from '../components/ErrorBoundary';
import {
  requestNotificationPermissions,
  checkAndNotifyOverdueInvoices,
  addNotificationResponseListener,
} from '../lib/notifications';
import { useRouter } from 'expo-router';
import '../i18n'; // Initialize i18n

SplashScreen.preventAutoHideAsync();

// Nécessaire pour fermer automatiquement le navigateur OAuth
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const { initialized, initialize, handleOAuthCallback, updateProfile } = useAuthStore();
  const { invoices, fetchInvoices } = useDataStore();
  const router = useRouter();
  const notifListenerRef = useRef<any>(null);

  useEffect(() => {
    initialize().then(() => SplashScreen.hideAsync());
  }, []);

  // ─── Permissions + check des factures overdue au démarrage ────────────────
  useEffect(() => {
    const initNotifications = async () => {
      const granted = await requestNotificationPermissions();
      if (!granted) return;

      // Si l'utilisateur est connecté, on charge les factures et on vérifie les retards
      const { user } = useAuthStore.getState();
      if (user) {
        await fetchInvoices();
        const { invoices: currentInvoices } = useDataStore.getState();
        await checkAndNotifyOverdueInvoices(currentInvoices);
      }
    };

    // Délai léger pour laisser l'auth se stabiliser
    const timer = setTimeout(initNotifications, 2000);
    return () => clearTimeout(timer);
  }, []);

  // ─── Listener sur tap de notification → deep link ────────────────────────
  useEffect(() => {
    notifListenerRef.current = addNotificationResponseListener((data) => {
      if (data.invoiceId) {
        // Ouvrir la facture concernée
        router.push(`/(app)/invoice/${data.invoiceId}`);
      } else if (data.screen === 'invoices') {
        // Ouvrir l'onglet factures
        router.push('/(app)/(tabs)/invoices');
      }
    });

    return () => {
      notifListenerRef.current?.remove?.();
    };
  }, []);

  // ─── Rescheduler les notifs quand les factures changent ───────────────────
  useEffect(() => {
    if (invoices.length > 0) {
      checkAndNotifyOverdueInvoices(invoices);
    }
  }, [invoices.length]);

  // Écouter les deep links (retour après connexion Google/Apple)
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url?.includes('auth/callback') || url?.includes('expo-auth-session')) handleOAuthCallback(url);
    });

    const subscription = Linking.addEventListener('url', async ({ url }) => {
      if (url?.includes('auth/callback') || url?.includes('expo-auth-session')) {
        handleOAuthCallback(url);
      } else if (url?.includes('stripe-connect')) {
        const parsed = Linking.parse(url);
        const code = parsed.queryParams?.code as string | undefined;
        if (code) {
          try {
            const { stripe_account_id } = await exchangeStripeCode(code);
            await updateProfile({ stripe_account_id } as any);
          } catch (e) {
            console.error('[stripe-connect] Erreur:', e);
          }
        }
      }
    });

    return () => subscription?.remove();
  }, []);

  if (!initialized) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Colors, FontSize, Spacing, Radius } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
export default function Login() {
  const router = useRouter();
  const { signIn, signInWithOAuth, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgotPassword = () => {
    let inputEmail = email.trim();
    Alert.prompt(
      'Mot de passe oublié',
      'Entrez votre adresse email pour recevoir un lien de réinitialisation.',
      async (value) => {
        if (!value) return;
        inputEmail = value.trim();
        if (!inputEmail.includes('@')) {
          Alert.alert('Email invalide', 'Veuillez entrer une adresse email valide.');
          return;
        }
        setForgotLoading(true);
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(inputEmail, {
            redirectTo: 'factume://auth/reset-password',
          });
          if (error) throw error;
          Alert.alert('Email envoyé', `Un lien de réinitialisation a été envoyé à ${inputEmail}.`);
        } catch (err: any) {
          Alert.alert('Erreur', err.message || 'Impossible d\'envoyer l\'email.');
        } finally {
          setForgotLoading(false);
        }
      },
      'plain-text',
      inputEmail
    );
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!email.includes('@')) e.email = 'Email invalide';
    if (password.length < 6) e.password = '6 caractères minimum';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setOauthLoading(provider);
    try {
      const result = await signInWithOAuth(provider);
      if (result?.url) {
        const res = await WebBrowser.openAuthSessionAsync(result.url, 'factume://auth/callback');
        if (res.type === 'success') {
          router.replace('/');
        }
      }
    } catch (err: any) {
      Alert.alert('Erreur OAuth', err.message);
    } finally {
      setOauthLoading(null);
    }
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (err: any) {
      Alert.alert(
        'Connexion impossible',
        err.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect.'
          : err.message
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Retour</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.logo}>
              Factu<Text style={styles.logoAccent}>.</Text>Me
            </Text>
            <Text style={styles.title}>Connexion</Text>
            <Text style={styles.subtitle}>
              Content de vous revoir !
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Adresse email"
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
            />

            <Input
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
              error={errors.password}
            />

            <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword} disabled={forgotLoading}>
              <Text style={styles.forgotText}>{forgotLoading ? 'Envoi...' : 'Mot de passe oublié ?'}</Text>
            </TouchableOpacity>

            <Button
              onPress={handleLogin}
              loading={loading}
              fullWidth
              size="lg"
            >
              Se connecter
            </Button>
          </View>

          {/* OAuth */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou continuer avec</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.oauthRow}>
            <TouchableOpacity
              style={styles.oauthBtn}
              onPress={() => handleOAuth('google')}
              disabled={!!oauthLoading}
            >
              <Ionicons name="logo-google" size={18} color={Colors.textPrimary} />
              <Text style={styles.oauthText}>
                {oauthLoading === 'google' ? 'Connexion...' : 'Google'}
              </Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.oauthBtn}
                onPress={() => handleOAuth('apple')}
                disabled={!!oauthLoading}
              >
                <Ionicons name="logo-apple" size={18} color={Colors.textPrimary} />
                <Text style={styles.oauthText}>
                  {oauthLoading === 'apple' ? 'Connexion...' : 'Apple'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Pas encore de compte ?</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/register')}>
              <Text style={styles.footerLink}> Créer un compte</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  backBtn: { paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  backText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '500' },
  header: { gap: 8, marginBottom: Spacing.xl, marginTop: Spacing.lg },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1,
  },
  logoAccent: { color: Colors.accent },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  form: { gap: Spacing.md },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -4 },
  forgotText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '500' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: { fontSize: FontSize.md, color: Colors.textSecondary },
  footerLink: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  oauthRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  oauthBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 14,
    backgroundColor: Colors.white,
  },
  oauthIcon: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  oauthText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
});

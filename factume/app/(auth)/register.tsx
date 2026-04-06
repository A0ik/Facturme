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
import { useAuthStore } from '../../stores/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Colors, FontSize, Spacing, Radius } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
export default function Register() {
  const router = useRouter();
  const { signUp, signInWithOAuth, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

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

  const validate = () => {
    const e: typeof errors = {};
    if (!email.includes('@')) e.email = 'Email invalide';
    if (password.length < 8) e.password = '8 caractères minimum';
    else if (!/[A-Z]/.test(password)) e.password = 'Au moins une majuscule requise';
    else if (!/[0-9]/.test(password)) e.password = 'Au moins un chiffre requis';
    else if (!/[^A-Za-z0-9]/.test(password)) e.password = 'Au moins un caractère spécial requis (!@#$...)';
    if (password !== confirmPassword) e.confirmPassword = 'Les mots de passe ne correspondent pas';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    try {
      await signUp(email.trim(), password);
      router.replace('/(auth)/onboarding/language');
    } catch (err: any) {
      if (err.message === 'CONFIRM_EMAIL') {
        Alert.alert(
          'Confirmez votre email',
          `Un lien de confirmation a été envoyé à ${email.trim()}. Cliquez dessus puis revenez vous connecter.`,
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
        return;
      }
      Alert.alert(
        'Erreur d\'inscription',
        err.message?.includes('already registered')
          ? 'Cet email est déjà utilisé.'
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Retour</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.logo}>
              Factu<Text style={styles.logoAccent}>.</Text>Me
            </Text>
            <Text style={styles.title}>Créer votre compte</Text>
            <Text style={styles.subtitle}>
              30 secondes et vous facturez en parlant.
            </Text>
          </View>

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
              error={errors.password}
              hint="8 car. min, 1 majuscule, 1 chiffre, 1 caractère spécial"
            />

            <Input
              label="Confirmer le mot de passe"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              secureTextEntry
              error={errors.confirmPassword}
            />

            <Button
              onPress={handleRegister}
              loading={loading}
              fullWidth
              size="lg"
            >
              Créer mon compte →
            </Button>

            <Text style={styles.terms}>
              En créant un compte, vous acceptez nos{' '}
              <Text style={styles.termsLink}>Conditions d'utilisation</Text>
              {' '}et notre{' '}
              <Text style={styles.termsLink}>Politique de confidentialité</Text>.
            </Text>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou s'inscrire avec</Text>
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
                {oauthLoading === 'google' ? 'Inscription...' : 'Google'}
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
                  {oauthLoading === 'apple' ? 'Inscription...' : 'Apple'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà un compte ?</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.footerLink}> Se connecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  backBtn: { paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  backText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '500' },
  header: { gap: 8, marginBottom: Spacing.xl, marginTop: Spacing.lg },
  logo: { fontSize: 36, fontWeight: '800', color: Colors.primary, letterSpacing: -1 },
  logoAccent: { color: Colors.accent },
  title: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary },
  form: { gap: Spacing.md },
  terms: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: { color: Colors.primary, fontWeight: '500' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xl, gap: Spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  oauthRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  oauthBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius?.md || 8, paddingVertical: 14, backgroundColor: Colors.white,
  },
  oauthText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  footerText: { fontSize: FontSize.md, color: Colors.textSecondary },
  footerLink: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
});

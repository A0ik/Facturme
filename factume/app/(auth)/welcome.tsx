import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Button from '../../components/ui/Button';
import { Colors, FontSize, Spacing, Radius } from '../../constants/Colors';
import { useAuthStore } from '../../stores/authStore';
import { Ionicons } from '@expo/vector-icons';

export default function Welcome() {
  const router = useRouter();
  const { signInWithOAuth, loading } = useAuthStore();
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(30)).current;
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(contentY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleOAuth = async (provider: 'google' | 'apple') => {
    if (provider === 'apple' && Platform.OS !== 'ios') {
      Alert.alert('Apple ID', 'La connexion Apple est disponible uniquement sur iOS.');
      return;
    }
    setOauthLoading(provider);
    try {
      const result = await signInWithOAuth(provider);
      if (result?.url) {
        const redirectUrl = AuthSession.makeRedirectUri({
          scheme: 'factume',
          path: 'auth/callback',
        });
        const browserResult = await WebBrowser.openAuthSessionAsync(
          result.url,
          redirectUrl
        );
        if (browserResult.type === 'success') {
          router.replace('/');
        }
      }
    } catch (err: any) {
      Alert.alert(
        'Connexion impossible',
        provider === 'google'
          ? 'Vérifiez que Google OAuth est activé dans votre projet Supabase.'
          : err.message
      );
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <LinearGradient
      colors={[Colors.primaryDark, Colors.primary, '#25C996']}
      style={styles.gradient}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <SafeAreaView style={styles.safe}>
        {/* Logo */}
        <Animated.View
          style={[
            styles.logoSection,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <Text style={styles.logoText}>Factu<Text style={styles.logoAccent}>.</Text>me</Text>
          <Text style={styles.tagline}>TU PARLES, ON FACTURE</Text>
        </Animated.View>

        {/* Features */}
        <Animated.View
          style={[
            styles.features,
            { opacity: contentOpacity, transform: [{ translateY: contentY }] },
          ]}
        >
          {[
            { icon: 'mic-outline' as const, text: 'Facture vocale en 10 secondes' },
            { icon: 'hardware-chip-outline' as const, text: 'IA transcrit et structure' },
            { icon: 'document-text-outline' as const, text: 'PDF conforme e-invoicing 2026' },
            { icon: 'card-outline' as const, text: 'Envoi et paiement en ligne' },
          ].map((f, i) => (
            <View key={i} style={styles.featurePill}>
              <Ionicons name={f.icon} size={20} color={Colors.white} />
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Boutons */}
        <Animated.View
          style={[
            styles.buttons,
            { opacity: contentOpacity, transform: [{ translateY: contentY }] },
          ]}
        >
          {/* Email */}
          <Button
            onPress={() => router.push('/(auth)/register')}
            fullWidth
            size="lg"
            style={styles.primaryBtn}
            textStyle={{ color: Colors.primaryDark }}
          >
            Créer mon compte
          </Button>

          {/* Séparateur */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou continuer avec</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* OAuth */}
          <View style={styles.oauthRow}>
            <TouchableOpacity
              style={styles.oauthBtn}
              onPress={() => handleOAuth('google')}
              disabled={!!oauthLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-google" size={18} color={Colors.white} />
              <Text style={styles.oauthText}>
                {oauthLoading === 'google' ? 'Connexion...' : 'Google'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.oauthBtn, Platform.OS !== 'ios' && styles.oauthBtnDisabled]}
              onPress={() => handleOAuth('apple')}
              disabled={!!oauthLoading || Platform.OS !== 'ios'}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-apple" size={18} color={Colors.white} />
              <Text style={styles.oauthText}>
                {oauthLoading === 'apple' ? 'Connexion...' : Platform.OS !== 'ios' ? 'Apple (iOS)' : 'Apple'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Déjà un compte */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            style={styles.loginLink}
          >
            <Text style={styles.loginLinkText}>J'ai déjà un compte →</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    justifyContent: 'space-between',
  },
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -1,
  },
  logoAccent: { color: Colors.accent },
  tagline: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white + 'CC',
    letterSpacing: 4,
  },
  features: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  featureText: { fontSize: FontSize.md, color: Colors.white, fontWeight: '500' },

  buttons: { gap: 12 },
  primaryBtn: { backgroundColor: Colors.white },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  dividerText: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  oauthRow: { flexDirection: 'row', gap: 10 },
  oauthBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: Radius.md,
    paddingVertical: 13,
  },
  oauthBtnDisabled: { opacity: 0.5 },
  oauthIcon: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  oauthText: { fontSize: FontSize.md, color: Colors.white, fontWeight: '600' },

  loginLink: { alignItems: 'center', paddingVertical: 6 },
  loginLinkText: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
});

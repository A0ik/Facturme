import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import { changeLanguage } from '../../../i18n';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';

export default function OnboardingLanguage() {
  const router = useRouter();
  const { updateProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleSelect = async (lang: 'fr' | 'en') => {
    setLoading(true);
    try {
      await changeLanguage(lang);
      await updateProfile({ language: lang } as any);
      router.push('/(auth)/onboarding/company');
    } catch {
      // On error, still navigate
      router.push('/(auth)/onboarding/company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>Dicta<Text style={styles.logoAccent}>B</Text>ill</Text>
          <View style={styles.logoDot} />
        </View>

        <Text style={styles.title}>Bienvenue / Welcome</Text>
        <Text style={styles.subtitle}>Choisissez votre langue{'\n'}Choose your language</Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.langBtn}
            onPress={() => handleSelect('fr')}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.flag}>🇫🇷</Text>
            <View>
              <Text style={styles.langName}>Français</Text>
              <Text style={styles.langSub}>French</Text>
            </View>
            <View style={styles.arrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.langBtn}
            onPress={() => handleSelect('en')}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.flag}>🇬🇧</Text>
            <View>
              <Text style={styles.langName}>English</Text>
              <Text style={styles.langSub}>Anglais</Text>
            </View>
            <View style={styles.arrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  logoWrap: { alignItems: 'center', marginBottom: Spacing.lg },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1,
  },
  logoAccent: { color: Colors.accent },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginTop: 4,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  buttons: { width: '100%', gap: Spacing.md },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  flag: { fontSize: 32 },
  langName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  langSub: { fontSize: FontSize.sm, color: Colors.textTertiary },
  arrow: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});

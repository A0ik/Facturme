import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingDone() {
  const router = useRouter();
  const { t } = useTranslation();
  const { updateProfile } = useAuthStore();

  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Mark onboarding as done
    updateProfile({ onboarding_done: true } as any).catch(() => {});

    // Entrance animation
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale }], opacity }]}>
          <Ionicons name="checkmark-circle" size={80} color={Colors.primary} />
        </Animated.View>

        <Animated.View style={{ opacity, alignItems: 'center', gap: 12 }}>
          <Text style={styles.title}>{t('onboarding.done.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.done.subtitle')}</Text>
        </Animated.View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace('/(app)/invoice/new?type=invoice')}
            activeOpacity={0.85}
          >
            <Ionicons name="mic" size={20} color={Colors.white} />
            <Text style={styles.primaryBtnText}>{t('onboarding.done.ctaBtn')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace('/')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>{t('onboarding.done.altBtn')}</Text>
          </TouchableOpacity>
        </View>
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
    gap: Spacing.xl,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  actions: { width: '100%', gap: Spacing.md },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  secondaryBtnText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '500' },
});

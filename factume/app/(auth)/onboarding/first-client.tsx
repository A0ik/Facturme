import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDataStore } from '../../../stores/dataStore';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';

export default function OnboardingFirstClient() {
  const router = useRouter();
  const { t } = useTranslation();
  const { createClient } = useDataStore();

  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (key: string, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const handleAdd = async () => {
    if (!form.name.trim()) {
      setErrors({ name: t('onboarding.firstClient.errors.nameRequired') });
      return;
    }
    setLoading(true);
    try {
      await createClient({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        country: 'FR',
      });
      router.push('/(auth)/onboarding/done');
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/(auth)/onboarding/done');
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
          {/* Progress — step 4/4 */}
          <View style={styles.progress}>
            <View style={[styles.progressDot, styles.progressDone]} />
            <View style={[styles.progressLine, { backgroundColor: Colors.primary }]} />
            <View style={[styles.progressDot, styles.progressDone]} />
            <View style={[styles.progressLine, { backgroundColor: Colors.primary }]} />
            <View style={[styles.progressDot, styles.progressDone]} />
            <View style={[styles.progressLine, { backgroundColor: Colors.primary }]} />
            <View style={[styles.progressDot, styles.progressActive]} />
          </View>
          <Text style={styles.step}>{t('onboarding.stepOf', { current: 4, total: 4 })}</Text>

          <Text style={styles.title}>{t('onboarding.firstClient.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.firstClient.subtitle')}</Text>

          <View style={styles.form}>
            <Input
              label={t('onboarding.firstClient.nameLabel')}
              value={form.name}
              onChangeText={(v) => update('name', v)}
              placeholder={t('onboarding.firstClient.namePlaceholder')}
              error={errors.name}
            />
            <Input
              label={t('onboarding.firstClient.emailLabel')}
              value={form.email}
              onChangeText={(v) => update('email', v)}
              placeholder={t('onboarding.firstClient.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label={t('onboarding.firstClient.phoneLabel')}
              value={form.phone}
              onChangeText={(v) => update('phone', v)}
              placeholder={t('onboarding.firstClient.phonePlaceholder')}
              keyboardType="phone-pad"
            />

            <Button onPress={handleAdd} loading={loading} fullWidth size="lg">
              {t('onboarding.firstClient.addBtn')}
            </Button>

            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>{t('onboarding.firstClient.skipBtn')}</Text>
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
    paddingTop: Spacing.lg,
  },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.gray200 },
  progressDone: { backgroundColor: Colors.primary, width: 10 },
  progressActive: { backgroundColor: Colors.primary, width: 24, borderRadius: 5 },
  progressLine: { flex: 1, height: 2, backgroundColor: Colors.gray200 },
  step: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: '500', marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 22 },
  form: { gap: Spacing.md },
  skipBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  skipText: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: '500' },
});

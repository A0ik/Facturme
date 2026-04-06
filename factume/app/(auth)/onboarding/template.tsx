import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import Button from '../../../components/ui/Button';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TEMPLATES: Array<{ id: number; name: string; desc: string; icon: IoniconsName; pro?: boolean }> = [
  {
    id: 1,
    name: 'Minimaliste',
    desc: 'Épuré, moderne. Idéal pour les freelances et consultants.',
    icon: 'remove-outline',
  },
  {
    id: 2,
    name: 'Classique',
    desc: 'Structure traditionnelle. Parfait pour les artisans et TPE.',
    icon: 'document-text-outline',
  },
  {
    id: 3,
    name: 'Moderne',
    desc: 'Coloré et dynamique. Pour se démarquer.',
    icon: 'color-palette-outline',
  },
  {
    id: 4,
    name: 'Custom IA',
    desc: 'Importez votre propre facture PDF — l\'IA crée votre template.',
    icon: 'sparkles-outline',
    pro: true,
  },
];

const ACCENT_COLORS = [
  '#1D9E75', // Vert (par défaut)
  '#3B82F6', // Bleu
  '#8B5CF6', // Violet
  '#EF9F27', // Orange
  '#EF4444', // Rouge
  '#06B6D4', // Cyan
  '#1F2937', // Gris foncé
];

export default function OnboardingTemplate() {
  const router = useRouter();
  const { updateProfile, loading } = useAuthStore();
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [selectedColor, setSelectedColor] = useState(Colors.primary);

  const handleFinish = async () => {
    try {
      await updateProfile({
        template_id: selectedTemplate,
        accent_color: selectedColor,
        // onboarding_done is set in done.tsx
      } as any);

      router.push('/(auth)/onboarding/first-client');
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Progress — step 3/4 */}
        <View style={styles.progress}>
          <View style={[styles.progressDot, styles.progressDone]} />
          <View style={[styles.progressLine, { backgroundColor: Colors.primary }]} />
          <View style={[styles.progressDot, styles.progressDone]} />
          <View style={[styles.progressLine, { backgroundColor: Colors.primary }]} />
          <View style={[styles.progressDot, styles.progressActive]} />
          <View style={styles.progressLine} />
          <View style={styles.progressDot} />
        </View>

        <Text style={styles.step}>Étape 3 / 4</Text>
        <Text style={styles.title}>Personnalisez vos factures</Text>
        <Text style={styles.subtitle}>
          Choisissez un design et une couleur. Vous pourrez les changer plus tard.
        </Text>

        {/* Templates */}
        <Text style={styles.sectionTitle}>Design</Text>
        <View style={styles.templates}>
          {TEMPLATES.map((t) => {
            const isLocked = !!t.pro;
            const isActive = selectedTemplate === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => {
                  if (isLocked) {
                    Alert.alert('Fonctionnalité Solo+', 'Importez votre template depuis les Paramètres une fois votre compte créé avec un abonnement Solo ou Pro.');
                    return;
                  }
                  setSelectedTemplate(t.id);
                }}
                style={[
                  styles.templateCard,
                  isActive && styles.templateCardActive,
                  isLocked && { opacity: 0.6 },
                ]}
                activeOpacity={0.8}
              >
                {isActive && !isLocked && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkIcon}>✓</Text>
                  </View>
                )}
                {isLocked && (
                  <View style={[styles.checkBadge, { backgroundColor: Colors.gray400 }]}>
                    <Ionicons name="lock-closed" size={10} color={Colors.white} />
                  </View>
                )}
                <Ionicons name={t.icon} size={28} color={isActive ? Colors.primary : Colors.textTertiary} />
                <Text style={styles.templateName}>{t.name}</Text>
                <Text style={styles.templateDesc}>{t.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Couleurs */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
          Couleur d'accent
        </Text>
        <View style={styles.colorGrid}>
          {ACCENT_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              onPress={() => setSelectedColor(color)}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                selectedColor === color && styles.colorSwatchActive,
              ]}
            >
              {selectedColor === color && (
                <Text style={styles.colorCheck}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Preview mini */}
        <View style={[styles.preview, { borderLeftColor: selectedColor }]}>
          <View style={styles.previewHeader}>
            <Text style={[styles.previewCompany, { color: selectedColor }]}>
              Votre Entreprise
            </Text>
            <Text style={styles.previewNumber}>FACT-2026-001</Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Consulting stratégie</Text>
            <Text style={styles.previewValue}>2 500,00 €</Text>
          </View>
          <View style={[styles.previewTotal, { backgroundColor: selectedColor }]}>
            <Text style={styles.previewTotalLabel}>Total TTC</Text>
            <Text style={styles.previewTotalValue}>3 000,00 €</Text>
          </View>
        </View>

        <Button
          onPress={handleFinish}
          loading={loading}
          fullWidth
          size="lg"
          style={{ marginTop: Spacing.xl }}
        >
          Continuer →
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, paddingTop: Spacing.lg },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.gray200 },
  progressDone: { backgroundColor: Colors.primary, width: 10 },
  progressActive: { backgroundColor: Colors.primary, width: 24, borderRadius: 5 },
  progressLine: { flex: 1, height: 2, backgroundColor: Colors.gray200 },
  step: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: '500', marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  templates: { gap: 12 },
  templateCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  templateCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  templateName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  templateDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: Colors.textPrimary,
  },
  colorCheck: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  // Preview
  preview: {
    marginTop: Spacing.xl,
    padding: 16,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    backgroundColor: Colors.white,
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  previewCompany: { fontSize: FontSize.md, fontWeight: '700' },
  previewNumber: { fontSize: FontSize.sm, color: Colors.textTertiary, fontFamily: 'monospace' },
  previewDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 10 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  previewLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  previewValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  previewTotal: { borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'space-between' },
  previewTotalLabel: { fontSize: FontSize.sm, color: Colors.white, fontWeight: '600' },
  previewTotalValue: { fontSize: FontSize.md, color: Colors.white, fontWeight: '700' },
});

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../stores/authStore';
import { Colors, FontSize, Spacing, Radius } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://factu.me';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface PlanFeature {
  icon: IoniconsName;
  text: string;
}

interface Plan {
  id: string;
  name: string;
  priceMonthly: string;
  priceAnnual: string;
  priceAnnualMonthly: string;
  savingLabel: string;
  badge: string;
  color: string;
  gradient: [string, string];
  features: PlanFeature[];
}

const PLANS: Plan[] = [
  {
    id: 'solo',
    name: 'Solo',
    priceMonthly: '9,99€',
    priceAnnual: '95,90€',
    priceAnnualMonthly: '7,99€',
    savingLabel: '−20%',
    badge: '⭐ Populaire',
    color: Colors.primary,
    gradient: [Colors.primary, '#25C996'],
    features: [
      { icon: 'infinite-outline', text: 'Documents illimités' },
      { icon: 'mic-outline', text: 'Facturation vocale IA' },
      { icon: 'document-text-outline', text: 'Export PDF + XML Factur-X' },
      { icon: 'people-outline', text: 'Gestion clients & sociétés' },
      { icon: 'receipt-outline', text: 'Notes de frais & factures d\'achat' },
      { icon: 'color-palette-outline', text: '5 templates de facture' },
      { icon: 'mail-outline', text: 'Relances automatiques' },
      { icon: 'eye-off-outline', text: 'Sans marque Factu.me' },
      { icon: 'download-outline', text: 'Export comptable CSV' },
      { icon: 'headset-outline', text: 'Support prioritaire' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: '24,99€',
    priceAnnual: '239,90€',
    priceAnnualMonthly: '19,99€',
    savingLabel: '−20%',
    badge: '🚀 Pour les équipes',
    color: Colors.accent,
    gradient: [Colors.accent, '#F59E0B'],
    features: [
      { icon: 'checkmark-done-outline', text: 'Tout Solo inclus' },
      { icon: 'phone-portrait-outline', text: 'Jusqu\'à 2 appareils' },
      { icon: 'card-outline', text: 'Paiement Stripe intégré' },
      { icon: 'pencil-outline', text: 'Signature électronique' },
      { icon: 'trending-up-outline', text: 'CRM : suivi d\'opportunités' },
      { icon: 'logo-whatsapp', text: 'WhatsApp Business' },
      { icon: 'code-slash-outline', text: 'API comptable (Pennylane...)' },
      { icon: 'bar-chart-outline', text: 'Tableau de bord avancé' },
      { icon: 'person-circle-outline', text: 'Gestionnaire de compte dédié' },
    ],
  },
];

const COMPARE_ROWS = [
  { label: 'Documents / mois', free: '5', solo: '∞', pro: '∞' },
  { label: 'Devis & avoirs', free: false, solo: true, pro: true },
  { label: 'Facturation vocale IA', free: true, solo: true, pro: true },
  { label: 'PDF + XML Factur-X', free: true, solo: true, pro: true },
  { label: 'Sans filigrane', free: false, solo: true, pro: true },
  { label: 'Templates personnalisés', free: false, solo: true, pro: true },
  { label: 'Gestion clients & sociétés', free: true, solo: true, pro: true },
  { label: 'Notes de frais & achats', free: false, solo: true, pro: true },
  { label: 'Export CSV comptable', free: false, solo: true, pro: true },
  { label: 'Relances automatiques', free: false, solo: true, pro: true },
  { label: 'CRM suivi d\'opportunités', free: false, solo: false, pro: true },
  { label: 'WhatsApp Business', free: false, solo: false, pro: true },
  { label: 'Paiement Stripe intégré', free: false, solo: false, pro: true },
  { label: 'Jusqu\'à 2 appareils', free: false, solo: false, pro: true },
];

export default function Paywall() {
  const router = useRouter();
  const { profile, fetchProfile, user } = useAuthStore();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState('solo');
  const [subscribing, setSubscribing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user) fetchProfile(user.id);
    }, [user])
  );

  const handleSubscribe = async (planId: string) => {
    setSubscribing(true);
    try {
      const url = `${WEB_URL}/checkout?plan=${planId}&interval=${billing}`;
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        toolbarColor: '#1D9E75',
      });
      if (user) await fetchProfile(user.id);
      const newTier = profile?.subscription_tier;
      if (newTier && newTier !== 'free') {
        Alert.alert('Abonnement activé ! 🎉', `Bienvenue sur le plan ${newTier === 'solo' ? 'Solo' : 'Pro'} !`);
        router.back();
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setSubscribing(false);
    }
  };

  const currentPlan = profile?.subscription_tier || 'free';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Choisissez votre plan</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Factu<Text style={styles.logoAccent}>.</Text>me</Text>
          <Text style={styles.tagline}>Tu parles, on facture.</Text>
          <Text style={styles.subtitle}>
            Débloquez toutes les fonctionnalités professionnelles et facturez sans limite.
          </Text>
        </View>

        {/* Toggle mensuel / annuel */}
        <View style={styles.billingToggle}>
          <TouchableOpacity
            onPress={() => setBilling('monthly')}
            style={[styles.toggleBtn, billing === 'monthly' && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, billing === 'monthly' && styles.toggleTextActive]}>
              Mensuel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setBilling('annual')}
            style={[styles.toggleBtn, billing === 'annual' && styles.toggleBtnActive]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.toggleText, billing === 'annual' && styles.toggleTextActive]}>
                Annuel
              </Text>
              <View style={styles.savingBadge}>
                <Text style={styles.savingBadgeText}>−20%</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Plans */}
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const isCurrent = currentPlan === plan.id;
          const displayPrice = billing === 'annual' ? plan.priceAnnualMonthly : plan.priceMonthly;

          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelectedPlan(plan.id)}
              activeOpacity={0.92}
              style={[
                styles.planCard,
                isSelected && { borderColor: plan.color, borderWidth: 2.5, shadowColor: plan.color, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8 },
              ]}
            >
              {/* Badge */}
              <View style={[styles.planBadge, { backgroundColor: plan.color }]}>
                <Text style={styles.planBadgeText}>{isCurrent ? '✓ Plan actuel' : plan.badge}</Text>
              </View>

              {/* Header plan */}
              <View style={styles.planHeader}>
                <View>
                  <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                  {billing === 'annual' && (
                    <Text style={[styles.annualLabel, { color: plan.color }]}>{plan.savingLabel} · {plan.priceAnnual}/an</Text>
                  )}
                </View>
                <View style={styles.pricingBlock}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Text style={[styles.priceCurrency, { color: plan.color }]}>€</Text>
                    <Text style={[styles.priceAmount, { color: plan.color }]}>
                      {displayPrice.replace('€', '').replace(',', '.')}
                    </Text>
                  </View>
                  <Text style={styles.pricePeriod}>/mois</Text>
                </View>
              </View>

              {/* Features */}
              <View style={styles.featuresContainer}>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <View style={[styles.featureIconBox, { backgroundColor: plan.color + '18' }]}>
                      <Ionicons name={f.icon} size={14} color={plan.color} />
                    </View>
                    <Text style={styles.featureText}>{f.text}</Text>
                  </View>
                ))}
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={[
                  styles.subscribeBtn,
                  { backgroundColor: isSelected ? plan.color : Colors.surface, borderColor: plan.color, borderWidth: isSelected ? 0 : 1.5 },
                  subscribing && { opacity: 0.7 },
                ]}
                onPress={() => handleSubscribe(plan.id)}
                disabled={subscribing}
              >
                {subscribing && selectedPlan === plan.id ? (
                  <ActivityIndicator size="small" color={isSelected ? '#fff' : plan.color} />
                ) : (
                  <Text style={[styles.subscribeBtnText, { color: isSelected ? '#fff' : plan.color }]}>
                    {isCurrent ? 'Plan actuel ✓' : `Commencer avec ${plan.name} →`}
                  </Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        {/* Comparatif */}
        <View style={styles.compareSection}>
          <Text style={styles.compareTitle}>Comparatif des plans</Text>
          <View style={styles.compareHeader}>
            <View style={{ flex: 2 }} />
            <View style={styles.compareHeaderCell}>
              <Text style={styles.compareHeaderFree}>Gratuit</Text>
            </View>
            <View style={styles.compareHeaderCell}>
              <Text style={[styles.compareHeaderPlan, { color: Colors.primary }]}>Solo</Text>
            </View>
            <View style={styles.compareHeaderCell}>
              <Text style={[styles.compareHeaderPlan, { color: Colors.accent }]}>Pro</Text>
            </View>
          </View>
          {COMPARE_ROWS.map((row, i) => (
            <View key={i} style={[styles.compareRow, i % 2 === 0 && styles.compareRowAlt]}>
              <Text style={styles.compareRowLabel} numberOfLines={1}>{row.label}</Text>
              <View style={styles.compareCell}>
                {typeof row.free === 'boolean'
                  ? <Ionicons name={row.free ? 'checkmark-circle' : 'close-circle'} size={18} color={row.free ? Colors.success : Colors.gray300} />
                  : <Text style={styles.compareVal}>{row.free}</Text>}
              </View>
              <View style={styles.compareCell}>
                {typeof row.solo === 'boolean'
                  ? <Ionicons name={row.solo ? 'checkmark-circle' : 'close-circle'} size={18} color={row.solo ? Colors.primary : Colors.gray300} />
                  : <Text style={[styles.compareVal, { color: Colors.primary }]}>{row.solo}</Text>}
              </View>
              <View style={styles.compareCell}>
                {typeof row.pro === 'boolean'
                  ? <Ionicons name={row.pro ? 'checkmark-circle' : 'close-circle'} size={18} color={row.pro ? Colors.accent : Colors.gray300} />
                  : <Text style={[styles.compareVal, { color: Colors.accent }]}>{row.pro}</Text>}
              </View>
            </View>
          ))}
        </View>

        {/* Section confiance */}
        <View style={styles.trustSection}>
          <Text style={styles.trustTitle}>Pourquoi Factu.me ?</Text>
          <View style={styles.trustGrid}>
            {[
              { icon: 'mic-outline' as IoniconsName, text: 'Facture en 30 sec par la voix' },
              { icon: 'hardware-chip-outline' as IoniconsName, text: 'IA qui comprend votre métier' },
              { icon: 'document-text-outline' as IoniconsName, text: 'Conforme e-invoicing 2026' },
              { icon: 'shield-checkmark-outline' as IoniconsName, text: 'Données sécurisées (RGPD)' },
              { icon: 'phone-portrait-outline' as IoniconsName, text: 'iOS & Android' },
              { icon: 'refresh-outline' as IoniconsName, text: 'Annuler à tout moment' },
            ].map((item, i) => (
              <View key={i} style={styles.trustItem}>
                <View style={[styles.trustIconBox, { backgroundColor: Colors.primary + '18' }]}>
                  <Ionicons name={item.icon} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.trustText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.legalText}>
          Abonnement mensuel ou annuel. Sans engagement. Annulable à tout moment depuis l'App Store.{'\n'}
          Paiement sécurisé via Apple Pay / Carte bancaire.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },

  scroll: { padding: Spacing.lg, paddingBottom: 60, gap: Spacing.lg },

  header: { alignItems: 'center', gap: 8, paddingVertical: Spacing.md },
  logo: { fontSize: 40, fontWeight: '800', color: Colors.primary, letterSpacing: -1.5 },
  logoAccent: { color: Colors.accent },
  tagline: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, maxWidth: 300 },

  billingToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: Radius.full,
    padding: 3,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 11, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  toggleText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  toggleTextActive: { color: Colors.textPrimary },
  savingBadge: {
    backgroundColor: Colors.primary + '22', borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  savingBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },

  planCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl || 20,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 16,
    paddingTop: 44,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  planBadge: {
    position: 'absolute', top: -13, left: Spacing.lg,
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: Radius.full,
  },
  planBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planName: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  annualLabel: { fontSize: FontSize.xs, fontWeight: '600', marginTop: 2 },
  pricingBlock: { alignItems: 'flex-end' },
  priceCurrency: { fontSize: 16, fontWeight: '700', marginTop: 4, marginRight: 1 },
  priceAmount: { fontSize: 40, fontWeight: '800', letterSpacing: -1, lineHeight: 44 },
  pricePeriod: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

  featuresContainer: { gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIconBox: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },

  subscribeBtn: {
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  subscribeBtnText: { fontSize: FontSize.md, fontWeight: '700' },

  compareSection: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  compareTitle: {
    fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  compareHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  compareHeaderCell: { flex: 1, alignItems: 'center' },
  compareHeaderFree: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textTertiary },
  compareHeaderPlan: { fontSize: FontSize.sm, fontWeight: '800' },
  compareRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  compareRowAlt: { backgroundColor: Colors.surface },
  compareRowLabel: { flex: 2, fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  compareCell: { flex: 1, alignItems: 'center' },
  compareVal: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },

  trustSection: { gap: 14 },
  trustTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trustItem: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: Radius.md, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  trustIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  trustText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 16 },
  legalText: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center', lineHeight: 18 },
});

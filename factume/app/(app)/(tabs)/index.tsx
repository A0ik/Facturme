import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { useDataStore } from '../../../stores/dataStore';
import InvoiceCard from '../../../components/InvoiceCard';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';
import { useCurrency } from '../../../hooks/useCurrency';

export default function Dashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, user } = useAuthStore();
  const { invoices, stats, fetchInvoices, fetchClients } = useDataStore();
  const { format: formatCurrency } = useCurrency();
  const [refreshing, setRefreshing] = React.useState(false);
  const [logoError, setLogoError] = React.useState(false);

  useEffect(() => {
    if (user) {
      fetchInvoices();
      fetchClients();
    }
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInvoices();
    setRefreshing(false);
  };

  const recentInvoices = invoices.slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('dashboard.greeting_morning') : hour < 18 ? t('dashboard.greeting_afternoon') : t('dashboard.greeting_evening');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.companyName}>
              {profile?.company_name || 'Mon entreprise'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/(tabs)/settings')}
            style={styles.avatarBtn}
          >
            {profile?.logo_url && !logoError ? (
              <Image source={{ uri: profile.logo_url }} style={styles.avatarImg} onError={() => setLogoError(true)} />
            ) : (
              <Text style={styles.avatarText}>
                {(profile?.company_name || 'M').charAt(0).toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Text style={styles.statLabelLight}>{t('dashboard.caThisMois')}</Text>
            <Text style={styles.statValueLight}>{formatCurrency(stats?.mrr || 0)}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('dashboard.pending')}</Text>
            <Text style={styles.statValue}>{stats?.pendingCount || 0}</Text>
            <Text style={styles.statSub}>{formatCurrency(stats?.pendingRevenue || 0)}</Text>
          </View>

          <View style={[styles.statCard, stats?.overdueCount ? styles.statCardDanger : undefined]}>
            <Text style={[styles.statLabel, stats?.overdueCount ? styles.statLabelDanger : undefined]}>
              {t('dashboard.overdue')}
            </Text>
            <Text style={[styles.statValue, stats?.overdueCount ? styles.statValueDanger : undefined]}>
              {stats?.overdueCount || 0}
            </Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickSection}>
          {/* ── Voix ── */}
          <View style={styles.quickHeader}>
            <Ionicons name="mic" size={15} color={Colors.textSecondary} />
            <Text style={styles.quickTitle}>{t('dashboard.voiceSection')}</Text>
          </View>
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: Colors.primary }]}
              onPress={() => router.push('/(app)/invoice/new?type=invoice')}
              activeOpacity={0.85}
            >
              <Ionicons name="document-text-outline" size={22} color={Colors.white} />
              <Text style={styles.quickBtnLabel}>{t('dashboard.invoice')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: '#3B82F6' }]}
              onPress={() => router.push('/(app)/invoice/new?type=quote')}
              activeOpacity={0.85}
            >
              <Ionicons name="clipboard-outline" size={22} color={Colors.white} />
              <Text style={styles.quickBtnLabel}>{t('dashboard.quote')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: '#8B5CF6' }]}
              onPress={() => router.push('/(app)/invoice/new?type=credit_note')}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-circle-outline" size={22} color={Colors.white} />
              <Text style={styles.quickBtnLabel}>{t('dashboard.creditNote')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.quickSub}>{t('dashboard.voiceSubtitle')}</Text>

          {/* ── Saisie manuelle ── */}
          <View style={[styles.quickHeader, { marginTop: 10 }]}>
            <Ionicons name="pencil-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.quickTitle}>{t('dashboard.manualSection')}</Text>
          </View>
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={[styles.quickBtnOutline, { borderColor: Colors.primary }]}
              onPress={() => router.push('/(app)/invoice/new?type=invoice&mode=manual')}
              activeOpacity={0.85}
            >
              <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
              <Text style={[styles.quickBtnOutlineLabel, { color: Colors.primary }]}>{t('dashboard.invoice')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtnOutline, { borderColor: '#3B82F6' }]}
              onPress={() => router.push('/(app)/invoice/new?type=quote&mode=manual')}
              activeOpacity={0.85}
            >
              <Ionicons name="clipboard-outline" size={18} color="#3B82F6" />
              <Text style={[styles.quickBtnOutlineLabel, { color: '#3B82F6' }]}>{t('dashboard.quote')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickBtnOutline, { borderColor: '#8B5CF6' }]}
              onPress={() => router.push('/(app)/invoice/new?type=credit_note&mode=manual')}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-circle-outline" size={18} color="#8B5CF6" />
              <Text style={[styles.quickBtnOutlineLabel, { color: '#8B5CF6' }]}>{t('dashboard.creditNote')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Graphique CA 6 mois */}
        <MonthlyChart invoices={invoices} />

        {/* Top 3 clients + taux de recouvrement */}
        <InsightsSection invoices={invoices} />

        {/* Factures récentes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('dashboard.recentDocs')}</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/invoices')}>
              <Text style={styles.seeAll}>{t('common.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          {recentInvoices.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>{t('dashboard.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('dashboard.emptyText')}</Text>
            </View>
          ) : (
            recentInvoices.map((inv) => <InvoiceCard key={inv.id} invoice={inv} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Graphique avancé avec sélecteur de période et tooltip
function MonthlyChart({ invoices }: { invoices: any[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR';
  const { format: formatCurrency } = useCurrency();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [period, setPeriod] = React.useState<1 | 3 | 6 | 12>(6);
  const [tooltip, setTooltip] = React.useState<{ paid: number; pending: number; label: string } | null>(null);

  const PERIODS: Array<{ value: 1 | 3 | 6 | 12; label: string }> = [
    { value: 1, label: '1M' },
    { value: 3, label: '3M' },
    { value: 6, label: '6M' },
    { value: 12, label: '12M' },
  ];

  const months = Array.from({ length: period }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (period - 1 - i));
    return {
      month: d.toLocaleString(locale, { month: 'short' }),
      paid: 0,
      pending: 0,
    };
  });

  invoices
    .filter((inv) => inv.document_type === 'invoice' || !inv.document_type)
    .forEach((inv) => {
      const refDate = inv.paid_at || inv.issue_date || inv.created_at;
      if (!refDate) return;
      const d = new Date(refDate);
      const now = new Date();
      const monthDiff =
        (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (monthDiff < 0 || monthDiff >= period) return;
      const idx = period - 1 - monthDiff;
      if (inv.status === 'paid') {
        months[idx].paid += inv.total;
      } else if (inv.status === 'sent' || inv.status === 'overdue' || inv.status === 'draft') {
        months[idx].pending += inv.total;
      }
    });

  const totalPaid = months.reduce((s, m) => s + m.paid, 0);
  const totalPending = months.reduce((s, m) => s + m.pending, 0);
  const accentWarn = Colors.warning || '#EF9F27';

  const barData: any[] = [];
  months.forEach((m, idx) => {
    barData.push({
      value: m.paid,
      frontColor: Colors.primary,
      spacing: 4,
      label: period <= 6 ? m.month.slice(0, 3) : (idx % 2 === 0 ? m.month.slice(0, 3) : ''),
      labelTextStyle: { color: Colors.textSecondary, fontSize: 10 },
      onPress: () => setTooltip({ paid: m.paid, pending: m.pending, label: m.month }),
    });
    barData.push({
      value: m.pending,
      frontColor: accentWarn,
      spacing: period <= 3 ? 20 : period <= 6 ? 14 : 8,
      onPress: () => setTooltip({ paid: m.paid, pending: m.pending, label: m.month }),
    });
  });
  if (barData.length > 0) barData[barData.length - 1].spacing = 0;

  const screenWidth = Dimensions.get('window').width;
  const barW = period <= 3 ? 20 : period <= 6 ? 14 : 10;

  const renderChart = (expanded: boolean) => (
    <View style={expanded ? styles.expandedChartContainer : styles.chartContainer}>
      {expanded && (
        <TouchableOpacity style={styles.closeExpandedBtn} onPress={() => setIsExpanded(false)}>
          <Ionicons name="close-circle-outline" size={32} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}
      {expanded && (
        <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>{t('dashboard.monthlyChart')}</Text>
      )}

      {/* Sélecteur de période */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[
              styles.periodBtn,
              period === p.value && { backgroundColor: Colors.primary, borderColor: Colors.primary },
            ]}
            onPress={() => { setPeriod(p.value); setTooltip(null); }}
          >
            <Text style={[styles.periodBtnText, period === p.value && { color: '#fff' }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Légende + totaux */}
      <View style={{ flexDirection: 'row', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: Colors.primary }} />
          <Text style={{ fontSize: 12, color: Colors.textSecondary, fontWeight: '500' }}>
            Payé · {formatCurrency(totalPaid)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: accentWarn }} />
          <Text style={{ fontSize: 12, color: Colors.textSecondary, fontWeight: '500' }}>
            En attente · {formatCurrency(totalPending)}
          </Text>
        </View>
      </View>

      {/* Tooltip */}
      {tooltip && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{tooltip.label}</Text>
          <Text style={styles.tooltipPaid}>✓ Payé : {formatCurrency(tooltip.paid)}</Text>
          <Text style={styles.tooltipPending}>⏳ En attente : {formatCurrency(tooltip.pending)}</Text>
          <TouchableOpacity onPress={() => setTooltip(null)} style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 10, color: Colors.textTertiary, textAlign: 'center' }}>Fermer ×</Text>
          </TouchableOpacity>
        </View>
      )}

      <BarChart
        data={barData}
        barWidth={expanded ? barW + 4 : barW}
        roundedTop
        roundedBottom
        hideRules={false}
        rulesColor={Colors.border}
        rulesType="dashed"
        xAxisThickness={0}
        yAxisThickness={0}
        yAxisTextStyle={{ color: Colors.textTertiary, fontSize: 10 }}
        noOfSections={4}
        width={expanded ? screenWidth - 80 : screenWidth - 120}
        height={expanded ? 280 : 150}
        isAnimated
        animationDuration={400}
        formatYLabel={(label: string) => {
          const val = parseInt(label);
          return val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`;
        }}
      />
    </View>
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('dashboard.monthlyChart')}</Text>
        <TouchableOpacity onPress={() => setIsExpanded(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="expand-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {renderChart(false)}

      <Modal visible={isExpanded} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsExpanded(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface, padding: 20 }}>
          {renderChart(true)}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ── Section Insights : Top 3 clients + taux de recouvrement ─────────────────
function InsightsSection({ invoices }: { invoices: any[] }) {
  const router = useRouter();
  const { format: formatCurrency } = useCurrency();

  // Top 3 clients par CA encaissé
  const clientMap: Record<string, { name: string; id: string; paid: number; count: number }> = {};
  invoices
    .filter((inv) => inv.status === 'paid' && inv.document_type === 'invoice')
    .forEach((inv) => {
      const name = inv.client?.name || inv.client_name_override || 'Sans nom';
      const id = inv.client_id || name;
      if (!clientMap[id]) clientMap[id] = { name, id: inv.client_id || '', paid: 0, count: 0 };
      clientMap[id].paid += inv.total;
      clientMap[id].count += 1;
    });
  const topClients = Object.values(clientMap)
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 3);
  const maxPaid = topClients[0]?.paid || 1;

  // Taux de recouvrement
  const totalPaid = invoices
    .filter((inv) => inv.status === 'paid' && inv.document_type === 'invoice')
    .reduce((s, inv) => s + inv.total, 0);
  const totalOverdue = invoices
    .filter((inv) => inv.status === 'overdue')
    .reduce((s, inv) => s + inv.total, 0);
  const recoveryRate = totalPaid + totalOverdue > 0
    ? Math.round((totalPaid / (totalPaid + totalOverdue)) * 100)
    : 100;

  if (topClients.length === 0) return null;

  const COLORS = [Colors.primary, '#3B82F6', '#8B5CF6'];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Insights</Text>
      </View>

      {/* Taux de recouvrement */}
      <View style={insightStyles.recCard}>
        <View style={insightStyles.recHeader}>
          <View>
            <Text style={insightStyles.recLabel}>Taux de recouvrement</Text>
            <Text style={insightStyles.recSub}>Factures payées vs impayées</Text>
          </View>
          <Text style={[insightStyles.recRate, { color: recoveryRate >= 80 ? Colors.primary : Colors.warning }]}>
            {recoveryRate}%
          </Text>
        </View>
        <View style={insightStyles.progressTrack}>
          <View style={[insightStyles.progressFill, {
            width: `${recoveryRate}%` as any,
            backgroundColor: recoveryRate >= 80 ? Colors.primary : Colors.warning,
          }]} />
        </View>
      </View>

      {/* Top clients */}
      <View style={insightStyles.topCard}>
        <Text style={insightStyles.topTitle}>Top clients</Text>
        {topClients.map((c, i) => (
          <TouchableOpacity
            key={c.id || c.name}
            style={insightStyles.topRow}
            onPress={() => c.id && router.push(`/(app)/client/${c.id}`)}
            activeOpacity={0.7}
          >
            <View style={[insightStyles.topRank, { backgroundColor: COLORS[i] + '20' }]}>
              <Text style={[insightStyles.topRankText, { color: COLORS[i] }]}>#{i + 1}</Text>
            </View>
            <View style={insightStyles.topInfo}>
              <Text style={insightStyles.topName} numberOfLines={1}>{c.name}</Text>
              <View style={insightStyles.topBarTrack}>
                <View style={[insightStyles.topBarFill, {
                  width: `${(c.paid / maxPaid) * 100}%` as any,
                  backgroundColor: COLORS[i],
                }]} />
              </View>
            </View>
            <View style={insightStyles.topAmounts}>
              <Text style={[insightStyles.topAmt, { color: COLORS[i] }]}>{formatCurrency(c.paid)}</Text>
              <Text style={insightStyles.topCount}>{c.count} fact.</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const insightStyles = StyleSheet.create({
  recCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  recSub: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  recRate: { fontSize: 32, fontWeight: '800' },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4 },

  topCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  topTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topRank: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRankText: { fontSize: FontSize.xs, fontWeight: '800' },
  topInfo: { flex: 1, gap: 4 },
  topName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  topBarTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  topBarFill: { height: 4, borderRadius: 2 },
  topAmounts: { alignItems: 'flex-end', gap: 2 },
  topAmt: { fontSize: FontSize.sm, fontWeight: '700' },
  topCount: { fontSize: FontSize.xs, color: Colors.textTertiary },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  scroll: { paddingBottom: Spacing.xxl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
  },
  greeting: { fontSize: FontSize.md, color: Colors.textSecondary },
  companyName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },

  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  statCardPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  statCardDanger: { backgroundColor: Colors.dangerLight, borderColor: Colors.danger },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },
  statLabelLight: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  statLabelDanger: { color: Colors.danger },
  statValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  statValueLight: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },
  statValueDanger: { color: Colors.danger },
  statSub: { fontSize: FontSize.xs, color: Colors.textTertiary },

  quickSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: 10,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  quickGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: Radius.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  quickBtnLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },
  quickBtnOutline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    backgroundColor: Colors.white,
  },
  quickBtnOutlineLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  quickSub: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center' },

  section: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  seeAll: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },

  chartContainer: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
    paddingTop: Spacing.lg,
  },
  expandedChartContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingTop: Spacing.xxl + 20, // Leave space for close button
    alignItems: 'center',
  },
  closeExpandedBtn: {
    position: 'absolute',
    top: 20,
    right: 0,
    zIndex: 10,
    padding: 10,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  periodBtnText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tooltip: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  tooltipTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  tooltipPaid: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  tooltipPending: { fontSize: FontSize.sm, color: Colors.warning || '#EF9F27', fontWeight: '600' },
});

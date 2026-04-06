import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useDataStore } from '../../../stores/dataStore';
import { useAuthStore } from '../../../stores/authStore';
import { useSubscription } from '../../../hooks/useSubscription';
import { useCurrency } from '../../../hooks/useCurrency';
import InvoiceCard from '../../../components/InvoiceCard';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { InvoiceStatus, DocumentType } from '../../../types';
import { generateAndShareAnnualReport } from '../../../lib/pdf';
import { Modal, ScrollView as RNScrollView } from 'react-native';

type StatusFilter = 'all' | InvoiceStatus;

export default function Documents() {
  const router = useRouter();
  const { invoices, clients, fetchInvoices, deleteInvoice } = useDataStore();
  const { profile } = useAuthStore();
  const sub = useSubscription();
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();

  const DOC_TYPES: Array<{
    key: DocumentType;
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    color: string;
    emptyText: string;
    newLabel: string;
  }> = [
    {
      key: 'invoice',
      label: t('invoices.invoices'),
      icon: 'document-text-outline',
      color: Colors.primary,
      emptyText: t('invoices.emptyInvoiceText'),
      newLabel: `+ ${t('invoices.invoice_singular')}`,
    },
    {
      key: 'quote',
      label: t('invoices.quotes'),
      icon: 'clipboard-outline',
      color: '#3B82F6',
      emptyText: t('invoices.emptyQuoteText'),
      newLabel: `+ ${t('invoices.quote_singular')}`,
    },
    {
      key: 'credit_note',
      label: t('invoices.creditNotes'),
      icon: 'refresh-circle-outline',
      color: '#8B5CF6',
      emptyText: t('invoices.emptyCreditText'),
      newLabel: `+ ${t('invoices.creditNote_singular')}`,
    },
  ];

  const INVOICE_FILTERS: Array<{ key: StatusFilter; label: string }> = [
    { key: 'all', label: t('invoices.filters.all') },
    { key: 'draft', label: t('invoices.filters.drafts') },
    { key: 'sent', label: t('invoices.filters.sent') },
    { key: 'paid', label: t('invoices.filters.paid') },
    { key: 'overdue', label: t('invoices.filters.overdue') },
  ];

  const QUOTE_FILTERS: Array<{ key: StatusFilter; label: string }> = [
    { key: 'all', label: t('invoices.filters.all') },
    { key: 'draft', label: t('invoices.filters.drafts') },
    { key: 'sent', label: t('invoices.filters.sent') },
    { key: 'accepted', label: t('invoices.filters.accepted') },
    { key: 'refused', label: t('invoices.filters.refused') },
  ];

  const CREDIT_FILTERS: Array<{ key: StatusFilter; label: string }> = [
    { key: 'all', label: t('invoices.filters.all') },
    { key: 'draft', label: t('invoices.filters.drafts') },
    { key: 'sent', label: t('invoices.filters.sent') },
  ];

  const [docType, setDocType] = useState<DocumentType>('invoice');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [showClientPicker, setShowClientPicker] = useState(false);

  const activeDoc = DOC_TYPES.find((d) => d.key === docType)!;
  const accentColor = activeDoc.color;

  const filters =
    docType === 'quote' ? QUOTE_FILTERS
    : docType === 'credit_note' ? CREDIT_FILTERS
    : INVOICE_FILTERS;

  const handleDocTypeChange = (type: DocumentType) => {
    setDocType(type);
    setStatusFilter('all');
    setSearch('');
    setClientFilter('all');
    setMonthFilter('all');
  };

  // Mois disponibles (6 derniers)
  const monthOptions = useMemo(() => {
    const opts: Array<{ key: string; label: string }> = [{ key: 'all', label: 'Tous les mois' }];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
      opts.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return opts;
  }, []);

  const filtered = useMemo(() => {
    let list = invoices.filter((inv) => (inv.document_type || 'invoice') === docType);
    if (statusFilter !== 'all') list = list.filter((inv) => inv.status === statusFilter);
    if (clientFilter !== 'all') list = list.filter((inv) => inv.client_id === clientFilter);
    if (monthFilter !== 'all') {
      list = list.filter((inv) => {
        const ref = inv.issue_date || inv.created_at;
        return ref && ref.startsWith(monthFilter);
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.number.toLowerCase().includes(q) ||
          inv.client?.name?.toLowerCase().includes(q) ||
          inv.client_name_override?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [invoices, docType, statusFilter, clientFilter, monthFilter, search]);

  const activeFiltersCount = (clientFilter !== 'all' ? 1 : 0) + (monthFilter !== 'all' ? 1 : 0);
  const selectedClient = clients.find((c) => c.id === clientFilter);

  const totalFiltered = filtered.reduce((sum, inv) => sum + inv.total, 0);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInvoices();
    setRefreshing(false);
  };

  const handleDelete = (id: string, number: string) => {
    Alert.alert(
      t('invoices.deleteConfirm'),
      t('invoices.deleteConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('invoices.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            try { await deleteInvoice(id); } catch (err: any) { Alert.alert(t('common.error'), err.message); }
          },
        },
      ]
    );
  };

  const handleNew = () => {
    // Vérification limite mensuelle plan gratuit
    if (sub.isFree) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const isNewMonth = (profile?.invoice_month || '') !== currentMonth;
      const monthlyUsed = isNewMonth ? 0 : (profile?.monthly_invoice_count || 0);
      if (monthlyUsed >= sub.maxInvoices) {
        router.push('/(app)/paywall');
        return;
      }
    }
    // Choix : voix ou saisie manuelle
    Alert.alert(
      t('invoices.newDocumentTitle'),
      t('invoices.newDocumentMsg'),
      [
        {
          text: t('invoices.voiceMode'),
          onPress: () => router.push(`/(app)/invoice/new?type=${docType}`),
        },
        {
          text: t('invoices.manualMode'),
          onPress: () => router.push(`/(app)/invoice/new?type=${docType}&mode=manual`),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const handleExportCsv = async () => {
    if (!sub.canExportCsv) { router.push('/(app)/paywall'); return; }
    if (filtered.length === 0) {
      Alert.alert(t('common.error'), t('invoices.exportEmpty'));
      return;
    }
    setExporting(true);
    try {
      const header = 'Numéro;Type;Client;Statut;Date émission;Échéance;HT;TVA;TTC;Mode paiement;Lien paiement;N° TVA client;Mois;Trimestre\n';
      const rows = filtered.map((inv) => {
        const client = inv.client?.name || inv.client_name_override || '';
        const issueDate = inv.issue_date || '';
        const month = issueDate ? issueDate.slice(0, 7) : '';
        const quarter = issueDate ? `T${Math.ceil(parseInt(issueDate.slice(5, 7)) / 3)}-${issueDate.slice(0, 4)}` : '';
        return [
          inv.number, inv.document_type, client, inv.status,
          issueDate, inv.due_date || '',
          inv.subtotal.toFixed(2).replace('.', ','),
          inv.vat_amount.toFixed(2).replace('.', ','),
          inv.total.toFixed(2).replace('.', ','),
          inv.payment_method || '',
          inv.stripe_payment_url || '',
          inv.client?.vat_number || '',
          month, quarter,
        ].join(';');
      }).join('\n');
      const fileUri = `${FileSystem.documentDirectory}export_${docType}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, header + rows, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Exporter CSV' });
    } catch (err: any) {
      if (!err.message?.includes('cancel') && !err.message?.includes('dismiss')) {
        Alert.alert('Erreur export', err.message);
      }
    } finally { setExporting(false); }
  };

  const handleExportFec = async () => {
    if (!sub.canExportCsv) { router.push('/(app)/paywall'); return; }
    const paidInvoices = invoices.filter(inv => inv.status === 'paid' && inv.document_type === 'invoice');
    if (paidInvoices.length === 0) {
      Alert.alert(t('common.error'), t('invoices.exportFecEmpty'));
      return;
    }
    setExporting(true);
    try {
      const sirenNum = (profile?.siret || '000000000').slice(0, 9);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const header = 'JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLettre|DateLettre|ValidDate|Montantdevise|Idevise\n';
      let lines = '';
      for (const inv of paidInvoices) {
        const dateNum = (inv.paid_at || inv.issue_date || '').replace(/-/g, '').slice(0, 8);
        const clientName = inv.client?.name || inv.client_name_override || 'Client';
        const clientNum = '411' + clientName.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(6, '0');
        lines += `VT|Ventes|${inv.number}|${dateNum}|${clientNum}|${clientName}|||${inv.number}|${dateNum}|Facture ${inv.number}|${inv.total.toFixed(2)}|0.00||||${inv.total.toFixed(2)}|EUR\n`;
        lines += `VT|Ventes|${inv.number}|${dateNum}|706000|Prestations de services|||${inv.number}|${dateNum}|Facture ${inv.number}|0.00|${inv.subtotal.toFixed(2)}||||${inv.subtotal.toFixed(2)}|EUR\n`;
        if (inv.vat_amount > 0) {
          lines += `VT|Ventes|${inv.number}|${dateNum}|445710|TVA collectée|||${inv.number}|${dateNum}|TVA ${inv.number}|0.00|${inv.vat_amount.toFixed(2)}||||${inv.vat_amount.toFixed(2)}|EUR\n`;
        }
      }
      const path = `${FileSystem.cacheDirectory}${sirenNum}_${dateStr}_FEC.txt`;
      await FileSystem.writeAsStringAsync(path, header + lines, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle: 'Exporter FEC' });
    } catch (err: any) {
      if (!err.message?.includes('cancel') && !err.message?.includes('dismiss')) {
        Alert.alert('Erreur export FEC', err.message);
      }
    } finally { setExporting(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('invoices.title')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/(app)/recurring')}
            style={[styles.iconBtn, { borderColor: Colors.border }]}
          >
            <Ionicons name="repeat-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert(
              t('invoices.exportFormat'),
              t('invoices.exportChoose'),
              [
                { text: 'CSV', onPress: handleExportCsv },
                { text: 'FEC (comptable)', onPress: handleExportFec },
                {
                  text: `Bilan ${new Date().getFullYear()}`,
                  onPress: async () => {
                    try {
                      await generateAndShareAnnualReport(invoices, profile as any);
                    } catch (err: any) {
                      Alert.alert('Erreur', err.message);
                    }
                  },
                },
                { text: t('common.cancel'), style: 'cancel' },
              ]
            )}
            style={[styles.iconBtn, { borderColor: sub.canExportCsv ? accentColor : Colors.border }]}
            disabled={exporting}
          >
            <Ionicons
              name={sub.canExportCsv ? 'download-outline' : 'lock-closed-outline'}
              size={18}
              color={sub.canExportCsv ? accentColor : Colors.textTertiary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNew} style={[styles.newBtn, { backgroundColor: accentColor }]}>
            <Text style={styles.newBtnText}>{activeDoc.newLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Onglets document ── */}
      <View style={styles.docTabs}>
        {DOC_TYPES.map((dt) => {
          const active = docType === dt.key;
          const count = invoices.filter((inv) => (inv.document_type || 'invoice') === dt.key).length;
          return (
            <TouchableOpacity
              key={dt.key}
              onPress={() => handleDocTypeChange(dt.key)}
              style={[styles.docTab, active && { borderBottomColor: dt.color }]}
            >
              <Ionicons name={dt.icon} size={15} color={active ? dt.color : Colors.textTertiary} />
              <Text style={[styles.docTabLabel, active && { color: dt.color, fontWeight: '700' }]}>
                {dt.label}
              </Text>
              {count > 0 && (
                <View style={[styles.countBadge, active && { backgroundColor: dt.color }]}>
                  <Text style={[styles.countBadgeText, active && { color: '#fff' }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Recherche ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={15} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('invoices.searchPlaceholder')}
          placeholderTextColor={Colors.textTertiary}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filtres statut ── */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={filters}
        keyExtractor={(f) => f.key}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setStatusFilter(item.key)}
            style={[
              styles.filterChip,
              statusFilter === item.key && { backgroundColor: accentColor + '1A', borderColor: accentColor },
            ]}
          >
            <Text style={[
              styles.filterChipText,
              statusFilter === item.key && { color: accentColor, fontWeight: '700' },
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Filtres avancés : client + mois ── */}
      <View style={styles.advFiltersRow}>
        {/* Filtre client */}
        <TouchableOpacity
          style={[styles.advFilterBtn, clientFilter !== 'all' && { borderColor: accentColor, backgroundColor: accentColor + '12' }]}
          onPress={() => setShowClientPicker(true)}
        >
          <Ionicons name="person-outline" size={13} color={clientFilter !== 'all' ? accentColor : Colors.textSecondary} />
          <Text style={[styles.advFilterText, clientFilter !== 'all' && { color: accentColor, fontWeight: '700' }]} numberOfLines={1}>
            {selectedClient ? selectedClient.name : 'Client'}
          </Text>
          {clientFilter !== 'all' && (
            <TouchableOpacity onPress={() => setClientFilter('all')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={14} color={accentColor} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Filtre mois */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={monthOptions}
          keyExtractor={(m) => m.key}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 6, paddingLeft: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setMonthFilter(item.key)}
              style={[styles.advFilterBtn, monthFilter === item.key && { borderColor: accentColor, backgroundColor: accentColor + '12' }]}
            >
              <Text style={[styles.advFilterText, monthFilter === item.key && { color: accentColor, fontWeight: '700' }]}>
                {item.key === 'all' ? 'Tous' : item.label.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Modal client picker */}
      <Modal visible={showClientPicker} transparent animationType="slide" onRequestClose={() => setShowClientPicker(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowClientPicker(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Filtrer par client</Text>
          <RNScrollView>
            {[{ id: 'all', name: 'Tous les clients' }, ...clients].map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.modalRow, clientFilter === c.id && { backgroundColor: accentColor + '12' }]}
                onPress={() => { setClientFilter(c.id); setShowClientPicker(false); }}
              >
                <Text style={[styles.modalRowText, clientFilter === c.id && { color: accentColor, fontWeight: '700' }]}>{c.name}</Text>
                {clientFilter === c.id && <Ionicons name="checkmark" size={18} color={accentColor} />}
              </TouchableOpacity>
            ))}
          </RNScrollView>
        </View>
      </Modal>

      {/* ── Compteur ── */}
      {filtered.length > 0 && (
        <View style={styles.totalBar}>
          <Text style={styles.totalBarText}>
            {t('invoices.totalFiltered', { count: filtered.length, amount: formatCurrency(totalFiltered) })}
          </Text>
          {activeFiltersCount > 0 && (
            <TouchableOpacity onPress={() => { setClientFilter('all'); setMonthFilter('all'); }}>
              <Text style={[styles.clearFilters, { color: accentColor }]}>Effacer filtres ({activeFiltersCount})</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Liste ── */}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(inv) => inv.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <InvoiceCard
            invoice={item}
            accentColor={accentColor}
            onDelete={() => handleDelete(item.id, item.number)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: accentColor + '18' }]}>
              <Ionicons name={activeDoc.icon} size={40} color={accentColor} />
            </View>
            <Text style={styles.emptyTitle}>
              {search ? t('common.noResults') : t('invoices.empty')}
            </Text>
            <Text style={styles.emptyText}>
              {search
                ? t('invoices.emptyFiltered')
                : activeDoc.emptyText}
            </Text>
            {!search && (
              <TouchableOpacity onPress={handleNew} style={[styles.emptyNewBtn, { backgroundColor: accentColor }]}>
                <Text style={styles.emptyNewBtnText}>{activeDoc.newLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.white,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  newBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },

  docTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  docTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  docTabLabel: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  countBadge: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: Colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },

  filterList: { paddingHorizontal: Spacing.lg, paddingVertical: 8, gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterChipText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },

  advFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 0,
  },
  advFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  advFilterText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500', maxWidth: 90 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    marginBottom: 2,
  },
  modalRowText: { fontSize: FontSize.md, color: Colors.textPrimary },

  totalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 4 },
  totalBarText: { fontSize: FontSize.xs, color: Colors.textTertiary },
  clearFilters: { fontSize: FontSize.xs, fontWeight: '600' },

  list: { padding: Spacing.lg, paddingTop: Spacing.sm },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 14 },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  emptyNewBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  emptyNewBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
});

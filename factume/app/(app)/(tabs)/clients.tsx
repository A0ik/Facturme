import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useDataStore } from '../../../stores/dataStore';
import ClientCard from '../../../components/ClientCard';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../../../hooks/useSubscription';
import { importClientsFromFile, ImportedClient } from '../../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type ImportStep = 'pick' | 'analyzing' | 'review';

interface ReviewClient extends ImportedClient {
  _id: string;
  selected: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const FILE_TYPES = [
  { ext: 'PDF',   icon: 'document-text-outline' as const,  color: '#EF4444', bg: '#FEE2E2' },
  { ext: 'Excel', icon: 'grid-outline' as const,            color: '#10B981', bg: '#D1FAE5' },
  { ext: 'Word',  icon: 'document-outline' as const,        color: '#3B82F6', bg: '#DBEAFE' },
  { ext: 'CSV',   icon: 'list-outline' as const,            color: '#8B5CF6', bg: '#EDE9FE' },
  { ext: 'TXT',   icon: 'create-outline' as const,          color: '#F59E0B', bg: '#FEF3C7' },
];

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/csv',
  'text/plain',
  'text/vcard',
  'text/x-vcard',
  'application/json',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  '*/*',
];

// ─── Composant principal ───────────────────────────────────────────────────────
export default function Clients() {
  const router = useRouter();
  const { clients, fetchClients, createClient } = useDataStore();
  const { t } = useTranslation();
  const sub = useSubscription();

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // États du modal d'import
  const [importVisible, setImportVisible] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>('pick');
  const [reviewClients, setReviewClients] = useState<ReviewClient[]>([]);
  const [importing, setImporting] = useState(false);
  const [analyzedFileName, setAnalyzedFileName] = useState('');

  // ── Liste filtrée ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClients();
    setRefreshing(false);
  };

  // ── Import ────────────────────────────────────────────────────────────────────
  const openImport = () => {
    if (!sub.canImportClients) {
      router.push('/(app)/paywall');
      return;
    }
    setImportStep('pick');
    setReviewClients([]);
    setAnalyzedFileName('');
    setImportVisible(true);
  };

  const closeImport = () => {
    if (importing) return;
    setImportVisible(false);
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setAnalyzedFileName(asset.name);
      setImportStep('analyzing');

      const data = await importClientsFromFile(asset.uri, asset.name, asset.mimeType || undefined);

      if (!data.clients.length) {
        Alert.alert(
          t('clients.import.noClientsTitle'),
          t('clients.import.noClientsMsg'),
          [{ text: t('clients.import.retryBtn'), onPress: () => setImportStep('pick') }]
        );
        return;
      }

      const withSelection: ReviewClient[] = data.clients.map((c, i) => ({
        ...c,
        _id: `${i}-${Date.now()}`,
        selected: true,
      }));
      setReviewClients(withSelection);
      setImportStep('review');
    } catch (err: any) {
      Alert.alert(t('clients.import.errorTitle'), err.message || t('clients.import.errorMsg'));
      setImportStep('pick');
    }
  };

  const toggleClient = useCallback((id: string) => {
    setReviewClients((prev) =>
      prev.map((c) => (c._id === id ? { ...c, selected: !c.selected } : c))
    );
  }, []);

  const toggleAll = () => {
    const allSelected = reviewClients.every((c) => c.selected);
    setReviewClients((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
  };

  const selectedCount = reviewClients.filter((c) => c.selected).length;

  const handleImport = async () => {
    const toImport = reviewClients.filter((c) => c.selected);
    if (!toImport.length) return;

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const client of toImport) {
      try {
        await createClient({
          name: client.name,
          email: client.email || undefined,
          phone: client.phone || undefined,
          siret: client.siret || undefined,
          address: client.address || undefined,
          city: client.city || undefined,
          postal_code: client.postal_code || undefined,
          country: 'France',
          vat_number: client.vat_number || undefined,
          notes: client.notes || undefined,
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setImporting(false);
    setImportVisible(false);

    const msg = errorCount
      ? t('clients.import.doneMsgWithErrors', { count: successCount, errors: errorCount })
      : t('clients.import.doneMsg', { count: successCount });
    Alert.alert(t('clients.import.doneTitle'), msg);
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('clients.title')}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={openImport} style={styles.importBtn}>
            <Ionicons name="cloud-upload-outline" size={15} color={Colors.primary} />
            <Text style={styles.importBtnText}>{t('clients.import.btn')}</Text>
            {sub.isFree && <Ionicons name="lock-closed" size={11} color={Colors.textTertiary} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(app)/client/new')} style={styles.newBtn}>
            <Text style={styles.newBtnText}>+ {t('common.add')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recherche */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('clients.searchPlaceholder')}
          placeholderTextColor={Colors.textTertiary}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Compteur */}
      {clients.length > 0 && (
        <View style={styles.countBar}>
          <Text style={styles.countText}>
            {t('clients.clientCount', { count: filtered.length })}
          </Text>
        </View>
      )}

      {/* Liste */}
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ClientCard client={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>
              {search ? t('common.noResults') : t('clients.empty')}
            </Text>
            <Text style={styles.emptyText}>
              {search
                ? t('clients.emptySearch', { search })
                : t('clients.emptyText')}
            </Text>
            {!search && (
              <TouchableOpacity
                onPress={() => router.push('/(app)/client/new')}
                style={styles.emptyBtn}
              >
                <Text style={styles.emptyBtnText}>+ {t('clients.addFirst')}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* ── Modal d'import ── */}
      <Modal visible={importVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>

          {/* Header modal */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeImport} style={styles.modalCloseBtn} disabled={importing}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('clients.import.modalTitle')}</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* ── Step 1 : Sélection fichier ── */}
          {importStep === 'pick' && (
            <ScrollView contentContainerStyle={styles.pickContainer}>

              {/* Illustration */}
              <View style={styles.pickIllustration}>
                <View style={styles.pickIconCircle}>
                  <Ionicons name="cloud-upload-outline" size={40} color={Colors.primary} />
                </View>
              </View>

              <Text style={styles.pickTitle}>{t('clients.import.pickTitle')}</Text>
              <Text style={styles.pickSubtitle}>{t('clients.import.pickSubtitle')}</Text>

              {/* Formats supportés */}
              <View style={styles.formatsSection}>
                <Text style={styles.formatsLabel}>{t('clients.import.formatsLabel')}</Text>
                <View style={styles.formatsGrid}>
                  {FILE_TYPES.map((ft) => (
                    <View key={ft.ext} style={[styles.formatChip, { backgroundColor: ft.bg }]}>
                      <Ionicons name={ft.icon} size={16} color={ft.color} />
                      <Text style={[styles.formatChipText, { color: ft.color }]}>{ft.ext}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Info plan */}
              <View style={styles.planBadge}>
                <Ionicons name="sparkles" size={14} color={Colors.primary} />
                <Text style={styles.planBadgeText}>
                  {sub.isPro ? t('clients.import.planBadgePro') : t('clients.import.planBadgeSolo')}
                </Text>
              </View>

              {/* CTA */}
              <TouchableOpacity onPress={handlePickFile} style={styles.pickBtn}>
                <Ionicons name="folder-open-outline" size={20} color="#fff" />
                <Text style={styles.pickBtnText}>{t('clients.import.chooseFileBtn')}</Text>
              </TouchableOpacity>

              <Text style={styles.pickHint}>{t('clients.import.privacyHint')}</Text>
            </ScrollView>
          )}

          {/* ── Step 2 : Analyse en cours ── */}
          {importStep === 'analyzing' && (
            <View style={styles.analyzingContainer}>
              <View style={styles.analyzingCard}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.analyzingTitle}>{t('clients.import.analyzingTitle')}</Text>
                <Text style={styles.analyzingFile} numberOfLines={1}>{analyzedFileName}</Text>
                <Text style={styles.analyzingSubtitle}>{t('clients.import.analyzingSubtitle')}</Text>
                <View style={styles.analyzingSteps}>
                  {[t('clients.import.steps.read'), t('clients.import.steps.extract'), t('clients.import.steps.identify'), t('clients.import.steps.structure')].map((s, i) => (
                    <View key={i} style={styles.analyzingStepRow}>
                      <ActivityIndicator size="small" color={Colors.primary} style={{ opacity: 0.6 }} />
                      <Text style={styles.analyzingStepText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ── Step 3 : Révision et sélection ── */}
          {importStep === 'review' && (
            <View style={{ flex: 1 }}>

              {/* Barre de résumé */}
              <View style={styles.reviewSummary}>
                <View style={styles.reviewSummaryLeft}>
                  <View style={styles.reviewCountBadge}>
                    <Text style={styles.reviewCountBadgeText}>{reviewClients.length}</Text>
                  </View>
                  <View>
                    <Text style={styles.reviewSummaryTitle}>
                      {reviewClients.length === 1
                        ? t('clients.import.clientFound_one')
                        : t('clients.import.clientFound_other', { count: reviewClients.length })}
                    </Text>
                    <Text style={styles.reviewSummaryFile} numberOfLines={1}>{analyzedFileName}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={toggleAll} style={styles.toggleAllBtn}>
                  <Text style={styles.toggleAllText}>
                    {reviewClients.every((c) => c.selected)
                      ? t('clients.import.deselectAll')
                      : t('clients.import.selectAll')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Liste clients */}
              <FlatList
                data={reviewClients}
                keyExtractor={(c) => c._id}
                contentContainerStyle={styles.reviewList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.reviewCard, item.selected && styles.reviewCardSelected]}
                    onPress={() => toggleClient(item._id)}
                    activeOpacity={0.8}
                  >
                    {/* Checkbox */}
                    <View style={[styles.checkbox, item.selected && styles.checkboxChecked]}>
                      {item.selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>

                    {/* Avatar */}
                    <View style={[styles.reviewAvatar, item.selected && { backgroundColor: Colors.primaryLight }]}>
                      <Text style={[styles.reviewAvatarText, item.selected && { color: Colors.primary }]}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    {/* Infos */}
                    <View style={styles.reviewInfo}>
                      <Text style={styles.reviewName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.reviewMeta}>
                        {item.email && (
                          <View style={styles.reviewMetaChip}>
                            <Ionicons name="mail-outline" size={11} color={Colors.textTertiary} />
                            <Text style={styles.reviewMetaText} numberOfLines={1}>{item.email}</Text>
                          </View>
                        )}
                        {item.phone && (
                          <View style={styles.reviewMetaChip}>
                            <Ionicons name="call-outline" size={11} color={Colors.textTertiary} />
                            <Text style={styles.reviewMetaText}>{item.phone}</Text>
                          </View>
                        )}
                        {item.siret && (
                          <View style={styles.reviewMetaChip}>
                            <Ionicons name="business-outline" size={11} color={Colors.textTertiary} />
                            <Text style={styles.reviewMetaText}>SIRET {item.siret}</Text>
                          </View>
                        )}
                        {item.city && (
                          <View style={styles.reviewMetaChip}>
                            <Ionicons name="location-outline" size={11} color={Colors.textTertiary} />
                            <Text style={styles.reviewMetaText}>{item.city}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />

              {/* Footer CTA */}
              <View style={styles.reviewFooter}>
                <TouchableOpacity
                  onPress={() => setImportStep('pick')}
                  style={styles.reviewBackBtn}
                >
                  <Ionicons name="arrow-back-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.reviewBackText}>{t('clients.import.otherFile')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleImport}
                  disabled={selectedCount === 0 || importing}
                  style={[
                    styles.reviewImportBtn,
                    (selectedCount === 0 || importing) && styles.reviewImportBtnDisabled,
                  ]}
                >
                  {importing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={18} color="#fff" />
                  )}
                  <Text style={styles.reviewImportBtnText}>
                    {importing
                      ? t('clients.import.importing')
                      : selectedCount === 0
                      ? t('clients.import.selectClients')
                      : selectedCount > 1
                      ? t('clients.import.importBtnPlural', { count: selectedCount })
                      : t('clients.import.importBtn', { count: selectedCount })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },

  // Header
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
  headerButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  importBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },

  newBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  newBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  clearSearch: { fontSize: 16, color: Colors.textTertiary, padding: 4 },
  countBar: { paddingHorizontal: Spacing.lg, paddingVertical: 8 },
  countText: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },

  // List
  list: { padding: Spacing.lg, paddingTop: Spacing.sm },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.full,
    marginTop: 8,
  },
  emptyBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalSafe: { flex: 1, backgroundColor: Colors.white },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },

  // ── Step 1 : Pick ─────────────────────────────────────────────────────────
  pickContainer: {
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.lg,
    paddingBottom: 60,
  },
  pickIllustration: { marginTop: Spacing.lg },
  pickIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '30',
  },
  pickTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  pickSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  formatsSection: { width: '100%', gap: 12 },
  formatsLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  formatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  formatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  formatChipText: { fontSize: FontSize.sm, fontWeight: '700' },

  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
  },
  planBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },

  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: Radius.full,
    width: '100%',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  pickBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  pickHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    maxWidth: 280,
  },

  // ── Step 2 : Analyzing ────────────────────────────────────────────────────
  analyzingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  analyzingCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  analyzingTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  analyzingFile: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
    maxWidth: 260,
  },
  analyzingSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  analyzingSteps: { width: '100%', gap: 10, marginTop: 4 },
  analyzingStepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analyzingStepText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // ── Step 3 : Review ───────────────────────────────────────────────────────
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reviewSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewCountBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCountBadgeText: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  reviewSummaryTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  reviewSummaryFile: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    maxWidth: 160,
  },
  toggleAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleAllText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },

  reviewList: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 120 },

  reviewCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  reviewCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '60',
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reviewAvatarText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textSecondary },

  reviewInfo: { flex: 1, gap: 4 },
  reviewName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  reviewMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  reviewMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reviewMetaText: { fontSize: FontSize.xs, color: Colors.textTertiary, maxWidth: 140 },

  // Footer
  reviewFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingBottom: 32,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  reviewBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  reviewBackText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  reviewImportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  reviewImportBtnDisabled: {
    backgroundColor: Colors.gray300,
    shadowOpacity: 0,
    elevation: 0,
  },
  reviewImportBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
});

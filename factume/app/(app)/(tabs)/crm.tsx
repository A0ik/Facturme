import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCrmStore, OpportunityStage, Opportunity, OpportunityInput } from '../../../stores/crmStore';
import { useDataStore } from '../../../stores/dataStore';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';

// ─── Config des étapes ────────────────────────────────────────────────────────
const STAGES: { id: OpportunityStage; label: string; color: string; bg: string; icon: string }[] = [
  { id: 'prospect',    label: 'Prospect',     color: '#6B7280', bg: '#F3F4F6', icon: 'eye-outline' },
  { id: 'qualified',   label: 'Qualifié',     color: '#3B82F6', bg: '#DBEAFE', icon: 'checkmark-circle-outline' },
  { id: 'proposal',    label: 'Proposition',  color: '#F59E0B', bg: '#FEF3C7', icon: 'document-text-outline' },
  { id: 'negotiation', label: 'Négociation',  color: '#EF9F27', bg: '#FEF3DC', icon: 'swap-horizontal-outline' },
  { id: 'won',         label: 'Gagné',        color: '#10B981', bg: '#D1FAE5', icon: 'trophy-outline' },
  { id: 'lost',        label: 'Perdu',        color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle-outline' },
];

const DEFAULT_PROBABILITIES: Record<OpportunityStage, number> = {
  prospect: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0,
};

function getStage(id: OpportunityStage) {
  return STAGES.find((s) => s.id === id) || STAGES[0];
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function formatDate(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Formulaire vide ──────────────────────────────────────────────────────────
const EMPTY_FORM: OpportunityInput = {
  title: '',
  client_name: '',
  client_id: null,
  value: 0,
  stage: 'prospect',
  probability: 10,
  expected_close_date: null,
  notes: null,
};

// ─── Composant carte opportunité ─────────────────────────────────────────────
function OpportunityCard({
  item,
  onPress,
  onDelete,
}: {
  item: Opportunity;
  onPress: () => void;
  onDelete: () => void;
}) {
  const stage = getStage(item.stage);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.82} onPress={onPress}>
      {/* Barre colorée gauche */}
      <View style={[styles.cardBar, { backgroundColor: stage.color }]} />

      <View style={styles.cardContent}>
        {/* Ligne 1: titre + valeur */}
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.cardValue, { color: item.stage === 'won' ? Colors.success : item.stage === 'lost' ? Colors.danger : Colors.textPrimary }]}>
            {formatCurrency(item.value)}
          </Text>
        </View>

        {/* Ligne 2: client */}
        <View style={styles.cardMeta}>
          <Ionicons name="person-outline" size={12} color={Colors.textTertiary} />
          <Text style={styles.cardMetaText} numberOfLines={1}>{item.client_name || 'Sans client'}</Text>
        </View>

        {/* Ligne 3: stage + probabilité + date */}
        <View style={styles.cardFooter}>
          <View style={[styles.stagePill, { backgroundColor: stage.bg }]}>
            <View style={[styles.stageDot, { backgroundColor: stage.color }]} />
            <Text style={[styles.stagePillText, { color: stage.color }]}>{stage.label}</Text>
          </View>

          <View style={styles.probBadge}>
            <Text style={styles.probText}>{item.probability}%</Text>
          </View>

          {item.expected_close_date && (
            <View style={styles.dateBadge}>
              <Ionicons name="calendar-outline" size={11} color={Colors.textTertiary} />
              <Text style={styles.dateText}>{formatDate(item.expected_close_date)}</Text>
            </View>
          )}
        </View>

        {/* Barre de probabilité */}
        <View style={styles.probBar}>
          <View style={[styles.probBarFill, { width: `${item.probability}%` as any, backgroundColor: stage.color }]} />
        </View>
      </View>

      {/* Bouton supprimer */}
      <TouchableOpacity onPress={onDelete} style={styles.cardDeleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="trash-outline" size={15} color={Colors.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Modal ajout / édition ────────────────────────────────────────────────────
function OpportunityModal({
  visible,
  initial,
  clients,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: OpportunityInput | null;
  clients: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: OpportunityInput) => Promise<void>;
}) {
  const [form, setForm] = useState<OpportunityInput>(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);

  useEffect(() => {
    setForm(initial || EMPTY_FORM);
  }, [visible]);

  const update = (key: keyof OpportunityInput, val: any) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleStageChange = (stage: OpportunityStage) => {
    update('stage', stage);
    update('probability', DEFAULT_PROBABILITIES[stage]);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { Alert.alert('Champ requis', 'Le titre de l\'opportunité est requis.'); return; }
    if (!form.client_name.trim()) { Alert.alert('Champ requis', 'Le nom du client est requis.'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{initial?.title ? 'Modifier' : 'Nouvelle opportunité'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.modalSaveBtn}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.modalSaveText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">

            {/* Titre */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Titre de l'opportunité *</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.title}
                onChangeText={(v) => update('title', v)}
                placeholder="Ex: Refonte site web, Mission conseil..."
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            {/* Client */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Client *</Text>
              <TouchableOpacity
                style={styles.fieldInputRow}
                onPress={() => setShowClientPicker((v) => !v)}
              >
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={form.client_name}
                  onChangeText={(v) => { update('client_name', v); update('client_id', null); }}
                  placeholder="Nom du client ou société"
                  placeholderTextColor={Colors.textTertiary}
                />
                {clients.length > 0 && (
                  <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} style={{ paddingRight: 12 }} />
                )}
              </TouchableOpacity>
              {showClientPicker && clients.length > 0 && (
                <ScrollView
                  style={styles.clientPicker}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {clients.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.clientPickerItem}
                      onPress={() => {
                        update('client_name', c.name);
                        update('client_id', c.id);
                        setShowClientPicker(false);
                      }}
                    >
                      <Ionicons name="person-outline" size={14} color={Colors.primary} />
                      <Text style={styles.clientPickerText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Valeur */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Valeur estimée (€)</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.value > 0 ? String(form.value) : ''}
                onChangeText={(v) => update('value', parseFloat(v.replace(',', '.')) || 0)}
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />
            </View>

            {/* Étape */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Étape</Text>
              <View style={styles.stageGrid}>
                {STAGES.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => handleStageChange(s.id)}
                    style={[
                      styles.stageChip,
                      { borderColor: s.color + '40' },
                      form.stage === s.id && { backgroundColor: s.bg, borderColor: s.color },
                    ]}
                  >
                    <View style={[styles.stageDot, { backgroundColor: s.color }]} />
                    <Text style={[styles.stageChipText, form.stage === s.id && { color: s.color, fontWeight: '700' }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Probabilité */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Probabilité de gain : <Text style={{ color: Colors.primary, fontWeight: '700' }}>{form.probability}%</Text></Text>
              <View style={styles.sliderRow}>
                {[0, 10, 25, 50, 75, 100].map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => update('probability', v)}
                    style={[styles.probBtn, form.probability === v && styles.probBtnActive]}
                  >
                    <Text style={[styles.probBtnText, form.probability === v && styles.probBtnTextActive]}>{v}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date de clôture */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Date de clôture prévue</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.expected_close_date || ''}
                onChangeText={(v) => update('expected_close_date', v || null)}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />
            </View>

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldTextarea]}
                value={form.notes || ''}
                onChangeText={(v) => update('notes', v || null)}
                placeholder="Contexte, remarques, prochaines étapes..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Écran principal CRM ──────────────────────────────────────────────────────
export default function CrmScreen() {
  const { opportunities, loading, fetchOpportunities, createOpportunity, updateOpportunity, deleteOpportunity } = useCrmStore();
  const { clients } = useDataStore();

  const [filterStage, setFilterStage] = useState<OpportunityStage | 'all'>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Opportunity | null>(null);

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOpportunities();
    setRefreshing(false);
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = opportunities.filter((o) => o.stage !== 'won' && o.stage !== 'lost');
    const won = opportunities.filter((o) => o.stage === 'won');
    const total = opportunities.length;
    const pipelineValue = active.reduce((s, o) => s + o.value * (o.probability / 100), 0);
    const wonValue = won.reduce((s, o) => s + o.value, 0);
    const winRate = total > 0 ? Math.round((won.length / total) * 100) : 0;
    return { active: active.length, pipelineValue, wonValue, winRate };
  }, [opportunities]);

  // ── Pipeline par étape ────────────────────────────────────────────────────────
  const stageCounts = useMemo(() => {
    const counts: Partial<Record<OpportunityStage, number>> = {};
    opportunities.forEach((o) => { counts[o.stage] = (counts[o.stage] || 0) + 1; });
    return counts;
  }, [opportunities]);

  // ── Liste filtrée ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = filterStage === 'all' ? opportunities : opportunities.filter((o) => o.stage === filterStage);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) =>
        o.title.toLowerCase().includes(q) || o.client_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [opportunities, filterStage, search]);

  const handleDelete = useCallback((id: string, title: string) => {
    Alert.alert('Supprimer', `Supprimer "${title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteOpportunity(id) },
    ]);
  }, []);

  const handleSave = async (data: OpportunityInput) => {
    if (editTarget) {
      await updateOpportunity(editTarget.id, data);
    } else {
      await createOpportunity(data);
    }
  };

  const openAdd = () => { setEditTarget(null); setModalVisible(true); };
  const openEdit = (opp: Opportunity) => { setEditTarget(opp); setModalVisible(true); };

  const initialForm: OpportunityInput | null = editTarget
    ? {
        title: editTarget.title,
        client_name: editTarget.client_name,
        client_id: editTarget.client_id,
        value: editTarget.value,
        stage: editTarget.stage,
        probability: editTarget.probability,
        expected_close_date: editTarget.expected_close_date,
        notes: editTarget.notes,
      }
    : null;

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>CRM</Text>
          <Text style={styles.headerSub}>{stats.active} opportunité{stats.active !== 1 ? 's' : ''} active{stats.active !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <>
            {/* ── Stats cards ─────────────────────────────────────────────────── */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.statCardPrimary]}>
                <View style={styles.statIconBox}>
                  <Ionicons name="trending-up-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.statValue}>{formatCurrency(stats.pipelineValue)}</Text>
                <Text style={styles.statLabel}>Pipeline pondéré</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: Colors.successLight }]}>
                  <Ionicons name="trophy-outline" size={20} color={Colors.success} />
                </View>
                <Text style={styles.statValue}>{formatCurrency(stats.wonValue)}</Text>
                <Text style={styles.statLabel}>CA gagné</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: Colors.infoLight }]}>
                  <Ionicons name="stats-chart-outline" size={20} color={Colors.info} />
                </View>
                <Text style={styles.statValue}>{stats.winRate}%</Text>
                <Text style={styles.statLabel}>Taux de gain</Text>
              </View>
            </View>

            {/* ── Pipeline mini kanban ─────────────────────────────────────────── */}
            <View style={styles.pipelineSection}>
              <Text style={styles.sectionTitle}>Pipeline</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pipelineScroll}>
                {STAGES.filter((s) => s.id !== 'lost').map((s) => {
                  const count = stageCounts[s.id] || 0;
                  const stageOpps = opportunities.filter((o) => o.stage === s.id);
                  const total = stageOpps.reduce((sum, o) => sum + o.value, 0);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.pipelineCard,
                        filterStage === s.id && { borderColor: s.color, borderWidth: 2 },
                      ]}
                      onPress={() => setFilterStage(filterStage === s.id ? 'all' : s.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.pipelineIconBox, { backgroundColor: s.bg }]}>
                        <Ionicons name={s.icon as any} size={16} color={s.color} />
                      </View>
                      <Text style={[styles.pipelineCount, { color: s.color }]}>{count}</Text>
                      <Text style={styles.pipelineLabel}>{s.label}</Text>
                      {total > 0 && (
                        <Text style={styles.pipelineValue}>{formatCurrency(total)}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Barre de recherche + filtres ─────────────────────────────────── */}
            <View style={styles.searchSection}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Rechercher une opportunité..."
                  placeholderTextColor={Colors.textTertiary}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Filtre actif */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                onPress={() => setFilterStage('all')}
                style={[styles.filterChip, filterStage === 'all' && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, filterStage === 'all' && styles.filterChipTextActive]}>
                  Tous ({opportunities.length})
                </Text>
              </TouchableOpacity>
              {STAGES.map((s) => {
                const count = stageCounts[s.id] || 0;
                if (count === 0 && filterStage !== s.id) return null;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setFilterStage(filterStage === s.id ? 'all' : s.id)}
                    style={[
                      styles.filterChip,
                      filterStage === s.id && { backgroundColor: s.bg, borderColor: s.color },
                    ]}
                  >
                    <View style={[styles.stageDot, { backgroundColor: s.color }]} />
                    <Text style={[styles.filterChipText, filterStage === s.id && { color: s.color, fontWeight: '700' }]}>
                      {s.label} {count > 0 ? `(${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {filtered.length > 0 && (
              <Text style={styles.resultCount}>
                {filtered.length} opportunité{filtered.length !== 1 ? 's' : ''}
                {filterStage !== 'all' ? ` · ${getStage(filterStage as OpportunityStage).label}` : ''}
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <OpportunityCard
            item={item}
            onPress={() => openEdit(item)}
            onDelete={() => handleDelete(item.id, item.title)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="trending-up-outline" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {search || filterStage !== 'all' ? 'Aucun résultat' : 'Votre pipeline est vide'}
              </Text>
              <Text style={styles.emptyText}>
                {search || filterStage !== 'all'
                  ? 'Essayez d\'autres filtres.'
                  : 'Ajoutez votre première opportunité pour commencer à suivre vos affaires.'}
              </Text>
              {!search && filterStage === 'all' && (
                <TouchableOpacity onPress={openAdd} style={styles.emptyBtn}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.emptyBtnText}>Ajouter une opportunité</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
      <OpportunityModal
        visible={modalVisible}
        initial={initialForm}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
      />
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
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },

  listContent: { paddingBottom: 40 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardPrimary: {
    borderColor: Colors.primary + '30',
    backgroundColor: Colors.primaryLight,
  },
  statIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  statLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '500' },

  // Pipeline
  pipelineSection: { paddingTop: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pipelineScroll: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: 4 },
  pipelineCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 12,
    width: 100,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pipelineIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  pipelineCount: { fontSize: FontSize.xl, fontWeight: '800', letterSpacing: -0.5 },
  pipelineLabel: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  pipelineValue: { fontSize: 10, color: Colors.textTertiary, fontWeight: '500', textAlign: 'center' },

  // Search & Filters
  searchSection: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  filterChipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.primary },
  resultCount: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardBar: { width: 4 },
  cardContent: { flex: 1, padding: 14, gap: 6 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  cardValue: { fontSize: FontSize.md, fontWeight: '800', letterSpacing: -0.3 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  stageDot: { width: 6, height: 6, borderRadius: 3 },
  stagePillText: { fontSize: 10, fontWeight: '700' },
  probBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  probText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dateText: { fontSize: 10, color: Colors.textTertiary },
  probBar: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  probBarFill: { height: 3, borderRadius: 2 },
  cardDeleteBtn: { padding: 14, justifyContent: 'flex-start' },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: Spacing.lg, gap: 14 },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: Radius.full,
    marginTop: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },

  // Modal
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
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: Radius.full,
    minWidth: 100,
    alignItems: 'center',
  },
  modalSaveText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  modalScroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },

  // Champs formulaire
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  fieldInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  fieldTextarea: { height: 100, paddingTop: 12 },

  // Client picker
  clientPicker: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    overflow: 'hidden',
    maxHeight: 200,
  },
  clientPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  clientPickerText: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },

  // Stage grid
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  stageChipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },

  // Probabilité slider
  sliderRow: { flexDirection: 'row', gap: 6 },
  probBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  probBtnActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  probBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  probBtnTextActive: { color: Colors.primary, fontWeight: '700' },
});

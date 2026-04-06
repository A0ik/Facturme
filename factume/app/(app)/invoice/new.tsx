import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../../stores/authStore';
import { useDataStore } from '../../../stores/dataStore';
import VoiceRecorder from '../../../components/VoiceRecorder';
import Button from '../../../components/ui/Button';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { processVoice, editVoiceInvoice } from '../../../lib/api';
import { InvoiceItem, DocumentType } from '../../../types';
import { generateId } from '../../../lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../../../hooks/useSubscription';

type Step = 'record' | 'edit' | 'confirm';

const DOC_TYPE_CONFIG = {
  invoice: {
    label: 'Facture',
    color: Colors.primary,
    icon: 'document-text-outline' as const,
    example: 'Ex : "Facture pour Martin Construction, pose de carrelage 45m², 38€ le m², TVA 20%, payable sous 30 jours"',
    btnLabel: 'Créer la facture',
  },
  quote: {
    label: 'Devis',
    color: '#3B82F6',
    icon: 'clipboard-outline' as const,
    example: 'Ex : "Devis pour Mme Dupont, installation cuisine 12m², 3 500€ HT, TVA 10%, valable 30 jours"',
    btnLabel: 'Créer le devis',
  },
  credit_note: {
    label: 'Avoir',
    color: '#8B5CF6',
    icon: 'refresh-circle-outline' as const,
    example: 'Ex : "Avoir pour SARL Bâtipro, annulation prestation peinture du 10 mars, montant 800€ TTC"',
    btnLabel: "Créer l'avoir",
  },
};

export default function NewInvoice() {
  const router = useRouter();
  const { type, mode } = useLocalSearchParams<{ type?: string; mode?: string }>();
  const { profile, fetchProfile, user } = useAuthStore();
  const { createInvoice, clients, invoices } = useDataStore();
  const sub = useSubscription();

  const [docType, setDocType] = useState<DocumentType>((type as DocumentType) || 'invoice');
  // mode=manual → démarre directement sur le formulaire sans passer par la voix
  const [step, setStep] = useState<Step>(mode === 'manual' ? 'edit' : 'record');
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showVoiceEdit, setShowVoiceEdit] = useState(false);
  const [isVoiceEditing, setIsVoiceEditing] = useState(false);

  // Form fields
  const [clientName, setClientName] = useState('');

  // Client picker
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientSuggestions = clients.filter((c) =>
    clientName.length >= 1 && c.name.toLowerCase().includes(clientName.toLowerCase())
  );

  // Date picker
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [items, setItems] = useState<Omit<InvoiceItem, 'total'>[]>([
    { id: generateId(), description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
  ]);
  const [notes, setNotes] = useState('');
  const [issueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // ── Calculs ────────────────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vatAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price * (item.vat_rate / 100),
    0
  );
  const total = subtotal + vatAmount;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

  // ── Traitement vocal ───────────────────────────────────────────────────────
  const handleRecordingComplete = async (uri: string, duration: number) => {
    setLoading(true);
    try {
      const result = await processVoice(uri, profile?.sector || undefined);
      setTranscript(result.transcript);

      const parsed = result.parsed;
      if (parsed.client_name) setClientName(parsed.client_name);

      if (parsed.items && parsed.items.length > 0) {
        setItems(
          parsed.items.map((item: any) => ({
            id: generateId(),
            description: item.description || '',
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || 0,
            vat_rate: Number(item.vat_rate) || 20,
          }))
        );
      }

      if (parsed.notes) setNotes(parsed.notes);

      if (parsed.due_days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + parsed.due_days);
        setDueDate(d.toISOString().split('T')[0]);
      }

      setStep('edit');
    } catch (err: any) {
      Alert.alert(
        'Erreur de traitement',
        err.message || 'Impossible de traiter l\'enregistrement. Vérifiez que le backend est démarré.',
        [{ text: 'Réessayer', onPress: () => {} }, { text: 'Saisie manuelle', onPress: () => setStep('edit') }]
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Gestion items ──────────────────────────────────────────────────────────
  const updateItem = (id: string, field: string, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: generateId(), description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // ── Modification vocale pendant la création ────────────────────────────────
  const handleVoiceEditComplete = async (uri: string) => {
    setIsVoiceEditing(true);
    try {
      const currentData = {
        client_name: clientName,
        items,
        notes,
        due_days: Math.floor((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      };
      const result = await editVoiceInvoice(uri, currentData as any, profile?.sector);
      const parsed = result.parsed;

      if (parsed.client_name !== undefined) setClientName(parsed.client_name || '');
      if (parsed.notes !== undefined) setNotes(parsed.notes || '');
      if (parsed.due_days !== undefined) {
        const d = new Date();
        d.setDate(d.getDate() + parsed.due_days);
        setDueDate(d.toISOString().split('T')[0]);
      }
      if (parsed.items && Array.isArray(parsed.items)) {
        setItems(parsed.items.map((it: any) => ({
          id: it.id || generateId(),
          description: it.description || '',
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          vat_rate: Number(it.vat_rate) || 20,
        })));
      }

      if (result.transcript) setTranscript(result.transcript);
      setShowVoiceEdit(false);

      const transcriptLine = result.transcript ? `\n\nCompris : "${result.transcript}"` : '';
      Alert.alert('Modifications appliquées ✓', `Vérifiez les champs puis créez.${transcriptLine}`);
    } catch (err: any) {
      Alert.alert('Erreur modification vocale', err.message || 'Impossible de traiter l\'enregistrement.');
    } finally {
      setIsVoiceEditing(false);
    }
  };

  // ── Sauvegarde ─────────────────────────────────────────────────────────────
  const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
    if (!clientName.trim() && !items[0].description) {
      Alert.alert('Champs manquants', 'Ajoutez au moins un client ou une prestation.');
      return;
    }

    // Vérification limite plan gratuit : 5 factures/mois
    // monthly_invoice_count se réinitialise automatiquement si le mois a changé
    if (sub.isFree) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const isNewMonth = (profile?.invoice_month || '') !== currentMonth;
      const monthlyUsed = isNewMonth ? 0 : (profile?.monthly_invoice_count || 0);
      if (monthlyUsed >= sub.maxInvoices) {
        Alert.alert(
          'Limite mensuelle atteinte 🔒',
          `Le plan Gratuit est limité à ${sub.maxInvoices} factures par mois.\n\nPassez au plan Solo pour des factures illimitées.`,
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Voir les plans', onPress: () => router.push('/(app)/paywall') },
          ]
        );
        return;
      }
    }

    setLoading(true);
    try {
      const invoice = await createInvoice(
        {
          document_type: docType,
          client_name_override: clientName,
          issue_date: issueDate,
          due_date: dueDate,
          items: items.map((item) => ({ ...item })),
          notes,
        },
        profile
      );

      // Rafraîchir le profil (compteur de factures)
      if (user) await fetchProfile(user.id);

      router.replace(`/(app)/invoice/${invoice.id}`);
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'record'
            ? `Nouveau ${DOC_TYPE_CONFIG[docType].label.toLowerCase()} vocal`
            : mode === 'manual' && step === 'edit'
            ? `Nouveau ${DOC_TYPE_CONFIG[docType].label.toLowerCase()}`
            : `Éditer le ${DOC_TYPE_CONFIG[docType].label.toLowerCase()}`}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Sélecteur type de document ── */}
      <View style={styles.typeSelector}>
        {(Object.entries(DOC_TYPE_CONFIG) as [DocumentType, typeof DOC_TYPE_CONFIG[DocumentType]][]).map(([key, cfg]) => {
          const active = docType === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setDocType(key)}
              style={[styles.typeBtn, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
            >
              <Ionicons name={cfg.icon} size={14} color={active ? '#fff' : Colors.textTertiary} />
              <Text style={[styles.typeBtnText, active && { color: '#fff', fontWeight: '700' }]}>
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Steps indicator */}
      <View style={styles.stepsBar}>
        {(['record', 'edit', 'confirm'] as Step[]).map((s, i) => {
          const steps: Step[] = ['record', 'edit', 'confirm'];
          const isActive = step === s;
          const isDone = i < steps.indexOf(step);
          const dotColor = DOC_TYPE_CONFIG[docType].color;
          return (
          <View key={s} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                (isActive || isDone) && { backgroundColor: dotColor },
              ]}
            >
              <Text style={styles.stepDotText}>{i + 1}</Text>
            </View>
            {i < 2 && <View style={[styles.stepConnector, isDone && { backgroundColor: dotColor }]} />}
          </View>
          );
        })}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Step 1: Enregistrement ── */}
          {step === 'record' && (
            <View style={styles.recordSection}>
              {loading ? (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.processingText}>Transcription en cours...</Text>
                  <Text style={styles.processingSub}>L'IA analyse votre enregistrement</Text>
                </View>
              ) : (
                <VoiceRecorder
                  onRecordingComplete={handleRecordingComplete}
                  accentColor={DOC_TYPE_CONFIG[docType].color}
                  exampleText={DOC_TYPE_CONFIG[docType].example}
                />
              )}

              {/* Ou saisie manuelle */}
              <TouchableOpacity
                onPress={() => setStep('edit')}
                style={styles.manualBtn}
              >
                <Text style={styles.manualText}>ou saisie manuelle →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 2: Édition ── */}
          {step === 'edit' && (
            <View style={styles.editSection}>
              {/* Transcript affiché */}
              {transcript ? (
                <View style={[styles.transcriptBox, { backgroundColor: DOC_TYPE_CONFIG[docType].color + '12', borderLeftColor: DOC_TYPE_CONFIG[docType].color }]}>
                  <Text style={[styles.transcriptLabel, { color: DOC_TYPE_CONFIG[docType].color }]}>Transcription</Text>
                  <Text style={styles.transcriptText}>{transcript}</Text>
                </View>
              ) : null}

              {/* Bloc modification vocale */}
              <View style={[styles.voiceEditBlock, { borderColor: DOC_TYPE_CONFIG[docType].color + '40', backgroundColor: DOC_TYPE_CONFIG[docType].color + '08' }]}>
                {!showVoiceEdit ? (
                  <TouchableOpacity
                    onPress={() => setShowVoiceEdit(true)}
                    style={styles.voiceEditToggle}
                  >
                    <Ionicons name="mic" size={17} color={DOC_TYPE_CONFIG[docType].color} />
                    <Text style={[styles.voiceEditToggleText, { color: DOC_TYPE_CONFIG[docType].color }]}>
                      Modifier par la voix
                    </Text>
                    <Ionicons name="chevron-down-outline" size={15} color={DOC_TYPE_CONFIG[docType].color} />
                  </TouchableOpacity>
                ) : isVoiceEditing ? (
                  <View style={styles.voiceEditingRow}>
                    <ActivityIndicator size="small" color={DOC_TYPE_CONFIG[docType].color} />
                    <Text style={[styles.voiceEditingText, { color: DOC_TYPE_CONFIG[docType].color }]}>
                      Application des modifications...
                    </Text>
                  </View>
                ) : (
                  <View>
                    <View style={styles.voiceEditHeader}>
                      <Text style={[styles.voiceEditTitle, { color: DOC_TYPE_CONFIG[docType].color }]}>
                        Dites ce que vous voulez modifier
                      </Text>
                      <TouchableOpacity onPress={() => setShowVoiceEdit(false)}>
                        <Ionicons name="close-outline" size={20} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                    <VoiceRecorder
                      onRecordingComplete={handleVoiceEditComplete}
                      mode="edit"
                      accentColor={DOC_TYPE_CONFIG[docType].color}
                    />
                  </View>
                )}
              </View>

              {/* Client */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Client</Text>
                <TextInput
                  style={styles.input}
                  value={clientName}
                  onChangeText={(v) => { setClientName(v); setShowClientSuggestions(true); }}
                  onFocus={() => setShowClientSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 150)}
                  placeholder="Nom du client ou entreprise"
                  placeholderTextColor={Colors.textTertiary}
                />
                {showClientSuggestions && clientSuggestions.length > 0 && (
                  <View style={styles.suggestionBox}>
                    {clientSuggestions.slice(0, 4).map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setClientName(c.name);
                          setShowClientSuggestions(false);
                        }}
                      >
                        <View style={styles.suggestionAvatar}>
                          <Text style={styles.suggestionAvatarText}>
                            {c.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.suggestionName}>{c.name}</Text>
                          {c.email && <Text style={styles.suggestionEmail}>{c.email}</Text>}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Date échéance */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date d'échéance</Text>
                <TouchableOpacity
                  onPress={() => setShowDueDatePicker(true)}
                  style={styles.dateBtn}
                >
                  <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.dateBtnText}>
                    {new Date(dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
                {/* iOS: modal spinner */}
                {showDueDatePicker && Platform.OS === 'ios' && (
                  <Modal transparent animationType="slide">
                    <TouchableOpacity
                      style={styles.dateModalOverlay}
                      activeOpacity={1}
                      onPress={() => setShowDueDatePicker(false)}
                    >
                      <View style={styles.dateModalSheet}>
                        <View style={styles.dateModalHeader}>
                          <Text style={styles.dateModalTitle}>Date d'échéance</Text>
                          <TouchableOpacity onPress={() => setShowDueDatePicker(false)}>
                            <Text style={styles.dateModalDone}>OK</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={new Date(dueDate)}
                          mode="date"
                          display="spinner"
                          locale="fr-FR"
                          textColor="#111111"
                          themeVariant="light"
                          onChange={(_, d) => { if (d) setDueDate(d.toISOString().split('T')[0]); }}
                          style={{ width: '100%', backgroundColor: Colors.white }}
                        />
                      </View>
                    </TouchableOpacity>
                  </Modal>
                )}
                {/* Android: dialog natif */}
                {showDueDatePicker && Platform.OS === 'android' && (
                  <DateTimePicker
                    value={new Date(dueDate)}
                    mode="date"
                    display="default"
                    onChange={(_, d) => {
                      setShowDueDatePicker(false);
                      if (d) setDueDate(d.toISOString().split('T')[0]);
                    }}
                  />
                )}
              </View>

              {/* Prestations */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Prestations</Text>
                {items.map((item, idx) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemNumber}>#{idx + 1}</Text>
                      {items.length > 1 && (
                        <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <TextInput
                      style={[styles.input, styles.inputDesc]}
                      value={item.description}
                      onChangeText={(v) => updateItem(item.id, 'description', v)}
                      placeholder="Description de la prestation"
                      placeholderTextColor={Colors.textTertiary}
                      multiline
                    />

                    <View style={styles.itemRow}>
                      <View style={styles.itemField}>
                        <Text style={styles.itemFieldLabel}>Quantité</Text>
                        <TextInput
                          style={[styles.input, styles.inputSmall]}
                          value={String(item.quantity)}
                          onChangeText={(v) => updateItem(item.id, 'quantity', parseFloat(v) || 0)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.itemField}>
                        <Text style={styles.itemFieldLabel}>Prix unitaire (€)</Text>
                        <TextInput
                          style={[styles.input, styles.inputSmall]}
                          value={String(item.unit_price)}
                          onChangeText={(v) => updateItem(item.id, 'unit_price', parseFloat(v) || 0)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.itemField}>
                        <Text style={styles.itemFieldLabel}>TVA (%)</Text>
                        <TextInput
                          style={[styles.input, styles.inputSmall]}
                          value={String(item.vat_rate)}
                          onChangeText={(v) => updateItem(item.id, 'vat_rate', parseFloat(v) || 0)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <Text style={styles.itemTotal}>
                      Sous-total : {formatCurrency(item.quantity * item.unit_price)} HT
                    </Text>
                  </View>
                ))}

                <TouchableOpacity
                  onPress={addItem}
                  style={[styles.addItemBtn, { borderColor: DOC_TYPE_CONFIG[docType].color }]}
                >
                  <Text style={[styles.addItemText, { color: DOC_TYPE_CONFIG[docType].color }]}>+ Ajouter une prestation</Text>
                </TouchableOpacity>
              </View>

              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Notes (optionnel)</Text>
                <TextInput
                  style={[styles.input, styles.inputDesc]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Conditions de paiement, notes diverses..."
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                />
              </View>

              {/* Total */}
              <View style={styles.totalBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Sous-total HT</Text>
                  <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TVA</Text>
                  <Text style={styles.totalValue}>{formatCurrency(vatAmount)}</Text>
                </View>
                <View style={[styles.totalRow, styles.totalRowFinal]}>
                  <Text style={styles.totalLabelFinal}>Total TTC</Text>
                  <Text style={[styles.totalValueFinal, { color: DOC_TYPE_CONFIG[docType].color }]}>{formatCurrency(total)}</Text>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <Button
                  onPress={() => handleSave('draft')}
                  variant="outline"
                  size="md"
                  loading={loading}
                  style={{ flex: 1, borderColor: DOC_TYPE_CONFIG[docType].color }}
                  textStyle={{ color: DOC_TYPE_CONFIG[docType].color }}
                >
                  Brouillon
                </Button>
                <Button
                  onPress={() => handleSave('sent')}
                  size="md"
                  loading={loading}
                  style={{ flex: 2, backgroundColor: DOC_TYPE_CONFIG[docType].color }}
                >
                  {DOC_TYPE_CONFIG[docType].btnLabel} →
                </Button>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.gray100,
  },
  closeText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },

  typeSelector: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  typeBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textTertiary },

  stepsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.success },
  stepDotText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
  stepConnector: { flex: 1, height: 2, backgroundColor: Colors.gray200, marginHorizontal: 4 },

  scroll: { flexGrow: 1, paddingBottom: 100 },

  // Step 1 - Record
  recordSection: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  processingContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: 16,
  },
  processingText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary },
  processingSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  manualBtn: {
    marginTop: Spacing.lg,
    padding: Spacing.sm,
  },
  manualText: { fontSize: FontSize.md, color: Colors.textTertiary },

  // Step 2 - Edit
  editSection: { padding: Spacing.lg, gap: Spacing.md },
  transcriptBox: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    paddingLeft: Spacing.md,
    gap: 6,
    borderLeftWidth: 3,
  },
  transcriptLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  transcriptText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 13,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  inputDesc: { minHeight: 60, textAlignVertical: 'top' },
  inputSmall: { padding: 10, fontSize: FontSize.sm },

  itemCard: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 10,
    backgroundColor: Colors.surface,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemNumber: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textTertiary },
  removeBtn: { padding: 4 },
  itemRow: { flexDirection: 'row', gap: 8 },
  itemField: { flex: 1, gap: 4 },
  itemFieldLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },
  itemTotal: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right' },

  addItemBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  addItemText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },

  // Client picker
  suggestionBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionAvatarText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  suggestionName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  suggestionEmail: { fontSize: FontSize.xs, color: Colors.textTertiary },

  dateBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
  },
  dateBtnText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dateModalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: 32,
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateModalTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  dateModalDone: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },

  totalBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRowFinal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '500' },
  totalLabelFinal: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  totalValueFinal: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.primary },

  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },

  // Bloc modification vocale dans le step edit
  voiceEditBlock: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  voiceEditToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
  },
  voiceEditToggleText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  voiceEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  voiceEditTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  voiceEditingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
  },
  voiceEditingText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});

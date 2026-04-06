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
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDataStore } from '../../../stores/dataStore';
import Button from '../../../components/ui/Button';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { DocumentType, RecurringFrequency } from '../../../types';
import { Ionicons } from '@expo/vector-icons';

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const FREQUENCIES: RecurringFrequency[] = ['weekly', 'monthly', 'quarterly', 'yearly'];
const DOC_TYPES: DocumentType[] = ['invoice', 'quote', 'credit_note'];

const DOC_TYPE_LABELS: Record<DocumentType, { fr: string; en: string }> = {
  invoice: { fr: 'Facture', en: 'Invoice' },
  quote: { fr: 'Devis', en: 'Quote' },
  credit_note: { fr: 'Avoir', en: 'Credit note' },
};

export default function NewRecurring() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { clients, recurringInvoices, createRecurringInvoice, updateRecurringInvoice } = useDataStore();

  const existing = id ? recurringInvoices.find((r) => r.id === id) : null;
  const lang = i18n.language as 'fr' | 'en';

  const [clientName, setClientName] = useState(
    existing?.client?.name || existing?.client_name_override || ''
  );
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(existing?.client_id);
  const [docType, setDocType] = useState<DocumentType>((existing?.document_type as DocumentType) || 'invoice');
  const [frequency, setFrequency] = useState<RecurringFrequency>(existing?.frequency || 'monthly');
  const [items, setItems] = useState(
    existing?.items?.map((i: any) => ({ ...i, id: i.id || generateId() })) || [
      { id: generateId(), description: '', quantity: 1, unit_price: 0, vat_rate: 20, total: 0 },
    ]
  );
  const [notes, setNotes] = useState(existing?.notes || '');
  const [autoSend, setAutoSend] = useState(existing?.auto_send || false);
  const [nextRunDate, setNextRunDate] = useState(() => {
    if (existing?.next_run_date) return new Date(existing.next_run_date);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const clientSuggestions = clients.filter(
    (c) => clientName.length >= 1 && c.name.toLowerCase().includes(clientName.toLowerCase())
  );

  const updateItem = (itemId: string, field: string, value: string | number) => {
    setItems((prev: any[]) =>
      prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    setItems((prev: any[]) => [
      ...prev,
      { id: generateId(), description: '', quantity: 1, unit_price: 0, vat_rate: 20, total: 0 },
    ]);
  };

  const removeItem = (itemId: string) => {
    if (items.length === 1) return;
    setItems((prev: any[]) => prev.filter((i) => i.id !== itemId));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        client_id: selectedClientId,
        client_name_override: selectedClientId ? undefined : (clientName.trim() || undefined),
        document_type: docType,
        frequency,
        items: items.map((i: any) => ({
          ...i,
          total: i.quantity * i.unit_price,
        })),
        notes: notes.trim() || undefined,
        next_run_date: nextRunDate.toISOString().split('T')[0],
        is_active: true,
        auto_send: autoSend,
      };

      if (existing) {
        await updateRecurringInvoice(existing.id, payload as any);
      } else {
        await createRecurringInvoice(payload as any);
      }
      router.back();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>
              {existing ? t('recurring.form.editTitle') : t('recurring.form.title')}
            </Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Document type */}
          <Text style={styles.label}>{t('recurring.form.documentType')}</Text>
          <View style={styles.chipRow}>
            {DOC_TYPES.map((dt) => (
              <TouchableOpacity
                key={dt}
                onPress={() => setDocType(dt)}
                style={[styles.chip, docType === dt && styles.chipActive]}
              >
                <Text style={[styles.chipText, docType === dt && styles.chipTextActive]}>
                  {DOC_TYPE_LABELS[dt][lang]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Frequency */}
          <Text style={styles.label}>{t('recurring.form.frequency')}</Text>
          <View style={styles.chipRow}>
            {FREQUENCIES.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFrequency(f)}
                style={[styles.chip, frequency === f && styles.chipActive]}
              >
                <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>
                  {t(`recurring.frequencies.${f}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Client */}
          <Text style={styles.label}>{t('recurring.form.client')}</Text>
          <View style={{ zIndex: 10, marginBottom: Spacing.md }}>
            <TextInput
              style={styles.input}
              value={clientName}
              onChangeText={(v) => {
                setClientName(v);
                setSelectedClientId(undefined);
                setShowSuggestions(true);
              }}
              placeholder={t('recurring.form.clientPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
            />
            {showSuggestions && clientSuggestions.length > 0 && (
              <View style={styles.dropdown}>
                {clientSuggestions.slice(0, 5).map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setClientName(c.name);
                      setSelectedClientId(c.id);
                      setShowSuggestions(false);
                    }}
                  >
                    <Text style={styles.dropdownName}>{c.name}</Text>
                    {c.email && <Text style={styles.dropdownSub}>{c.email}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Next run date */}
          <Text style={styles.label}>{t('recurring.form.nextDate')}</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            <Text style={styles.dateBtnText}>
              {nextRunDate.toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={nextRunDate}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setNextRunDate(date);
              }}
            />
          )}

          {/* Items */}
          <Text style={styles.label}>{t('recurring.form.items')}</Text>
          {items.map((item: any) => (
            <View key={item.id} style={styles.itemRow}>
              <TextInput
                style={[styles.input, { flex: 3 }]}
                value={item.description}
                onChangeText={(v) => updateItem(item.id, 'description', v)}
                placeholder={t('recurring.form.itemDescription')}
                placeholderTextColor={Colors.textTertiary}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={String(item.quantity)}
                onChangeText={(v) => updateItem(item.id, 'quantity', parseFloat(v) || 1)}
                keyboardType="numeric"
                placeholder={t('recurring.form.itemQty')}
                placeholderTextColor={Colors.textTertiary}
              />
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={String(item.unit_price)}
                onChangeText={(v) => updateItem(item.id, 'unit_price', parseFloat(v) || 0)}
                keyboardType="decimal-pad"
                placeholder={t('recurring.form.itemPrice')}
                placeholderTextColor={Colors.textTertiary}
              />
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(item.id)} style={{ padding: 6 }}>
                  <Ionicons name="remove-circle-outline" size={20} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={addItem} style={styles.addItemBtn}>
            <Text style={styles.addItemText}>{t('recurring.form.addItem')}</Text>
          </TouchableOpacity>

          {/* Notes */}
          <Text style={styles.label}>{t('recurring.form.notes')}</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top', marginBottom: Spacing.md }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder={t('common.optional')}
            placeholderTextColor={Colors.textTertiary}
          />

          {/* Auto-send */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('recurring.form.autoSendLabel')}</Text>
            <Switch
              value={autoSend}
              onValueChange={setAutoSend}
              trackColor={{ false: Colors.gray200, true: Colors.primaryLight }}
              thumbColor={autoSend ? Colors.primary : Colors.gray400}
            />
          </View>

          <Button onPress={handleSave} loading={saving} fullWidth size="lg" style={{ marginTop: Spacing.lg }}>
            {t('recurring.form.save')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  scroll: { padding: Spacing.lg, paddingBottom: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  label: {
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary,
    marginBottom: 8, marginTop: Spacing.md,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.sm,
    color: Colors.textPrimary, backgroundColor: Colors.white, marginBottom: 4,
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.primary,
    borderRadius: Radius.md, zIndex: 999, elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8,
  },
  dropdownItem: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  dropdownSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4,
  },
  dateBtnText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '500' },
  itemRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 8 },
  addItemBtn: { paddingVertical: 8 },
  addItemText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.md, paddingVertical: 8,
  },
  toggleLabel: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '500', flex: 1 },
});

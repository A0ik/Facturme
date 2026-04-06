import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDataStore } from '../../../stores/dataStore';
import { RecurringInvoice } from '../../../types';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const FREQ_COLORS: Record<string, string> = {
  weekly: '#3B82F6',
  monthly: Colors.primary,
  quarterly: '#8B5CF6',
  yearly: '#EF9F27',
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

export default function RecurringList() {
  const router = useRouter();
  const { t } = useTranslation();
  const { recurringInvoices, fetchRecurringInvoices, updateRecurringInvoice, deleteRecurringInvoice } = useDataStore();

  useEffect(() => {
    fetchRecurringInvoices();
  }, []);

  const handleToggle = async (rec: RecurringInvoice) => {
    try {
      await updateRecurringInvoice(rec.id, { is_active: !rec.is_active });
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message);
    }
  };

  const handleDelete = (rec: RecurringInvoice) => {
    Alert.alert(
      t('recurring.deleteConfirm'),
      t('recurring.deleteConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecurringInvoice(rec.id);
            } catch (err: any) {
              Alert.alert(t('common.error'), err.message);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: RecurringInvoice }) => {
    const clientName = item.client?.name || item.client_name_override || '—';
    const total = item.items.reduce((s, i) => s + i.quantity * i.unit_price * (1 + i.vat_rate / 100), 0);
    const freqColor = FREQ_COLORS[item.frequency] || Colors.primary;
    const nextDate = new Date(item.next_run_date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

    return (
      <TouchableOpacity
        style={[styles.card, !item.is_active && styles.cardInactive]}
        onPress={() => router.push(`/(app)/recurring/new?id=${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={[styles.freqBadge, { backgroundColor: freqColor + '20' }]}>
            <Text style={[styles.freqText, { color: freqColor }]}>
              {t(`recurring.frequencies.${item.frequency}`)}
            </Text>
          </View>
          <Switch
            value={item.is_active}
            onValueChange={() => handleToggle(item)}
            trackColor={{ false: Colors.gray200, true: Colors.primaryLight }}
            thumbColor={item.is_active ? Colors.primary : Colors.gray400}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>

        <Text style={styles.clientName}>{clientName}</Text>
        <Text style={styles.total}>{formatCurrency(total)}</Text>
        <Text style={styles.nextDate}>{t('recurring.nextRun', { date: nextDate })}</Text>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('recurring.title')}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(app)/recurring/new')}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={recurringInvoices}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="repeat-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>{t('recurring.empty')}</Text>
            <Text style={styles.emptyText}>{t('recurring.emptyText')}</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/(app)/recurring/new')}
            >
              <Text style={styles.emptyBtnText}>{t('recurring.addFirst')}</Text>
            </TouchableOpacity>
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
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    position: 'relative',
  },
  cardInactive: { opacity: 0.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  freqBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  freqText: { fontSize: FontSize.xs, fontWeight: '700' },
  clientName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  total: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary },
  nextDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
  deleteBtn: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: 12,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', maxWidth: 260 },
  emptyBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
});

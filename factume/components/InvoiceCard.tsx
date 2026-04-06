import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Radius, Spacing } from '../constants/Colors';
import Badge from './ui/Badge';
import { Invoice } from '../types';
import { useCurrency } from '../hooks/useCurrency';

interface Props {
  invoice: Invoice;
  onDelete?: () => void;
  accentColor?: string;
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  });

export default function InvoiceCard({ invoice, onDelete }: Props) {
  const router = useRouter();
  const swipeRef = useRef<Swipeable>(null);
  const { format: formatCurrency } = useCurrency();
  const clientName =
    invoice.client?.name || invoice.client_name_override || 'Client non défini';

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.7, 1],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          swipeRef.current?.close();
          onDelete?.();
        }}
        activeOpacity={0.8}
      >
        <Animated.View style={[styles.deleteInner, { transform: [{ scale }] }]}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={styles.deleteText}>Supprimer</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={60}
      overshootRight={false}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/invoice/${invoice.id}`)}
        activeOpacity={0.75}
      >
        <View style={styles.left}>
          <Text style={styles.number}>{invoice.number}</Text>
          <Text style={styles.client} numberOfLines={1}>{clientName}</Text>
          <Text style={styles.date}>{formatDate(invoice.issue_date)}</Text>
        </View>

        <View style={styles.right}>
          <Text style={styles.amount}>{formatCurrency(invoice.total)}</Text>
          <Badge status={invoice.status} />
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  left: { flex: 1, gap: 3 },
  right: { alignItems: 'flex-end', gap: 6 },
  number: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  client: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.textPrimary,
    maxWidth: 200,
  },
  date: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  amount: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  deleteAction: {
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    marginLeft: Spacing.sm,
  },
  deleteInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 4,
  },
});

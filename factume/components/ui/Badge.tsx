import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize } from '../../constants/Colors';
import { InvoiceStatus } from '../../types';

interface BadgeProps {
  status: InvoiceStatus;
}

const config: Record<InvoiceStatus, { label: string; bg: string; text: string }> = {
  draft: { label: 'Brouillon', bg: Colors.gray100, text: Colors.gray600 },
  sent: { label: 'Envoyé', bg: Colors.infoLight, text: Colors.info },
  paid: { label: 'Payée', bg: Colors.successLight, text: Colors.success },
  overdue: { label: 'En retard', bg: Colors.dangerLight, text: Colors.danger },
  accepted: { label: 'Accepté', bg: Colors.successLight, text: Colors.success },
  refused: { label: 'Refusé', bg: Colors.dangerLight, text: Colors.danger },
};

export default function Badge({ status }: BadgeProps) {
  const { label, bg, text } = config[status] || config.draft;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: text }]} />
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Radius, Spacing } from '../constants/Colors';
import { Client } from '../types';

interface Props {
  client: Client;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Couleur d'avatar déterministe basée sur le nom
const AVATAR_COLORS = [
  '#1D9E75', '#3B82F6', '#EF9F27', '#8B5CF6', '#EF4444', '#06B6D4',
];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function ClientCard({ client }: Props) {
  const router = useRouter();
  const initials = getInitials(client.name);
  const avatarColor = getAvatarColor(client.name);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(app)/client/${client.id}`)}
      activeOpacity={0.75}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColor + '22' }]}>
        <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{client.name}</Text>
        {client.email && (
          <Text style={styles.sub} numberOfLines={1}>{client.email}</Text>
        )}
        {client.city && !client.email && (
          <Text style={styles.sub} numberOfLines={1}>{client.city}</Text>
        )}
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  info: { flex: 1, gap: 2 },
  name: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sub: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  chevron: {
    fontSize: 22,
    color: Colors.gray300,
    fontWeight: '300',
  },
});

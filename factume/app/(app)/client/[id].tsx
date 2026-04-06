import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDataStore } from '../../../stores/dataStore';
import { useAuthStore } from '../../../stores/authStore';
import InvoiceCard from '../../../components/InvoiceCard';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { transcribeAudio } from '../../../lib/api';

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { clients, invoices, updateClient, deleteClient } = useDataStore();
  const { profile } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [notesText, setNotesText] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);

  const client = clients.find((c) => c.id === id);
  const clientInvoices = useMemo(
    () => invoices.filter((inv) => inv.client_id === id),
    [invoices, id]
  );

  const [form, setForm] = useState(client || {});
  // Initialise les notes depuis le client
  React.useEffect(() => {
    if (client?.notes) setNotesText(client.notes);
  }, [client?.notes]);

  if (!client) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ padding: 20 }}>Client introuvable</Text>
      </SafeAreaView>
    );
  }

  const totalRevenue = clientInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);

  const pendingRevenue = clientInvoices
    .filter((inv) => inv.status === 'sent')
    .reduce((sum, inv) => sum + inv.total, 0);

  const overdueCount = clientInvoices.filter(
    (inv) => inv.status === 'sent' && inv.due_date && new Date(inv.due_date) < new Date()
  ).length;

  const lastInvoice = clientInvoices[0]; // sorted by created_at desc from store
  const lastInvoiceDate = lastInvoice
    ? new Date(lastInvoice.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateClient(id, form as any);
      setEditing(false);
      Alert.alert('Sauvegardé', 'Informations client mises à jour.');
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer', `Supprimer ${client.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClient(id);
            router.back();
          } catch (err: any) {
            Alert.alert('Erreur', err.message);
          }
        },
      },
    ]);
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert('Permission refusée', 'Autorise le micro dans les réglages.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      setRecording(rec);
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    }
  };

  const stopAndTranscribe = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    try {
      setTranscribing(true);
      await rec.stopAndUnloadAsync();
      setRecording(null);
      recordingRef.current = null;
      const uri = rec.getURI();
      if (!uri) throw new Error('Aucun fichier audio');
      const { transcript } = await transcribeAudio(uri);
      if (!transcript) throw new Error('Transcription vide');
      const ts = new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const newNote = `[${ts}] ${transcript}`;
      const updated = notesText ? `${notesText}\n${newNote}` : newNote;
      setNotesText(updated);
      await updateClient(id, { notes: updated } as any);
    } catch (err: any) {
      Alert.alert('Erreur transcription', err.message);
    } finally {
      setTranscribing(false);
    }
  };

  const saveNote = async () => {
    setLoading(true);
    try {
      await updateClient(id, { notes: notesText } as any);
      Alert.alert('Sauvegardé', 'Note enregistrée.');
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally { setLoading(false); }
  };

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{client.name}</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={22} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar + stats */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(client.name)}</Text>
          </View>
          <Text style={styles.clientName}>{client.name}</Text>
          {client.city && <Text style={styles.clientCity}>{client.city}</Text>}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{clientInvoices.length}</Text>
              <Text style={styles.statLabel}>Factures</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatCurrency(totalRevenue)}</Text>
              <Text style={styles.statLabel}>CA encaissé</Text>
            </View>
          </View>

          {/* Stats supplémentaires */}
          <View style={styles.statsGrid}>
            {pendingRevenue > 0 && (
              <View style={[styles.statChip, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time-outline" size={13} color={Colors.warning} />
                <Text style={[styles.statChipText, { color: Colors.warning }]}>
                  {formatCurrency(pendingRevenue)} en attente
                </Text>
              </View>
            )}
            {overdueCount > 0 && (
              <View style={[styles.statChip, { backgroundColor: Colors.dangerLight }]}>
                <Ionicons name="warning-outline" size={13} color={Colors.danger} />
                <Text style={[styles.statChipText, { color: Colors.danger }]}>
                  {overdueCount} en retard
                </Text>
              </View>
            )}
            {lastInvoiceDate && (
              <View style={[styles.statChip, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
                <Text style={[styles.statChipText, { color: Colors.primary }]}>
                  Dernière : {lastInvoiceDate}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Infos */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Informations</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Text style={styles.editBtn}>{editing ? 'Annuler' : 'Modifier'}</Text>
            </TouchableOpacity>
          </View>

          {editing ? (
            <View style={styles.editForm}>
              <Input label="Nom" value={(form as any).name || ''} onChangeText={(v) => update('name', v)} />
              <Input label="Email" value={(form as any).email || ''} onChangeText={(v) => update('email', v)} keyboardType="email-address" autoCapitalize="none" />
              <Input label="Téléphone" value={(form as any).phone || ''} onChangeText={(v) => update('phone', v)} keyboardType="phone-pad" />
              <Input label="Adresse" value={(form as any).address || ''} onChangeText={(v) => update('address', v)} />
              <View style={styles.row}>
                <Input label="Code postal" value={(form as any).postal_code || ''} onChangeText={(v) => update('postal_code', v)} containerStyle={{ flex: 1 }} />
                <Input label="Ville" value={(form as any).city || ''} onChangeText={(v) => update('city', v)} containerStyle={{ flex: 2 }} />
              </View>
              <Input label="SIRET" value={(form as any).siret || ''} onChangeText={(v) => update('siret', v)} keyboardType="numeric" />
              <Button onPress={handleSave} loading={loading} fullWidth>Sauvegarder</Button>
            </View>
          ) : (
            <View style={styles.infoList}>
              {[
                { label: 'Email', value: client.email },
                { label: 'Téléphone', value: client.phone },
                { label: 'Adresse', value: [client.address, client.postal_code && client.city ? `${client.postal_code} ${client.city}` : client.city].filter(Boolean).join(', ') },
                { label: 'SIRET', value: client.siret },
                { label: 'N° TVA', value: client.vat_number },
              ]
                .filter((item) => item.value)
                .map((item, i) => (
                  <View key={i} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={styles.infoValue}>{item.value}</Text>
                  </View>
                ))}
            </View>
          )}
        </View>

        {/* Notes vocales */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Notes</Text>
            <TouchableOpacity
              onPress={recording ? stopAndTranscribe : startRecording}
              style={[styles.voiceBtn, recording && { backgroundColor: Colors.danger }]}
              disabled={transcribing}
            >
              {transcribing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name={recording ? 'stop' : 'mic'} size={14} color="#fff" />
              )}
              <Text style={styles.voiceBtnText}>
                {transcribing ? 'Transcription...' : recording ? 'Arrêter' : 'Mémo vocal'}
              </Text>
            </TouchableOpacity>
          </View>
          {recording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Enregistrement en cours…</Text>
            </View>
          )}
          <Input
            value={notesText}
            onChangeText={setNotesText}
            placeholder="Ajouter une note sur ce client…"
            multiline
            numberOfLines={4}
            containerStyle={{ marginTop: 4 }}
          />
          {notesText !== (client.notes || '') && (
            <Button onPress={saveNote} loading={loading} fullWidth style={{ marginTop: 8 }}>
              Sauvegarder la note
            </Button>
          )}
        </View>

        {/* Factures */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              Factures ({clientInvoices.length})
            </Text>
            <TouchableOpacity onPress={() => router.push('/(app)/invoice/new')}>
              <Text style={styles.editBtn}>+ Nouvelle</Text>
            </TouchableOpacity>
          </View>
          {clientInvoices.length === 0 ? (
            <Text style={styles.noInvoice}>Aucune facture pour ce client.</Text>
          ) : (
            clientInvoices.map((inv) => <InvoiceCard key={inv.id} invoice={inv} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 28, color: Colors.primary, fontWeight: '300' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  deleteBtn: { padding: 4 },

  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.white },
  clientName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  clientCity: { fontSize: FontSize.md, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  stat: { alignItems: 'center', paddingHorizontal: Spacing.lg },
  statValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.border },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  statChipText: { fontSize: FontSize.xs, fontWeight: '600' },

  card: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  editBtn: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  editForm: { gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  infoList: { gap: 6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '500', maxWidth: 220, textAlign: 'right' },
  noInvoice: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 16 },

  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  voiceBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#fff' },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    padding: 10,
    borderRadius: Radius.md,
    marginBottom: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  recordingText: { fontSize: FontSize.sm, color: Colors.danger, fontWeight: '600' },
});

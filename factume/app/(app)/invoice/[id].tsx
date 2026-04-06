import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDataStore } from '../../../stores/dataStore';
import { useAuthStore } from '../../../stores/authStore';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import VoiceRecorder from '../../../components/VoiceRecorder';
import { Colors, FontSize, Spacing, Radius } from '../../../constants/Colors';
import { generateAndSharePdf, generatePdfBase64, generateEmailHtml, generateAndShareFacturXPdf, generateFacturXBase64 } from '../../../lib/pdf';
import { sendInvoiceByEmail, createStripePaymentLink, editVoiceInvoice, submitToChorusPro } from '../../../lib/api';
import { InvoiceItem, InvoiceStatus } from '../../../types';
import { generateId } from '../../../lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../../../hooks/useSubscription';
import { scheduleInvoiceReminder, cancelInvoiceReminder } from '../../../lib/notifications';
import { useCurrency } from '../../../hooks/useCurrency';

const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

const DOC_CONFIG = {
  invoice:     { label: 'Facture',  color: '#1D9E75', accentKey: 'primary' },
  quote:       { label: 'Devis',    color: '#3B82F6', accentKey: 'blue' },
  credit_note: { label: 'Avoir',    color: '#8B5CF6', accentKey: 'purple' },
} as const;

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { invoices, updateInvoice, updateInvoiceStatus, deleteInvoice, duplicateInvoice } = useDataStore();
  const { profile, fetchProfile, user } = useAuthStore();

  const sub = useSubscription();
  const { format: formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);

  const invoice = invoices.find((inv) => inv.id === id);

  // Edit states — initialisés depuis la facture
  const [editClientName, setEditClientName] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState<Omit<InvoiceItem, 'total'>[]>([]);
  const [isEditingAudio, setIsEditingAudio] = useState(false);

  if (!invoice) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ padding: 20, color: Colors.textSecondary }}>Facture introuvable</Text>
      </SafeAreaView>
    );
  }

  const clientName = invoice.client?.name || invoice.client_name_override || 'Client';
  const docType = invoice.document_type || 'invoice';
  const docCfg = DOC_CONFIG[docType] ?? DOC_CONFIG.invoice;
  const isOverdue =
    invoice.status === 'sent' && invoice.due_date && new Date(invoice.due_date) < new Date();

  const startEditing = () => {
    setEditClientName(clientName);
    setEditDueDate(invoice.due_date || '');
    setEditNotes(invoice.notes || '');
    setEditItems(
      invoice.items.map((item) => ({
        id: item.id || generateId(),
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate,
      }))
    );
    setEditing(true);
  };

  const updateEditItem = (itemId: string, field: string, value: string | number) => {
    setEditItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    );
  };

  const addEditItem = () => {
    setEditItems((prev) => [
      ...prev,
      { id: generateId(), description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
    ]);
  };

  const removeEditItem = (itemId: string) => {
    if (editItems.length === 1) return;
    setEditItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const editSubtotal = editItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const editVat = editItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price * (item.vat_rate / 100),
    0
  );
  const editTotal = editSubtotal + editVat;

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      await updateInvoice(id, {
        client_name_override: editClientName || invoice.client_name_override,
        due_date: editDueDate || undefined,
        notes: editNotes || undefined,
        items: editItems as any,
      });
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRecordingComplete = async (uri: string) => {
    setIsEditingAudio(true);
    setLoading(true);
    try {
      const currentInvoiceData = {
        client_name: editClientName,
        items: editItems,
        notes: editNotes,
        due_days: editDueDate ? Math.floor((new Date(editDueDate).getTime() - new Date(invoice.issue_date).getTime()) / (1000 * 60 * 60 * 24)) : 30
      };

      const result = await editVoiceInvoice(uri, currentInvoiceData as any, profile?.sector);
      const parsed = result.parsed;

      if (parsed.client_name !== undefined) setEditClientName(parsed.client_name || '');
      if (parsed.notes !== undefined) setEditNotes(parsed.notes || '');
      if (parsed.due_days !== undefined) {
        const d = new Date(invoice.issue_date);
        d.setDate(d.getDate() + parsed.due_days);
        setEditDueDate(d.toISOString().split('T')[0]);
      }
      if (parsed.items && Array.isArray(parsed.items)) {
        setEditItems(parsed.items.map((it: any) => ({
          id: it.id || generateId(),
          description: it.description || '',
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          vat_rate: Number(it.vat_rate) || 20,
        })));
      }

      const transcriptLine = result.transcript ? `\n\nCompris : "${result.transcript}"` : '';
      Alert.alert('Modifications appliquées ✓', `Vérifiez les changements puis sauvegardez.${transcriptLine}`);
    } catch (err: any) {
      Alert.alert('Erreur modification vocale', err.message || 'Impossible de traiter l\'enregistrement.');
    } finally {
      setIsEditingAudio(false);
      setLoading(false);
    }
  };

  const handleQuickVoiceEdit = () => {
    startEditing();
  };

  const handleDownload = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const pdfUri = await generateAndSharePdf(invoice, profile);
      const { sharePdf } = await import('../../../lib/pdf');
      await sharePdf(pdfUri);
    } catch (err: any) {
      if (!err.message?.includes('cancel') && !err.message?.includes('dismiss')) {
        Alert.alert('Erreur PDF', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (isReminder = false) => {
    if (!profile) return;
    const email = emailInput || invoice.client?.email;
    if (!email) {
      setShowEmailInput(true);
      return;
    }

    setLoading(true);
    try {
      const pdfBase64 = await generatePdfBase64(invoice, profile);
      const htmlBody = isReminder
        ? generateReminderHtml(invoice, profile)
        : generateEmailHtml(invoice, profile);

      const subject = isReminder
        ? `Rappel de paiement — Facture ${invoice.number}`
        : `Facture ${invoice.number} — ${profile.company_name}`;

      const result = await sendInvoiceByEmail({
        to: email,
        toName: clientName,
        subject,
        htmlBody,
        pdfBase64,
        filename: `${invoice.number}.pdf`,
        fromName: profile.company_name,
      });

      if (result.simulated) {
        Alert.alert('Simulation', `En production, l'email serait envoyé à ${email}`);
      } else {
        Alert.alert(isReminder ? 'Relance envoyée !' : 'Envoyé !', `Email envoyé à ${email}`);
      }

      if (invoice.status === 'draft') {
        await updateInvoiceStatus(id, 'sent');
        // Planifier une notification de relance si la facture n'est pas payée à l'échéance
        const updatedInvoice = { ...invoice, status: 'sent' as const };
        await scheduleInvoiceReminder(updatedInvoice);
      }
    } catch (err: any) {
      Alert.alert('Erreur envoi', err.message);
    } finally {
      setLoading(false);
      setShowEmailInput(false);
    }
  };

  const handleMarkPaid = async () => {
    Alert.alert('Marquer payée', 'Confirmer que cette facture a été payée ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          try {
            await updateInvoiceStatus(id, 'paid');
            // Annuler la notif de relance puisque la facture est payée
            await cancelInvoiceReminder(id);
          } catch (err: any) {
            Alert.alert('Erreur', err.message);
          }
        },
      },
    ]);
  };

  const handleDuplicate = async () => {
    // Vérification limite plan gratuit avant duplication (mensuelle, non réinitialisable par suppression)
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
    Alert.alert('Dupliquer', 'Créer une copie brouillon de cette facture ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Dupliquer',
        onPress: async () => {
          setLoading(true);
          try {
            const copy = await duplicateInvoice(id, profile);
            if (user) await fetchProfile(user.id);
            router.replace(`/(app)/invoice/${copy.id}`);
          } catch (err: any) {
            Alert.alert('Erreur', err.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleStripePaymentLink = async () => {
    if (!profile?.stripe_account_id) {
      Alert.alert(
        'Stripe non connecté',
        'Connectez votre compte Stripe dans Réglages → Paiement Stripe.',
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Réglages', onPress: () => router.push('/(app)/(tabs)/settings') },
        ]
      );
      return;
    }
    if (invoice.payment_link) {
      Alert.alert(
        'Lien existant',
        'Un bouton de paiement Stripe est déjà intégré dans le PDF de cette facture.',
        [
          { text: 'Supprimer le bouton', style: 'destructive', onPress: () => updateInvoice(id, { payment_link: undefined } as any) },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }
    setStripeLoading(true);
    try {
      const clientName = invoice.client?.name || invoice.client_name_override || 'Client';
      const { url } = await createStripePaymentLink({
        stripeAccountId: profile.stripe_account_id,
        amount: invoice.total,
        invoiceNumber: invoice.number,
        description: `Facture ${invoice.number} — ${clientName}`,
      });
      await updateInvoice(id, { payment_link: url } as any);
      Alert.alert('Bouton ajouté ! 💳', 'Le bouton de paiement Stripe sera visible dans le PDF de cette facture.');
    } catch (err: any) {
      Alert.alert('Erreur Stripe', err.message);
    } finally {
      setStripeLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer', 'Supprimer définitivement cette facture ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInvoice(id);
            router.back();
          } catch (err: any) {
            Alert.alert('Erreur', err.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (editing) setEditing(false); else router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <View style={[styles.docTypePill, { backgroundColor: docCfg.color + '20' }]}>
            <Text style={[styles.docTypePillText, { color: docCfg.color }]}>{docCfg.label}</Text>
          </View>
          <Text style={styles.headerTitle}>{invoice.number}</Text>
        </View>
        <View style={styles.headerRight}>
          {!editing && (
            <TouchableOpacity onPress={startEditing} style={styles.iconBtn}>
              <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>

          {/* Bannière overdue */}
          {isOverdue && !editing && (
            <View style={styles.overdueBanner}>
              <Ionicons name="warning-outline" size={16} color="#fff" />
              <Text style={styles.overdueBannerText}>Paiement en retard</Text>
            </View>
          )}

          {/* ── MODE LECTURE ── */}
          {!editing && (
            <>
              {/* Status + Client */}
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Badge status={invoice.status} />
                  <Text style={styles.invoiceNumber}>{invoice.number}</Text>
                </View>
                <Text style={styles.clientName}>{clientName}</Text>
                {invoice.client?.email && (
                  <Text style={styles.clientEmail}>{invoice.client.email}</Text>
                )}
                <View style={styles.datesRow}>
                  <View>
                    <Text style={styles.dateLabel}>Émise le</Text>
                    <Text style={styles.dateValue}>{formatDate(invoice.issue_date)}</Text>
                  </View>
                  {invoice.due_date && (
                    <View>
                      <Text style={styles.dateLabel}>Échéance</Text>
                      <Text style={[styles.dateValue, isOverdue && { color: Colors.danger }]}>
                        {formatDate(invoice.due_date)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Prestations */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Prestations</Text>
                {invoice.items.map((item, i) => (
                  <View key={item.id || i} style={styles.itemRow}>
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemDesc}>{item.description}</Text>
                      <Text style={styles.itemMeta}>
                        {item.quantity} × {formatCurrency(item.unit_price)} — TVA {item.vat_rate}%
                      </Text>
                    </View>
                    <Text style={styles.itemTotal}>{formatCurrency(item.total)}</Text>
                  </View>
                ))}
              </View>

              {/* Totaux */}
              <View style={styles.card}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Sous-total HT</Text>
                  <Text style={styles.totalVal}>{formatCurrency(invoice.subtotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TVA</Text>
                  <Text style={styles.totalVal}>{formatCurrency(invoice.vat_amount)}</Text>
                </View>
                <View style={[styles.totalRow, styles.totalFinal]}>
                  <Text style={styles.totalFinalLabel}>Total TTC</Text>
                  <Text style={styles.totalFinalVal}>{formatCurrency(invoice.total)}</Text>
                </View>
              </View>

              {/* Notes */}
              {invoice.notes && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Notes</Text>
                  <Text style={styles.notesText}>{invoice.notes}</Text>
                </View>
              )}

              {/* Email input */}
              {showEmailInput && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Email du destinataire</Text>
                  <TextInput
                    style={styles.emailInput}
                    value={emailInput}
                    onChangeText={setEmailInput}
                    placeholder="client@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                {loading ? (
                  <ActivityIndicator size="large" color={Colors.primary} style={{ padding: 20 }} />
                ) : (
                  <>
                    {/* Bouton modification vocale rapide */}
                    <TouchableOpacity onPress={handleQuickVoiceEdit} style={styles.quickVoiceBtn}>
                      <Ionicons name="mic" size={18} color={Colors.primary} />
                      <Text style={styles.quickVoiceBtnText}>Modifier par la voix</Text>
                    </TouchableOpacity>

                    <Button onPress={() => handleSendEmail(false)} size="lg" fullWidth>
                      {showEmailInput ? 'Envoyer' : 'Envoyer par email'}
                    </Button>

                    {/* Relance — Solo+ */}
                    {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                      <Button
                        onPress={() => {
                          if (!sub.canSendReminder) { router.push('/(app)/paywall'); return; }
                          handleSendEmail(true);
                        }}
                        variant="outline"
                        size="md"
                        fullWidth
                        style={{ borderColor: sub.canSendReminder ? Colors.warning : Colors.border }}
                        textStyle={{ color: sub.canSendReminder ? Colors.warning : Colors.textTertiary }}
                      >
                        {sub.canSendReminder ? 'Envoyer une relance' : '🔒 Relance (Solo+)'}
                      </Button>
                    )}

                    {/* PDF + Factur-X */}
                    <View style={styles.actionsRow}>
                      <Button onPress={handleDownload} variant="outline" size="md" style={{ flex: 1 }}>
                        Partager PDF
                      </Button>
                      {(docType === 'invoice' || docType === 'credit_note') && (
                        <Button
                          onPress={async () => {
                            if (!sub.canFacturX) { router.push('/(app)/paywall'); return; }
                            if (!profile) return;
                            setLoading(true);
                            try {
                              await generateAndShareFacturXPdf(invoice, profile);
                            } catch (err: any) {
                              Alert.alert('Erreur Factur-X', err.message);
                            } finally {
                              setLoading(false);
                            }
                          }}
                          variant="outline"
                          size="md"
                          style={{ flex: 1, borderColor: sub.canFacturX ? Colors.primary : Colors.border }}
                          textStyle={{ color: sub.canFacturX ? Colors.primary : Colors.textTertiary }}
                        >
                          {sub.canFacturX ? 'Factur-X ✦' : '🔒 Factur-X (Pro)'}
                        </Button>
                      )}
                    </View>

                    {/* Chorus Pro — e-invoicing B2G */}
                    {(docType === 'invoice' || docType === 'credit_note') && (
                      <Button
                        onPress={async () => {
                          if (!sub.canFacturX) { router.push('/(app)/paywall'); return; }
                          if (!profile) return;
                          setLoading(true);
                          try {
                            const fxBase64 = await generateFacturXBase64(invoice, profile);
                            const result = await submitToChorusPro({ pdfBase64: fxBase64, invoiceNumber: invoice.number });
                            Alert.alert('Chorus Pro ✓', `Facture déposée\nID flux : ${result.identifiantFlux}`);
                          } catch (err: any) {
                            const msg = err.message || '';
                            if (msg.includes('non configuré')) {
                              Alert.alert('Chorus Pro', 'Ajoutez vos identifiants PISTE dans le fichier .env du backend.');
                            } else {
                              Alert.alert('Erreur Chorus Pro', msg);
                            }
                          } finally {
                            setLoading(false);
                          }
                        }}
                        variant="outline"
                        size="md"
                        fullWidth
                        style={{ marginTop: 8, borderColor: sub.canFacturX ? '#003189' : Colors.border }}
                        textStyle={{ color: sub.canFacturX ? '#003189' : Colors.textTertiary, fontSize: 13 }}
                      >
                        {sub.canFacturX ? 'Déposer sur Chorus Pro' : '🔒 Chorus Pro (Pro)'}
                      </Button>
                    )}

                    {/* Bouton paiement Stripe — Pro only */}
                    {docType === 'invoice' && (
                      <Button
                        onPress={() => {
                          if (!sub.canStripePayment) { router.push('/(app)/paywall'); return; }
                          handleStripePaymentLink();
                        }}
                        variant="outline"
                        size="md"
                        fullWidth
                        loading={stripeLoading}
                        style={{
                          borderColor: sub.canStripePayment
                            ? (invoice.payment_link ? '#635BFF' : Colors.border)
                            : Colors.border,
                        }}
                        textStyle={{
                          color: sub.canStripePayment
                            ? (invoice.payment_link ? '#635BFF' : Colors.textSecondary)
                            : Colors.textTertiary,
                        }}
                      >
                        {!sub.canStripePayment
                          ? '🔒 Bouton paiement Stripe (Pro)'
                          : invoice.payment_link
                          ? '💳 Lien Stripe actif — Appuyer pour gérer'
                          : '💳 Ajouter bouton de paiement Stripe'}
                      </Button>
                    )}

                    {/* Actions spécifiques au type */}
                    <View style={styles.actionsRow}>
                      {/* Facture : Marquer payée */}
                      {docType === 'invoice' && invoice.status !== 'paid' && (
                        <Button
                          onPress={handleMarkPaid}
                          variant="secondary"
                          size="md"
                          style={{ flex: 1, backgroundColor: Colors.successLight }}
                          textStyle={{ color: Colors.success }}
                        >
                          Marquer payée
                        </Button>
                      )}
                      {/* Devis : Accepter / Refuser */}
                      {docType === 'quote' && invoice.status !== 'accepted' && invoice.status !== 'refused' && (
                        <>
                          <Button
                            onPress={() => updateInvoiceStatus(id, 'accepted')}
                            variant="secondary"
                            size="md"
                            style={{ flex: 1, backgroundColor: Colors.successLight }}
                            textStyle={{ color: Colors.success }}
                          >
                            Accepter
                          </Button>
                          <Button
                            onPress={() => updateInvoiceStatus(id, 'refused')}
                            variant="secondary"
                            size="md"
                            style={{ flex: 1, backgroundColor: Colors.dangerLight }}
                            textStyle={{ color: Colors.danger }}
                          >
                            Refuser
                          </Button>
                        </>
                      )}
                      {/* Devis accepté → convertir en facture */}
                      {docType === 'quote' && invoice.status === 'accepted' && (
                        <Button
                          onPress={async () => {
                            setLoading(true);
                            try {
                              const copy = await duplicateInvoice(id, { ...profile, document_type: 'invoice' });
                              await updateInvoice(copy.id, { document_type: 'invoice' } as any);
                              if (user) await fetchProfile(user.id);
                              router.replace(`/(app)/invoice/${copy.id}`);
                            } catch (err: any) { Alert.alert('Erreur', err.message); }
                            finally { setLoading(false); }
                          }}
                          size="md"
                          style={{ flex: 1, backgroundColor: '#3B82F6' }}
                        >
                          Convertir en facture
                        </Button>
                      )}
                      <Button onPress={handleDuplicate} variant="outline" size="md" style={{ flex: 1 }}>
                        Dupliquer
                      </Button>
                    </View>
                  </>
                )}
              </View>

              {/* Timestamps */}
              <View style={styles.timestamps}>
                <Text style={styles.tsText}>Créée le {formatDate(invoice.created_at)}</Text>
                {invoice.sent_at && <Text style={styles.tsText}>Envoyée le {formatDate(invoice.sent_at)}</Text>}
                {invoice.paid_at && (
                  <Text style={[styles.tsText, { color: Colors.success }]}>
                    ✓ Payée le {formatDate(invoice.paid_at)}
                  </Text>
                )}
              </View>
            </>
          )}

          {/* ── MODE ÉDITION ── */}
          {editing && (
            <View style={styles.editSection}>
              <Text style={styles.editTitle}>Modifier la facture</Text>

              {/* Bot IA vocal pour édition */}
              <View style={{ marginBottom: Spacing.md, padding: Spacing.md, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, alignItems: 'center' }}>
                <Text style={{ fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginBottom: 10, textAlign: 'center' }}>
                  Modifiez cette facture par la voix !
                </Text>
                {isEditingAudio ? (
                  <View style={{ alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={{ fontSize: FontSize.xs, color: Colors.primary }}>Application des modifications...</Text>
                  </View>
                ) : (
                  <VoiceRecorder onRecordingComplete={handleEditRecordingComplete} mode="edit" />
                )}
              </View>

              {/* Client */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Client</Text>
                <TextInput
                  style={styles.input}
                  value={editClientName}
                  onChangeText={setEditClientName}
                  placeholder="Nom du client"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              {/* Échéance */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date d'échéance</Text>
                <TextInput
                  style={styles.input}
                  value={editDueDate}
                  onChangeText={setEditDueDate}
                  placeholder="AAAA-MM-JJ"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              {/* Prestations */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Prestations</Text>
                {editItems.map((item, idx) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemCardHeader}>
                      <Text style={styles.itemNumber}>#{idx + 1}</Text>
                      {editItems.length > 1 && (
                        <TouchableOpacity onPress={() => removeEditItem(item.id)} style={styles.removeBtn}>
                          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={[styles.input, styles.inputDesc]}
                      value={item.description}
                      onChangeText={(v) => updateEditItem(item.id, 'description', v)}
                      placeholder="Description"
                      placeholderTextColor={Colors.textTertiary}
                      multiline
                    />
                    <View style={styles.itemFieldRow}>
                      <View style={styles.itemFieldCol}>
                        <Text style={styles.itemFieldLabel}>Quantité</Text>
                        <TextInput
                          style={[styles.input, styles.inputSmall]}
                          value={String(item.quantity)}
                          onChangeText={(v) => updateEditItem(item.id, 'quantity', parseFloat(v) || 0)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.itemFieldCol}>
                        <Text style={styles.itemFieldLabel}>Prix HT (€)</Text>
                        <TextInput
                          style={[styles.input, styles.inputSmall]}
                          value={String(item.unit_price)}
                          onChangeText={(v) => updateEditItem(item.id, 'unit_price', parseFloat(v) || 0)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.itemFieldCol}>
                        <Text style={styles.itemFieldLabel}>TVA (%)</Text>
                        <TextInput
                          style={[styles.input, styles.inputSmall]}
                          value={String(item.vat_rate)}
                          onChangeText={(v) => updateEditItem(item.id, 'vat_rate', parseFloat(v) || 0)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <Text style={styles.itemSubtotal}>
                      {formatCurrency(item.quantity * item.unit_price)} HT
                    </Text>
                  </View>
                ))}
                <TouchableOpacity onPress={addEditItem} style={styles.addItemBtn}>
                  <Text style={styles.addItemText}>+ Ajouter une prestation</Text>
                </TouchableOpacity>
              </View>

              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.inputDesc]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Notes additionnelles..."
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                />
              </View>

              {/* Total */}
              <View style={styles.totalBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Sous-total HT</Text>
                  <Text style={styles.totalVal}>{formatCurrency(editSubtotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TVA</Text>
                  <Text style={styles.totalVal}>{formatCurrency(editVat)}</Text>
                </View>
                <View style={[styles.totalRow, styles.totalFinal]}>
                  <Text style={styles.totalFinalLabel}>Total TTC</Text>
                  <Text style={styles.totalFinalVal}>{formatCurrency(editTotal)}</Text>
                </View>
              </View>

              <View style={styles.editButtons}>
                <Button onPress={() => setEditing(false)} variant="outline" style={{ flex: 1 }}>
                  Annuler
                </Button>
                <Button onPress={handleSaveEdit} loading={loading} style={{ flex: 2 }}>
                  Sauvegarder
                </Button>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Email de relance ──────────────────────────────────────────────────────────
function generateReminderHtml(invoice: any, profile: any): string {
  const accentColor = profile.accent_color || '#1D9E75';
  const clientName = invoice.client?.name || invoice.client_name_override || 'Client';
  const total = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.total);
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('fr-FR')
    : 'passée';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;">
  <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:16px;border-radius:8px;margin-bottom:24px;">
      <p style="color:#92400E;font-weight:700;margin:0">Rappel de paiement</p>
    </div>
    <h2 style="color:${accentColor};margin-bottom:8px">${profile.company_name}</h2>
    <p style="color:#6b7280">Bonjour ${clientName},</p>
    <p style="color:#374151;line-height:1.7">
      Sauf erreur de notre part, nous n'avons pas encore reçu le règlement de la facture
      <strong>${invoice.number}</strong> d'un montant de <strong>${total}</strong>,
      dont l'échéance était fixée au <strong>${dueDate}</strong>.
    </p>
    <p style="color:#374151;line-height:1.7">
      Merci de bien vouloir procéder au règlement dans les meilleurs délais.
      En cas de règlement déjà effectué, veuillez ignorer ce message.
    </p>
    <p style="color:#374151;margin-top:24px">Cordialement,</p>
    <p style="color:${accentColor};font-weight:700">${profile.company_name}</p>
  </div>
  <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px">
    Facture générée avec Factu.me
  </p>
</body></html>`;
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
  backBtn: { padding: 4 },
  backText: { fontSize: 28, color: Colors.primary, fontWeight: '300' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'monospace' },
  docTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  docTypePillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 6 },

  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.danger,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  overdueBannerText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },

  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceNumber: { fontSize: FontSize.sm, color: Colors.textTertiary, fontFamily: 'monospace', fontWeight: '600' },
  clientName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  clientEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  datesRow: { flexDirection: 'row', gap: Spacing.xl, marginTop: 4 },
  dateLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },
  dateValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600' },

  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemLeft: { flex: 1, paddingRight: 12 },
  itemDesc: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  itemMeta: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  itemTotal: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalVal: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '500' },
  totalFinal: { borderTopWidth: 1.5, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 },
  totalFinalLabel: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  totalFinalVal: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.primary },
  totalBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  notesText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  emailInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 13,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },

  actions: { gap: Spacing.sm },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  quickVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: 12,
    backgroundColor: Colors.primaryLight,
  },
  quickVoiceBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  timestamps: { alignItems: 'center', gap: 4 },
  tsText: { fontSize: FontSize.xs, color: Colors.textTertiary },

  // ── Édition ──
  editSection: { gap: Spacing.md },
  editTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
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
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemNumber: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textTertiary },
  removeBtn: { padding: 4 },
  itemFieldRow: { flexDirection: 'row', gap: 8 },
  itemFieldCol: { flex: 1, gap: 4 },
  itemFieldLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },
  itemSubtotal: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right' },
  addItemBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  addItemText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  editButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Invoice } from '../types';

// ─── Configuration du handler par défaut ──────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Demande de permissions ───────────────────────────────────────────────────
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Planifier une notif de relance pour une facture ──────────────────────────
// Appelé quand une facture passe au statut "sent"
export async function scheduleInvoiceReminder(invoice: Invoice): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    const clientName = invoice.client?.name || invoice.client_name_override || 'votre client';
    const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.total);

    // Date de déclenchement : date d'échéance ou J+7 si pas d'échéance
    let triggerDate: Date;
    if (invoice.due_date) {
      triggerDate = new Date(invoice.due_date);
      triggerDate.setHours(9, 0, 0, 0); // 9h du matin à la date d'échéance
    } else {
      triggerDate = new Date();
      triggerDate.setDate(triggerDate.getDate() + 7);
      triggerDate.setHours(9, 0, 0, 0);
    }

    // Ne pas planifier si la date est déjà passée
    if (triggerDate <= new Date()) return;

    // Annuler les éventuelles anciennes notifs pour cette facture
    await cancelInvoiceReminder(invoice.id);

    await Notifications.scheduleNotificationAsync({
      identifier: `invoice-reminder-${invoice.id}`,
      content: {
        title: `💰 Facture impayée — ${invoice.number}`,
        body: `${clientName} n'a pas encore payé ${amount}. Envoyez une relance ?`,
        data: { invoiceId: invoice.id, screen: 'invoice-detail' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  } catch (err) {
    console.warn('[notifications] scheduleInvoiceReminder error:', err);
  }
}

// ─── Annuler la notif d'une facture (ex: quand elle est marquée payée) ────────
export async function cancelInvoiceReminder(invoiceId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`invoice-reminder-${invoiceId}`);
  } catch {
    // Ignore si la notif n'existe pas
  }
}

// ─── Scanner toutes les factures overdue et envoyer une notif immédiate ───────
// Appelé au lancement de l'app si des factures sont en retard
export async function checkAndNotifyOverdueInvoices(invoices: Invoice[]): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    const now = new Date();
    const overdueInvoices = invoices.filter(
      (inv) =>
        (inv.document_type === 'invoice' || !inv.document_type) &&
        inv.status === 'sent' &&
        inv.due_date &&
        new Date(inv.due_date) < now
    );

    if (overdueInvoices.length === 0) return;

    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const amountStr = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalOverdue);

    // Une seule notif récap pour ne pas spammer
    const notifId = 'overdue-summary';
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const alreadySent = scheduled.find((n) => n.identifier === notifId);
    if (alreadySent) return; // Déjà planifiée, pas besoin d'en créer une autre

    await Notifications.scheduleNotificationAsync({
      identifier: notifId,
      content: {
        title: `⚠️ ${overdueInvoices.length} facture${overdueInvoices.length > 1 ? 's' : ''} en retard`,
        body: `${amountStr} total en attente de paiement. Relancez vos clients dès maintenant.`,
        data: { screen: 'invoices', filter: 'overdue' },
        sound: true,
        badge: overdueInvoices.length,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5, // Affiche dans 5 secondes (au lancement)
        repeats: false,
      },
    });
  } catch (err) {
    console.warn('[notifications] checkAndNotifyOverdueInvoices error:', err);
  }
}

// ─── Écouter les taps sur les notifications ───────────────────────────────────
export type NotificationTapHandler = (data: Record<string, any>) => void;

export function addNotificationResponseListener(handler: NotificationTapHandler) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, any>;
    handler(data);
  });
}

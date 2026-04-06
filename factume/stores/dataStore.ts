import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Client, Invoice, InvoiceFormData, InvoiceStatus, DashboardStats, RecurringInvoice } from '../types';
import { generateId } from '../lib/utils';

interface DataState {
  clients: Client[];
  invoices: Invoice[];
  recurringInvoices: RecurringInvoice[];
  loading: boolean;
  stats: DashboardStats | null;

  // Client actions
  fetchClients: () => Promise<void>;
  createClient: (data: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<Client>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  // Invoice actions
  fetchInvoices: () => Promise<void>;
  createInvoice: (data: InvoiceFormData, profile: any) => Promise<Invoice>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  duplicateInvoice: (id: string, profile: any) => Promise<Invoice>;
  getNextInvoiceNumber: (prefix: string, count: number) => string;

  // Recurring invoice actions
  fetchRecurringInvoices: () => Promise<void>;
  createRecurringInvoice: (data: Omit<RecurringInvoice, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<RecurringInvoice>;
  updateRecurringInvoice: (id: string, data: Partial<RecurringInvoice>) => Promise<void>;
  deleteRecurringInvoice: (id: string) => Promise<void>;

  // Stats
  computeStats: () => void;
  clearData: () => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  clients: [],
  invoices: [],
  recurringInvoices: [],
  loading: false,
  stats: null,

  clearData: () => set({ clients: [], invoices: [], recurringInvoices: [], stats: null }),

  // ── Clients ────────────────────────────────────────────────────────────────
  fetchClients: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) { console.error('[dataStore] fetchClients:', error); return; }
      set({ clients: data || [] });
    } finally {
      set({ loading: false });
    }
  },

  createClient: async (clientData) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Non authentifié');

    const { data, error } = await supabase
      .from('clients')
      .insert({ ...clientData, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    set((s) => ({ clients: [...s.clients, data].sort((a, b) => a.name.localeCompare(b.name)) }));
    return data;
  },

  updateClient: async (id, updates) => {
    const { data, error } = await supabase
      .from('clients')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? data : c)) }));
  },

  deleteClient: async (id) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
  },

  // ── Factures ───────────────────────────────────────────────────────────────
  fetchInvoices: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(*)')
        .order('created_at', { ascending: false });

      if (error) { console.error('[dataStore] fetchInvoices:', error); return; }
      const invoices = data || [];
      set({ invoices });
      get().computeStats();
    } finally {
      set({ loading: false });
    }
  },

  getNextInvoiceNumber: (prefix, nextCount) => {
    const year = new Date().getFullYear();
    const num = String(nextCount).padStart(3, '0');
    return `${prefix}-${year}-${num}`;
  },

  createInvoice: async (formData, profile) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Non authentifié');

    // Calculer les totaux
    const items = formData.items.map((item) => ({
      ...item,
      id: generateId(),
      total: item.quantity * item.unit_price,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const vatAmount = items.reduce(
      (sum, item) => sum + item.total * (item.vat_rate / 100),
      0
    );
    const total = subtotal + vatAmount;

    const docType = formData.document_type || 'invoice';
    const prefix =
      docType === 'quote' ? 'DEVIS'
      : docType === 'credit_note' ? 'AVOIR'
      : (profile.invoice_prefix || 'FACT');

    // ── Incrément atomique du compteur via RPC pour éviter les doublons ────────
    // La fonction SQL `increment_invoice_count` fait UPDATE … RETURNING en une
    // seule transaction, éliminant la race condition entre plusieurs appareils.
    // Prérequis : exécuter supabase/migrations/increment_invoice_count.sql
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: counters, error: rpcError } = await supabase.rpc(
      'increment_invoice_count',
      { p_user_id: user.id, p_month: currentMonth }
    );

    let invoiceNumber: string;
    if (rpcError || !counters?.invoice_count) {
      // Fallback si la migration SQL n'a pas encore été appliquée
      invoiceNumber = get().getNextInvoiceNumber(prefix, (profile.invoice_count || 0) + 1);
      // Mise à jour manuelle (non-atomique) en fallback
      const isNewMonth = (profile.invoice_month || '') !== currentMonth;
      const prevMonthly = isNewMonth ? 0 : (profile.monthly_invoice_count || 0);
      await supabase
        .from('profiles')
        .update({
          invoice_count: (profile.invoice_count || 0) + 1,
          monthly_invoice_count: prevMonthly + 1,
          invoice_month: currentMonth,
        })
        .eq('id', user.id);
    } else {
      // Chemin nominal : `invoice_count` est déjà le nouveau compteur
      invoiceNumber = get().getNextInvoiceNumber(prefix, counters.invoice_count);
    }

    const invoiceData = {
      user_id: user.id,
      client_id: formData.client_id || null,
      client_name_override: formData.client_name_override || null,
      number: invoiceNumber,
      document_type: docType,
      status: 'draft' as InvoiceStatus,
      issue_date: formData.issue_date,
      due_date: formData.due_date || null,
      items,
      subtotal,
      vat_amount: vatAmount,
      total,
      notes: formData.notes || null,
      linked_invoice_id: formData.linked_invoice_id || null,
    };

    const { data, error } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select('*, client:clients(*)')
      .single();

    if (error) throw error;

    set((s) => ({ invoices: [data, ...s.invoices] }));
    get().computeStats();
    return data;
  },

  updateInvoice: async (id, updates) => {
    // Recalculer les totaux si items changent
    let computedUpdates = { ...updates, updated_at: new Date().toISOString() };
    if (updates.items) {
      const items = updates.items.map((item) => ({
        ...item,
        total: item.quantity * item.unit_price,
      }));
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const vatAmount = items.reduce(
        (sum, item) => sum + item.total * (item.vat_rate / 100),
        0
      );
      computedUpdates = {
        ...computedUpdates,
        items,
        subtotal,
        vat_amount: vatAmount,
        total: subtotal + vatAmount,
      };
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(computedUpdates)
      .eq('id', id)
      .select('*, client:clients(*)')
      .single();

    if (error) throw error;
    set((s) => ({ invoices: s.invoices.map((inv) => (inv.id === id ? data : inv)) }));
    get().computeStats();
  },

  updateInvoiceStatus: async (id, status) => {
    const updates: Partial<Invoice> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'paid') updates.paid_at = new Date().toISOString();
    if (status === 'sent') updates.sent_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select('*, client:clients(*)')
      .single();

    if (error) throw error;
    set((s) => ({ invoices: s.invoices.map((inv) => (inv.id === id ? data : inv)) }));
    get().computeStats();
  },

  deleteInvoice: async (id) => {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
    set((s) => ({ invoices: s.invoices.filter((inv) => inv.id !== id) }));
    get().computeStats();
  },

  duplicateInvoice: async (id, profile) => {
    const { invoices } = get();
    const original = invoices.find((inv) => inv.id === id);
    if (!original) throw new Error('Facture introuvable');

    const { data: { session: dupSession } } = await supabase.auth.getSession();
    const user = dupSession?.user;
    if (!user) throw new Error('Non authentifié');

    const today = new Date().toISOString().split('T')[0];
    const due = new Date();
    due.setDate(due.getDate() + 30);

    const origDocType = original.document_type || 'invoice';
    const dupPrefix =
      origDocType === 'quote' ? 'DEVIS'
      : origDocType === 'credit_note' ? 'AVOIR'
      : (profile.invoice_prefix || 'FACT');

    // Incrément atomique (même logique que createInvoice)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: counters, error: rpcError } = await supabase.rpc(
      'increment_invoice_count',
      { p_user_id: user.id, p_month: currentMonth }
    );

    let dupNumber: string;
    if (rpcError || !counters?.invoice_count) {
      dupNumber = get().getNextInvoiceNumber(dupPrefix, (profile.invoice_count || 0) + 1);
      const isNewMonth = (profile.invoice_month || '') !== currentMonth;
      const prevMonthly = isNewMonth ? 0 : (profile.monthly_invoice_count || 0);
      await supabase
        .from('profiles')
        .update({
          invoice_count: (profile.invoice_count || 0) + 1,
          monthly_invoice_count: prevMonthly + 1,
          invoice_month: currentMonth,
        })
        .eq('id', user.id);
    } else {
      dupNumber = get().getNextInvoiceNumber(dupPrefix, counters.invoice_count);
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        client_id: original.client_id || null,
        client_name_override: original.client_name_override || null,
        number: dupNumber,
        document_type: origDocType,
        status: 'draft' as InvoiceStatus,
        issue_date: today,
        due_date: due.toISOString().split('T')[0],
        items: original.items,
        subtotal: original.subtotal,
        vat_amount: original.vat_amount,
        total: original.total,
        notes: original.notes || null,
      })
      .select('*, client:clients(*)')
      .single();

    if (error) throw error;

    set((s) => ({ invoices: [data, ...s.invoices] }));
    get().computeStats();
    return data;
  },

  // ── Factures récurrentes ───────────────────────────────────────────────────
  fetchRecurringInvoices: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('recurring_invoices')
        .select('*, client:clients(*)')
        .order('next_run_date', { ascending: true });

      if (error) { console.error('[dataStore] fetchRecurringInvoices:', error); return; }
      set({ recurringInvoices: data || [] });
    } finally {
      set({ loading: false });
    }
  },

  createRecurringInvoice: async (recData) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Non authentifié');

    const { data, error } = await supabase
      .from('recurring_invoices')
      .insert({ ...recData, user_id: user.id })
      .select('*, client:clients(*)')
      .single();

    if (error) throw error;
    set((s) => ({ recurringInvoices: [...s.recurringInvoices, data] }));
    return data;
  },

  updateRecurringInvoice: async (id, updates) => {
    const { data, error } = await supabase
      .from('recurring_invoices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, client:clients(*)')
      .single();

    if (error) throw error;
    set((s) => ({ recurringInvoices: s.recurringInvoices.map((r) => (r.id === id ? data : r)) }));
  },

  deleteRecurringInvoice: async (id) => {
    const { error } = await supabase.from('recurring_invoices').delete().eq('id', id);
    if (error) throw error;
    set((s) => ({ recurringInvoices: s.recurringInvoices.filter((r) => r.id !== id) }));
  },

  // ── Stats ──────────────────────────────────────────────────────────────────
  computeStats: () => {
    const { invoices } = get();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthInvoices = invoices.filter(
      (inv) => new Date(inv.created_at) >= startOfMonth
    );

    const paid = invoices.filter((inv) => inv.status === 'paid');
    const pending = invoices.filter((inv) => inv.status === 'sent');
    const overdue = invoices.filter(
      (inv) =>
        inv.status === 'sent' &&
        inv.due_date &&
        new Date(inv.due_date) < now
    );

    const mrr = thisMonthInvoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);

    const totalRevenue = paid.reduce((sum, inv) => sum + inv.total, 0);
    const pendingRevenue = pending.reduce((sum, inv) => sum + inv.total, 0);

    set({
      stats: {
        mrr,
        pendingCount: pending.length,
        paidCount: paid.length,
        overdueCount: overdue.length,
        totalRevenue,
        pendingRevenue,
      },
    });
  },
}));

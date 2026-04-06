export interface Profile {
  id: string;
  email: string;
  company_name: string;
  siret?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country: string;
  phone?: string;
  vat_number?: string;
  logo_url?: string;
  template_id: number;
  accent_color: string;
  legal_status: LegalStatus;
  subscription_tier: SubscriptionTier;
  invoice_count: number;
  monthly_invoice_count: number;
  invoice_month: string;
  invoice_prefix: string;
  onboarding_done: boolean;
  custom_template_html?: string;
  stripe_account_id?: string;
  signature_url?: string;
  language?: 'fr' | 'en';
  expo_push_token?: string;
  sector?: string;
  created_at: string;
}

export type LegalStatus =
  | 'auto-entrepreneur'
  | 'eirl'
  | 'eurl'
  | 'sarl'
  | 'sas'
  | 'sasu'
  | 'sa'
  | 'autre';

export type SubscriptionTier = 'free' | 'solo' | 'pro';

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  siret?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country: string;
  vat_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  total: number;
}

export type DocumentType = 'invoice' | 'quote' | 'credit_note';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'accepted' | 'refused';

export interface Invoice {
  id: string;
  user_id: string;
  client_id?: string;
  client?: Client;
  client_name_override?: string;
  number: string;
  document_type: DocumentType;
  status: InvoiceStatus;
  issue_date: string;
  due_date?: string;
  items: InvoiceItem[];
  subtotal: number;
  vat_amount: number;
  total: number;
  notes?: string;
  pdf_url?: string;
  payment_link?: string;
  payment_method?: string;
  stripe_payment_url?: string;
  voice_transcript?: string;
  linked_invoice_id?: string;
  sent_at?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ParsedVoiceInvoice {
  client_name: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
  }>;
  notes: string | null;
  due_days: number;
}

export interface DashboardStats {
  mrr: number;
  pendingCount: number;
  paidCount: number;
  overdueCount: number;
  totalRevenue: number;
  pendingRevenue: number;
}

export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringInvoice {
  id: string;
  user_id: string;
  client_id?: string;
  client?: Client;
  client_name_override?: string;
  document_type: DocumentType;
  frequency: RecurringFrequency;
  items: InvoiceItem[];
  notes?: string;
  next_run_date: string;
  last_run_date?: string;
  is_active: boolean;
  auto_send: boolean;
  created_at: string;
  updated_at: string;
}

// Invoice/Quote/CreditNote creation form
export interface InvoiceFormData {
  document_type?: DocumentType;
  client_id?: string;
  client_name_override?: string;
  issue_date: string;
  due_date?: string;
  items: Omit<InvoiceItem, 'total'>[];
  notes?: string;
  linked_invoice_id?: string;
}

-- ============================================================
-- MIGRATION SUPABASE — DictaBill
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Colonnes supplémentaires sur la table profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'en'));

-- 2. Table des factures récurrentes
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name_override TEXT,
  document_type TEXT NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice', 'quote', 'credit_note')),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  next_run_date DATE NOT NULL,
  last_run_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_send BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own recurring invoices" ON recurring_invoices
  FOR ALL USING (auth.uid() = user_id);

-- Index pour les requêtes du cron
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_next_run
  ON recurring_invoices (next_run_date, is_active)
  WHERE is_active = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_recurring_invoices_updated_at ON recurring_invoices;
CREATE TRIGGER update_recurring_invoices_updated_at
  BEFORE UPDATE ON recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

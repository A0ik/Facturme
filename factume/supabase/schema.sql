  -- ═══════════════════════════════════════════════════════════════════
  -- DictaBill — Schéma Supabase (v2 — RLS corrigé)
  -- Exécuter dans l'éditeur SQL de ton projet Supabase
  -- ═══════════════════════════════════════════════════════════════════

  -- Extensions
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- ─── TABLE: profiles ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    company_name TEXT DEFAULT '',
    siret TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'France',
    phone TEXT,
    vat_number TEXT,
    logo_url TEXT,
    template_id INTEGER DEFAULT 1,
    accent_color TEXT DEFAULT '#1D9E75',
    legal_status TEXT DEFAULT 'auto-entrepreneur',
    sector TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'solo', 'pro')),
    invoice_count INTEGER DEFAULT 0,
    invoice_prefix TEXT DEFAULT 'FACT',
    onboarding_done BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- ─── TABLE: clients ───────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    siret TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'France',
    vat_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- ─── TABLE: invoices ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name_override TEXT,
    number TEXT NOT NULL,
    document_type TEXT DEFAULT 'invoice' CHECK (document_type IN ('invoice', 'quote', 'credit_note')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'accepted', 'refused')),
    linked_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    items JSONB DEFAULT '[]'::jsonb,
    subtotal DECIMAL(12,2) DEFAULT 0,
    vat_amount DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    pdf_url TEXT,
    payment_link TEXT,
    voice_transcript TEXT,
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

  -- Supprimer les anciennes politiques si elles existent
  DROP POLICY IF EXISTS "profiles_own" ON profiles;
  DROP POLICY IF EXISTS "clients_own" ON clients;
  DROP POLICY IF EXISTS "invoices_own" ON invoices;

  -- Profiles : politiques séparées par opération (plus fiable)
  CREATE POLICY "profiles_select" ON profiles
    FOR SELECT USING (auth.uid() = id);

  CREATE POLICY "profiles_insert" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

  CREATE POLICY "profiles_update" ON profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

  CREATE POLICY "profiles_delete" ON profiles
    FOR DELETE USING (auth.uid() = id);

  -- Clients
  CREATE POLICY "clients_select" ON clients
    FOR SELECT USING (auth.uid() = user_id);

  CREATE POLICY "clients_insert" ON clients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "clients_update" ON clients
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "clients_delete" ON clients
    FOR DELETE USING (auth.uid() = user_id);

  -- Invoices
  CREATE POLICY "invoices_select" ON invoices
    FOR SELECT USING (auth.uid() = user_id);

  CREATE POLICY "invoices_insert" ON invoices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "invoices_update" ON invoices
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "invoices_delete" ON invoices
    FOR DELETE USING (auth.uid() = user_id);

  -- ─── TRIGGER: créer un profil à l'inscription ─────────────────────────────────
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger AS $$
  BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

  -- ─── TRIGGER: updated_at automatique ──────────────────────────────────────────
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
  CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
  CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
  CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  -- ─── INDEX pour les performances ─────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

  -- ─── MIGRATION: ajouter colonne sector si elle n'existe pas ──────────────────
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sector TEXT;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_template_html TEXT;

  -- ─── MIGRATION: limite mensuelle factures plan gratuit ───────────────────────
  -- monthly_invoice_count : nb de factures créées ce mois (ne décrémente pas à la suppression)
  -- invoice_month         : mois courant au format 'YYYY-MM' (ex: '2026-03'), sert à détecter le changement de mois
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_invoice_count INTEGER DEFAULT 0;
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invoice_month TEXT DEFAULT '';

  -- ─── MIGRATION: stripe_account_id ────────────────────────────────────────────
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

  -- ─── MIGRATION: devis, avoirs, Factur-X ──────────────────────────────────────
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'invoice'
    CHECK (document_type IN ('invoice', 'quote', 'credit_note'));
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS linked_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
  ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
  ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'accepted', 'refused'));
  CREATE INDEX IF NOT EXISTS idx_invoices_document_type ON invoices(document_type);

  -- ─── MIGRATION: Supabase Storage bucket for company logos ────────────────────
  -- Run this in Supabase SQL editor OR via Storage dashboard (create public bucket "logos")
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('logos', 'logos', true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
  ON CONFLICT (id) DO NOTHING;

  -- RLS policies for logos bucket
  DROP POLICY IF EXISTS "Users can upload their own logo" ON storage.objects;
  CREATE POLICY "Users can upload their own logo"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

  DROP POLICY IF EXISTS "Users can update their own logo" ON storage.objects;
  CREATE POLICY "Users can update their own logo"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

  DROP POLICY IF EXISTS "Anyone can read logos" ON storage.objects;
  CREATE POLICY "Anyone can read logos"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'logos');

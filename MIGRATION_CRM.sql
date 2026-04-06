-- Migration CRM — Table opportunities
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.opportunities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name   TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL,
  value         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stage         TEXT NOT NULL DEFAULT 'prospect'
                  CHECK (stage IN ('prospect','qualified','proposal','negotiation','won','lost')),
  probability   INTEGER NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  expected_close_date DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes par user
CREATE INDEX IF NOT EXISTS opportunities_user_id_idx ON public.opportunities(user_id);
CREATE INDEX IF NOT EXISTS opportunities_stage_idx   ON public.opportunities(stage);

-- RLS
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own opportunities"
  ON public.opportunities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_opportunities_updated_at ON public.opportunities;
CREATE TRIGGER set_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

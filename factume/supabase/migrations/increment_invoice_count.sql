-- ─── Fonction RPC : incrément atomique du compteur de factures ─────────────────
-- Résout la race condition où deux appels simultanés généreraient le même numéro.
-- À exécuter une seule fois dans l'éditeur SQL de Supabase.
--
-- Usage depuis le client :
--   const { data } = await supabase.rpc('increment_invoice_count', {
--     p_user_id: user.id,
--     p_month: '2026-03',
--   });
--   // data.invoice_count = nouveau compteur (après incrément)

CREATE OR REPLACE FUNCTION increment_invoice_count(p_user_id UUID, p_month TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_count  INT;
  v_monthly_count  INT;
BEGIN
  UPDATE profiles
  SET
    invoice_count        = invoice_count + 1,
    monthly_invoice_count = CASE
      WHEN invoice_month IS DISTINCT FROM p_month THEN 1
      ELSE monthly_invoice_count + 1
    END,
    invoice_month = p_month
  WHERE id = p_user_id
  RETURNING invoice_count, monthly_invoice_count
  INTO v_invoice_count, v_monthly_count;

  RETURN json_build_object(
    'invoice_count',         v_invoice_count,
    'monthly_invoice_count', v_monthly_count
  );
END;
$$;

-- Accorder l'exécution aux utilisateurs authentifiés uniquement
REVOKE ALL ON FUNCTION increment_invoice_count(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_invoice_count(UUID, TEXT) TO authenticated;

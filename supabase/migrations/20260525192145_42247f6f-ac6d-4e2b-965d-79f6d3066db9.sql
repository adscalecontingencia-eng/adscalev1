
-- 1) Block password column reads for all non-service roles
REVOKE SELECT (password) ON public.clients FROM PUBLIC, anon, authenticated;
REVOKE SELECT (password) ON public.support_users FROM PUBLIC, anon, authenticated;

-- 2) Restrict commission_tiers SELECT to admin/support
DROP POLICY IF EXISTS "Authenticated can view tiers" ON public.commission_tiers;
CREATE POLICY "Admin/support view tiers"
  ON public.commission_tiers
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'support'::app_role));

-- 3) Realtime authorization: only admin/support may subscribe
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin/support realtime read" ON realtime.messages;
CREATE POLICY "Admin/support realtime read"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'support'::app_role));

-- 4) Revoke EXECUTE on internal trigger functions (keep has_role for RLS)
REVOKE EXECUTE ON FUNCTION public.sync_transaction_to_commission() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_partner_commission() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_partner_commission_payout() FROM PUBLIC, anon, authenticated;

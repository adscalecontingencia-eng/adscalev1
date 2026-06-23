
CREATE TABLE public.download_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  product_id uuid,
  user_id uuid,
  requested_by uuid,
  file_path text,
  signed_url_expires_at timestamptz,
  download_released boolean NOT NULL DEFAULT false,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.download_audit_log TO authenticated;
GRANT ALL ON public.download_audit_log TO service_role;
ALTER TABLE public.download_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view download audit" ON public.download_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_download_audit_order ON public.download_audit_log(marketplace_order_id);
CREATE INDEX idx_download_audit_user ON public.download_audit_log(user_id);
CREATE INDEX idx_download_audit_created ON public.download_audit_log(created_at DESC);

CREATE TABLE public.payment_admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('wallet_deposit','marketplace_order')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('reprocess','refund','mark_credited','release_download','note')),
  performed_by uuid,
  performed_by_email text,
  reason text,
  previous_state jsonb,
  new_state jsonb,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_admin_actions TO authenticated;
GRANT ALL ON public.payment_admin_actions TO service_role;
ALTER TABLE public.payment_admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view admin actions" ON public.payment_admin_actions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_admin_actions_target ON public.payment_admin_actions(target_type, target_id);
CREATE INDEX idx_admin_actions_created ON public.payment_admin_actions(created_at DESC);

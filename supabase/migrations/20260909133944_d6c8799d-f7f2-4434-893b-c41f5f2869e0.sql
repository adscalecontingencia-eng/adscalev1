CREATE TABLE public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  amount_usd numeric(12,2) NOT NULL DEFAULT 0,
  fx_rate numeric(12,6),
  amount_brl numeric(12,2),
  provider text NOT NULL DEFAULT 'mercado_pago',
  external_reference text NOT NULL,
  mercado_pago_payment_id text,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  status text NOT NULL DEFAULT 'aberta',
  due_date date,
  reminders_sent integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  paid_at timestamptz,
  marked_paid_by uuid,
  note text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX billing_invoices_external_reference_key ON public.billing_invoices (external_reference);
CREATE UNIQUE INDEX billing_invoices_client_week_key ON public.billing_invoices (client_id, week_start);
CREATE INDEX billing_invoices_status_idx ON public.billing_invoices (status, week_start DESC);

GRANT SELECT ON public.billing_invoices TO authenticated;
GRANT ALL ON public.billing_invoices TO service_role;

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own invoices"
ON public.billing_invoices FOR SELECT TO authenticated
USING (
  client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
);

CREATE POLICY "Staff manage invoices"
ON public.billing_invoices FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));

CREATE TRIGGER trg_billing_invoices_updated_at
BEFORE UPDATE ON public.billing_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.settle_invoice_payment(_invoice_id uuid, _mp_payment_id text DEFAULT NULL, _raw jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv record;
  v_client_name text;
  v_remaining numeric(12,2);
  v_c record;
  v_apply numeric(12,2);
BEGIN
  SELECT * INTO v_inv FROM public.billing_invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invoice_not_found');
  END IF;

  IF v_inv.status = 'paga' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true);
  END IF;

  UPDATE public.billing_invoices
     SET status = 'paga',
         paid_at = now(),
         mercado_pago_payment_id = COALESCE(_mp_payment_id, mercado_pago_payment_id),
         raw_response = COALESCE(_raw, raw_response),
         updated_at = now()
   WHERE id = v_inv.id
  RETURNING * INTO v_inv;

  v_remaining := v_inv.amount_usd;

  FOR v_c IN
    SELECT * FROM public.commissions
     WHERE client_id = v_inv.client_id
       AND COALESCE(valor_pendente, 0) > 0
     ORDER BY COALESCE(billing_week_start, date) ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_apply := LEAST(v_remaining, COALESCE(v_c.valor_pendente, 0));
    UPDATE public.commissions
       SET valor_pago = COALESCE(valor_pago, 0) + v_apply,
           valor_pendente = COALESCE(valor_pendente, 0) - v_apply,
           status = CASE WHEN COALESCE(valor_pendente, 0) - v_apply <= 0 THEN 'pago' ELSE 'parcial' END
     WHERE id = v_c.id;
    v_remaining := v_remaining - v_apply;
  END LOOP;

  SELECT name INTO v_client_name FROM public.clients WHERE id = v_inv.client_id;

  INSERT INTO public.transactions (date, type, category, description, amount, client_id, quantidade, valor_venda, status, source_type, source_id)
  VALUES (
    CURRENT_DATE,
    'receita',
    'Comissão Semanal',
    'Pagamento fatura semanal (Pix) — ' || COALESCE(v_client_name, '') || ' — semana ' || to_char(v_inv.week_start, 'DD/MM') || ' a ' || to_char(v_inv.week_end, 'DD/MM'),
    v_inv.amount_usd,
    v_inv.client_id,
    1,
    v_inv.amount_usd,
    'confirmado',
    'billing_invoice',
    v_inv.id::text
  )
  ON CONFLICT (source_type, source_id) DO UPDATE
    SET status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        valor_venda = EXCLUDED.valor_venda;

  RETURN jsonb_build_object('ok', true, 'invoice_id', v_inv.id, 'amount_usd', v_inv.amount_usd);
END;
$$;

INSERT INTO public.support_settings (key, value)
VALUES ('billing_fx_margin_pct', '2')
ON CONFLICT (key) DO NOTHING;
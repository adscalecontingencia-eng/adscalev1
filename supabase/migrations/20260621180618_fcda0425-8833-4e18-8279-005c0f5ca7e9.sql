
CREATE TABLE public.mercadopago_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  external_reference text NOT NULL UNIQUE,
  customer_name text,
  customer_email text,
  customer_document text,
  product_name text,
  plan_id text,
  amount numeric(12,2) NOT NULL,
  mercado_pago_order_id text,
  mercado_pago_payment_id text,
  pix_qr_code text,
  pix_qr_code_base64 text,
  pix_ticket_url text,
  status text,
  status_detail text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

GRANT SELECT ON public.mercadopago_payments TO authenticated;
GRANT ALL ON public.mercadopago_payments TO service_role;

ALTER TABLE public.mercadopago_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mercadopago payments"
  ON public.mercadopago_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_mercadopago_payments_updated_at
  BEFORE UPDATE ON public.mercadopago_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mercadopago_payments_external_ref ON public.mercadopago_payments(external_reference);
CREATE INDEX idx_mercadopago_payments_user_id ON public.mercadopago_payments(user_id);
CREATE INDEX idx_mercadopago_payments_mp_order_id ON public.mercadopago_payments(mercado_pago_order_id);

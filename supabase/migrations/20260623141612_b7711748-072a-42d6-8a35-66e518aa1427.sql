
-- Carteira do usuário (qualquer auth.user pode ter)
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Movimentos da carteira
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit','purchase','refund','adjustment')),
  amount numeric(12,2) NOT NULL,
  balance_after numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','cancelled')),
  reference_type text,
  reference_id text,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own wallet tx" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_wallet_tx_user_created ON public.wallet_transactions(user_id, created_at DESC);

-- Depósitos Pix
CREATE TABLE public.wallet_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending',
  status_detail text,
  external_reference text UNIQUE NOT NULL,
  mercado_pago_order_id text,
  mercado_pago_payment_id text,
  pix_qr_code text,
  pix_qr_code_base64 text,
  pix_ticket_url text,
  credited_at timestamptz,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_deposits TO authenticated;
GRANT ALL ON public.wallet_deposits TO service_role;
ALTER TABLE public.wallet_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own deposits" ON public.wallet_deposits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_deposits_user_created ON public.wallet_deposits(user_id, created_at DESC);
CREATE INDEX idx_deposits_ext_ref ON public.wallet_deposits(external_reference);

CREATE TRIGGER trg_deposits_updated_at BEFORE UPDATE ON public.wallet_deposits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função: creditar carteira de forma atômica (idempotente por external_reference)
CREATE OR REPLACE FUNCTION public.credit_wallet_from_deposit(_external_reference text, _mp_payment_id text, _raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep record;
  v_new_balance numeric(12,2);
BEGIN
  SELECT * INTO v_dep FROM public.wallet_deposits WHERE external_reference = _external_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'deposit_not_found'); END IF;
  IF v_dep.credited_at IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'already_credited', true); END IF;

  INSERT INTO public.wallets(user_id, balance) VALUES (v_dep.user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
    SET balance = balance + v_dep.amount, updated_at = now()
    WHERE user_id = v_dep.user_id
    RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, status, reference_type, reference_id, description, metadata)
    VALUES (v_dep.user_id, 'deposit', v_dep.amount, v_new_balance, 'completed', 'wallet_deposit', v_dep.id::text,
            'Depósito via Pix', jsonb_build_object('mp_payment_id', _mp_payment_id));

  UPDATE public.wallet_deposits
    SET status='approved', mercado_pago_payment_id = COALESCE(_mp_payment_id, mercado_pago_payment_id),
        credited_at = now(), raw_response = COALESCE(_raw, raw_response), updated_at = now()
    WHERE id = v_dep.id;

  RETURN jsonb_build_object('ok', true, 'new_balance', v_new_balance);
END;
$$;

-- Função: debitar carteira para compra (atômica)
CREATE OR REPLACE FUNCTION public.purchase_with_wallet(_product_id uuid, _quantity int DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_product record;
  v_total numeric(12,2);
  v_balance numeric(12,2);
  v_new_balance numeric(12,2);
  v_order_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  IF _quantity IS NULL OR _quantity < 1 THEN _quantity := 1; END IF;

  SELECT id, name, price, status INTO v_product FROM public.marketplace_products WHERE id = _product_id;
  IF NOT FOUND OR v_product.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'product_unavailable'); END IF;

  v_total := v_product.price * _quantity;

  INSERT INTO public.wallets(user_id, balance) VALUES (v_uid, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF v_balance < v_total THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_balance', 'balance', v_balance, 'required', v_total);
  END IF;

  UPDATE public.wallets SET balance = balance - v_total, updated_at = now() WHERE user_id = v_uid RETURNING balance INTO v_new_balance;

  INSERT INTO public.marketplace_orders(user_id, product_id, external_reference, amount, status, status_detail,
                                        customer_email, customer_name, download_released)
    VALUES (v_uid, v_product.id, 'wallet-'||gen_random_uuid()::text, v_total, 'approved', 'wallet_balance',
            (SELECT email FROM auth.users WHERE id = v_uid),
            COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = v_uid), 'Cliente'),
            true)
    RETURNING id INTO v_order_id;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, status, reference_type, reference_id, description)
    VALUES (v_uid, 'purchase', -v_total, v_new_balance, 'completed', 'marketplace_order', v_order_id::text,
            'Compra: '||v_product.name);

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_with_wallet(uuid, int) TO authenticated;

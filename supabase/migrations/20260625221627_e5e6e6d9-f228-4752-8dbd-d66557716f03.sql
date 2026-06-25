
-- 1. Adicionar categoria nos produtos do marketplace
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Marketplace';

-- 2. Atualizar credit_wallet_from_deposit para lançar a receita
CREATE OR REPLACE FUNCTION public.credit_wallet_from_deposit(_external_reference text, _mp_payment_id text, _raw jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dep record;
  v_new_balance numeric(12,2);
  v_user_email text;
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

  -- Lançamento financeiro (receita) — categoria fixa "Depósito Wallet"
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_dep.user_id;
  INSERT INTO public.transactions (date, type, category, description, amount, quantidade, valor_venda)
  VALUES (
    CURRENT_DATE,
    'receita',
    'Depósito Wallet',
    'Depósito Wallet via Pix — ' || COALESCE(v_user_email, v_dep.user_id::text),
    v_dep.amount,
    1,
    v_dep.amount
  );

  RETURN jsonb_build_object('ok', true, 'new_balance', v_new_balance);
END;
$function$;

-- 3. Atualizar purchase_with_wallet para lançar o gasto com a categoria do produto
CREATE OR REPLACE FUNCTION public.purchase_with_wallet(_product_id uuid, _quantity integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_product record;
  v_total numeric(12,2);
  v_balance numeric(12,2);
  v_new_balance numeric(12,2);
  v_order_id uuid;
  v_user_email text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  IF _quantity IS NULL OR _quantity < 1 THEN _quantity := 1; END IF;

  SELECT id, name, price, status, category INTO v_product FROM public.marketplace_products WHERE id = _product_id;
  IF NOT FOUND OR v_product.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'product_unavailable'); END IF;

  v_total := v_product.price * _quantity;

  INSERT INTO public.wallets(user_id, balance) VALUES (v_uid, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF v_balance < v_total THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_balance', 'balance', v_balance, 'required', v_total);
  END IF;

  UPDATE public.wallets SET balance = balance - v_total, updated_at = now() WHERE user_id = v_uid RETURNING balance INTO v_new_balance;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.marketplace_orders(user_id, product_id, external_reference, amount, status, status_detail,
                                        customer_email, customer_name, download_released)
    VALUES (v_uid, v_product.id, 'wallet-'||gen_random_uuid()::text, v_total, 'approved', 'wallet_balance',
            v_user_email,
            COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = v_uid), 'Cliente'),
            true)
    RETURNING id INTO v_order_id;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, status, reference_type, reference_id, description)
    VALUES (v_uid, 'purchase', -v_total, v_new_balance, 'completed', 'marketplace_order', v_order_id::text,
            'Compra: '||v_product.name);

  -- Lançamento financeiro (gasto) usando a categoria do produto
  INSERT INTO public.transactions (date, type, category, description, amount, quantidade, custo_produto)
  VALUES (
    CURRENT_DATE,
    'gasto',
    COALESCE(NULLIF(v_product.category, ''), 'Marketplace'),
    'Compra Marketplace: ' || v_product.name || ' — ' || COALESCE(v_user_email, v_uid::text),
    v_total,
    _quantity,
    v_total
  );

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$function$;

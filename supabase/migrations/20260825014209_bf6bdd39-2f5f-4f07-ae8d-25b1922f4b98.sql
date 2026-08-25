-- 1. Referral fields on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at timestamptz;

CREATE OR REPLACE FUNCTION public.generate_referral_code(_seed text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_code text;
  v_i int := 0;
BEGIN
  v_base := upper(regexp_replace(COALESCE(_seed, 'ADS'), '[^a-zA-Z0-9]', '', 'g'));
  v_base := left(COALESCE(NULLIF(v_base, ''), 'ADS'), 6);
  LOOP
    v_code := v_base || lpad((floor(random() * 10000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clients WHERE referral_code = v_code);
    v_i := v_i + 1;
    IF v_i > 50 THEN
      v_code := v_base || replace(gen_random_uuid()::text, '-', '');
      v_code := left(v_code, 14);
      EXIT;
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

UPDATE public.clients
   SET referral_code = public.generate_referral_code(name)
 WHERE referral_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_referral_code_key ON public.clients (referral_code);
CREATE INDEX IF NOT EXISTS clients_referred_by_idx ON public.clients (referred_by_client_id);

CREATE OR REPLACE FUNCTION public.clients_set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_referral_code ON public.clients;
CREATE TRIGGER trg_clients_referral_code
BEFORE INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_set_referral_code();

-- 2. Credits ledger
CREATE TABLE IF NOT EXISTS public.referral_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  referred_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('signup', 'milestone', 'manual')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  milestone_index integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
  note text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_credits_signup_uniq
  ON public.referral_credits (referred_client_id) WHERE type = 'signup';
CREATE UNIQUE INDEX IF NOT EXISTS referral_credits_milestone_uniq
  ON public.referral_credits (referred_client_id, milestone_index) WHERE type = 'milestone';
CREATE INDEX IF NOT EXISTS referral_credits_referrer_idx ON public.referral_credits (referrer_client_id);

GRANT SELECT ON public.referral_credits TO authenticated;
GRANT ALL ON public.referral_credits TO service_role;

ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own referral credits"
ON public.referral_credits FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = referral_credits.referrer_client_id AND c.auth_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
);

CREATE POLICY "Staff manage referral credits"
ON public.referral_credits FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));

GRANT INSERT, UPDATE, DELETE ON public.referral_credits TO authenticated;

DROP TRIGGER IF EXISTS trg_referral_credits_updated ON public.referral_credits;
CREATE TRIGGER trg_referral_credits_updated
BEFORE UPDATE ON public.referral_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Signup bonus (US$ 20)
CREATE OR REPLACE FUNCTION public.award_referral_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referred_by_client_id IS NOT NULL
     AND NEW.referred_by_client_id <> NEW.id
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.referred_by_client_id::text, '') IS DISTINCT FROM NEW.referred_by_client_id::text) THEN
    INSERT INTO public.referral_credits (referrer_client_id, referred_client_id, type, amount, note)
    VALUES (NEW.referred_by_client_id, NEW.id, 'signup', 20, 'Bônus de indicação: cadastro de ' || COALESCE(NEW.name, NEW.email))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_referral_signup ON public.clients;
CREATE TRIGGER trg_clients_referral_signup
AFTER INSERT OR UPDATE OF referred_by_client_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.award_referral_signup();

-- 4. Milestones (US$ 50 a cada US$ 1.000 pagos)
CREATE OR REPLACE FUNCTION public.award_referral_milestones(_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer uuid;
  v_name text;
  v_paid numeric;
  v_target int;
  v_i int;
BEGIN
  SELECT referred_by_client_id, COALESCE(name, email) INTO v_referrer, v_name
    FROM public.clients WHERE id = _client_id;
  IF v_referrer IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(valor_pago), 0) INTO v_paid
    FROM public.commissions WHERE client_id = _client_id;

  v_target := floor(v_paid / 1000.0)::int;
  IF v_target < 1 THEN RETURN; END IF;

  FOR v_i IN 1..v_target LOOP
    INSERT INTO public.referral_credits (referrer_client_id, referred_client_id, type, amount, milestone_index, note)
    VALUES (v_referrer, _client_id, 'milestone', 50, v_i,
            'Meta de US$ ' || (v_i * 1000)::text || ' paga por ' || COALESCE(v_name, 'indicado'))
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.commissions_referral_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND COALESCE(NEW.valor_pago, 0) > COALESCE(OLD.valor_pago, 0) THEN
    PERFORM public.award_referral_milestones(NEW.client_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commissions_referral_milestone ON public.commissions;
CREATE TRIGGER trg_commissions_referral_milestone
AFTER INSERT OR UPDATE OF valor_pago ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.commissions_referral_milestone();

-- 5. Summary RPC for the logged-in client
CREATE OR REPLACE FUNCTION public.get_referral_summary(_client_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client record;
  v_is_staff boolean;
BEGIN
  v_is_staff := public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role);

  IF _client_id IS NOT NULL AND v_is_staff THEN
    SELECT * INTO v_client FROM public.clients WHERE id = _client_id;
  ELSE
    SELECT * INTO v_client FROM public.clients WHERE auth_user_id = auth.uid();
  END IF;

  IF v_client.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'client_not_found'); END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', v_client.id,
    'referral_code', v_client.referral_code,
    'totals', (
      SELECT jsonb_build_object(
        'total', COALESCE(SUM(amount), 0),
        'pending', COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0),
        'applied', COALESCE(SUM(amount) FILTER (WHERE status = 'applied'), 0),
        'signup_count', COUNT(*) FILTER (WHERE type = 'signup'),
        'milestone_count', COUNT(*) FILTER (WHERE type = 'milestone')
      ) FROM public.referral_credits WHERE referrer_client_id = v_client.id AND status <> 'cancelled'
    ),
    'referrals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'created_at', r.created_at,
        'referred_at', r.referred_at,
        'total_paid', COALESCE((SELECT SUM(valor_pago) FROM public.commissions WHERE client_id = r.id), 0),
        'credits', COALESCE((SELECT SUM(amount) FROM public.referral_credits rc WHERE rc.referred_client_id = r.id AND rc.referrer_client_id = v_client.id AND rc.status <> 'cancelled'), 0)
      ) ORDER BY r.created_at DESC)
      FROM public.clients r WHERE r.referred_by_client_id = v_client.id
    ), '[]'::jsonb),
    'credits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rc.id, 'type', rc.type, 'amount', rc.amount, 'status', rc.status,
        'note', rc.note, 'created_at', rc.created_at
      ) ORDER BY rc.created_at DESC)
      FROM public.referral_credits rc WHERE rc.referrer_client_id = v_client.id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_summary(uuid) TO authenticated;
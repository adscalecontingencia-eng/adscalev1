-- 1. Alerts table
CREATE TABLE IF NOT EXISTS public.referral_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  referred_client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('approaching', 'awarded')),
  milestone_index integer NOT NULL,
  estimated_amount numeric(12,2) NOT NULL DEFAULT 50,
  remaining_amount numeric(12,2) NOT NULL DEFAULT 0,
  progress_pct numeric(6,2) NOT NULL DEFAULT 0,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_alerts_uniq
  ON public.referral_alerts (referrer_client_id, referred_client_id, kind, milestone_index);
CREATE INDEX IF NOT EXISTS referral_alerts_referrer_idx ON public.referral_alerts (referrer_client_id, created_at DESC);

GRANT SELECT, UPDATE ON public.referral_alerts TO authenticated;
GRANT ALL ON public.referral_alerts TO service_role;

ALTER TABLE public.referral_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referrer reads own alerts" ON public.referral_alerts;
CREATE POLICY "Referrer reads own alerts"
ON public.referral_alerts FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = referral_alerts.referrer_client_id AND c.auth_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
);

DROP POLICY IF EXISTS "Referrer marks own alerts read" ON public.referral_alerts;
CREATE POLICY "Referrer marks own alerts read"
ON public.referral_alerts FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = referral_alerts.referrer_client_id AND c.auth_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.id = referral_alerts.referrer_client_id AND c.auth_user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'support'::app_role)
);

DROP TRIGGER IF EXISTS trg_referral_alerts_updated ON public.referral_alerts;
CREATE TRIGGER trg_referral_alerts_updated
BEFORE UPDATE ON public.referral_alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Alert when a milestone credit is created
CREATE OR REPLACE FUNCTION public.referral_credit_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'milestone' THEN
    INSERT INTO public.referral_alerts (referrer_client_id, referred_client_id, kind, milestone_index, estimated_amount, remaining_amount, progress_pct)
    VALUES (NEW.referrer_client_id, NEW.referred_client_id, 'awarded', COALESCE(NEW.milestone_index, 0), NEW.amount, 0, 100)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_credit_alert ON public.referral_credits;
CREATE TRIGGER trg_referral_credit_alert
AFTER INSERT ON public.referral_credits
FOR EACH ROW EXECUTE FUNCTION public.referral_credit_alert();

-- 3. Detect partners approaching the next US$ 1,000 milestone
CREATE OR REPLACE FUNCTION public.detect_referral_milestone_alerts(_threshold_pct numeric DEFAULT 70)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  WITH pairs AS (
    SELECT r.referred_by_client_id AS referrer_id,
           r.id AS referred_id,
           COALESCE((SELECT SUM(valor_pago) FROM public.commissions c WHERE c.client_id = r.id), 0) AS paid
      FROM public.clients r
     WHERE r.referred_by_client_id IS NOT NULL
  ), calc AS (
    SELECT referrer_id, referred_id, paid,
           (floor(paid / 1000.0) + 1)::int AS next_index,
           ((paid - floor(paid / 1000.0) * 1000) / 1000.0 * 100)::numeric(6,2) AS pct,
           ((floor(paid / 1000.0) + 1) * 1000 - paid)::numeric(12,2) AS remaining
      FROM pairs
  )
  INSERT INTO public.referral_alerts (referrer_client_id, referred_client_id, kind, milestone_index, estimated_amount, remaining_amount, progress_pct)
  SELECT referrer_id, referred_id, 'approaching', next_index, 50, remaining, pct
    FROM calc
   WHERE pct >= _threshold_pct
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_referral_milestone_alerts(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.detect_referral_milestone_alerts(numeric) TO service_role;

-- 4. Statement RPC (credits ledger + progress)
CREATE OR REPLACE FUNCTION public.get_referral_statement(_client_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
  v_client record;
  v_all boolean := false;
BEGIN
  v_is_staff := public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role);

  IF _client_id IS NOT NULL AND v_is_staff THEN
    SELECT * INTO v_client FROM public.clients WHERE id = _client_id;
  ELSIF _client_id IS NULL AND v_is_staff THEN
    v_all := true;
  ELSE
    SELECT * INTO v_client FROM public.clients WHERE auth_user_id = auth.uid();
  END IF;

  IF NOT v_all AND v_client.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'client_not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'scope', CASE WHEN v_all THEN 'all' ELSE 'client' END,
    'client_id', v_client.id,
    'client_name', v_client.name,
    'referral_code', v_client.referral_code,
    'entries', COALESCE((
      SELECT jsonb_agg(e ORDER BY e->>'created_at' DESC) FROM (
        SELECT jsonb_build_object(
          'id', rc.id,
          'created_at', rc.created_at,
          'type', rc.type,
          'amount', rc.amount,
          'status', rc.status,
          'note', rc.note,
          'milestone_index', rc.milestone_index,
          'applied_at', rc.applied_at,
          'referrer_id', rc.referrer_client_id,
          'referrer_name', rf.name,
          'referred_id', rc.referred_client_id,
          'referred_name', rd.name
        ) AS e
        FROM public.referral_credits rc
        LEFT JOIN public.clients rd ON rd.id = rc.referred_client_id
        LEFT JOIN public.clients rf ON rf.id = rc.referrer_client_id
        WHERE v_all OR rc.referrer_client_id = v_client.id
      ) s
    ), '[]'::jsonb),
    'progress', COALESCE((
      SELECT jsonb_agg(p) FROM (
        SELECT jsonb_build_object(
          'referrer_id', r.referred_by_client_id,
          'referrer_name', (SELECT name FROM public.clients x WHERE x.id = r.referred_by_client_id),
          'referred_id', r.id,
          'referred_name', r.name,
          'total_paid', paid.v,
          'next_index', (floor(paid.v / 1000.0) + 1)::int,
          'remaining', ((floor(paid.v / 1000.0) + 1) * 1000 - paid.v),
          'progress_pct', ((paid.v - floor(paid.v / 1000.0) * 1000) / 1000.0 * 100),
          'next_bonus', 50
        ) AS p
        FROM public.clients r
        CROSS JOIN LATERAL (
          SELECT COALESCE((SELECT SUM(valor_pago) FROM public.commissions c WHERE c.client_id = r.id), 0) AS v
        ) paid
        WHERE r.referred_by_client_id IS NOT NULL
          AND (v_all OR r.referred_by_client_id = v_client.id)
      ) s2
    ), '[]'::jsonb),
    'alerts', COALESCE((
      SELECT jsonb_agg(a ORDER BY a->>'created_at' DESC) FROM (
        SELECT jsonb_build_object(
          'id', ra.id,
          'kind', ra.kind,
          'milestone_index', ra.milestone_index,
          'estimated_amount', ra.estimated_amount,
          'remaining_amount', ra.remaining_amount,
          'progress_pct', ra.progress_pct,
          'read_at', ra.read_at,
          'created_at', ra.created_at,
          'referred_id', ra.referred_client_id,
          'referred_name', rd2.name
        ) AS a
        FROM public.referral_alerts ra
        LEFT JOIN public.clients rd2 ON rd2.id = ra.referred_client_id
        WHERE v_all OR ra.referrer_client_id = v_client.id
      ) s3
    ), '[]'::jsonb),
    'totals', (
      SELECT jsonb_build_object(
        'total', COALESCE(SUM(amount), 0),
        'pending', COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0),
        'applied', COALESCE(SUM(amount) FILTER (WHERE status = 'applied'), 0),
        'cancelled', COALESCE(SUM(amount) FILTER (WHERE status = 'cancelled'), 0),
        'signup_count', COUNT(*) FILTER (WHERE type = 'signup'),
        'milestone_count', COUNT(*) FILTER (WHERE type = 'milestone')
      )
      FROM public.referral_credits rc2
      WHERE v_all OR rc2.referrer_client_id = v_client.id
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_referral_statement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_statement(uuid) TO authenticated;
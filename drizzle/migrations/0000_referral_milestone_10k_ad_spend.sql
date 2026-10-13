CREATE OR REPLACE FUNCTION public.award_referral_milestones(_client_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_referrer uuid; v_name text; v_paid numeric; v_target int; v_i int;
BEGIN
  SELECT referred_by_client_id, COALESCE(name, email) INTO v_referrer, v_name FROM public.clients WHERE id = _client_id;
  IF v_referrer IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(COALESCE(ad_spend,0)) FILTER (WHERE type <> 'paid'), 0) INTO v_paid FROM public.commissions WHERE client_id = _client_id;
  v_target := floor(v_paid / 10000.0)::int;
  IF v_target < 1 THEN RETURN; END IF;
  FOR v_i IN 1..v_target LOOP
    INSERT INTO public.referral_credits (referrer_client_id, referred_client_id, type, amount, milestone_index, note)
    VALUES (v_referrer, _client_id, 'milestone', 50, v_i, 'Meta de US$ ' || (v_i * 10000)::text || ' em gastos de ' || COALESCE(v_name, 'indicado'))
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_referral_summary(_client_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_client record; v_is_staff boolean;
BEGIN
  v_is_staff := public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role);
  IF _client_id IS NOT NULL AND v_is_staff THEN SELECT * INTO v_client FROM public.clients WHERE id = _client_id;
  ELSE SELECT * INTO v_client FROM public.clients WHERE auth_user_id = auth.uid(); END IF;
  IF v_client.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'client_not_found'); END IF;
  RETURN jsonb_build_object(
    'ok', true, 'client_id', v_client.id, 'referral_code', v_client.referral_code,
    'totals', (SELECT jsonb_build_object(
        'total', COALESCE(SUM(amount), 0),
        'pending', COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0),
        'applied', COALESCE(SUM(amount) FILTER (WHERE status = 'applied'), 0),
        'signup_count', COUNT(*) FILTER (WHERE type = 'signup'),
        'milestone_count', COUNT(*) FILTER (WHERE type = 'milestone')
      ) FROM public.referral_credits WHERE referrer_client_id = v_client.id AND status <> 'cancelled'),
    'referrals', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'created_at', r.created_at, 'referred_at', r.referred_at,
        'total_paid', COALESCE((SELECT SUM(COALESCE(ad_spend,0)) FILTER (WHERE type <> 'paid') FROM public.commissions WHERE client_id = r.id), 0),
        'credits', COALESCE((SELECT SUM(amount) FROM public.referral_credits rc WHERE rc.referred_client_id = r.id AND rc.referrer_client_id = v_client.id AND rc.status <> 'cancelled'), 0)
      ) ORDER BY r.created_at DESC) FROM public.clients r WHERE r.referred_by_client_id = v_client.id), '[]'::jsonb),
    'credits', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', rc.id, 'type', rc.type, 'amount', rc.amount, 'status', rc.status, 'note', rc.note, 'created_at', rc.created_at
      ) ORDER BY rc.created_at DESC) FROM public.referral_credits rc WHERE rc.referrer_client_id = v_client.id), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.detect_referral_milestone_alerts(_threshold_pct numeric DEFAULT 70)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_count int := 0;
BEGIN
  WITH pairs AS (
    SELECT r.referred_by_client_id AS referrer_id, r.id AS referred_id,
           COALESCE((SELECT SUM(COALESCE(ad_spend,0)) FILTER (WHERE type <> 'paid') FROM public.commissions c WHERE c.client_id = r.id), 0) AS paid
      FROM public.clients r WHERE r.referred_by_client_id IS NOT NULL
  ), calc AS (
    SELECT referrer_id, referred_id, paid,
           (floor(paid / 10000.0) + 1)::int AS next_index,
           ((paid - floor(paid / 10000.0) * 10000) / 10000.0 * 100)::numeric(6,2) AS pct,
           ((floor(paid / 10000.0) + 1) * 10000 - paid)::numeric(12,2) AS remaining
      FROM pairs
  )
  INSERT INTO public.referral_alerts (referrer_client_id, referred_client_id, kind, milestone_index, estimated_amount, remaining_amount, progress_pct)
  SELECT referrer_id, referred_id, 'approaching', next_index, 50, remaining, pct FROM calc WHERE pct >= _threshold_pct
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_referral_statement(_client_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_is_staff boolean; v_client record; v_all boolean := false;
BEGIN
  v_is_staff := public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role);
  IF _client_id IS NOT NULL AND v_is_staff THEN SELECT * INTO v_client FROM public.clients WHERE id = _client_id;
  ELSIF _client_id IS NULL AND v_is_staff THEN v_all := true;
  ELSE SELECT * INTO v_client FROM public.clients WHERE auth_user_id = auth.uid(); END IF;
  IF NOT v_all AND v_client.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'client_not_found'); END IF;
  RETURN jsonb_build_object(
    'ok', true, 'scope', CASE WHEN v_all THEN 'all' ELSE 'client' END,
    'client_id', v_client.id, 'client_name', v_client.name, 'referral_code', v_client.referral_code,
    'entries', COALESCE((SELECT jsonb_agg(e ORDER BY e->>'created_at' DESC) FROM (
        SELECT jsonb_build_object('id', rc.id, 'created_at', rc.created_at, 'type', rc.type, 'amount', rc.amount,
          'status', rc.status, 'note', rc.note, 'milestone_index', rc.milestone_index, 'applied_at', rc.applied_at,
          'referrer_id', rc.referrer_client_id, 'referrer_name', rf.name, 'referred_id', rc.referred_client_id, 'referred_name', rd.name) AS e
        FROM public.referral_credits rc
        LEFT JOIN public.clients rd ON rd.id = rc.referred_client_id
        LEFT JOIN public.clients rf ON rf.id = rc.referrer_client_id
        WHERE v_all OR rc.referrer_client_id = v_client.id) s), '[]'::jsonb),
    'progress', COALESCE((SELECT jsonb_agg(p) FROM (
        SELECT jsonb_build_object(
          'referrer_id', r.referred_by_client_id,
          'referrer_name', (SELECT name FROM public.clients x WHERE x.id = r.referred_by_client_id),
          'referred_id', r.id, 'referred_name', r.name, 'total_paid', paid.v,
          'next_index', (floor(paid.v / 10000.0) + 1)::int,
          'remaining', ((floor(paid.v / 10000.0) + 1) * 10000 - paid.v),
          'progress_pct', ((paid.v - floor(paid.v / 10000.0) * 10000) / 10000.0 * 100),
          'next_bonus', 50) AS p
        FROM public.clients r
        CROSS JOIN LATERAL (SELECT COALESCE((SELECT SUM(COALESCE(ad_spend,0)) FILTER (WHERE type <> 'paid') FROM public.commissions c WHERE c.client_id = r.id), 0) AS v) paid
        WHERE r.referred_by_client_id IS NOT NULL AND (v_all OR r.referred_by_client_id = v_client.id)) s2), '[]'::jsonb),
    'alerts', COALESCE((SELECT jsonb_agg(a ORDER BY a->>'created_at' DESC) FROM (
        SELECT jsonb_build_object('id', ra.id, 'kind', ra.kind, 'milestone_index', ra.milestone_index,
          'estimated_amount', ra.estimated_amount, 'remaining_amount', ra.remaining_amount, 'progress_pct', ra.progress_pct,
          'read_at', ra.read_at, 'created_at', ra.created_at, 'referred_id', ra.referred_client_id, 'referred_name', rd2.name) AS a
        FROM public.referral_alerts ra
        LEFT JOIN public.clients rd2 ON rd2.id = ra.referred_client_id
        WHERE v_all OR ra.referrer_client_id = v_client.id) s3), '[]'::jsonb),
    'totals', (SELECT jsonb_build_object(
        'total', COALESCE(SUM(amount), 0),
        'pending', COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0),
        'applied', COALESCE(SUM(amount) FILTER (WHERE status = 'applied'), 0),
        'cancelled', COALESCE(SUM(amount) FILTER (WHERE status = 'cancelled'), 0),
        'signup_count', COUNT(*) FILTER (WHERE type = 'signup'),
        'milestone_count', COUNT(*) FILTER (WHERE type = 'milestone'))
      FROM public.referral_credits rc2 WHERE v_all OR rc2.referrer_client_id = v_client.id)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.commissions_referral_milestone()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.client_id IS NOT NULL AND NEW.type <> 'paid'
     AND (TG_OP = 'INSERT' OR COALESCE(NEW.ad_spend,0) <> COALESCE(OLD.ad_spend,0)) THEN
    PERFORM public.award_referral_milestones(NEW.client_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_commissions_referral_milestone ON public.commissions;
CREATE TRIGGER trg_commissions_referral_milestone AFTER INSERT OR UPDATE OF ad_spend ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.commissions_referral_milestone();

DELETE FROM public.referral_alerts WHERE kind = 'approaching' AND read_at IS NULL;

DO $$ DECLARE r record; BEGIN FOR r IN SELECT id FROM public.clients WHERE referred_by_client_id IS NOT NULL LOOP PERFORM public.award_referral_milestones(r.id); END LOOP; END $$;
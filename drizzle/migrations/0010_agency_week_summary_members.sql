CREATE OR REPLACE FUNCTION public.get_agency_week_summary(_agency uuid, _week_start date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_end date := _week_start + 6; v_total numeric; v_plat record; v_next record; v_rows jsonb; v_ad numeric; v_def numeric;
BEGIN
  IF NOT (public.agency_can_any(_agency, ARRAY['resumo','clientes','creditos','tiers']) OR public.is_staff()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

  SELECT COALESCE(SUM(i.spend),0) INTO v_total
    FROM public.meta_ad_insights i
    JOIN public.meta_ad_account_assignments a ON a.ad_account_id = i.ad_account_id AND a.client_id = _agency AND a.active
   WHERE i.date BETWEEN _week_start AND v_end AND i.date >= COALESCE(a.effective_from, '1900-01-01'::date);

  SELECT * INTO v_plat FROM public.agency_platform_tiers WHERE min_weekly_spend <= v_total ORDER BY min_weekly_spend DESC LIMIT 1;
  SELECT * INTO v_next FROM public.agency_platform_tiers WHERE min_weekly_spend > v_total ORDER BY min_weekly_spend ASC LIMIT 1;
  v_ad := COALESCE(v_plat.adscale_pct, 0);
  v_def := v_ad + COALESCE(v_plat.suggested_agency_pct, 0);

  WITH sc AS (
    SELECT s.id, s.name,
      COALESCE((SELECT SUM(i.spend) FROM public.meta_ad_insights i
        JOIN public.agency_sub_client_accounts x ON x.ad_account_id = i.ad_account_id AND x.sub_client_id = s.id
        WHERE i.date BETWEEN _week_start AND v_end),0) AS spend,
      EXISTS (SELECT 1 FROM public.agency_tiers z WHERE z.sub_client_id = s.id) AS has_custom
    FROM public.agency_sub_clients s WHERE s.agency_client_id = _agency
  ), t AS (
    SELECT sc.id, sc.name, sc.spend, tt.name AS tier_name, tt.total_pct AS pct
    FROM sc LEFT JOIN LATERAL (
      SELECT t.name, t.total_pct FROM public.agency_tiers t
       WHERE t.agency_client_id = _agency
         AND ((sc.has_custom AND t.sub_client_id = sc.id) OR (NOT sc.has_custom AND t.sub_client_id IS NULL))
         AND t.min_weekly_spend <= sc.spend
       ORDER BY t.min_weekly_spend DESC LIMIT 1) tt ON true
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'sub_client_id', id, 'name', name, 'spend', round(spend,2),
    'tier_name', tier_name, 'client_pct', COALESCE(pct, v_def),
    'client_fee', round(spend * COALESCE(pct, v_def) / 100, 2),
    'adscale_fee', round(spend * v_ad / 100, 2),
    'agency_margin', round(spend * (COALESCE(pct, v_def) - v_ad) / 100, 2)
  ) ORDER BY spend DESC),'[]'::jsonb) INTO v_rows FROM t;

  RETURN jsonb_build_object(
    'week_start', _week_start, 'week_end', v_end,
    'total_spend', round(v_total,2),
    'platform_tier', CASE WHEN v_plat.id IS NULL THEN NULL ELSE jsonb_build_object('name', v_plat.name, 'adscale_pct', v_plat.adscale_pct, 'min', v_plat.min_weekly_spend) END,
    'next_tier', CASE WHEN v_next.id IS NULL THEN NULL ELSE jsonb_build_object('name', v_next.name, 'adscale_pct', v_next.adscale_pct, 'min', v_next.min_weekly_spend, 'remaining', round(v_next.min_weekly_spend - v_total,2)) END,
    'adscale_due', round(v_total * v_ad / 100, 2),
    'sub_clients', v_rows
  );
END $function$;
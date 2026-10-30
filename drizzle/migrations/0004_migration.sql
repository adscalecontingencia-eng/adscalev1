
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_agency boolean NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS agency_enabled_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_agency_owner(_agency uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE id = _agency AND auth_user_id = auth.uid() AND is_agency);
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'support'::app_role);
$$;

CREATE TABLE public.agency_platform_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_weekly_spend numeric(14,2) NOT NULL DEFAULT 0,
  adscale_pct numeric(6,3) NOT NULL,
  suggested_agency_pct numeric(6,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_platform_tiers TO authenticated;
GRANT ALL ON public.agency_platform_tiers TO service_role;
ALTER TABLE public.agency_platform_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read platform tiers" ON public.agency_platform_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage platform tiers" ON public.agency_platform_tiers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
INSERT INTO public.agency_platform_tiers (name,min_weekly_spend,adscale_pct,suggested_agency_pct) VALUES
 ('Tier 1 · Início',0,3.0,2.0),('Tier 2 · Escala',25000,2.5,1.8),('Tier 3 · Elite',75000,2.0,1.5),('Tier 4 · VIP',150000,1.5,1.2);

CREATE TABLE public.agency_settings (
  agency_client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  brand_name text,
  logo_url text,
  primary_color text DEFAULT '#22c55e',
  custom_domain text,
  data_mode text NOT NULL DEFAULT 'adscale',
  byod_url text,
  byod_anon_key text,
  byod_initialized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.agency_settings TO authenticated;
GRANT ALL ON public.agency_settings TO service_role;
ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency own settings" ON public.agency_settings FOR ALL TO authenticated
 USING (public.is_agency_owner(agency_client_id) OR public.is_staff())
 WITH CHECK (public.is_agency_owner(agency_client_id) OR public.is_staff());

CREATE TABLE public.agency_sub_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_sub_clients TO authenticated;
GRANT ALL ON public.agency_sub_clients TO service_role;
ALTER TABLE public.agency_sub_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency own sub clients" ON public.agency_sub_clients FOR ALL TO authenticated
 USING (public.is_agency_owner(agency_client_id) OR public.is_staff())
 WITH CHECK (public.is_agency_owner(agency_client_id) OR public.is_staff());

CREATE TABLE public.agency_sub_client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sub_client_id uuid NOT NULL REFERENCES public.agency_sub_clients(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_sub_client_accounts TO authenticated;
GRANT ALL ON public.agency_sub_client_accounts TO service_role;
ALTER TABLE public.agency_sub_client_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency own sub accounts" ON public.agency_sub_client_accounts FOR ALL TO authenticated
 USING (public.is_agency_owner(agency_client_id) OR public.is_staff())
 WITH CHECK (
   public.is_staff() OR (
     public.is_agency_owner(agency_client_id)
     AND EXISTS (SELECT 1 FROM public.meta_ad_account_assignments a WHERE a.ad_account_id = agency_sub_client_accounts.ad_account_id AND a.client_id = agency_sub_client_accounts.agency_client_id AND a.active)
     AND EXISTS (SELECT 1 FROM public.agency_sub_clients s WHERE s.id = agency_sub_client_accounts.sub_client_id AND s.agency_client_id = agency_sub_client_accounts.agency_client_id)
   ));

CREATE TABLE public.agency_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sub_client_id uuid REFERENCES public.agency_sub_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_weekly_spend numeric(14,2) NOT NULL DEFAULT 0,
  total_pct numeric(6,3) NOT NULL,
  allow_subsidy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_tiers TO authenticated;
GRANT ALL ON public.agency_tiers TO service_role;
ALTER TABLE public.agency_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency own tiers" ON public.agency_tiers FOR ALL TO authenticated
 USING (public.is_agency_owner(agency_client_id) OR public.is_staff())
 WITH CHECK (public.is_agency_owner(agency_client_id) OR public.is_staff());

CREATE OR REPLACE FUNCTION public.agency_tiers_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_floor numeric;
BEGIN
  IF NEW.total_pct < 0 OR NEW.total_pct > 50 THEN RAISE EXCEPTION 'Taxa inválida'; END IF;
  SELECT MIN(adscale_pct) INTO v_floor FROM public.agency_platform_tiers;
  IF NOT NEW.allow_subsidy AND NEW.total_pct < COALESCE(v_floor,0) THEN
    RAISE EXCEPTION 'Taxa abaixo do custo minimo AD SCALE (% por cento). Marque subsidio para confirmar.', v_floor;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_agency_tiers_validate BEFORE INSERT OR UPDATE ON public.agency_tiers FOR EACH ROW EXECUTE FUNCTION public.agency_tiers_validate();

CREATE TABLE public.agency_terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  version text NOT NULL,
  language text NOT NULL DEFAULT 'pt',
  content_hash text NOT NULL,
  user_agent text,
  accepted_by uuid NOT NULL DEFAULT auth.uid(),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_client_id, version)
);
GRANT SELECT, INSERT ON public.agency_terms_acceptances TO authenticated;
GRANT ALL ON public.agency_terms_acceptances TO service_role;
ALTER TABLE public.agency_terms_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read agency terms" ON public.agency_terms_acceptances FOR SELECT TO authenticated USING (public.is_agency_owner(agency_client_id) OR public.is_staff());
CREATE POLICY "accept agency terms" ON public.agency_terms_acceptances FOR INSERT TO authenticated WITH CHECK (public.is_agency_owner(agency_client_id) AND accepted_by = auth.uid());

CREATE TABLE public.agency_sub_client_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sub_client_id uuid NOT NULL REFERENCES public.agency_sub_clients(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'confirmado',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_sub_client_credits TO authenticated;
GRANT ALL ON public.agency_sub_client_credits TO service_role;
ALTER TABLE public.agency_sub_client_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency own credits" ON public.agency_sub_client_credits FOR ALL TO authenticated
 USING (public.is_agency_owner(agency_client_id) OR public.is_staff())
 WITH CHECK (public.is_agency_owner(agency_client_id) OR public.is_staff());

CREATE OR REPLACE FUNCTION public.get_agency_week_summary(_agency uuid, _week_start date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_end date := _week_start + 6; v_total numeric; v_plat record; v_next record; v_rows jsonb; v_ad numeric; v_def numeric;
BEGIN
  IF NOT (public.is_agency_owner(_agency) OR public.is_staff()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

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
END $$;
GRANT EXECUTE ON FUNCTION public.get_agency_week_summary(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_agencies_overview(_week_start date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb := '[]'::jsonb; r record;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  FOR r IN SELECT c.id, c.name, c.email, c.agency_enabled_at,
      (SELECT MAX(accepted_at) FROM public.agency_terms_acceptances t WHERE t.agency_client_id=c.id) AS terms_at,
      (SELECT COUNT(*) FROM public.agency_sub_clients s WHERE s.agency_client_id=c.id) AS subs
    FROM public.clients c WHERE c.is_agency ORDER BY c.name LOOP
    v := v || jsonb_build_object('id', r.id, 'name', r.name, 'email', r.email, 'agency_enabled_at', r.agency_enabled_at,
      'terms_accepted_at', r.terms_at, 'sub_clients', r.subs,
      'summary', public.get_agency_week_summary(r.id, _week_start));
  END LOOP;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.get_agencies_overview(date) TO authenticated;

-- 1) Agency's own support WhatsApp
ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS support_whatsapp text;

DROP FUNCTION IF EXISTS public.get_client_agency_branding(uuid);
CREATE FUNCTION public.get_client_agency_branding(_client_id uuid)
RETURNS TABLE(agency_client_id uuid, brand_name text, logo_url text, primary_color text, slug text, support_whatsapp text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT st.agency_client_id, st.brand_name, st.logo_url, st.primary_color, st.slug, st.support_whatsapp
    FROM public.agency_sub_clients s
    JOIN public.agency_settings st ON st.agency_client_id = s.agency_client_id
   WHERE s.client_id = _client_id
     AND (public.is_staff()
          OR _client_id IN (SELECT c.id FROM public.clients c WHERE c.auth_user_id = auth.uid())
          OR _client_id IN (SELECT public.agency_visible_client_ids()))
   ORDER BY s.created_at
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_client_agency_branding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_client_agency_branding(uuid) TO authenticated;

-- 2) Agency collaborators
CREATE TABLE public.agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agency_members_agency_idx ON public.agency_members(agency_client_id);
GRANT SELECT, UPDATE ON public.agency_members TO authenticated;
GRANT ALL ON public.agency_members TO service_role;
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency owner or staff read members" ON public.agency_members
  FOR SELECT TO authenticated USING (public.is_agency_owner(agency_client_id) OR public.is_staff() OR auth_user_id = auth.uid());
CREATE POLICY "agency owner or staff update members" ON public.agency_members
  FOR UPDATE TO authenticated USING (public.is_agency_owner(agency_client_id) OR public.is_staff())
  WITH CHECK (public.is_agency_owner(agency_client_id) OR public.is_staff());

CREATE TRIGGER agency_members_updated_at BEFORE UPDATE ON public.agency_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Owner, or active collaborator holding the permission (NULL = any permission)
CREATE OR REPLACE FUNCTION public.agency_can(_agency uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_agency_owner(_agency) OR EXISTS (
    SELECT 1 FROM public.agency_members m
     WHERE m.agency_client_id = _agency AND m.auth_user_id = auth.uid() AND m.active
       AND (_perm IS NULL OR _perm = ANY(m.permissions))
       AND EXISTS (SELECT 1 FROM public.clients a WHERE a.id = _agency AND a.is_agency)
  )
$$;

CREATE OR REPLACE FUNCTION public.agency_can_any(_agency uuid, _perms text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_agency_owner(_agency) OR EXISTS (
    SELECT 1 FROM public.agency_members m
     WHERE m.agency_client_id = _agency AND m.auth_user_id = auth.uid() AND m.active
       AND m.permissions && _perms
       AND EXISTS (SELECT 1 FROM public.clients a WHERE a.id = _agency AND a.is_agency)
  )
$$;

-- Agencies the caller works for as collaborator (with any of the permissions)
CREATE OR REPLACE FUNCTION public.agency_member_agency_ids(_perms text[])
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.agency_client_id FROM public.agency_members m
    JOIN public.clients a ON a.id = m.agency_client_id AND a.is_agency
   WHERE m.auth_user_id = auth.uid() AND m.active AND m.permissions && _perms
$$;

-- Membership info for the panel (agency name + permissions)
CREATE OR REPLACE FUNCTION public.get_my_agency_membership()
RETURNS TABLE(agency_client_id uuid, agency_name text, is_agency boolean, permissions text[], member_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.agency_client_id, a.name, a.is_agency, m.permissions, m.name
    FROM public.agency_members m JOIN public.clients a ON a.id = m.agency_client_id
   WHERE m.auth_user_id = auth.uid() AND m.active
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.agency_can(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agency_can_any(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agency_member_agency_ids(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_agency_membership() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_can(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agency_can_any(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agency_member_agency_ids(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_agency_membership() TO authenticated;

-- 3) Per-section access for collaborators
DROP POLICY IF EXISTS "agency own settings" ON public.agency_settings;
CREATE POLICY "agency read settings" ON public.agency_settings FOR SELECT TO authenticated
  USING (public.agency_can(agency_client_id, NULL) OR public.is_staff());
CREATE POLICY "agency manage settings" ON public.agency_settings FOR ALL TO authenticated
  USING (public.agency_can(agency_client_id, 'marca') OR public.is_staff())
  WITH CHECK (public.agency_can(agency_client_id, 'marca') OR public.is_staff());

DROP POLICY IF EXISTS "agency own sub clients" ON public.agency_sub_clients;
CREATE POLICY "agency read sub clients" ON public.agency_sub_clients FOR SELECT TO authenticated
  USING (public.agency_can(agency_client_id, NULL) OR public.is_staff());
CREATE POLICY "agency manage sub clients" ON public.agency_sub_clients FOR ALL TO authenticated
  USING (public.agency_can(agency_client_id, 'clientes') OR public.is_staff())
  WITH CHECK (public.agency_can(agency_client_id, 'clientes') OR public.is_staff());

DROP POLICY IF EXISTS "agency own sub accounts" ON public.agency_sub_client_accounts;
CREATE POLICY "agency read sub accounts" ON public.agency_sub_client_accounts FOR SELECT TO authenticated
  USING (public.agency_can(agency_client_id, NULL) OR public.is_staff());
CREATE POLICY "agency manage sub accounts" ON public.agency_sub_client_accounts FOR ALL TO authenticated
  USING (public.agency_can(agency_client_id, 'contas') OR public.is_staff())
  WITH CHECK (public.is_staff() OR (public.agency_can(agency_client_id, 'contas')
    AND EXISTS (SELECT 1 FROM public.meta_ad_account_assignments a WHERE a.ad_account_id = agency_sub_client_accounts.ad_account_id AND a.client_id = agency_sub_client_accounts.agency_client_id AND a.active)
    AND EXISTS (SELECT 1 FROM public.agency_sub_clients s WHERE s.id = agency_sub_client_accounts.sub_client_id AND s.agency_client_id = agency_sub_client_accounts.agency_client_id)));

DROP POLICY IF EXISTS "agency own credits" ON public.agency_sub_client_credits;
CREATE POLICY "agency read credits" ON public.agency_sub_client_credits FOR SELECT TO authenticated
  USING (public.agency_can_any(agency_client_id, ARRAY['creditos','clientes']) OR public.is_staff());
CREATE POLICY "agency manage credits" ON public.agency_sub_client_credits FOR ALL TO authenticated
  USING (public.agency_can_any(agency_client_id, ARRAY['creditos','clientes']) OR public.is_staff())
  WITH CHECK (public.agency_can_any(agency_client_id, ARRAY['creditos','clientes']) OR public.is_staff());

DROP POLICY IF EXISTS "agency own tiers" ON public.agency_tiers;
CREATE POLICY "agency read tiers" ON public.agency_tiers FOR SELECT TO authenticated
  USING (public.agency_can(agency_client_id, NULL) OR public.is_staff());
CREATE POLICY "agency manage tiers" ON public.agency_tiers FOR ALL TO authenticated
  USING (public.agency_can(agency_client_id, 'tiers') OR public.is_staff())
  WITH CHECK (public.agency_can(agency_client_id, 'tiers') OR public.is_staff());

DROP POLICY IF EXISTS "agency owner or staff manage support tasks" ON public.agency_support_tasks;
CREATE POLICY "agency manage support tasks" ON public.agency_support_tasks FOR ALL TO authenticated
  USING (public.agency_can(agency_client_id, 'suporte') OR public.is_staff())
  WITH CHECK (public.agency_can(agency_client_id, 'suporte') OR public.is_staff());

DROP POLICY IF EXISTS "read agency terms" ON public.agency_terms_acceptances;
CREATE POLICY "read agency terms" ON public.agency_terms_acceptances FOR SELECT TO authenticated
  USING (public.agency_can(agency_client_id, NULL) OR public.is_staff());

DROP POLICY IF EXISTS "Agency reads its clients support_requests" ON public.support_requests;
CREATE POLICY "Agency reads its clients support_requests" ON public.support_requests
  FOR SELECT TO authenticated USING (agency_client_id IS NOT NULL AND public.agency_can(agency_client_id, 'suporte'));

-- Accounts assigned to the agency, readable by collaborators who work with accounts
CREATE POLICY "Agency members read agency assignments" ON public.meta_ad_account_assignments
  FOR SELECT TO authenticated USING (client_id IN (SELECT public.agency_member_agency_ids(ARRAY['contas','resumo','clientes'])));

CREATE OR REPLACE FUNCTION public.agency_visible_client_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.client_id FROM public.agency_sub_clients s
  JOIN public.clients a ON a.id = s.agency_client_id
  WHERE a.auth_user_id = auth.uid() AND a.is_agency AND s.client_id IS NOT NULL
  UNION
  SELECT s.client_id FROM public.agency_sub_clients s
  WHERE s.client_id IS NOT NULL AND s.agency_client_id IN (SELECT public.agency_member_agency_ids(ARRAY['clientes']))
$$;

CREATE OR REPLACE FUNCTION public.agency_visible_ad_account_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.ad_account_id FROM public.meta_ad_account_assignments a
   WHERE a.active AND a.client_id IN (SELECT public.agency_visible_client_ids())
  UNION
  SELECT sa.ad_account_id FROM public.agency_sub_client_accounts sa
    JOIN public.agency_sub_clients s ON s.id = sa.sub_client_id
   WHERE s.client_id IN (SELECT public.agency_visible_client_ids())
      OR s.client_id IN (SELECT c.id FROM public.clients c WHERE c.auth_user_id = auth.uid())
  UNION
  SELECT a.ad_account_id FROM public.meta_ad_account_assignments a
   WHERE a.active AND a.client_id IN (SELECT public.agency_member_agency_ids(ARRAY['contas','resumo','clientes']))
$$;

CREATE OR REPLACE FUNCTION public.agency_handle_support_request(_id uuid, _agency_bm_id text, _agency_notes text, _status text, _forward boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.support_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.support_requests WHERE id = _id;
  IF NOT FOUND OR r.agency_client_id IS NULL OR NOT public.agency_can(r.agency_client_id, 'suporte') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('pendente','em_andamento','concluida','cancelada') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  PERFORM set_config('app.agency_support_update', 'on', true);
  UPDATE public.support_requests SET
    agency_bm_id = NULLIF(left(regexp_replace(COALESCE(_agency_bm_id, ''), '[^0-9]', '', 'g'), 40), ''),
    agency_notes = NULLIF(left(btrim(COALESCE(_agency_notes, '')), 2000), ''),
    status = COALESCE(_status, status),
    resolved_at = CASE WHEN COALESCE(_status, status) IN ('concluida','cancelada') THEN COALESCE(resolved_at, now()) ELSE NULL END,
    forwarded_to_adscale_at = CASE WHEN _forward THEN COALESCE(forwarded_to_adscale_at, now()) ELSE forwarded_to_adscale_at END,
    forwarded_by = CASE WHEN _forward THEN COALESCE(forwarded_by, auth.uid()) ELSE forwarded_by END,
    updated_at = now()
  WHERE id = _id;
  PERFORM set_config('app.agency_support_update', 'off', true);
  RETURN jsonb_build_object('ok', true);
END $$;
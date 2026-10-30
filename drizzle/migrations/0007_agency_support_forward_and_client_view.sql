-- 1) Support requests routed through partner agencies
ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS agency_client_id uuid,
  ADD COLUMN IF NOT EXISTS agency_bm_id text,
  ADD COLUMN IF NOT EXISTS agency_notes text,
  ADD COLUMN IF NOT EXISTS forwarded_to_adscale_at timestamptz,
  ADD COLUMN IF NOT EXISTS forwarded_by uuid;

CREATE INDEX IF NOT EXISTS support_requests_agency_idx ON public.support_requests(agency_client_id);

-- Backfill: existing sub-client requests stay visible to AD SCALE (marked as already forwarded)
UPDATE public.support_requests r
   SET agency_client_id = s.agency_client_id,
       forwarded_to_adscale_at = COALESCE(r.forwarded_to_adscale_at, r.created_at)
  FROM public.agency_sub_clients s
 WHERE s.client_id = r.client_id AND r.agency_client_id IS NULL;

CREATE OR REPLACE FUNCTION public.support_requests_agency_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_staff() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.agency_client_id := (SELECT s.agency_client_id FROM public.agency_sub_clients s WHERE s.client_id = NEW.client_id ORDER BY s.created_at LIMIT 1);
    NEW.agency_bm_id := NULL; NEW.agency_notes := NULL;
    NEW.forwarded_to_adscale_at := NULL; NEW.forwarded_by := NULL;
  ELSE
    -- only the agency RPC (which sets this flag) may touch agency fields
    IF current_setting('app.agency_support_update', true) IS DISTINCT FROM 'on' THEN
      NEW.agency_client_id := OLD.agency_client_id; NEW.agency_bm_id := OLD.agency_bm_id;
      NEW.agency_notes := OLD.agency_notes; NEW.forwarded_to_adscale_at := OLD.forwarded_to_adscale_at;
      NEW.forwarded_by := OLD.forwarded_by;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS support_requests_agency_guard ON public.support_requests;
CREATE TRIGGER support_requests_agency_guard BEFORE INSERT OR UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.support_requests_agency_guard();

CREATE POLICY "Agency reads its clients support_requests" ON public.support_requests
  FOR SELECT TO authenticated USING (agency_client_id IS NOT NULL AND public.is_agency_owner(agency_client_id));

CREATE OR REPLACE FUNCTION public.agency_handle_support_request(_id uuid, _agency_bm_id text, _agency_notes text, _status text, _forward boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.support_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.support_requests WHERE id = _id;
  IF NOT FOUND OR r.agency_client_id IS NULL OR NOT public.is_agency_owner(r.agency_client_id) THEN
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
REVOKE ALL ON FUNCTION public.agency_handle_support_request(uuid, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_handle_support_request(uuid, text, text, text, boolean) TO authenticated;

-- 2) Agency can open the full client dashboard of its own sub-clients (read-only)
CREATE OR REPLACE FUNCTION public.agency_visible_client_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.client_id FROM public.agency_sub_clients s
  JOIN public.clients a ON a.id = s.agency_client_id
  WHERE a.auth_user_id = auth.uid() AND a.is_agency AND s.client_id IS NOT NULL
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
$$;

-- Accounts the agency assigned to a sub-client (shown in that sub-client's dashboard)
CREATE OR REPLACE FUNCTION public.get_agency_linked_accounts(_client_id uuid)
RETURNS TABLE(ad_account_id uuid, linked_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sa.ad_account_id, sa.created_at FROM public.agency_sub_client_accounts sa
    JOIN public.agency_sub_clients s ON s.id = sa.sub_client_id
   WHERE s.client_id = _client_id
     AND (public.is_staff()
          OR _client_id IN (SELECT c.id FROM public.clients c WHERE c.auth_user_id = auth.uid())
          OR _client_id IN (SELECT public.agency_visible_client_ids()))
$$;

REVOKE ALL ON FUNCTION public.agency_visible_client_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agency_visible_ad_account_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_agency_linked_accounts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_visible_client_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agency_visible_ad_account_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_linked_accounts(uuid) TO authenticated;

CREATE POLICY "Agency reads its sub-clients" ON public.clients
  FOR SELECT TO authenticated USING (id IN (SELECT public.agency_visible_client_ids()));
CREATE POLICY "Agency reads sub-client commissions" ON public.commissions
  FOR SELECT TO authenticated USING (client_id IN (SELECT public.agency_visible_client_ids()));
CREATE POLICY "Agency reads sub-client assignments" ON public.meta_ad_account_assignments
  FOR SELECT TO authenticated USING (client_id IN (SELECT public.agency_visible_client_ids()));
CREATE POLICY "Agency reads sub-client page assignments" ON public.meta_page_assignments
  FOR SELECT TO authenticated USING (client_id IN (SELECT public.agency_visible_client_ids()));
CREATE POLICY "Agency reads sub-client pages" ON public.meta_pages
  FOR SELECT TO authenticated USING (id IN (SELECT pa.page_id FROM public.meta_page_assignments pa WHERE pa.active AND pa.client_id IN (SELECT public.agency_visible_client_ids())));
CREATE POLICY "Agency-linked accounts readable" ON public.meta_ad_accounts
  FOR SELECT TO authenticated USING (id IN (SELECT public.agency_visible_ad_account_ids()));
CREATE POLICY "Agency-linked insights readable" ON public.meta_ad_insights
  FOR SELECT TO authenticated USING (ad_account_id IN (SELECT public.agency_visible_ad_account_ids()));
CREATE POLICY "Agency reads sub-client support_requests" ON public.support_requests
  FOR SELECT TO authenticated USING (client_id IN (SELECT public.agency_visible_client_ids()));
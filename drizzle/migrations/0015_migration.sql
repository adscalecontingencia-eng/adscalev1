DROP POLICY IF EXISTS "read platform tiers" ON public.agency_platform_tiers;
CREATE POLICY "read platform tiers" ON public.agency_platform_tiers
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (SELECT 1 FROM public.clients c WHERE c.auth_user_id = auth.uid() AND c.is_agency)
    OR EXISTS (SELECT 1 FROM public.get_my_agency_membership())
  );
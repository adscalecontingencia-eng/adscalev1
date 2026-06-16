
-- 1) suppliers: restrict to admin/support only
DROP POLICY IF EXISTS "Authenticated can manage suppliers" ON public.suppliers;
CREATE POLICY "Admin/support manage suppliers"
  ON public.suppliers
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));

REVOKE ALL ON public.suppliers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;

-- 2) meta_apps: split policies — support read-only, admin full write
DROP POLICY IF EXISTS "Admin/support full meta_apps" ON public.meta_apps;

CREATE POLICY "Admin/support read meta_apps"
  ON public.meta_apps
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Admin insert meta_apps"
  ON public.meta_apps
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update meta_apps"
  ON public.meta_apps
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete meta_apps"
  ON public.meta_apps
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) products.cost_price: idempotent column-level revoke
REVOKE SELECT (cost_price) ON public.products FROM anon;
REVOKE SELECT (cost_price) ON public.products FROM authenticated;

-- 1. Drop legacy password columns (auth is managed by Supabase Auth)
ALTER TABLE public.clients DROP COLUMN IF EXISTS password;
ALTER TABLE public.support_users DROP COLUMN IF EXISTS password;

-- 2. Restrict cost_price on products from anon / authenticated
REVOKE SELECT (cost_price) ON public.products FROM anon;
REVOKE SELECT (cost_price) ON public.products FROM authenticated;

-- 3. Secure helper so admin/support UIs can still fetch cost_price
CREATE OR REPLACE FUNCTION public.get_product_costs()
RETURNS TABLE(id uuid, cost_price numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'support'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT p.id, p.cost_price FROM public.products p;
END;
$$;

REVOKE ALL ON FUNCTION public.get_product_costs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_costs() TO authenticated;
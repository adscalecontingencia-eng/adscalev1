-- product_stock: contains pre-delivery credentials. No anon access at all.
REVOKE ALL ON public.product_stock FROM anon;
REVOKE ALL ON public.product_stock FROM PUBLIC;
REVOKE ALL ON public.product_stock FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_stock TO authenticated; -- gated by admin/support RLS
GRANT ALL ON public.product_stock TO service_role;

-- order_deliveries: no anon access; authenticated keeps only safe-column SELECT.
REVOKE ALL ON public.order_deliveries FROM anon;
REVOKE ALL ON public.order_deliveries FROM PUBLIC;
REVOKE ALL ON public.order_deliveries FROM authenticated;
GRANT SELECT (id, order_id, order_item_id, product_id, delivery_mode, delivered_at, created_at)
  ON public.order_deliveries TO authenticated;
GRANT ALL ON public.order_deliveries TO service_role;

-- commission_tiers: internal pricing config, never for anonymous visitors.
REVOKE ALL ON public.commission_tiers FROM anon;
REVOKE ALL ON public.commission_tiers FROM PUBLIC;
REVOKE ALL ON public.commission_tiers FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_tiers TO authenticated; -- gated by admin/support RLS
GRANT ALL ON public.commission_tiers TO service_role;

-- 1) Products: hide cost_price from public/authenticated reads
REVOKE SELECT (cost_price) ON public.products FROM anon, authenticated;
-- Admin/support continue reading cost via public.get_product_costs() (SECURITY DEFINER).

-- 2) marketplace_asset_accounts: expose only safe columns via a public view; keep base table admin-only for reads.
DROP POLICY IF EXISTS "Public can view accounts of active assets" ON public.marketplace_asset_accounts;

CREATE OR REPLACE VIEW public.marketplace_asset_accounts_public AS
SELECT a.id, a.asset_id, a.account_number, a.status, a.is_prepaid, a.created_at, a.updated_at
FROM public.marketplace_asset_accounts a
JOIN public.marketplace_assets ast ON ast.id = a.asset_id
WHERE ast.status = 'active';

GRANT SELECT ON public.marketplace_asset_accounts_public TO anon, authenticated;

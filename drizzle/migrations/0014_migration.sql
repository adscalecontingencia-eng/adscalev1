DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n_readonly') THEN
    CREATE ROLE n8n_readonly NOLOGIN BYPASSRLS;
  END IF;
END $$;

GRANT n8n_readonly TO postgres;
GRANT USAGE ON SCHEMA public TO n8n_readonly;
GRANT SELECT ON public.transactions, public.commissions, public.clients, public.partners,
  public.partner_commissions, public.meta_ad_accounts, public.meta_business_managers,
  public.meta_ad_insights, public.marketplace_products, public.marketplace_orders,
  public.product_stock, public.commission_tiers TO n8n_readonly;
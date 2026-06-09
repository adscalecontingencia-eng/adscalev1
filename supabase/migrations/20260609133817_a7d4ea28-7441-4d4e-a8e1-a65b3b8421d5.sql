
ALTER TABLE public.meta_business_managers ADD COLUMN IF NOT EXISTS meta_app_id uuid REFERENCES public.meta_apps(id) ON DELETE SET NULL;
ALTER TABLE public.meta_ad_accounts ADD COLUMN IF NOT EXISTS meta_app_id uuid REFERENCES public.meta_apps(id) ON DELETE SET NULL;
ALTER TABLE public.meta_pages ADD COLUMN IF NOT EXISTS meta_app_id uuid REFERENCES public.meta_apps(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_meta_bms_app ON public.meta_business_managers(meta_app_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_app ON public.meta_ad_accounts(meta_app_id);
CREATE INDEX IF NOT EXISTS idx_meta_pages_app ON public.meta_pages(meta_app_id);
GRANT SELECT(meta_app_id) ON public.meta_business_managers TO authenticated;
GRANT SELECT(meta_app_id) ON public.meta_ad_accounts TO authenticated;
GRANT SELECT(meta_app_id) ON public.meta_pages TO authenticated;

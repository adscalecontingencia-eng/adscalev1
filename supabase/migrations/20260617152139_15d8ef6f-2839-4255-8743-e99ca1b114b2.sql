ALTER TABLE public.meta_ad_accounts ADD COLUMN IF NOT EXISTS owner_business_id text;
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_owner_business_id ON public.meta_ad_accounts(owner_business_id);
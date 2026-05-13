
ALTER TABLE public.meta_ad_accounts
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT;

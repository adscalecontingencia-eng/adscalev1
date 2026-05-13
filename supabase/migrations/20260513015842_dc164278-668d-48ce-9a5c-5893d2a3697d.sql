-- Each Meta ad account belongs to at most one active client at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_ad_account_active
  ON public.meta_ad_account_assignments (ad_account_id)
  WHERE active = true;
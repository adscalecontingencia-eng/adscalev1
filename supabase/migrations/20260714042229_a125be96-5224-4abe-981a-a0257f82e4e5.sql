ALTER TABLE public.meta_ad_accounts
  ADD COLUMN IF NOT EXISTS last_sync_error_source text,
  ADD COLUMN IF NOT EXISTS last_sync_error_attempts jsonb;
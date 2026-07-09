ALTER TABLE public.meta_ad_accounts
  ADD COLUMN IF NOT EXISTS last_sync_error_code integer,
  ADD COLUMN IF NOT EXISTS last_sync_error_message text,
  ADD COLUMN IF NOT EXISTS last_sync_error_at timestamptz;
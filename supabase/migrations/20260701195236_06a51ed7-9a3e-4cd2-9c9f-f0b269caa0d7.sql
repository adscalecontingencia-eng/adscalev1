
ALTER TABLE public.meta_apps
  ADD COLUMN IF NOT EXISTS token_scopes text[],
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_user_id text,
  ADD COLUMN IF NOT EXISTS token_type text,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_status jsonb,
  ADD COLUMN IF NOT EXISTS data_access_expires_at timestamptz;

ALTER TABLE public.meta_ad_accounts
  ADD COLUMN IF NOT EXISTS raw_json jsonb,
  ADD COLUMN IF NOT EXISTS business_id text,
  ADD COLUMN IF NOT EXISTS business_name text;

-- Composite unique for upsert per app
CREATE UNIQUE INDEX IF NOT EXISTS meta_ad_accounts_app_account_uk
  ON public.meta_ad_accounts (meta_app_id, meta_account_id)
  WHERE meta_app_id IS NOT NULL;

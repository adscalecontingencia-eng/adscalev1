
ALTER TABLE public.meta_ad_accounts ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_archived_at ON public.meta_ad_accounts(archived_at);

-- Archive accounts where both tokens (or no token) failed with permission errors
UPDATE public.meta_ad_accounts
SET archived_at = now()
WHERE last_sync_error_code IN (200,190,10,100)
  AND (last_sync_error_source IN ('both','no_token') OR last_sync_error_source IS NULL)
  AND archived_at IS NULL;

-- Hard-delete only those with no history (no assignments, no insights)
DELETE FROM public.meta_ad_accounts a
WHERE a.archived_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.meta_ad_account_assignments x WHERE x.ad_account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM public.meta_ad_insights x WHERE x.ad_account_id = a.id);

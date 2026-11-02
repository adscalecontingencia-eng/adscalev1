ALTER TABLE public.meta_ad_accounts ADD COLUMN IF NOT EXISTS archived_reason text;

-- Contas arquivadas automaticamente por sumirem da Meta voltam sozinhas
-- assim que uma sincronização volta a encontrá-las.
CREATE OR REPLACE FUNCTION public.meta_ad_accounts_auto_restore()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.archived_at IS NOT NULL
     AND OLD.archived_reason = 'auto_missing'
     AND NEW.archived_at IS NOT NULL
     AND NEW.last_synced_at IS NOT NULL
     AND NEW.last_synced_at > COALESCE(OLD.last_synced_at, 'epoch'::timestamptz)
     AND NEW.last_synced_at > OLD.archived_at THEN
    NEW.archived_at := NULL;
    NEW.archived_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_ad_accounts_auto_restore ON public.meta_ad_accounts;
CREATE TRIGGER trg_meta_ad_accounts_auto_restore
BEFORE UPDATE ON public.meta_ad_accounts
FOR EACH ROW EXECUTE FUNCTION public.meta_ad_accounts_auto_restore();

-- Arquiva contas não devolvidas pela Meta há N dias e apaga só as arquivadas
-- automaticamente há M dias que não têm nenhum histórico ligado a elas.
CREATE OR REPLACE FUNCTION public.meta_cleanup_missing_accounts(_archive_days integer DEFAULT 3, _delete_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _archived integer := 0;
  _deleted integer := 0;
BEGIN
  UPDATE public.meta_ad_accounts
     SET archived_at = now(), archived_reason = 'auto_missing'
   WHERE archived_at IS NULL
     AND (last_synced_at IS NULL OR last_synced_at < now() - make_interval(days => _archive_days))
     AND created_at < now() - make_interval(days => _archive_days);
  GET DIAGNOSTICS _archived = ROW_COUNT;

  DELETE FROM public.meta_ad_accounts a
   WHERE a.archived_reason = 'auto_missing'
     AND a.archived_at < now() - make_interval(days => _delete_days)
     AND NOT EXISTS (SELECT 1 FROM public.meta_ad_insights i WHERE i.ad_account_id = a.id)
     AND NOT EXISTS (SELECT 1 FROM public.meta_ad_account_assignments s WHERE s.ad_account_id = a.id)
     AND NOT EXISTS (SELECT 1 FROM public.meta_ads m WHERE m.ad_account_id = a.id)
     AND NOT EXISTS (SELECT 1 FROM public.meta_blocked_accounts_log b WHERE b.ad_account_id = a.id)
     AND NOT EXISTS (SELECT 1 FROM public.agency_sub_client_accounts g WHERE g.ad_account_id = a.id)
     AND NOT EXISTS (SELECT 1 FROM public.meta_critical_events c WHERE c.ad_account_id = a.id)
     AND NOT EXISTS (SELECT 1 FROM public.manual_adjustments ma
                      WHERE a.id::text = ANY(ma.ad_account_ids) OR a.meta_account_id = ANY(ma.ad_account_ids));
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  RETURN jsonb_build_object('arquivadas', _archived, 'apagadas', _deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.meta_cleanup_missing_accounts(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_cleanup_missing_accounts(integer, integer) TO service_role;
REVOKE UPDATE ON public.partners FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.partners TO authenticated;
GRANT UPDATE (name, whatsapp_phone, pix_key, notes, preferred_language, updated_at) ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;

REVOKE UPDATE ON public.referral_alerts FROM authenticated;
GRANT SELECT ON public.referral_alerts TO authenticated;
GRANT UPDATE (read_at, updated_at) ON public.referral_alerts TO authenticated;
GRANT ALL ON public.referral_alerts TO service_role;

CREATE OR REPLACE FUNCTION public.referral_alerts_prevent_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'support'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.referrer_client_id IS DISTINCT FROM OLD.referrer_client_id
     OR NEW.referred_client_id IS DISTINCT FROM OLD.referred_client_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.milestone_index IS DISTINCT FROM OLD.milestone_index
     OR NEW.estimated_amount IS DISTINCT FROM OLD.estimated_amount
     OR NEW.remaining_amount IS DISTINCT FROM OLD.remaining_amount
     OR NEW.progress_pct IS DISTINCT FROM OLD.progress_pct
     OR NEW.emailed_at IS DISTINCT FROM OLD.emailed_at THEN
    RAISE EXCEPTION 'Only admin/support can change referral alert values'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS referral_alerts_prevent_tampering ON public.referral_alerts;
CREATE TRIGGER referral_alerts_prevent_tampering
BEFORE UPDATE ON public.referral_alerts
FOR EACH ROW EXECUTE FUNCTION public.referral_alerts_prevent_tampering();
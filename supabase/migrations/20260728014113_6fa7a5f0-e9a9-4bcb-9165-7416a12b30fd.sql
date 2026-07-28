
-- 1) Recreate view with security_invoker so it respects caller's RLS
ALTER VIEW public.marketplace_asset_accounts_public SET (security_invoker = true);

-- 2) support_requests: restrict client updates to keep status = 'pendente' and preserve ownership
DROP POLICY IF EXISTS "Clients update own pending support_requests" ON public.support_requests;
CREATE POLICY "Clients update own pending support_requests"
ON public.support_requests
FOR UPDATE
TO authenticated
USING (
  status = 'pendente'
  AND client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  status = 'pendente'
  AND client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
);

-- 3) partners: prevent self-escalation of commission/status via trigger.
--    Keeps existing UPDATE policy so partners can still edit their profile fields
--    (name, email, whatsapp_phone, pix_key, notes, preferred_language),
--    but reverts any attempt to change protected columns unless caller is admin/support.
CREATE OR REPLACE FUNCTION public.partners_prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  v_is_staff := public.has_role(auth.uid(), 'admin'::public.app_role)
             OR public.has_role(auth.uid(), 'support'::public.app_role);

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  -- Non-staff callers cannot change these fields on any row.
  IF NEW.commission_pct IS DISTINCT FROM OLD.commission_pct THEN
    RAISE EXCEPTION 'Only admin/support can change commission_pct'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only admin/support can change partner status'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    RAISE EXCEPTION 'Cannot reassign partner ownership'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    -- Email is the login identifier; only staff can rotate it.
    RAISE EXCEPTION 'Only admin/support can change partner email'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partners_prevent_self_privilege_escalation ON public.partners;
CREATE TRIGGER partners_prevent_self_privilege_escalation
BEFORE UPDATE ON public.partners
FOR EACH ROW
EXECUTE FUNCTION public.partners_prevent_self_privilege_escalation();

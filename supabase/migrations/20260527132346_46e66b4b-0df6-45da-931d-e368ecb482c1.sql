
-- Ensure password column is not readable by any client-facing role
REVOKE SELECT (password) ON public.clients FROM PUBLIC, anon, authenticated;
REVOKE SELECT (password) ON public.support_users FROM PUBLIC, anon, authenticated;

-- Re-grant all other columns explicitly to authenticated so RLS policies still work
-- (column-level REVOKE on password keeps the rest accessible)
GRANT SELECT (id, name, email, number, company_name, payment_type, fixed_value, percentage_value,
              ad_accounts, used_accounts, blocked_accounts, observations, created_at, updated_at,
              auth_user_id, notify_whatsapp, whatsapp_group_link, client_type, plan_credit,
              partner_id, whatsapp_phone)
  ON public.clients TO authenticated;

GRANT SELECT (id, name, email, permissions, created_at, updated_at, auth_user_id)
  ON public.support_users TO authenticated;

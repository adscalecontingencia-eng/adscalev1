-- 1) meta_apps: prevent privilege escalation via UPDATE on secret columns
REVOKE UPDATE (app_secret, system_user_token, user_access_token) ON public.meta_apps FROM authenticated;
REVOKE INSERT (app_secret, system_user_token, user_access_token) ON public.meta_apps FROM authenticated;

-- 2) Email queue functions: set fixed search_path
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = pgmq, public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = pgmq, public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = pgmq, public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = pgmq, public;
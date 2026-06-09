-- 1) support_users: hide plaintext password from authenticated users
REVOKE SELECT (password) ON public.support_users FROM authenticated;
REVOKE SELECT (password) ON public.support_users FROM anon;

-- 2) meta_apps: hide raw API credentials from authenticated users (edge functions use service_role)
REVOKE SELECT (app_secret, user_access_token, system_user_token) ON public.meta_apps FROM authenticated;
REVOKE SELECT (app_secret, user_access_token, system_user_token) ON public.meta_apps FROM anon;

-- 3) products: hide internal cost_price from anon and authenticated (admin reads via service_role / dedicated path)
REVOKE SELECT (cost_price) ON public.products FROM anon;
REVOKE SELECT (cost_price) ON public.products FROM authenticated;
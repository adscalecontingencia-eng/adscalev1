
-- clients: revoke table-wide SELECT for non-service roles and re-grant on safe columns
REVOKE SELECT ON public.clients FROM anon, authenticated;
GRANT SELECT (
  id, number, name, email, company_name, payment_type, fixed_value, percentage_value,
  ad_accounts, used_accounts, blocked_accounts, observations, created_at, updated_at,
  auth_user_id, whatsapp_phone, notify_whatsapp, whatsapp_group_link, client_type,
  plan_credit, partner_id, phone, meta_app_id, custom_tiers
) ON public.clients TO authenticated;

-- support_users
REVOKE SELECT ON public.support_users FROM anon, authenticated;
GRANT SELECT (
  id, name, email, permissions, created_at, updated_at, auth_user_id
) ON public.support_users TO authenticated;

-- meta_apps: hide secrets from authenticated reads
REVOKE SELECT ON public.meta_apps FROM anon, authenticated;
GRANT SELECT (
  id, label, app_id, is_default, status, notes, last_used_at, created_at, updated_at
) ON public.meta_apps TO authenticated;

-- products: keep public catalog but exclude cost_price
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (
  id, name, slug, category, subcategory, country, description, warranty_terms, tags,
  sale_price, discount_price, is_featured, is_new, active, image_url, sort_order,
  created_at, updated_at
) ON public.products TO anon, authenticated;

-- order_items: hide cost_snapshot from clients
REVOKE SELECT ON public.order_items FROM anon, authenticated;
GRANT SELECT (
  id, order_id, product_id, quantity, unit_price, product_name_snapshot, created_at
) ON public.order_items TO authenticated;

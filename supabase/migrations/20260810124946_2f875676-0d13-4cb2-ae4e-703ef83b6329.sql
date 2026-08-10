-- Table-level grants were overriding the column-level restriction on cost_price.
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.products FROM authenticated;

-- Re-apply column-scoped read access (no cost_price).
GRANT SELECT (
  id, name, slug, category, subcategory, country, description, warranty_terms,
  tags, sale_price, discount_price, is_featured, is_new, active, image_url,
  sort_order, created_at, updated_at
) ON public.products TO anon, authenticated;

-- Admin/support write paths (RLS policy still enforces the role check).
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;

GRANT ALL ON public.products TO service_role;
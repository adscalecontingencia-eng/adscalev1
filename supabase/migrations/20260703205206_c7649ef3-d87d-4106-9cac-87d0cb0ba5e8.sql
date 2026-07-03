
CREATE TABLE public.sales_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('whatsapp','site')),
  meta_app_id uuid REFERENCES public.meta_apps(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_stocks TO authenticated;
GRANT ALL ON public.sales_stocks TO service_role;
ALTER TABLE public.sales_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_support_manage_sales_stocks" ON public.sales_stocks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE TABLE public.sales_bm_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES public.sales_stocks(id) ON DELETE CASCADE,
  bm_id uuid NOT NULL REFERENCES public.meta_business_managers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','reservado','vendido')),
  sold_price numeric(12,2),
  buyer text,
  notes text,
  sold_at timestamptz,
  added_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stock_id, bm_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_bm_stock TO authenticated;
GRANT ALL ON public.sales_bm_stock TO service_role;
ALTER TABLE public.sales_bm_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_support_manage_sales_bm_stock" ON public.sales_bm_stock FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE TRIGGER trg_sales_stocks_updated BEFORE UPDATE ON public.sales_stocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sales_bm_stock_updated BEFORE UPDATE ON public.sales_bm_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

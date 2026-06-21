
-- Marketplace products (digital TXT files sold via Pix)
CREATE TABLE public.marketplace_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL CHECK (price >= 0),
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_products TO anon, authenticated;
GRANT ALL ON public.marketplace_products TO service_role;
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_products public read active"
  ON public.marketplace_products FOR SELECT
  USING (status = 'active');
CREATE POLICY "marketplace_products admin manage"
  ON public.marketplace_products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_marketplace_products_updated
  BEFORE UPDATE ON public.marketplace_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Orders
CREATE TABLE public.marketplace_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  product_id uuid NOT NULL REFERENCES public.marketplace_products(id),
  external_reference text UNIQUE NOT NULL,
  mercado_pago_order_id text,
  mercado_pago_payment_id text,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  status_detail text,
  download_released boolean NOT NULL DEFAULT false,
  customer_name text,
  customer_email text,
  customer_document text,
  paid_at timestamptz,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_marketplace_orders_external_reference ON public.marketplace_orders(external_reference);
CREATE INDEX idx_marketplace_orders_user_id ON public.marketplace_orders(user_id);
CREATE INDEX idx_marketplace_orders_mp_order_id ON public.marketplace_orders(mercado_pago_order_id);
GRANT SELECT ON public.marketplace_orders TO authenticated, anon;
GRANT ALL ON public.marketplace_orders TO service_role;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
-- Authenticated users can read their own orders
CREATE POLICY "marketplace_orders read own"
  ON public.marketplace_orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- Allow reading by external_reference for guest polling (needed for Realtime/polling without login)
CREATE POLICY "marketplace_orders admin read all"
  ON public.marketplace_orders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_marketplace_orders_updated
  BEFORE UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime so frontend can listen for approval updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_orders;


-- =========================
-- PRODUCTS
-- =========================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL,
  subcategory text,
  country text,
  description text,
  warranty_terms text,
  tags text[] DEFAULT '{}',
  cost_price numeric NOT NULL DEFAULT 0,
  sale_price numeric NOT NULL DEFAULT 0,
  discount_price numeric,
  is_featured boolean NOT NULL DEFAULT false,
  is_new boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active products"
ON public.products FOR SELECT
TO anon, authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Admin/support manage products"
ON public.products FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- PRODUCT STOCK (unidades entregáveis)
-- =========================
CREATE TABLE public.product_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'disponivel', -- disponivel | reservado | entregue | inativo
  reserved_until timestamptz,
  order_id uuid,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_stock_product_status ON public.product_stock(product_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_stock TO authenticated;
GRANT ALL ON public.product_stock TO service_role;

ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support manage stock"
ON public.product_stock FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));

CREATE TRIGGER trg_product_stock_updated_at
BEFORE UPDATE ON public.product_stock
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- ORDERS
-- =========================
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'aguardando_pagamento',
  total numeric NOT NULL DEFAULT 0,
  delivery_mode text NOT NULL DEFAULT 'auto', -- auto | manual
  notes text,
  paid_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_client ON public.orders(client_id);
CREATE INDEX idx_orders_status ON public.orders(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support manage orders"
ON public.orders FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Clients read own orders"
ON public.orders FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- ORDER ITEMS
-- =========================
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  cost_snapshot numeric NOT NULL DEFAULT 0,
  product_name_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support manage order_items"
ON public.order_items FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Clients read own order_items"
ON public.order_items FOR SELECT
TO authenticated
USING (order_id IN (
  SELECT o.id FROM public.orders o
  JOIN public.clients c ON c.id = o.client_id
  WHERE c.auth_user_id = auth.uid()
));

-- =========================
-- ORDER DELIVERIES
-- =========================
CREATE TABLE public.order_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  stock_id uuid REFERENCES public.product_stock(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_by uuid,
  delivery_mode text NOT NULL DEFAULT 'auto',
  delivered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_deliveries_order ON public.order_deliveries(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_deliveries TO authenticated;
GRANT ALL ON public.order_deliveries TO service_role;

ALTER TABLE public.order_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support manage deliveries"
ON public.order_deliveries FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Clients read own deliveries"
ON public.order_deliveries FOR SELECT
TO authenticated
USING (order_id IN (
  SELECT o.id FROM public.orders o
  JOIN public.clients c ON c.id = o.client_id
  WHERE c.auth_user_id = auth.uid()
));

-- =========================
-- PAYMENTS (Woovi Pix)
-- =========================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'woovi',
  charge_id text,
  correlation_id text UNIQUE,
  qr_code text,
  br_code text,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo', -- ativo | pago | expirado | cancelado
  expires_at timestamptz,
  paid_at timestamptz,
  raw_webhook jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_order ON public.payments(order_id);
CREATE INDEX idx_payments_charge ON public.payments(charge_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support manage payments"
ON public.payments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Clients read own payments"
ON public.payments FOR SELECT
TO authenticated
USING (order_id IN (
  SELECT o.id FROM public.orders o
  JOIN public.clients c ON c.id = o.client_id
  WHERE c.auth_user_id = auth.uid()
));

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- CLIENTS: phone obrigatório nos novos cadastros
-- =========================
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone text;

-- =========================
-- reserve_stock: reserva atômica
-- =========================
CREATE OR REPLACE FUNCTION public.reserve_stock(_product_id uuid, _qty integer, _order_id uuid)
RETURNS SETOF public.product_stock
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.product_stock
     SET status = 'reservado',
         order_id = _order_id,
         reserved_until = now() + interval '30 minutes',
         updated_at = now()
   WHERE id IN (
     SELECT id FROM public.product_stock
      WHERE product_id = _product_id AND status = 'disponivel'
      ORDER BY created_at ASC
      LIMIT _qty
      FOR UPDATE SKIP LOCKED
   )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_stock(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_stock(uuid, integer, uuid) TO service_role;

-- =========================
-- Storage bucket for product images
-- =========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Admin/support upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role)));

CREATE POLICY "Admin/support update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role)));

CREATE POLICY "Admin/support delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'support'::app_role)));

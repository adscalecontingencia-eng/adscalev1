
-- 1) marketplace_assets
CREATE TABLE public.marketplace_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platform text NOT NULL DEFAULT 'Facebook',
  currency text NOT NULL DEFAULT 'BRL',
  year int,
  price numeric(12,2) NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  notes text,
  status text NOT NULL DEFAULT 'active',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_assets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_assets TO authenticated;
GRANT ALL ON public.marketplace_assets TO service_role;
ALTER TABLE public.marketplace_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active assets" ON public.marketplace_assets
  FOR SELECT USING (status = 'active' OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE POLICY "Admins manage assets" ON public.marketplace_assets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE TRIGGER trg_marketplace_assets_updated_at
  BEFORE UPDATE ON public.marketplace_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) marketplace_asset_accounts
CREATE TABLE public.marketplace_asset_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.marketplace_assets(id) ON DELETE CASCADE,
  account_number int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ativa',
  is_prepaid boolean NOT NULL DEFAULT false,
  gastos numeric(12,2) NOT NULL DEFAULT 0,
  limite_meta numeric(12,2) NOT NULL DEFAULT 0,
  ciclo numeric(12,2) NOT NULL DEFAULT 0,
  divida numeric(12,2) NOT NULL DEFAULT 0,
  saldo numeric(12,2) NOT NULL DEFAULT 0,
  extensao_limite numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mp_asset_accounts_asset ON public.marketplace_asset_accounts(asset_id);
GRANT SELECT ON public.marketplace_asset_accounts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_asset_accounts TO authenticated;
GRANT ALL ON public.marketplace_asset_accounts TO service_role;
ALTER TABLE public.marketplace_asset_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view accounts of active assets" ON public.marketplace_asset_accounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.marketplace_assets a WHERE a.id = asset_id AND (a.status='active' OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support')))
  );

CREATE POLICY "Admins manage asset accounts" ON public.marketplace_asset_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE TRIGGER trg_marketplace_asset_accounts_updated_at
  BEFORE UPDATE ON public.marketplace_asset_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

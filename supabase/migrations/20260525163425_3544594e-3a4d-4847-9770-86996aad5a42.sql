
-- ============ PARTNERS ============
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  whatsapp_phone text,
  pix_key text,
  commission_pct numeric NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending', -- pending | active | inactive
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full partners" ON public.partners FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));

CREATE POLICY "Partner reads own" ON public.partners FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY "Partner updates own" ON public.partners FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE TRIGGER trg_partners_updated
BEFORE UPDATE ON public.partners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CLIENTS.partner_id ============
ALTER TABLE public.clients ADD COLUMN partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL;
CREATE INDEX idx_clients_partner_id ON public.clients(partner_id);

-- ============ PARTNER_COMMISSIONS ============
CREATE TABLE public.partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  source_commission_id uuid REFERENCES public.commissions(id) ON DELETE SET NULL,
  base_amount numeric NOT NULL DEFAULT 0,    -- agency commission paid
  pct_applied numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,         -- partner share
  status text NOT NULL DEFAULT 'pendente',   -- pendente | pago
  paid_at timestamptz,
  transaction_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pc_partner ON public.partner_commissions(partner_id);
CREATE INDEX idx_pc_client ON public.partner_commissions(client_id);
CREATE INDEX idx_pc_source ON public.partner_commissions(source_commission_id);

ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full partner_commissions" ON public.partner_commissions FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'support'));

CREATE POLICY "Partner reads own commissions" ON public.partner_commissions FOR SELECT TO authenticated
USING (partner_id IN (SELECT id FROM public.partners WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_pc_updated
BEFORE UPDATE ON public.partner_commissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TRIGGER: generate partner commission when client commission is paid ============
CREATE OR REPLACE FUNCTION public.generate_partner_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_pct numeric;
  v_paid_delta numeric;
  v_share numeric;
BEGIN
  v_paid_delta := COALESCE(NEW.valor_pago,0) - COALESCE(OLD.valor_pago,0);
  IF TG_OP = 'INSERT' THEN
    v_paid_delta := COALESCE(NEW.valor_pago,0);
  END IF;

  IF v_paid_delta <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT partner_id INTO v_partner_id FROM public.clients WHERE id = NEW.client_id;
  IF v_partner_id IS NULL THEN RETURN NEW; END IF;

  SELECT commission_pct INTO v_pct FROM public.partners WHERE id = v_partner_id;
  IF COALESCE(v_pct,0) <= 0 THEN RETURN NEW; END IF;

  v_share := v_paid_delta * (v_pct/100.0);
  IF v_share <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.partner_commissions
    (partner_id, client_id, source_commission_id, base_amount, pct_applied, amount, status, note)
  VALUES
    (v_partner_id, NEW.client_id, NEW.id, v_paid_delta, v_pct, v_share, 'pendente',
     'Gerado automaticamente do pagamento da comissão #' || NEW.id::text);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_commissions_partner_share
AFTER INSERT OR UPDATE OF valor_pago ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.generate_partner_commission();

-- ============ TRIGGER: when partner commission marked paid -> create transaction (gasto) ============
CREATE OR REPLACE FUNCTION public.sync_partner_commission_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_name text;
  v_tx_id uuid;
BEGIN
  IF NEW.status = 'pago' AND COALESCE(OLD.status,'') <> 'pago' THEN
    SELECT name INTO v_partner_name FROM public.partners WHERE id = NEW.partner_id;

    INSERT INTO public.transactions (date, type, category, description, amount, client_id, quantidade)
    VALUES (
      COALESCE(NEW.paid_at::date, CURRENT_DATE),
      'gasto',
      'Comissão Parceiro',
      'Pagamento parceiro: ' || COALESCE(v_partner_name,'') || ' (comissão indicação)',
      NEW.amount,
      NEW.client_id,
      1
    )
    RETURNING id INTO v_tx_id;

    NEW.transaction_id := v_tx_id;
    IF NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_partner_commission_payout
BEFORE UPDATE OF status ON public.partner_commissions
FOR EACH ROW EXECUTE FUNCTION public.sync_partner_commission_payout();

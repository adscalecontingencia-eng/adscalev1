CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'banco',
  currency text NOT NULL DEFAULT 'USD',
  initial_balance numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff full access financial_accounts" ON public.financial_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));
CREATE TRIGGER trg_financial_accounts_updated BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.transactions
  ADD COLUMN due_date date,
  ADD COLUMN paid_at date,
  ADD COLUMN payment_method text,
  ADD COLUMN account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN destination_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN related_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN notes text,
  ADD COLUMN updated_at timestamptz;
COMMENT ON COLUMN public.transactions.status IS 'pendente | confirmado (Pago/Recebido) | atrasado | cancelado';
CREATE INDEX idx_transactions_status_due ON public.transactions(status, due_date);
CREATE INDEX idx_transactions_related ON public.transactions(related_transaction_id);

CREATE OR REPLACE FUNCTION public.transactions_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type NOT IN ('receita','gasto','transferencia','estorno','reembolso') THEN
    RAISE EXCEPTION 'Tipo de lançamento inválido: %', NEW.type;
  END IF;
  IF NEW.status NOT IN ('pendente','confirmado','atrasado','cancelado') THEN
    RAISE EXCEPTION 'Status inválido: %', NEW.status;
  END IF;
  IF NEW.payment_method IS NOT NULL AND NEW.payment_method NOT IN ('pix','cartao_credito','cartao_debito','boleto','transferencia','cripto','mercado_pago','outro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida: %', NEW.payment_method;
  END IF;
  IF NEW.type = 'transferencia' THEN
    IF NEW.account_id IS NULL OR NEW.destination_account_id IS NULL OR NEW.account_id = NEW.destination_account_id THEN
      RAISE EXCEPTION 'Transferência precisa de conta de origem e destino diferentes';
    END IF;
  ELSE
    NEW.destination_account_id := NULL;
  END IF;
  IF NEW.type IN ('estorno','reembolso') AND NEW.related_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Estorno/Reembolso precisa estar ligado ao lançamento original';
  END IF;
  IF NEW.status = 'pendente' AND NEW.due_date IS NOT NULL AND NEW.due_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    NEW.status := 'atrasado';
  END IF;
  IF NEW.status = 'atrasado' AND (NEW.due_date IS NULL OR NEW.due_date >= (now() AT TIME ZONE 'America/Sao_Paulo')::date) THEN
    NEW.status := 'pendente';
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_transactions_validate BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_validate();

CREATE TABLE public.transaction_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  action text NOT NULL,
  changed_by uuid,
  changed_by_email text,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_transaction_history_tx ON public.transaction_history(transaction_id, created_at DESC);
GRANT SELECT ON public.transaction_history TO authenticated;
GRANT ALL ON public.transaction_history TO service_role;
ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read transaction_history" ON public.transaction_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support'));

CREATE OR REPLACE FUNCTION public.transactions_log_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _diff jsonb := '{}'::jsonb;
  _o jsonb; _n jsonb; k text;
  _uid uuid := auth.uid();
  _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  IF TG_OP = 'UPDATE' THEN
    _o := to_jsonb(OLD) - 'updated_at'; _n := to_jsonb(NEW) - 'updated_at';
    FOR k IN SELECT jsonb_object_keys(_n) LOOP
      IF (_o -> k) IS DISTINCT FROM (_n -> k) THEN
        _diff := _diff || jsonb_build_object(k, jsonb_build_object('old', _o -> k, 'new', _n -> k));
      END IF;
    END LOOP;
    IF _diff = '{}'::jsonb THEN RETURN NEW; END IF;
    INSERT INTO public.transaction_history(transaction_id, action, changed_by, changed_by_email, changes)
      VALUES (NEW.id, 'update', _uid, _email, _diff);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.transaction_history(transaction_id, action, changed_by, changed_by_email, changes)
      VALUES (NEW.id, 'insert', _uid, _email, to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO public.transaction_history(transaction_id, action, changed_by, changed_by_email, changes)
      VALUES (OLD.id, 'delete', _uid, _email, to_jsonb(OLD));
    RETURN OLD;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.transactions_log_history() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_transactions_history AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_log_history();

CREATE OR REPLACE FUNCTION public.mark_overdue_transactions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.transactions SET status = 'atrasado'
   WHERE status = 'pendente' AND due_date IS NOT NULL
     AND due_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_transactions() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('transactions-mark-overdue', '5 3 * * *', $$SELECT public.mark_overdue_transactions();$$);
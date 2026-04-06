DROP TRIGGER IF EXISTS trg_sync_transaction_to_commission ON public.transactions;

CREATE OR REPLACE FUNCTION public.sync_transaction_to_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'receita'
     AND NEW.category IN ('Comissão Fixa', 'Comissão Semanal')
     AND NEW.client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.commissions c
      WHERE c.client_id = NEW.client_id
        AND c.date::date = NEW.date
        AND c.amount = NEW.amount
    ) THEN
      INSERT INTO public.commissions (
        client_id,
        date,
        amount,
        ad_spend,
        type,
        note,
        billing_week_start,
        billing_week_end,
        percentual_aplicado,
        valor_pago,
        valor_pendente,
        status
      ) VALUES (
        NEW.client_id,
        NEW.date,
        NEW.amount,
        0,
        'daily',
        NEW.description,
        date_trunc('week', NEW.date::timestamp)::date,
        (date_trunc('week', NEW.date::timestamp)::date + 6),
        0,
        0,
        NEW.amount,
        'pendente'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_transaction_to_commission
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_transaction_to_commission();
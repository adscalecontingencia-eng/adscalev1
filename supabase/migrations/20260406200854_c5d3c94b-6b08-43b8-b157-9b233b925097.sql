
-- PROBLEMA 3: Corrigir transações com category de comissão que estão como 'gasto' para 'receita'
UPDATE public.transactions 
SET type = 'receita' 
WHERE type = 'gasto' 
  AND category IN ('Comissão Fixa', 'Comissão Semanal');

-- Criar função da trigger para sincronizar transactions → commissions
CREATE OR REPLACE FUNCTION public.sync_transaction_to_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só sincroniza receitas de comissão com client_id
  IF NEW.type = 'receita' 
     AND NEW.category IN ('Comissão Fixa', 'Comissão Semanal') 
     AND NEW.client_id IS NOT NULL THEN
    
    -- Verificar duplicata: mesmo client_id, date e amount
    IF NOT EXISTS (
      SELECT 1 FROM public.commissions 
      WHERE client_id = NEW.client_id 
        AND date::date = NEW.date 
        AND amount = NEW.amount
    ) THEN
      INSERT INTO public.commissions (
        client_id, date, amount, ad_spend, type, note,
        billing_week_start, billing_week_end,
        percentual_aplicado, valor_pago, valor_pendente, status
      ) VALUES (
        NEW.client_id,
        NEW.date,
        NEW.amount,
        0,
        'daily',
        NEW.description,
        (NEW.date - EXTRACT(DOW FROM NEW.date)::int)::date,
        (NEW.date - EXTRACT(DOW FROM NEW.date)::int + 6)::date,
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

-- Criar a trigger
CREATE TRIGGER trg_sync_transaction_to_commission
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_transaction_to_commission();

-- Sincronizar registros antigos que já existem em transactions mas não em commissions
INSERT INTO public.commissions (client_id, date, amount, ad_spend, type, note, billing_week_start, billing_week_end, percentual_aplicado, valor_pago, valor_pendente, status)
SELECT 
  t.client_id,
  t.date,
  t.amount,
  0,
  'daily',
  t.description,
  (t.date - EXTRACT(DOW FROM t.date)::int)::date,
  (t.date - EXTRACT(DOW FROM t.date)::int + 6)::date,
  0,
  0,
  t.amount,
  'pendente'
FROM public.transactions t
WHERE t.type = 'receita'
  AND t.category IN ('Comissão Fixa', 'Comissão Semanal')
  AND t.client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.commissions c
    WHERE c.client_id = t.client_id
      AND c.date::date = t.date
      AND c.amount = t.amount
  );

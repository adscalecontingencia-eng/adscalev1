CREATE OR REPLACE FUNCTION public.sync_transaction_to_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'receita'
     AND NEW.category IN ('Comissão Fixa', 'Comissão Semanal')
     AND NEW.client_id IS NOT NULL
     AND COALESCE(NEW.description, '') NOT ILIKE 'Pagamento%' THEN
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
        (NEW.date - (((EXTRACT(DOW FROM NEW.date)::int - 5 + 7) % 7)::int))::date,
        ((NEW.date - (((EXTRACT(DOW FROM NEW.date)::int - 5 + 7) % 7)::int))::date + 6),
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

DELETE FROM public.commissions
WHERE type = 'daily'
  AND COALESCE(ad_spend, 0) = 0
  AND (
    COALESCE(note, '') ILIKE 'Pagamento de comissão%'
    OR COALESCE(note, '') ILIKE 'Pagamento de cobrança semanal%'
  );

UPDATE public.commissions
SET status = 'pago',
    valor_pago = amount,
    valor_pendente = 0
WHERE type = 'paid';
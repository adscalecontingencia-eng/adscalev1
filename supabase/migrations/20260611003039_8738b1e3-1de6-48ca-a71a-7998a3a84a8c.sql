ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS plan_credit_start_date date;
-- backfill: para clientes que já têm plan_credit > 0, considera a data mais antiga de gasto como início
UPDATE public.clients c
SET plan_credit_start_date = (
  SELECT MIN(i.date)
  FROM public.meta_ad_insights i
  JOIN public.meta_ad_account_assignments a ON a.ad_account_id = i.ad_account_id AND a.client_id = c.id
)
WHERE c.plan_credit > 0 AND c.plan_credit_start_date IS NULL;
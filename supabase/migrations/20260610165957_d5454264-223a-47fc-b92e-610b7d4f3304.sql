
ALTER TABLE public.meta_ad_account_assignments
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS effective_to DATE;

UPDATE public.meta_ad_account_assignments
   SET effective_from = COALESCE(effective_from, assigned_at::date)
 WHERE effective_from IS NULL;

ALTER TABLE public.meta_ad_account_assignments
  ALTER COLUMN effective_from SET NOT NULL,
  ALTER COLUMN effective_from SET DEFAULT CURRENT_DATE;

-- Limpa comissões daily geradas para semanas inteiramente anteriores ao início da vigência
DELETE FROM public.commissions c
 WHERE c.type = 'daily'
   AND c.billing_week_end IS NOT NULL
   AND c.billing_week_end < (
     SELECT MIN(a.effective_from)
       FROM public.meta_ad_account_assignments a
      WHERE a.client_id = c.client_id
   );

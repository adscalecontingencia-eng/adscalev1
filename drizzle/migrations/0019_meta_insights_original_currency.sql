ALTER TABLE public.meta_ad_insights
  ADD COLUMN IF NOT EXISTS spend_original numeric,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS fx_rate numeric;

COMMENT ON COLUMN public.meta_ad_insights.spend IS 'Gasto do dia convertido para USD (cotação do dia).';
COMMENT ON COLUMN public.meta_ad_insights.spend_original IS 'Gasto do dia na moeda original da conta de anúncio.';
COMMENT ON COLUMN public.meta_ad_insights.currency IS 'Moeda original da conta de anúncio (BRL, EUR, USD...).';
COMMENT ON COLUMN public.meta_ad_insights.fx_rate IS 'USD por 1 unidade da moeda original usada na conversão.';
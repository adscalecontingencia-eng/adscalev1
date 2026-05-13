ALTER TABLE public.meta_ad_insights
  ADD COLUMN IF NOT EXISTS purchases bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue numeric DEFAULT 0;
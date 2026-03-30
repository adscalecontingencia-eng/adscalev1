
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS ad_spend numeric DEFAULT 0;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS billing_week_start date;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS billing_week_end date;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS is_weekly_billing boolean DEFAULT false;

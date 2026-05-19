ALTER TABLE public.meta_ad_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.meta_ad_account_assignments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_ad_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_ad_account_assignments;
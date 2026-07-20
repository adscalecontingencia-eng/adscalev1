CREATE POLICY "Public request settings readable"
ON public.support_settings
FOR SELECT
TO authenticated
USING (key IN ('ad_account_request_limit','ad_account_request_notice'));

INSERT INTO public.support_settings (key, value)
VALUES
  ('ad_account_request_limit', to_jsonb(5)),
  ('ad_account_request_notice', to_jsonb('AVISO: estamos passando por uma instabilidade no Meta e por isso estamos limitando 5 contas por pedido. Dessa forma conseguimos atender todo mundo, agradeço a compreensão e bora escalar!'::text))
ON CONFLICT (key) DO NOTHING;
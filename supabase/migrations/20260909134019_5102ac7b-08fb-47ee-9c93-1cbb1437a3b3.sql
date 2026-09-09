REVOKE ALL ON FUNCTION public.settle_invoice_payment(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_invoice_payment(uuid, text, jsonb) TO service_role;
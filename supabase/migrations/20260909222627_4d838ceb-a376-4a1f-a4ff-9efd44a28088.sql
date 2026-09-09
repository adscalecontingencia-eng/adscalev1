
-- Trigger functions: never callable directly through the API
REVOKE ALL ON FUNCTION public.clients_set_referral_code() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.partners_prevent_self_privilege_escalation() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_alerts_prevent_tampering() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_referral_code(text) FROM anon, authenticated;

-- Internal/service-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.credit_wallet_from_deposit(text, text, jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_deposit_finance(uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_stock(uuid, integer, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.detect_referral_milestone_alerts(numeric) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.award_referral_milestones(uuid) FROM anon, authenticated;

-- Cost data: authenticated only (function already enforces admin/support)
REVOKE ALL ON FUNCTION public.get_product_costs() FROM anon;

-- Keep service_role able to run everything above
GRANT EXECUTE ON FUNCTION public.credit_wallet_from_deposit(text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_deposit_finance(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_stock(uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.detect_referral_milestone_alerts(numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_referral_milestones(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_product_costs() TO service_role;

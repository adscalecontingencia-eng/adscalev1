REVOKE EXECUTE ON FUNCTION public.award_referral_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.commissions_referral_milestone() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_referral_milestones(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_referral_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_summary(uuid) TO authenticated;
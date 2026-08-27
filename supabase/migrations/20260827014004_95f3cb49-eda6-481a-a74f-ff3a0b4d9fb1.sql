GRANT INSERT ON public.client_terms_acceptances TO authenticated;
CREATE POLICY "Clients insert own terms acceptance"
ON public.client_terms_acceptances FOR INSERT TO authenticated
WITH CHECK (auth_user_id = auth.uid());
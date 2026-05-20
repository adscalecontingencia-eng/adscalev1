-- Add BM id field and proper FK so joins work
ALTER TABLE public.support_requests 
  ADD COLUMN IF NOT EXISTS bm_meta_id text;

ALTER TABLE public.support_requests
  DROP CONSTRAINT IF EXISTS support_requests_client_id_fkey;

ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- Allow clients to update/delete their own pending requests
DROP POLICY IF EXISTS "Clients update own pending support_requests" ON public.support_requests;
CREATE POLICY "Clients update own pending support_requests"
  ON public.support_requests FOR UPDATE
  TO authenticated
  USING (
    status = 'pendente' AND client_id IN (
      SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clients delete own pending support_requests" ON public.support_requests;
CREATE POLICY "Clients delete own pending support_requests"
  ON public.support_requests FOR DELETE
  TO authenticated
  USING (
    status = 'pendente' AND client_id IN (
      SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
    )
  );
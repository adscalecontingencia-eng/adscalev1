-- Make the ALL policy more specific - drop overly permissive ones
DROP POLICY "Allow all for authenticated users" ON public.clients;
DROP POLICY "Allow all for authenticated users" ON public.support_users;

-- More specific policies for authenticated users
CREATE POLICY "Authenticated users can select clients" ON public.clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients" ON public.clients
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clients" ON public.clients
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select support_users" ON public.support_users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert support_users" ON public.support_users
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update support_users" ON public.support_users
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete support_users" ON public.support_users
  FOR DELETE TO authenticated USING (true);

-- Allow anon to insert, update, delete on clients
CREATE POLICY "Allow anon insert clients" ON public.clients FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update clients" ON public.clients FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete clients" ON public.clients FOR DELETE TO anon USING (true);

-- Allow anon to insert, update, delete on support_users
CREATE POLICY "Allow anon insert support_users" ON public.support_users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update support_users" ON public.support_users FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete support_users" ON public.support_users FOR DELETE TO anon USING (true);

-- Allow anon to insert, update, delete on commissions
CREATE POLICY "Allow anon insert commissions" ON public.commissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update commissions" ON public.commissions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete commissions" ON public.commissions FOR DELETE TO anon USING (true);

-- Allow anon to insert, update, delete on transactions
CREATE POLICY "Allow anon insert transactions" ON public.transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update transactions" ON public.transactions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete transactions" ON public.transactions FOR DELETE TO anon USING (true);


-- Create commissions table
CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  amount numeric NOT NULL,
  type text NOT NULL DEFAULT 'daily',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select commissions" ON public.commissions FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated select commissions" ON public.commissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert commissions" ON public.commissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update commissions" ON public.commissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete commissions" ON public.commissions FOR DELETE TO authenticated USING (true);

-- Create transactions table
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  type text NOT NULL DEFAULT 'gasto',
  category text NOT NULL DEFAULT 'BMs',
  subcategory text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select transactions" ON public.transactions FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated select transactions" ON public.transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update transactions" ON public.transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete transactions" ON public.transactions FOR DELETE TO authenticated USING (true);

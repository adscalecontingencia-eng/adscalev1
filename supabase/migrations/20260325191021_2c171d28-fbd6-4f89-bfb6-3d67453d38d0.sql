
-- Create role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'support', 'client');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Add auth_user_id columns to link tables to auth.users
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.support_users ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ===== REMOVE ALL DANGEROUS ANON POLICIES =====

-- clients
DROP POLICY IF EXISTS "Allow anon select for login" ON public.clients;
DROP POLICY IF EXISTS "Allow anon insert clients" ON public.clients;
DROP POLICY IF EXISTS "Allow anon update clients" ON public.clients;
DROP POLICY IF EXISTS "Allow anon delete clients" ON public.clients;

-- support_users
DROP POLICY IF EXISTS "Allow anon select for login" ON public.support_users;
DROP POLICY IF EXISTS "Allow anon insert support_users" ON public.support_users;
DROP POLICY IF EXISTS "Allow anon update support_users" ON public.support_users;
DROP POLICY IF EXISTS "Allow anon delete support_users" ON public.support_users;

-- commissions
DROP POLICY IF EXISTS "Allow anon select commissions" ON public.commissions;
DROP POLICY IF EXISTS "Allow anon insert commissions" ON public.commissions;
DROP POLICY IF EXISTS "Allow anon update commissions" ON public.commissions;
DROP POLICY IF EXISTS "Allow anon delete commissions" ON public.commissions;

-- transactions
DROP POLICY IF EXISTS "Allow anon select transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow anon insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow anon update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow anon delete transactions" ON public.transactions;

-- ===== CREATE SECURE AUTHENTICATED-ONLY POLICIES =====

-- clients: admins/support full access, clients can read own record
CREATE POLICY "Admins full access clients" ON public.clients
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'support'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'support'));

CREATE POLICY "Clients read own data" ON public.clients
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

-- support_users: only admins
DROP POLICY IF EXISTS "Authenticated users can select support_users" ON public.support_users;
DROP POLICY IF EXISTS "Authenticated users can insert support_users" ON public.support_users;
DROP POLICY IF EXISTS "Authenticated users can update support_users" ON public.support_users;
DROP POLICY IF EXISTS "Authenticated users can delete support_users" ON public.support_users;

CREATE POLICY "Admins full access support_users" ON public.support_users
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Support reads own data" ON public.support_users
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

-- commissions: admins/support full access, clients read own
DROP POLICY IF EXISTS "Authenticated select commissions" ON public.commissions;
DROP POLICY IF EXISTS "Authenticated insert commissions" ON public.commissions;
DROP POLICY IF EXISTS "Authenticated update commissions" ON public.commissions;
DROP POLICY IF EXISTS "Authenticated delete commissions" ON public.commissions;

CREATE POLICY "Admins full access commissions" ON public.commissions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'support'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'support'));

CREATE POLICY "Clients read own commissions" ON public.commissions
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

-- transactions: admins/support only
DROP POLICY IF EXISTS "Authenticated select transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated delete transactions" ON public.transactions;

CREATE POLICY "Admins full access transactions" ON public.transactions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'support'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'support'));

-- Also drop the old generic authenticated policies on clients
DROP POLICY IF EXISTS "Authenticated users can select clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;

-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  company_name TEXT,
  payment_type TEXT NOT NULL DEFAULT 'fixed' CHECK (payment_type IN ('fixed', 'percentage', 'both')),
  fixed_value NUMERIC DEFAULT 0,
  percentage_value NUMERIC DEFAULT 0,
  ad_accounts INTEGER DEFAULT 0,
  used_accounts INTEGER DEFAULT 0,
  blocked_accounts INTEGER DEFAULT 0,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support users table
CREATE TABLE public.support_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_users ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Allow all for authenticated users" ON public.clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON public.support_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anon read for login purposes
CREATE POLICY "Allow anon select for login" ON public.clients
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon select for login" ON public.support_users
  FOR SELECT TO anon USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_users_updated_at
  BEFORE UPDATE ON public.support_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
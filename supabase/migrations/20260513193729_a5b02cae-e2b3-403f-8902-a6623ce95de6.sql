ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'aluguel';

UPDATE public.clients SET client_type = CASE WHEN payment_type = 'fixed' THEN 'venda' ELSE 'aluguel' END WHERE client_type = 'aluguel';

ALTER TABLE public.clients ADD CONSTRAINT clients_client_type_check CHECK (client_type IN ('aluguel','venda'));
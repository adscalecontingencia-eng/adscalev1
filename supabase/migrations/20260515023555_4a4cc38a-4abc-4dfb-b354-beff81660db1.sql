ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS custo_produto numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_venda numeric DEFAULT 0;
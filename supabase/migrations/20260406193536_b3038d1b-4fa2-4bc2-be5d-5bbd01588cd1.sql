
-- Add new columns to commissions table
ALTER TABLE public.commissions 
  ADD COLUMN IF NOT EXISTS percentual_aplicado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pago numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pendente numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente';

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS niche text,
  ADD COLUMN IF NOT EXISTS monthly_investment text,
  ADD COLUMN IF NOT EXISTS how_found_us text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_approval_status_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_approval_status_check
  CHECK (approval_status IN ('pending','approved','rejected'));

CREATE INDEX IF NOT EXISTS idx_clients_approval_status ON public.clients (approval_status);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.whatsapp_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  billing_id UUID,
  phone TEXT,
  payload JSONB,
  status TEXT NOT NULL,
  http_status INTEGER,
  response TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support read whatsapp_dispatch_log"
ON public.whatsapp_dispatch_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

CREATE INDEX IF NOT EXISTS idx_whatsapp_dispatch_log_client ON public.whatsapp_dispatch_log(client_id, created_at DESC);


-- Webhook telemetry + idempotency table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'mercado_pago',
  event_key text NOT NULL,
  topic text,
  data_id text,
  request_id text,
  signature_valid boolean,
  external_reference text,
  status text,
  http_status int,
  response jsonb,
  headers jsonb,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_unique_event UNIQUE (provider, event_key)
);

GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view webhook events"
  ON public.webhook_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON public.webhook_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_extref ON public.webhook_events (external_reference);

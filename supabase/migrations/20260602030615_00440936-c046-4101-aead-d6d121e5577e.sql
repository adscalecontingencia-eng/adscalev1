-- Tabela para armazenar múltiplos aplicativos Meta (App ID/Secret/Tokens)
CREATE TABLE public.meta_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  app_id text NOT NULL,
  app_secret text,
  system_user_token text,
  user_access_token text,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  notes text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_apps TO authenticated;
GRANT ALL ON public.meta_apps TO service_role;

ALTER TABLE public.meta_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/support full meta_apps"
ON public.meta_apps
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

CREATE TRIGGER trg_meta_apps_updated_at
BEFORE UPDATE ON public.meta_apps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Garantir somente um aplicativo padrão (is_default = true)
CREATE UNIQUE INDEX meta_apps_only_one_default
  ON public.meta_apps ((is_default))
  WHERE is_default = true;

-- Vincular cada cliente a um aplicativo Meta (opcional; null = usa o padrão)
ALTER TABLE public.clients
  ADD COLUMN meta_app_id uuid REFERENCES public.meta_apps(id) ON DELETE SET NULL;

CREATE INDEX idx_clients_meta_app_id ON public.clients(meta_app_id);
CREATE TABLE public.support_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_chat_messages_client ON public.support_chat_messages (client_id, created_at);

GRANT SELECT, INSERT ON public.support_chat_messages TO authenticated;
GRANT ALL ON public.support_chat_messages TO service_role;

ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients read own chat" ON public.support_chat_messages
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

CREATE POLICY "clients insert own chat" ON public.support_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (role = 'user' AND user_id = auth.uid() AND client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

CREATE POLICY "admin support read all chat" ON public.support_chat_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

INSERT INTO public.support_settings (key, value) VALUES ('support_whatsapp', to_jsonb(''::text)) ON CONFLICT (key) DO NOTHING;
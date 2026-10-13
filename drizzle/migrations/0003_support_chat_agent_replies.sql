ALTER TABLE public.support_chat_messages DROP CONSTRAINT IF EXISTS support_chat_messages_role_check;
ALTER TABLE public.support_chat_messages ADD CONSTRAINT support_chat_messages_role_check CHECK (role IN ('user','assistant','agent'));
CREATE POLICY "admin support reply chat" ON public.support_chat_messages FOR INSERT TO authenticated
WITH CHECK (role = 'agent' AND user_id = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support')));
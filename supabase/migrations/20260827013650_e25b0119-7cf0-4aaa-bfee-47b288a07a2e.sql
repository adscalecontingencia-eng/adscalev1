CREATE TABLE IF NOT EXISTS public.terms_versions (
  version TEXT PRIMARY KEY,
  content_pt TEXT NOT NULL,
  content_en TEXT,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.terms_versions TO authenticated;
GRANT SELECT ON public.terms_versions TO anon;
GRANT ALL ON public.terms_versions TO service_role;
ALTER TABLE public.terms_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read terms versions" ON public.terms_versions FOR SELECT USING (true);
CREATE POLICY "Admins manage terms versions" ON public.terms_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_terms_versions_updated_at BEFORE UPDATE ON public.terms_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.terms_download_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_id UUID REFERENCES public.client_terms_acceptances(id) ON DELETE SET NULL,
  client_id UUID,
  auth_user_id UUID,
  email TEXT,
  terms_version TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'download',
  format TEXT NOT NULL DEFAULT 'txt',
  language TEXT NOT NULL DEFAULT 'pt',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.terms_download_log TO authenticated;
GRANT ALL ON public.terms_download_log TO service_role;
ALTER TABLE public.terms_download_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users log own terms downloads" ON public.terms_download_log FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Users read own terms downloads" ON public.terms_download_log FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY "Staff read all terms downloads" ON public.terms_download_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));
CREATE INDEX IF NOT EXISTS idx_terms_dl_client ON public.terms_download_log(client_id);
CREATE INDEX IF NOT EXISTS idx_terms_dl_created ON public.terms_download_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_terms_dl_version ON public.terms_download_log(terms_version);
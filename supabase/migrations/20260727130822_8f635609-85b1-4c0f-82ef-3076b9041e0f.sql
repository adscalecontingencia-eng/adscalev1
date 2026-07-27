-- Add preferred_language to existing role tables
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferred_language text CHECK (preferred_language IN ('pt','en','es'));
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS preferred_language text CHECK (preferred_language IN ('pt','en','es'));
ALTER TABLE public.support_users ADD COLUMN IF NOT EXISTS preferred_language text CHECK (preferred_language IN ('pt','en','es'));

-- Generic per-auth-user preferences (admins, marketplace clients, fallback)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_language text CHECK (preferred_language IN ('pt','en','es')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_own" ON public.user_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_preferences_update_own" ON public.user_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_preferences_delete_own" ON public.user_preferences
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
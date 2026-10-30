ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS domain_status text,
  ADD COLUMN IF NOT EXISTS domain_a_ip text,
  ADD COLUMN IF NOT EXISTS domain_txt_value text,
  ADD COLUMN IF NOT EXISTS domain_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS domain_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS domain_admin_note text;

COMMENT ON COLUMN public.agency_settings.domain_status IS 'null | solicitado | dns_pendente | ativo | erro';

-- Agencies may only request a domain; AD SCALE staff fill DNS records and activate it.
CREATE OR REPLACE FUNCTION public.agency_settings_domain_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_staff() THEN RETURN NEW; END IF;
  IF NEW.custom_domain IS NOT NULL THEN
    NEW.custom_domain := lower(btrim(NEW.custom_domain));
    IF NEW.custom_domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$' THEN
      RAISE EXCEPTION 'Domínio inválido' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.custom_domain IS DISTINCT FROM OLD.custom_domain THEN
      -- domain changed: start over
      NEW.domain_status := CASE WHEN NEW.custom_domain IS NULL THEN NULL WHEN NEW.domain_status = 'solicitado' THEN 'solicitado' ELSE NULL END;
      NEW.domain_a_ip := NULL; NEW.domain_txt_value := NULL; NEW.domain_activated_at := NULL; NEW.domain_admin_note := NULL;
      NEW.domain_requested_at := CASE WHEN NEW.domain_status = 'solicitado' THEN now() ELSE NULL END;
    ELSE
      NEW.domain_a_ip := OLD.domain_a_ip; NEW.domain_txt_value := OLD.domain_txt_value;
      NEW.domain_activated_at := OLD.domain_activated_at; NEW.domain_admin_note := OLD.domain_admin_note;
      IF NEW.domain_status IS DISTINCT FROM OLD.domain_status THEN
        IF NEW.domain_status = 'solicitado' AND OLD.domain_status IS NULL AND NEW.custom_domain IS NOT NULL THEN
          NEW.domain_requested_at := now();
        ELSE
          NEW.domain_status := OLD.domain_status; NEW.domain_requested_at := OLD.domain_requested_at;
        END IF;
      ELSE
        NEW.domain_requested_at := OLD.domain_requested_at;
      END IF;
    END IF;
  ELSE
    NEW.domain_a_ip := NULL; NEW.domain_txt_value := NULL; NEW.domain_activated_at := NULL; NEW.domain_admin_note := NULL;
    IF NEW.domain_status = 'solicitado' AND NEW.custom_domain IS NOT NULL THEN NEW.domain_requested_at := now();
    ELSE NEW.domain_status := NULL; NEW.domain_requested_at := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS agency_settings_domain_guard ON public.agency_settings;
CREATE TRIGGER agency_settings_domain_guard BEFORE INSERT OR UPDATE ON public.agency_settings
  FOR EACH ROW EXECUTE FUNCTION public.agency_settings_domain_guard();

CREATE UNIQUE INDEX IF NOT EXISTS agency_settings_custom_domain_key ON public.agency_settings (lower(custom_domain)) WHERE custom_domain IS NOT NULL;
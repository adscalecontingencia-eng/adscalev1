import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AgencyBranding { agency_client_id: string; brand_name: string | null; logo_url: string | null; primary_color: string | null; slug: string | null }

const OWN_HOSTS = ['localhost', '127.0.0.1', 'lovable.app', 'lovableproject.com', 'adscalehub.com'];

/** Resolve the partner agency from ?agencia=slug or from a custom domain hostname. */
export function getAgencyKey(search: URLSearchParams): string | null {
  const q = (search.get('agencia') || search.get('agency') || '').trim().toLowerCase();
  if (q) return q.slice(0, 80);
  const host = window.location.hostname.toLowerCase();
  if (OWN_HOSTS.some(h => host === h || host.endsWith('.' + h))) return null;
  return host;
}

export function hexToHsl(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return null;
  const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b); const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function useAgencyBranding(search: URLSearchParams) {
  const key = getAgencyKey(search);
  const [branding, setBranding] = useState<AgencyBranding | null>(null);
  const [loading, setLoading] = useState(!!key);
  useEffect(() => {
    if (!key) { setLoading(false); return; }
    (supabase.rpc as any)('get_agency_branding', { _key: key }).then(({ data }: any) => {
      const row = Array.isArray(data) ? data[0] : data;
      setBranding(row || null); setLoading(false);
      if (row?.primary_color) {
        const hsl = hexToHsl(row.primary_color);
        if (hsl) { document.documentElement.style.setProperty('--primary', hsl); document.documentElement.style.setProperty('--ring', hsl); }
      }
      if (row?.brand_name) document.title = `${row.brand_name} · Cadastro`;
    });
  }, [key]);
  return { key, branding, loading };
}

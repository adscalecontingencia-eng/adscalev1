import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AgencyBranding { agency_client_id: string; brand_name: string | null; logo_url: string | null; primary_color: string | null; slug: string | null; support_whatsapp?: string | null; favicon_url?: string | null; site_title?: string | null }

const OWN_HOSTS = ['localhost', '127.0.0.1', 'lovable.app', 'lovableproject.com', 'adscalehub.com', 'adscalehub.com.br'];

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

/** Recommended favicon: square PNG, 512×512 (min. 32×32), transparent background. */
export const FAVICON_HINT = 'PNG quadrado (1:1), 512×512 px recomendado (mínimo 32×32), fundo transparente.';

/** Swap the browser tab icon and title; returns a cleanup that restores the previous ones. */
export function applyHeadBranding(opts: { title?: string | null; favicon?: string | null }): () => void {
  const prevTitle = document.title;
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
  const prevHrefs = links.map(l => l.getAttribute('href'));
  const prevTypes = links.map(l => l.getAttribute('type'));
  if (opts.title) document.title = opts.title;
  const fav = /^https?:\/\/|^\/|^data:image\//i.test(opts.favicon || '') ? opts.favicon! : null;
  let added: HTMLLinkElement | null = null;
  if (fav) {
    if (links.length) links.forEach(l => { l.setAttribute('href', fav); l.removeAttribute('type'); });
    else { added = document.createElement('link'); added.rel = 'icon'; added.href = fav; document.head.appendChild(added); }
  }
  return () => {
    document.title = prevTitle;
    if (fav) {
      links.forEach((l, i) => { if (prevHrefs[i]) l.setAttribute('href', prevHrefs[i]!); if (prevTypes[i]) l.setAttribute('type', prevTypes[i]!); });
      added?.remove();
    }
  };
}

const CACHE_PREFIX = 'agencyBrand:';
export function readBrandCache(key: string | null): AgencyBranding | null {
  if (!key) return null;
  try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || 'null'); } catch { return null; }
}
function writeBrandCache(key: string, row: AgencyBranding | null) {
  try { row ? localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(row)) : localStorage.removeItem(CACHE_PREFIX + key); } catch { /* quota */ }
}
function applyColorVars(hex?: string | null) {
  const hsl = hexToHsl(hex || '');
  if (hsl) { document.documentElement.style.setProperty('--primary', hsl); document.documentElement.style.setProperty('--ring', hsl); }
}
/** Show the page (hidden by index.html on agency hosts until the brand is known). */
export function revealPage() { document.documentElement.classList.remove('agency-pending'); }

/** Agency key detected before React mounted (custom domain or ?agencia=). */
export function bootKey(): string | null { return (window as any).__AGENCY_KEY__ || null; }

/** Runs once at startup on agency hosts: applies cached brand instantly, then refreshes it from the server. */
export function bootAgencyBranding() {
  const key = bootKey();
  if (!key) return;
  const cached = readBrandCache(key);
  if (cached) applyColorVars(cached.primary_color);
  (supabase.rpc as any)('get_agency_branding', { _key: key }).then(({ data }: any) => {
    const row = Array.isArray(data) ? data[0] : data;
    writeBrandCache(key, row || null);
    if (row) {
      applyColorVars(row.primary_color);
      applyHeadBranding({ title: row.site_title || row.brand_name, favicon: row.favicon_url });
    }
    revealPage();
  }, revealPage);
}

export function useAgencyBranding(search: URLSearchParams, opts: { applyColor?: boolean; titleSuffix?: string } = {}) {
  const applyColor = opts.applyColor !== false;
  const suffix = opts.titleSuffix || 'Cadastro';
  const key = getAgencyKey(search) || bootKey();
  const [branding, setBranding] = useState<AgencyBranding | null>(() => readBrandCache(key));
  const [loading, setLoading] = useState(!!key && !readBrandCache(key));
  useEffect(() => {
    if (!key) { setLoading(false); return; }
    (supabase.rpc as any)('get_agency_branding', { _key: key }).then(({ data }: any) => {
      const row = Array.isArray(data) ? data[0] : data;
      setBranding(row || null); setLoading(false);
      writeBrandCache(key, row || null);
      if (applyColor && row?.primary_color) applyColorVars(row.primary_color);
      revealPage();
    });
  }, [key]);
  useEffect(() => {
    if (!branding) return;
    return applyHeadBranding({ title: branding.site_title || (branding.brand_name ? `${branding.brand_name} · ${suffix}` : null), favicon: branding.favicon_url });
  }, [branding, suffix]);
  return { key, branding, loading };
}

/** Hex brand color -> CSS vars so every themed element follows the agency color. */
export function brandVars(hex?: string | null): Record<string, string> | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  const v = `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  const fg = l > 0.6 ? '0 0% 8%' : '0 0% 100%';
  return { '--primary': v, '--ring': v, '--accent': v, '--primary-foreground': fg };
}

/**
 * Branding of the partner agency a client belongs to (null for AD SCALE's own clients).
 * Applies the agency color to the whole page (incl. dialogs) while mounted.
 */
export function useClientAgencyBranding(clientId?: string | null) {
  // On an agency host start from the cached host brand so AD SCALE never flashes.
  const [branding, setBranding] = useState<AgencyBranding | null>(() => (clientId && bootKey() ? readBrandCache(bootKey()) : null));
  const [loading, setLoading] = useState(!!clientId);
  useEffect(() => {
    if (!clientId) { setBranding(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    (supabase.rpc as any)('get_client_agency_branding', { _client_id: clientId }).then(({ data }: any) => {
      if (!alive) return;
      const row = Array.isArray(data) ? data[0] : data;
      setBranding(row || null); setLoading(false);
    });
    return () => { alive = false; };
  }, [clientId]);

  useEffect(() => {
    if (!branding) return;
    const root = document.documentElement;
    const vars = brandVars(branding.primary_color) || {};
    const prev: Record<string, string> = {};
    Object.entries(vars).forEach(([k, v]) => { prev[k] = root.style.getPropertyValue(k); root.style.setProperty(k, v); });
    const restoreHead = applyHeadBranding({ title: branding.site_title || (branding.brand_name ? `${branding.brand_name} · Painel` : null), favicon: branding.favicon_url });
    return () => {
      Object.keys(vars).forEach(k => { if (prev[k]) root.style.setProperty(k, prev[k]); else root.style.removeProperty(k); });
      restoreHead();
    };
  }, [branding]);

  return { branding, loading };
}

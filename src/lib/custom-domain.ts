/** Default IP the hosting asks custom domains to point to (A record). AD SCALE can override it per agency. */
export const DEFAULT_DOMAIN_IP = '185.158.133.1';

const TWO_LEVEL_SUFFIXES = ['com.br', 'net.br', 'org.br', 'art.br', 'blog.br', 'eco.br', 'app.br', 'dev.br', 'co.uk', 'com.au', 'com.mx', 'com.ar', 'com.co', 'com.pt', 'co.za'];

export function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export function isValidDomain(d: string): boolean {
  return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d);
}

/** Splits "painel.agencia.com.br" into host "painel" + root "agencia.com.br". Root domain → host "@". */
export function splitDomain(domain: string): { host: string; root: string } {
  const d = normalizeDomain(domain);
  const parts = d.split('.');
  const suffix2 = parts.slice(-2).join('.');
  const rootLen = TWO_LEVEL_SUFFIXES.includes(suffix2) ? 3 : 2;
  if (parts.length <= rootLen) return { host: '@', root: d };
  return { host: parts.slice(0, parts.length - rootLen).join('.'), root: parts.slice(-rootLen).join('.') };
}

/** DNS records the agency must create at its domain provider. */
export function dnsRecordsFor(domain: string, ip?: string | null, txt?: string | null) {
  const { host } = splitDomain(domain);
  return [
    { type: 'A', name: host, fqdn: domain, value: ip || DEFAULT_DOMAIN_IP },
    { type: 'TXT', name: host === '@' ? '_lovable' : `_lovable.${host}`, fqdn: `_lovable.${domain}`, value: txt || null },
  ];
}

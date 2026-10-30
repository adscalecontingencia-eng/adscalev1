import { describe, it, expect } from 'vitest';
import { splitDomain, dnsRecordsFor, isValidDomain } from './custom-domain';

describe('custom domain DNS records', () => {
  it('subdomain on .com.br uses the subdomain label as record name', () => {
    expect(splitDomain('painel.agencia.com.br')).toEqual({ host: 'painel', root: 'agencia.com.br' });
    const [a, txt] = dnsRecordsFor('painel.agencia.com.br', null, 'lovable_verify=abc');
    expect(a).toMatchObject({ type: 'A', name: 'painel' });
    expect(txt).toMatchObject({ type: 'TXT', name: '_lovable.painel', value: 'lovable_verify=abc' });
  });
  it('root domain uses @ and _lovable', () => {
    const [a, txt] = dnsRecordsFor('agencia.com');
    expect(a.name).toBe('@');
    expect(txt.name).toBe('_lovable');
  });
  it('rejects invalid domains', () => {
    expect(isValidDomain('painel.agencia.com')).toBe(true);
    expect(isValidDomain('https://x')).toBe(false);
  });
});

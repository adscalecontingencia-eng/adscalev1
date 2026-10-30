import { describe, it, expect } from 'vitest';
import { defaultAgencySignupTerms, resolveAgencySignupTerms } from './agency-signup-terms';

describe('agency signup terms', () => {
  it('default terms carry the agency name and never AD SCALE', () => {
    const pt = defaultAgencySignupTerms('Agência Demo', 'pt');
    expect(pt).toContain('Agência Demo');
    expect(/AD\s?SCALE/i.test(pt)).toBe(false);
    expect(/AD\s?SCALE/i.test(defaultAgencySignupTerms('Demo', 'en'))).toBe(false);
  });
  it('custom text wins and keeps the saved version', () => {
    const r = resolveAgencySignupTerms({ brand_name: 'X', terms_pt: 'Meu termo', terms_en: null, terms_version: 'ag-1' }, 'pt-BR');
    expect(r).toEqual({ text: 'Meu termo', version: 'ag-1' });
  });
  it('falls back to branded default when nothing was saved', () => {
    const r = resolveAgencySignupTerms({ brand_name: 'Loja', terms_pt: null, terms_en: null, terms_version: null }, 'pt');
    expect(r.text).toContain('Loja');
  });
});

import { describe, it, expect } from 'vitest';
import { visibleSections, normalizeWhatsapp } from './agency-permissions';

describe('agency collaborator permissions', () => {
  it('owner sees every section plus Usuários', () => {
    const s = visibleSections(true, []);
    expect(s).toContain('usuarios');
    expect(s).toContain('creditos');
  });
  it('collaborator sees only granted sections and never Usuários', () => {
    expect(visibleSections(false, ['suporte', 'contas'])).toEqual(['contas', 'suporte']);
    expect(visibleSections(false, ['suporte'])).not.toContain('usuarios');
  });
  it('collaborator with no permission sees nothing', () => {
    expect(visibleSections(false, [])).toEqual([]);
  });
});

describe('agency WhatsApp', () => {
  it('keeps only digits with country code', () => {
    expect(normalizeWhatsapp('+55 (31) 99841-6336')).toBe('5531998416336');
  });
  it('rejects numbers that are too short', () => {
    expect(normalizeWhatsapp('9984')).toBeNull();
  });
});

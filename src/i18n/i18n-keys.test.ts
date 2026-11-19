import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import i18n from '@/i18n';

// Every literal key passed to t()/tr() must exist in PT, EN and ES — otherwise the
// screen shows the raw key or falls back to Portuguese when another language is selected.
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(tsx?|jsx?)$/.test(e.name) && !e.name.endsWith('.test.ts') ? [p] : [];
  });

describe('i18n keys', () => {
  it('every t()/tr() key exists in pt, en and es', () => {
    const missing: string[] = [];
    for (const f of walk(path.resolve(__dirname, '..'))) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\b(?:t|tr|trHtml|i18n\.t)\(\s*['"`]([a-zA-Z][\w-]*(?:\.[\w-]+)+)['"`]/g)) {
        for (const lng of ['pt', 'en', 'es']) {
          const k = m[1];
          if (!i18n.exists(k, { lng }) && !i18n.exists(`${k}_one`, { lng })) missing.push(`${path.basename(f)} [${lng}] ${k}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('admin labels switch language (keys from different areas under the same root survive the merge)', () => {
    expect(i18n.t('admin.clients.newClient', { lng: 'en' })).toBe('New Client');
    expect(i18n.t('admin.clients.newClient', { lng: 'es' })).toBe('Nuevo Cliente');
    expect(i18n.t('fin.status.confirmado', { lng: 'en' })).toBe('Paid/Received');
  });
});

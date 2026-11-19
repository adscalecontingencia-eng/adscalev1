// Lista chaves usadas em t('...')/tr('...') que faltam em pt/en/es. Uso: bun scripts/i18n-missing.ts [arquivos...]
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import pt from '../src/i18n/locales/pt';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import { areaPt, areaEn, areaEs, deepMerge } from '../src/i18n/locales/areas';
const res = { pt: deepMerge(pt as any, areaPt), en: deepMerge(en as any, areaEn), es: deepMerge(es as any, areaEs) } as Record<string, any>;
const get = (o: any, k: string) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : execSync("rg -l \"\\b(t|tr)\\(\" src --glob '*.tsx' --glob '*.ts'").toString().trim().split('\n');
let missing = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\b(?:t|tr|i18n\.t)\(\s*['"`]([a-zA-Z][\w-]*(?:\.[\w-]+)+)['"`]/g)) {
    const k = m[1];
    for (const lng of ['pt', 'en', 'es']) {
      const v = get(res[lng], k) ?? get(res[lng], k + '_one') ?? get(res[lng], k + '_other');
      if (v == null) { missing++; console.log(`${f}: [${lng}] ${k}`); }
    }
  }
}
console.error(`${missing} chaves faltando`);

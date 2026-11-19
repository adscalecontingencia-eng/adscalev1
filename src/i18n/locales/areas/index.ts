import * as client from './client';
import * as agency from './agency';
import * as adminCore from './admin_core';
import * as adminFinance from './admin_finance';
import * as adminMeta from './admin_meta';
import * as adminSupport from './admin_support';
import * as marketplace from './marketplace';
import * as auth from './auth';

const areas = [client, agency, adminCore, adminFinance, adminMeta, adminSupport, marketplace, auth];

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => !!v && typeof v === 'object' && !Array.isArray(v);

/** Deep merge: several areas may add keys under the same root (e.g. `admin.*`). */
export function deepMerge(...trees: Tree[]): Tree {
  const out: Tree = {};
  for (const t of trees) {
    for (const [k, v] of Object.entries(t || {})) {
      out[k] = isTree(v) && isTree(out[k]) ? deepMerge(out[k] as Tree, v) : v;
    }
  }
  return out;
}

export const areaPt = deepMerge(...areas.map(a => a.pt));
export const areaEn = deepMerge(...areas.map(a => a.en));
export const areaEs = deepMerge(...areas.map(a => a.es));

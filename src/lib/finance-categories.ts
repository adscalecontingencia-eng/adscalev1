// Categorias do Financeiro. Lançamentos antigos mantêm o nome original da categoria
// e continuam aparecendo em filtros e relatórios (ver `withLegacy`).
export const ASSET_CATEGORIES = [
  'Perfil Comum', 'Perfil Verificado', 'Perfil Antigo',
  'BM Comum', 'BMV 250', 'BMV 2K', 'BMV 10K', 'BMV 100K',
  'Combo Comum', 'Combo Verificado', 'Super Combo', 'Pagina',
];
export const EXPENSE_EXTRA = ['Fornecedores', 'Marketing', 'Custo Operacional'];
export const OTHER_CATEGORIES = ['Comissão Fixa', 'Comissão Semanal', 'Outros'];
export const CATEGORIES = [...ASSET_CATEGORIES, ...EXPENSE_EXTRA, ...OTHER_CATEGORIES];
/** Categorias que não são ativo (nunca entram nos gráficos por estrutura de ativo). */
export const NON_ASSET = new Set([...EXPENSE_EXTRA, ...OTHER_CATEGORIES, 'Transferência']);

/** Lista oficial + categorias antigas encontradas nos lançamentos (no fim, em ordem alfabética). */
export function withLegacy(base: string[], used: (string | null | undefined)[]): string[] {
  const set = new Set(base);
  const legacy = [...new Set(used.filter((c): c is string => !!c && !set.has(c)))].sort((a, b) => a.localeCompare(b));
  return [...base, ...legacy];
}

/** Categorias de ativo para relatórios: novas + antigas de ativo usadas nos lançamentos. */
export function assetCategoriesForReports(used: (string | null | undefined)[]): string[] {
  return withLegacy(ASSET_CATEGORIES, used.filter(c => c && !NON_ASSET.has(c)));
}

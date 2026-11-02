/**
 * O banco devolve no máximo 1000 linhas por consulta. Listas que podem passar
 * disso (ex.: contas Meta) precisam ser buscadas em páginas, senão as linhas
 * do fim da ordenação somem da tela sem nenhum erro.
 *
 * Passe uma função que monta a consulta já com filtros/ordem; ela recebe o
 * intervalo da página. Inclua uma ordem estável (ex.: `.order("id")`) para
 * nenhuma linha pular ou repetir entre páginas.
 */
export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000,
  maxPages = 50,
): Promise<{ data: T[]; error: any }> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) return { data: all, error };
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return { data: all, error: null };
}

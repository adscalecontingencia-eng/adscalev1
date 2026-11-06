import { describe, it, expect } from 'vitest';
import { ASSET_CATEGORIES, withLegacy, assetCategoriesForReports } from './finance-categories';

describe('finance-categories', () => {
  it('lista oficial na ordem pedida', () => {
    expect(ASSET_CATEGORIES).toEqual(['Perfil Comum', 'Perfil Verificado', 'Perfil Antigo', 'BM Comum', 'BMV 250', 'BMV 2K', 'BMV 10K', 'BMV 100K', 'Combo Comum', 'Combo Verificado', 'Super Combo', 'Pagina']);
  });
  it('categorias antigas continuam disponíveis com o nome antigo', () => {
    const l = withLegacy(['A'], ['BM API', 'A', 'Crédito do Plano']);
    expect(l).toEqual(['A', 'BM API', 'Crédito do Plano']);
  });
  it('relatórios de ativo incluem antigas e excluem extras', () => {
    const l = assetCategoriesForReports(['Perfil', 'Marketing', 'Comissão Fixa']);
    expect(l).toContain('Perfil');
    expect(l).not.toContain('Marketing');
    expect(l).not.toContain('Comissão Fixa');
  });
});

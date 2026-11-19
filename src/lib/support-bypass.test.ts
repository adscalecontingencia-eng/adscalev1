import { describe, it, expect } from 'vitest';
import { isSupportBlockedByOverdue } from './support-bypass';

describe('liberação do suporte com saldo atrasado', () => {
  it('Bravo Multimarcas pode abrir suporte mesmo com atraso', () => {
    expect(isSupportBlockedByOverdue({ id: '6c1f1501-33c9-4eb5-a02d-69dfe80ff964', name: 'Mateus' }, 31.26)).toBe(false);
  });
  it('outros clientes com atraso acima de US$ 25 continuam bloqueados', () => {
    expect(isSupportBlockedByOverdue({ id: 'outro', name: 'Mateus' }, 31.26)).toBe(true);
  });
});

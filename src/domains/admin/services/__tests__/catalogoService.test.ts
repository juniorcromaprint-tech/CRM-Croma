import { describe, it, expect, vi } from 'vitest';

// Mock supabase before importing catalogoService to avoid env-var error
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
  },
}));

import { buildCategoriaTree } from '../catalogoService';
import type { CategoriaProduto } from '../../types/catalogo.types';

const makeCategoria = (id: string, parent_id: string | null, nome: string): CategoriaProduto => ({
  id, nome, slug: nome.toLowerCase().replace(/\s/g, '-'), parent_id,
  icone: null, cor: null, ordem: 0, ativo: true,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
});

describe('buildCategoriaTree', () => {
  it('retorna nós raiz quando não há parent_id', () => {
    const flat = [
      makeCategoria('1', null, 'Banners'),
      makeCategoria('2', null, 'Adesivos'),
    ];
    const tree = buildCategoriaTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toEqual([]);
    expect(tree[1].children).toEqual([]);
  });

  it('aninha children corretamente', () => {
    const flat = [
      makeCategoria('1', null, 'Root'),
      makeCategoria('2', '1', 'Child A'),
      makeCategoria('3', '1', 'Child B'),
    ];
    const tree = buildCategoriaTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
  });

  it('nós órfãos (parent não existe) vão para a raiz', () => {
    const flat = [makeCategoria('1', 'inexistente', 'Órfão')];
    const tree = buildCategoriaTree(flat);
    expect(tree).toHaveLength(1);
  });

  it('array vazio retorna array vazio', () => {
    expect(buildCategoriaTree([])).toEqual([]);
  });

  it('aninha 3 níveis corretamente', () => {
    const flat = [
      makeCategoria('1', null, 'Nível 1'),
      makeCategoria('2', '1', 'Nível 2'),
      makeCategoria('3', '2', 'Nível 3'),
    ];
    const tree = buildCategoriaTree(flat);
    expect(tree[0].children![0].children).toHaveLength(1);
  });
});

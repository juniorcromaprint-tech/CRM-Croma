// src/hooks/useTerceirizacaoCatalogo.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface TerceirizacaoFornecedor {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
}

export interface TerceirizacaoItem {
  id: string;
  categoria: string;
  nome: string;
  cores: string | null;
  material: string | null;
  revestimento: string | null;
  acabamento: string | null;
  extras: string | null;
  prazo: string | null;
  preco_info: string | null;
  preco_texto: string | null;
  preco_valor: number | null;
  preco_unidade: string | null;
  markup_aplicado: number | null;
  preco_venda: number | null;
  url: string | null;
  capturado_em: string | null;
  fornecedores: TerceirizacaoFornecedor;
}

export interface UseTerceirizacaoCatalogoFilters {
  fornecedorId?: string;
  categoria?: string;
  search?: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTerceirizacaoCatalogo(filters: UseTerceirizacaoCatalogoFilters = {}) {
  return useQuery({
    queryKey: ['terceirizacao_catalogo', filters],
    queryFn: async () => {
      let query = supabase
        .from('terceirizacao_catalogo')
        .select(`
          id, categoria, nome, cores, material, revestimento, acabamento, extras,
          prazo, preco_info, preco_texto, preco_valor, preco_unidade,
          markup_aplicado, preco_venda, url, capturado_em,
          fornecedores!inner(id, razao_social, nome_fantasia)
        `)
        .eq('ativo', true)
        .order('categoria')
        .order('nome');

      if (filters.fornecedorId) {
        query = query.eq('fornecedor_id', filters.fornecedorId);
      }

      if (filters.categoria) {
        query = query.eq('categoria', filters.categoria);
      }

      if (filters.search) {
        query = query.ilike('nome', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as TerceirizacaoItem[];
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

// ─── Hook categorias ─────────────────────────────────────────────────────────

export function useTerceirizacaoCategorias() {
  return useQuery({
    queryKey: ['terceirizacao_categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terceirizacao_catalogo')
        .select('categoria')
        .eq('ativo', true)
        .order('categoria');

      if (error) throw error;

      const unique = [...new Set((data ?? []).map((r) => r.categoria as string))];
      return unique;
    },
    staleTime: 1000 * 60 * 10,
  });
}

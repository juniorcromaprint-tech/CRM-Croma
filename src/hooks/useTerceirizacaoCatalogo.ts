// src/hooks/useTerceirizacaoCatalogo.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
    staleTime: 1000 * 60 * 5,
  });
}

// Tipos faixas
export interface TerceirizacaoFaixa {
  id: string;
  catalogo_id: string;
  qtd_min: number;
  preco_unitario: number;
  capturado_em: string;
}

export function useTerceirizacaoFaixas(catalogoId: string | null | undefined) {
  return useQuery({
    queryKey: ['terceirizacao_faixas', catalogoId],
    enabled: !!catalogoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terceirizacao_catalogo_faixas')
        .select('id, catalogo_id, qtd_min, preco_unitario, capturado_em')
        .eq('catalogo_id', catalogoId!)
        .order('qtd_min', { ascending: true });

      if (error) throw error;
      return (data ?? []) as TerceirizacaoFaixa[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

// Tipos variacoes (Fase 3)
export type TerceirizacaoVariacaoTipo = 'cor' | 'revestimento' | 'opcao' | 'outro';

export interface TerceirizacaoVariacao {
  id: string;
  catalogo_id: string;
  tipo: TerceirizacaoVariacaoTipo;
  valor_id: string;
  rotulo: string;
  modificador_preco: number | null;
  ordem: number;
  capturado_em: string;
}

export function useTerceirizacaoVariacoes(catalogoId: string | null | undefined) {
  return useQuery({
    queryKey: ['terceirizacao_variacoes', catalogoId],
    enabled: !!catalogoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terceirizacao_catalogo_variacoes')
        .select('id, catalogo_id, tipo, valor_id, rotulo, modificador_preco, ordem, capturado_em')
        .eq('catalogo_id', catalogoId!)
        .order('tipo', { ascending: true })
        .order('ordem', { ascending: true })
        .order('rotulo', { ascending: true });

      if (error) throw error;
      return (data ?? []) as TerceirizacaoVariacao[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

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

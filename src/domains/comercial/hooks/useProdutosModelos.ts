import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Produto {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: string;
  descricao: string | null;
  unidade_padrao: string;
  ativo: boolean;
}

export interface ProdutoModelo {
  id: string;
  produto_id: string;
  nome: string;
  largura_cm: number | null;
  altura_cm: number | null;
  area_m2: number | null;
  markup_padrao: number;
  margem_minima: number;
  preco_fixo: number | null;
  tempo_producao_min: number | null;
  ativo: boolean;
  materiais?: ModeloMaterial[];
  processos?: ModeloProcesso[];
}

export interface ModeloMaterial {
  id: string;
  modelo_id: string;
  material_id: string;
  quantidade_por_unidade: number;
  unidade: string | null;
  material?: { nome: string; preco_medio: number | null };
}

export interface ModeloProcesso {
  id: string;
  modelo_id: string;
  etapa: string;
  tempo_por_unidade_min: number;
  ordem: number;
}

export interface Acabamento {
  id: string;
  nome: string;
  descricao: string | null;
  custo_unitario: number;
  unidade: string;
  ordem: number;
}

export interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  custo_hora: number;
  horas_estimadas: number;
  preco_fixo: number | null;
  categoria: string;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useProdutos() {
  return useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useProdutoModelos(produtoId?: string) {
  return useQuery({
    queryKey: ["produto_modelos", produtoId],
    queryFn: async () => {
      let query = supabase
        .from("produto_modelos")
        .select(`
          *,
          materiais:modelo_materiais(
            *,
            material:materiais(nome, preco_medio)
          ),
          processos:modelo_processos(*)
        `)
        .eq("ativo", true)
        .order("nome");

      if (produtoId) {
        query = query.eq("produto_id", produtoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ProdutoModelo[];
    },
    enabled: !!produtoId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAcabamentos() {
  return useQuery({
    queryKey: ["acabamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acabamentos")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Acabamento[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useServicos() {
  return useQuery({
    queryKey: ["servicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Servico[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

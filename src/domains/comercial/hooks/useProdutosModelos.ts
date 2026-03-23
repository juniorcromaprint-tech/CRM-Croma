import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CategoriaProduto {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  icone: string | null;
  ordem_exibicao: number;
  ativo: boolean;
}

export interface Produto {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: string;
  categoria_id: string | null;
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
  tempo_producao_min: number | null;
  ativo: boolean;
  // Campos adicionados em migration 011
  linha_qualidade: 'primeira' | 'segunda' | null;
  descritivo_tecnico: string | null;
  descritivo_nf: string | null;
  garantia_meses: number | null;
  garantia_descricao: string | null;
  unidade_venda: string | null;
  // Campos adicionados em migration 028
  ncm: string | null;
  descricao_fiscal: string | null;
  materiais?: ModeloMaterial[];
  processos?: ModeloProcesso[];
}

export interface ModeloMaterial {
  id: string;
  modelo_id: string;
  material_id: string;
  quantidade_por_unidade: number;
  unidade: string | null;
  material?: { nome: string; preco_medio: number | null; aproveitamento: number | null };
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

export function useCategorias() {
  return useQuery({
    queryKey: ["categorias_produto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_produto")
        .select("*")
        .eq("ativo", true)
        .order("ordem_exibicao");
      if (error) throw error;
      return (data ?? []) as CategoriaProduto[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

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
            material:materiais!modelo_materiais_material_id_fkey(nome, preco_medio, aproveitamento)
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

// ============================================================
// MUTATIONS — Produtos
// ============================================================

export function useCriarProduto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: { nome: string; categoria: string; unidade_padrao?: string; descricao?: string }) => {
      const { data, error } = await supabase.from("produtos").insert(dados).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (_err: Error) => {
      // TanStack Query surfaces this to callers via mutation.error
    },
  });
}

export function useAtualizarProduto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<Produto> }) => {
      const { data, error } = await supabase.from("produtos").update(dados).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
  });
}

// ============================================================
// MUTATIONS — Modelos
// ============================================================

export function useCriarModelo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dados: {
      produto_id: string;
      nome: string;
      largura_cm?: number;
      altura_cm?: number;
      markup_padrao?: number;
      margem_minima?: number;
      tempo_producao_min?: number;
    }) => {
      const { data, error } = await supabase.from("produto_modelos").insert(dados).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { produto_id }) => {
      queryClient.invalidateQueries({ queryKey: ["produto_modelos", produto_id] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
  });
}

export function useAtualizarModelo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<ProdutoModelo> }) => {
      const { data, error } = await supabase.from("produto_modelos").update(dados).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_modelos"] });
    },
  });
}

export function useExcluirModelo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produto_modelos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_modelos"] });
    },
  });
}

// ============================================================
// MUTATIONS — Materiais e Processos do Modelo
// ============================================================

export function useSalvarMaterialModelo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      modeloId,
      materiais,
    }: {
      modeloId: string;
      materiais: Array<{ material_id: string; quantidade_por_unidade: number; unidade?: string }>;
    }) => {
      // Replace-all: delete existing + insert new
      await supabase.from("modelo_materiais").delete().eq("modelo_id", modeloId);
      if (materiais.length > 0) {
        const { error } = await supabase.from("modelo_materiais").insert(
          materiais.map((m) => ({ ...m, modelo_id: modeloId }))
        );
        if (error) throw error;
      }
    },
    onSuccess: (_, { modeloId }) => {
      queryClient.invalidateQueries({ queryKey: ["produto_modelos"] });
    },
  });
}

export function useSalvarProcessosModelo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      modeloId,
      processos,
    }: {
      modeloId: string;
      processos: Array<{ etapa: string; tempo_por_unidade_min: number; ordem: number }>;
    }) => {
      await supabase.from("modelo_processos").delete().eq("modelo_id", modeloId);
      if (processos.length > 0) {
        const { error } = await supabase.from("modelo_processos").insert(
          processos.map((p) => ({ ...p, modelo_id: modeloId }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_modelos"] });
    },
  });
}

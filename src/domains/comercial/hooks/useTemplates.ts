// ============================================================================
// HOOKS DE TEMPLATES DE ORCAMENTO
// CRUD para templates reutilizaveis de orcamento
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TemplateItem {
  descricao: string;
  especificacao: string | null;
  quantidade: number;
  largura_cm: number | null;
  altura_cm: number | null;
  markup_percentual: number;
}

export interface OrcamentoTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  itens: TemplateItem[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateCreateInput {
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  itens: TemplateItem[];
}

const TEMPLATES_KEY = "templates_orcamento";

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Lista todos os templates ativos
 */
export function useTemplates() {
  return useQuery({
    queryKey: [TEMPLATES_KEY],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("templates_orcamento" as any)
          .select("*")
          .eq("ativo", true)
          .order("nome");
        if (error) throw error;
        return (data ?? []) as OrcamentoTemplate[];
      } catch {
        // Tabela pode nao existir (migration 006 pendente)
        return [] as OrcamentoTemplate[];
      }
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

/**
 * Busca template por ID
 */
export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: [TEMPLATES_KEY, id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates_orcamento" as any)
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as OrcamentoTemplate;
    },
    enabled: !!id,
    retry: false,
  });
}

/**
 * Criar template
 */
export function useCriarTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TemplateCreateInput) => {
      const { data, error } = await supabase
        .from("templates_orcamento" as any)
        .insert({
          nome: input.nome,
          descricao: input.descricao ?? null,
          categoria: input.categoria ?? null,
          itens: input.itens,
          ativo: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as OrcamentoTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
      showSuccess("Template criado com sucesso!");
    },
    onError: (err: Error) => showError(err.message || "Erro ao criar template"),
  });
}

/**
 * Atualizar template
 */
export function useAtualizarTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TemplateCreateInput & { ativo: boolean }> }) => {
      const { data, error } = await supabase
        .from("templates_orcamento" as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as OrcamentoTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
      showSuccess("Template atualizado!");
    },
    onError: (err: Error) => showError(err.message || "Erro ao atualizar template"),
  });
}

/**
 * Excluir template (soft delete via ativo=false)
 */
export function useExcluirTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("templates_orcamento" as any)
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
      showSuccess("Template excluido!");
    },
    onError: (err: Error) => showError(err.message || "Erro ao excluir template"),
  });
}

/**
 * Criar template a partir de um orcamento existente
 */
export function useCriarTemplateDeOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orcamentoId,
      nome,
      descricao,
      categoria,
    }: {
      orcamentoId: string;
      nome: string;
      descricao?: string;
      categoria?: string;
    }) => {
      // Buscar itens do orcamento
      const { data: itens, error: itensErr } = await supabase
        .from("proposta_itens")
        .select("descricao, especificacao, quantidade, largura_cm, altura_cm, markup_percentual")
        .eq("proposta_id", orcamentoId)
        .order("ordem");

      if (itensErr) throw itensErr;

      const templateItens: TemplateItem[] = (itens ?? []).map((i) => ({
        descricao: i.descricao,
        especificacao: i.especificacao,
        quantidade: i.quantidade,
        largura_cm: i.largura_cm,
        altura_cm: i.altura_cm,
        markup_percentual: i.markup_percentual,
      }));

      const { data, error } = await supabase
        .from("templates_orcamento" as any)
        .insert({
          nome,
          descricao: descricao ?? null,
          categoria: categoria ?? null,
          itens: templateItens,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as OrcamentoTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
      showSuccess("Template criado a partir do orcamento!");
    },
    onError: (err: Error) => showError(err.message || "Erro ao criar template"),
  });
}

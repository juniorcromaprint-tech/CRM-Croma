import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Checklist {
  id: string;
  nome: string;
  tipo: string;
  descricao: string | null;
  ativo: boolean;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  numero_item: number;
  descricao: string;
  categoria: string; // ferramenta | epi | consumivel | documentacao | seguranca | equipamento
  obrigatorio: boolean;
  observacao_padrao: string | null;
}

export interface ChecklistExecucao {
  id: string;
  checklist_id: string;
  tipo_referencia: string;
  referencia_id: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  iniciado_em: string | null;
  concluido_em: string | null;
  local_verificado: boolean;
  observacoes_gerais: string | null;
}

export interface ChecklistExecucaoItem {
  id: string;
  execucao_id: string;
  item_id: string;
  status: 'conforme' | 'nao_conforme' | 'nao_aplicavel' | 'pendente';
  observacao: string | null;
  foto_url: string | null;
}

// ─── Categoria config ─────────────────────────────────────────────────────────

export const CATEGORIA_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  ferramenta:    { label: "Ferramentas",    color: "bg-blue-50 text-blue-700 border-blue-200",    emoji: "🔧" },
  epi:           { label: "EPIs",           color: "bg-orange-50 text-orange-700 border-orange-200", emoji: "🦺" },
  consumivel:    { label: "Consumíveis",    color: "bg-purple-50 text-purple-700 border-purple-200", emoji: "📦" },
  documentacao:  { label: "Documentação",   color: "bg-slate-50 text-slate-700 border-slate-200",   emoji: "📋" },
  seguranca:     { label: "Segurança",      color: "bg-red-50 text-red-700 border-red-200",          emoji: "⚠️" },
  equipamento:   { label: "Equipamentos",   color: "bg-teal-50 text-teal-700 border-teal-200",       emoji: "⚙️" },
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useChecklists() {
  return useQuery({
    queryKey: ["checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Checklist[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useChecklistItens(checklistId?: string) {
  return useQuery({
    queryKey: ["checklist_itens", checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_itens")
        .select("*")
        .eq("checklist_id", checklistId!)
        .order("numero_item");
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
    enabled: !!checklistId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useChecklistExecucao(referenciaId?: string, checklistId?: string) {
  return useQuery({
    queryKey: ["checklist_execucao", referenciaId, checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_execucoes")
        .select("*")
        .eq("referencia_id", referenciaId!)
        .eq("checklist_id", checklistId!)
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ChecklistExecucao | null;
    },
    enabled: !!referenciaId && !!checklistId,
    staleTime: 0,
  });
}

export function useChecklistExecucaoItens(execucaoId?: string) {
  return useQuery({
    queryKey: ["checklist_execucao_itens", execucaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_execucao_itens")
        .select("*")
        .eq("execucao_id", execucaoId!);
      if (error) throw error;
      return (data ?? []) as ChecklistExecucaoItem[];
    },
    enabled: !!execucaoId,
    staleTime: 0,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useIniciarChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      checklistId,
      referenciaId,
      tipoReferencia = "instalacao",
    }: {
      checklistId: string;
      referenciaId: string;
      tipoReferencia?: string;
    }) => {
      // Criar execução
      const { data: execucao, error: errExec } = await supabase
        .from("checklist_execucoes")
        .insert({
          checklist_id: checklistId,
          referencia_id: referenciaId,
          tipo_referencia: tipoReferencia,
          status: "em_andamento",
          iniciado_em: new Date().toISOString(),
        })
        .select()
        .single();
      if (errExec) throw errExec;

      // Buscar itens do checklist
      const { data: itens, error: errItens } = await supabase
        .from("checklist_itens")
        .select("id")
        .eq("checklist_id", checklistId);
      if (errItens) throw errItens;

      // Criar entradas pendentes para cada item
      if (itens && itens.length > 0) {
        const { error: errExecItens } = await supabase
          .from("checklist_execucao_itens")
          .insert(
            itens.map((item) => ({
              execucao_id: execucao.id,
              item_id: item.id,
              status: "pendente",
            }))
          );
        if (errExecItens) throw errExecItens;
      }

      return execucao as ChecklistExecucao;
    },
    onSuccess: (execucao) => {
      queryClient.invalidateQueries({ queryKey: ["checklist_execucao", execucao.referencia_id] });
      queryClient.invalidateQueries({ queryKey: ["checklist_execucao_itens", execucao.id] });
    },
  });
}

export function useMarcarItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      execucaoId,
      itemId,
      status,
      observacao,
    }: {
      execucaoId: string;
      itemId: string;
      status: ChecklistExecucaoItem["status"];
      observacao?: string;
    }) => {
      const { error } = await supabase
        .from("checklist_execucao_itens")
        .update({ status, observacao: observacao ?? null })
        .eq("execucao_id", execucaoId)
        .eq("item_id", itemId);
      if (error) throw error;
    },
    onSuccess: (_, { execucaoId }) => {
      queryClient.invalidateQueries({ queryKey: ["checklist_execucao_itens", execucaoId] });
    },
  });
}

export function useConcluirChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      execucaoId,
      referenciaId,
      checklistId,
      observacoesGerais,
    }: {
      execucaoId: string;
      referenciaId: string;
      checklistId: string;
      observacoesGerais?: string;
    }) => {
      const { error } = await supabase
        .from("checklist_execucoes")
        .update({
          status: "concluido",
          concluido_em: new Date().toISOString(),
          observacoes_gerais: observacoesGerais ?? null,
        })
        .eq("id", execucaoId);
      if (error) throw error;
    },
    onSuccess: (_, { referenciaId, checklistId, execucaoId }) => {
      queryClient.invalidateQueries({ queryKey: ["checklist_execucao", referenciaId, checklistId] });
      queryClient.invalidateQueries({ queryKey: ["checklist_execucao_itens", execucaoId] });
    },
  });
}

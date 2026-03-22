// ============================================================================
// HOOK: useUsinagemTempos — CRUD para tabela usinagem_tempos
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

const db = supabase as unknown as any;

// ----------------------------------------------------------------------------
// TIPOS
// ----------------------------------------------------------------------------

export type TipoOperacao = "corte" | "vinco" | "rebaixo" | "gravacao";

export interface UsinagemTempo {
  id: string;
  maquina_id: string;
  material_id: string | null;
  tipo_operacao: TipoOperacao;
  tempo_metro_linear_min: number;
  custo_hora_operacao: number;
  created_at: string;
  // Join data
  material_nome?: string | null;
  maquina_nome?: string | null;
}

export interface UsinagemTempoInsert {
  maquina_id: string;
  material_id: string | null;
  tipo_operacao: TipoOperacao;
  tempo_metro_linear_min: number;
  custo_hora_operacao: number;
}

// ----------------------------------------------------------------------------
// QUERY KEY
// ----------------------------------------------------------------------------

export const USINAGEM_QUERY_KEY = (maquinaId?: string) =>
  maquinaId ? ["usinagem_tempos", maquinaId] : ["usinagem_tempos"];

// ----------------------------------------------------------------------------
// FETCH
// ----------------------------------------------------------------------------

export function useUsinagemTempos(maquinaId: string) {
  return useQuery<UsinagemTempo[]>({
    queryKey: USINAGEM_QUERY_KEY(maquinaId),
    queryFn: async () => {
      const { data, error } = await db
        .from("usinagem_tempos")
        .select(
          `
          id,
          maquina_id,
          material_id,
          tipo_operacao,
          tempo_metro_linear_min,
          custo_hora_operacao,
          created_at,
          materiais!usinagem_tempos_material_id_fkey(nome)
          `
        )
        .eq("maquina_id", maquinaId)
        .order("tipo_operacao");

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        material_nome: row.materiais?.nome ?? null,
      })) as UsinagemTempo[];
    },
    enabled: !!maquinaId,
  });
}

// ----------------------------------------------------------------------------
// INSERT
// ----------------------------------------------------------------------------

export function useInsertUsinagemTempo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (values: UsinagemTempoInsert) => {
      const { error } = await db.from("usinagem_tempos").insert(values);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: USINAGEM_QUERY_KEY(vars.maquina_id) });
      showSuccess("Tempo de usinagem adicionado!");
    },
    onError: () => showError("Erro ao adicionar tempo de usinagem."),
  });
}

// ----------------------------------------------------------------------------
// UPDATE
// ----------------------------------------------------------------------------

export function useUpdateUsinagemTempo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      maquina_id,
      ...values
    }: UsinagemTempoInsert & { id: string }) => {
      const { error } = await db
        .from("usinagem_tempos")
        .update(values)
        .eq("id", id);
      if (error) throw error;
      return maquina_id;
    },
    onSuccess: (maquinaId) => {
      qc.invalidateQueries({ queryKey: USINAGEM_QUERY_KEY(maquinaId) });
      showSuccess("Tempo de usinagem atualizado!");
    },
    onError: () => showError("Erro ao atualizar tempo de usinagem."),
  });
}

// ----------------------------------------------------------------------------
// DELETE
// ----------------------------------------------------------------------------

export function useDeleteUsinagemTempo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, maquina_id }: { id: string; maquina_id: string }) => {
      const { error } = await db.from("usinagem_tempos").delete().eq("id", id);
      if (error) throw error;
      return maquina_id;
    },
    onSuccess: (maquinaId) => {
      qc.invalidateQueries({ queryKey: USINAGEM_QUERY_KEY(maquinaId) });
      showSuccess("Registro removido.");
    },
    onError: () => showError("Erro ao remover registro."),
  });
}

// ----------------------------------------------------------------------------
// LOOKUP — buscar tempo de usinagem por material + operação (para o motor)
// ----------------------------------------------------------------------------

export async function fetchUsinagemTempo(
  materialId: string,
  tipoOperacao: TipoOperacao
): Promise<UsinagemTempo | null> {
  const { data, error } = await db
    .from("usinagem_tempos")
    .select("*")
    .eq("material_id", materialId)
    .eq("tipo_operacao", tipoOperacao)
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data as UsinagemTempo | null;
}

import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function responsavelApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { responsavel_id: string | null } | null;
  const suggested = action.valor_sugerido as { ordem_id: string; responsavel_id: string };

  const { error } = await ctx.supabase
    .from('ordens_producao')
    .update({ responsavel_id: suggested.responsavel_id })
    .eq('id', suggested.ordem_id)
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao atribuir responsável: ${error.message}` };

  return {
    success: true,
    message: `Responsável atribuído com sucesso`,
    rollback: async () => {
      if (previous) {
        await ctx.supabase
          .from('ordens_producao')
          .update({ responsavel_id: previous.responsavel_id ?? null })
          .eq('id', suggested.ordem_id);
      }
    },
  };
}

import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function modeloApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as { item_id: string; modelo_id: string; nome: string };
  const previous = action.valor_atual as { item_id: string; modelo_id: string | null } | null;

  const { error } = await ctx.supabase
    .from('proposta_itens')
    .update({ modelo_id: suggested.modelo_id })
    .eq('id', suggested.item_id)
    .eq('proposta_id', ctx.entityId)
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao definir modelo: ${error.message}` };

  return {
    success: true,
    message: `Modelo "${suggested.nome}" definido`,
    rollback: async () => {
      if (previous?.item_id) {
        await ctx.supabase
          .from('proposta_itens')
          .update({ modelo_id: previous.modelo_id ?? null })
          .eq('id', previous.item_id);
      }
    },
  };
}

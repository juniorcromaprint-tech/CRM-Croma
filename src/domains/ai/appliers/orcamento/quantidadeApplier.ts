import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function quantidadeApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { item_id: string; quantidade: number };
  const suggested = action.valor_sugerido as { item_id: string; quantidade: number };

  const { error } = await ctx.supabase
    .from('proposta_itens')
    .update({ quantidade: suggested.quantidade })
    .eq('id', suggested.item_id)
    .eq('proposta_id', ctx.entityId);

  if (error) return { success: false, message: `Erro ao ajustar quantidade: ${error.message}` };

  return {
    success: true,
    message: `Quantidade ajustada de ${previous?.quantidade ?? '?'} para ${suggested.quantidade}`,
    rollback: async () => {
      if (previous?.quantidade != null) {
        await ctx.supabase
          .from('proposta_itens')
          .update({ quantidade: previous.quantidade })
          .eq('id', suggested.item_id);
      }
    },
  };
}

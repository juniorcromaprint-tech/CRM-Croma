import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function precoApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as { item_id: string; preco: number };
  const previous = action.valor_atual as { item_id: string; preco: number };

  if (!suggested?.item_id || !suggested?.preco) {
    return { success: false, message: 'Dados insuficientes: item_id e preco obrigatórios' };
  }

  const { error } = await ctx.supabase
    .from('proposta_itens')
    .update({ preco_unitario: suggested.preco })
    .eq('id', suggested.item_id)
    .eq('proposta_id', ctx.entityId)
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao atualizar preço: ${error.message}` };

  return {
    success: true,
    message: `Preço atualizado de R$ ${previous?.preco?.toFixed(2) ?? '?'} para R$ ${suggested.preco.toFixed(2)}`,
    rollback: async () => {
      if (previous?.preco) {
        await ctx.supabase
          .from('proposta_itens')
          .update({ preco_unitario: previous.preco })
          .eq('id', suggested.item_id);
      }
    },
  };
}

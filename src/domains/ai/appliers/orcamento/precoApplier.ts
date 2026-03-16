import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function precoApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as { item_id: string; preco: number };
  const previous = action.valor_atual as { item_id: string; preco: number };

  if (!suggested?.item_id || suggested.preco == null) {
    return { success: false, message: 'Dados insuficientes: item_id e preco obrigatorios' };
  }

  // Fetch current item quantity for total calculation
  const { data: itemData } = await ctx.supabase
    .from('proposta_itens')
    .select('quantidade')
    .eq('id', suggested.item_id)
    .single();

  const quantidade = itemData?.quantidade ?? 1;

  // Update price + valor_total + override flag together
  const { error, count } = await ctx.supabase
    .from('proposta_itens')
    .update(
      {
        valor_unitario: suggested.preco,
        valor_total: suggested.preco * quantidade,
        preco_override: true,
      },
      { count: 'exact' },
    )
    .eq('id', suggested.item_id)
    .eq('proposta_id', ctx.entityId);

  if (error) return { success: false, message: `Erro ao atualizar preco: ${error.message}` };
  if (count === 0) return { success: false, message: `Item ${suggested.item_id} nao encontrado nesta proposta` };

  return {
    success: true,
    message: `Preco atualizado de R$ ${previous?.preco?.toFixed(2) ?? '?'} para R$ ${suggested.preco.toFixed(2)} (override IA)`,
    rollback: async () => {
      if (previous?.preco) {
        await ctx.supabase
          .from('proposta_itens')
          .update({ valor_unitario: previous.preco, valor_total: previous.preco * quantidade, preco_override: false })
          .eq('id', suggested.item_id)
          .eq('proposta_id', ctx.entityId);
      }
    },
  };
}

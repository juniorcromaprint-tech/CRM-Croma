import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function pendenciaApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { status: string } | null;
  const suggested = action.valor_sugerido as { pedido_item_id: string; status: string };

  const { error } = await ctx.supabase
    .from('pedido_itens')
    .update({ status_producao: suggested.status })
    .eq('id', suggested.pedido_item_id)
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao marcar pendência: ${error.message}` };

  return {
    success: true,
    message: `Pendência marcada como "${suggested.status}"`,
    rollback: async () => {
      if (previous?.status) {
        await ctx.supabase
          .from('pedido_itens')
          .update({ status_producao: previous.status })
          .eq('id', suggested.pedido_item_id);
      }
    },
  };
}

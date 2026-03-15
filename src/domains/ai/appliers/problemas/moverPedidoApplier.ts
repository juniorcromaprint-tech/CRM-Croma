import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function moverPedidoApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { status: string } | null;
  const suggested = action.valor_sugerido as { pedido_id?: string; novo_status: string };

  const id = suggested.pedido_id ?? ctx.entityId;

  const { error } = await ctx.supabase
    .from('pedidos')
    .update({ status: suggested.novo_status })
    .eq('id', id)
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao mover pedido: ${error.message}` };

  return {
    success: true,
    message: `Pedido movido para "${suggested.novo_status}"`,
    rollback: async () => {
      if (previous?.status) {
        await ctx.supabase
          .from('pedidos')
          .update({ status: previous.status })
          .eq('id', id);
      }
    },
  };
}

import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function revalidarApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { validade: string } | null;
  const suggested = action.valor_sugerido as { proposta_id?: string; nova_validade: string };

  const id = suggested.proposta_id ?? ctx.entityId;

  const { error } = await ctx.supabase
    .from('propostas')
    .update({ validade: suggested.nova_validade, status: 'em_analise' })
    .eq('id', id)
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao revalidar orçamento: ${error.message}` };

  return {
    success: true,
    message: `Orçamento revalidado até ${suggested.nova_validade}`,
    rollback: async () => {
      if (previous?.validade) {
        await ctx.supabase
          .from('propostas')
          .update({ validade: previous.validade })
          .eq('id', id);
      }
    },
  };
}

import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function servicoApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as { servico_id?: string; nome: string; valor: number };

  const { data, error } = await ctx.supabase
    .from('proposta_servicos')
    .insert({
      proposta_id: ctx.entityId,
      servico_id: suggested.servico_id ?? null,
      nome_servico: suggested.nome,
      preco: suggested.valor,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao adicionar serviço: ${error.message}` };

  return {
    success: true,
    message: `Serviço "${suggested.nome}" adicionado (R$ ${suggested.valor.toFixed(2)})`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('proposta_servicos').delete().eq('id', data.id);
    },
  };
}

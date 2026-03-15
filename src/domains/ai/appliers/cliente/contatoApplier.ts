import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function contatoApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as { motivo: string; data_sugerida?: string };

  const { data, error } = await ctx.supabase
    .from('tarefas_comerciais')
    .insert({
      titulo: `Contato: ${suggested.motivo}`,
      descricao: suggested.motivo,
      responsavel_id: ctx.userId,
      data_limite: suggested.data_sugerida ?? null,
      status: 'pendente',
      tipo: 'contato',
      entidade_tipo: ctx.entityType,
      entidade_id: ctx.entityId,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao agendar contato: ${error.message}` };

  return {
    success: true,
    message: `Contato "${suggested.motivo}" agendado`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('tarefas_comerciais').delete().eq('id', data.id);
    },
  };
}

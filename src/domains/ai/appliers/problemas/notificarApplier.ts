import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function notificarApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as { mensagem: string; responsavel_id?: string };

  // Insert as a notification record (tarefas_comerciais as notification)
  const { data, error } = await ctx.supabase
    .from('tarefas_comerciais')
    .insert({
      titulo: `Notificação: ${suggested.mensagem.slice(0, 50)}`,
      descricao: suggested.mensagem,
      responsavel_id: suggested.responsavel_id ?? ctx.userId,
      status: 'pendente',
      tipo: 'notificacao',
      entidade_tipo: ctx.entityType,
      entidade_id: ctx.entityId,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao notificar: ${error.message}` };

  return {
    success: true,
    message: `Responsável notificado`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('tarefas_comerciais').delete().eq('id', data.id);
    },
  };
}

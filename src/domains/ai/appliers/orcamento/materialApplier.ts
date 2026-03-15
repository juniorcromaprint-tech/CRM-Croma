import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function materialApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { material_id: string; item_id: string } | null;
  const suggested = action.valor_sugerido as { material_id: string; nome: string; preco: number };

  if (!suggested?.material_id) {
    return { success: false, message: 'Material sugerido não tem ID válido' };
  }

  if (previous?.material_id && previous?.item_id) {
    const { error } = await ctx.supabase
      .from('proposta_item_materiais')
      .update({
        material_id: suggested.material_id,
        nome_material: suggested.nome,
        preco_unitario: suggested.preco,
      })
      .eq('material_id', previous.material_id)
      .eq('proposta_item_id', previous.item_id)
      .select()
      .single();

    if (error) return { success: false, message: `Erro ao trocar material: ${error.message}` };

    return {
      success: true,
      message: `Material trocado para "${suggested.nome}"`,
      rollback: async () => {
        await ctx.supabase
          .from('proposta_item_materiais')
          .update({ material_id: previous.material_id })
          .eq('material_id', suggested.material_id)
          .eq('proposta_item_id', previous.item_id);
      },
    };
  }

  const { data, error } = await ctx.supabase
    .from('proposta_item_materiais')
    .insert({
      proposta_item_id: (suggested as any).item_id,
      material_id: suggested.material_id,
      nome_material: suggested.nome,
      preco_unitario: suggested.preco,
      quantidade: 1,
      preco_total: suggested.preco,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao adicionar material: ${error.message}` };

  return {
    success: true,
    message: `Material "${suggested.nome}" adicionado`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('proposta_item_materiais').delete().eq('id', data.id);
    },
  };
}

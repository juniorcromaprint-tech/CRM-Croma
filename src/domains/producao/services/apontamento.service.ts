import { supabase } from '@/integrations/supabase/client';
import type { Apontamento } from '../types/pcp.types';

export async function iniciarEtapa(
  etapaId: string,
  opId: string,
  tipo: Apontamento['tipo'] = 'producao'
): Promise<Apontamento> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // Atualizar etapa para em_andamento
  await supabase
    .from('producao_etapas')
    .update({ status: 'em_andamento', inicio: new Date().toISOString() })
    .eq('id', etapaId);

  // Atualizar OP para em_producao se estava em_fila
  await supabase
    .from('ordens_producao')
    .update({ status: 'em_producao' })
    .eq('id', opId)
    .eq('status', 'em_fila');

  // Criar apontamento
  const { data, error } = await supabase
    .from('producao_apontamentos')
    .insert({
      producao_etapa_id: etapaId,
      ordem_producao_id: opId,
      operador_id: user.id,
      inicio: new Date().toISOString(),
      tipo,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Apontamento;
}

export async function pausarEtapa(apontamentoId: string): Promise<void> {
  const { error } = await supabase
    .from('producao_apontamentos')
    .update({ fim: new Date().toISOString() })
    .eq('id', apontamentoId)
    .is('fim', null);
  if (error) throw new Error(error.message);
}

export async function concluirEtapa(
  etapaId: string,
  apontamentoId: string | null,
  observacoes?: string
): Promise<void> {
  // Fechar apontamento aberto
  if (apontamentoId) {
    await supabase
      .from('producao_apontamentos')
      .update({ fim: new Date().toISOString() })
      .eq('id', apontamentoId)
      .is('fim', null);
  }

  // Marcar etapa como concluída (trigger avança OP automaticamente)
  const { error } = await supabase
    .from('producao_etapas')
    .update({
      status: 'concluida',
      fim: new Date().toISOString(),
      observacoes: observacoes ?? null,
    })
    .eq('id', etapaId);

  if (error) throw new Error(error.message);
}

export async function listarApontamentosPorOp(opId: string): Promise<Apontamento[]> {
  const { data, error } = await supabase
    .from('producao_apontamentos')
    .select('*')
    .eq('ordem_producao_id', opId)
    .order('inicio', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Apontamento[];
}

export async function apontamentoAberto(etapaId: string): Promise<Apontamento | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('producao_apontamentos')
    .select('*')
    .eq('producao_etapa_id', etapaId)
    .eq('operador_id', user.id)
    .is('fim', null)
    .maybeSingle();

  return data as Apontamento | null;
}

import { supabase } from '@/integrations/supabase/client';

// ============================================================
// TYPES
// ============================================================

export type CampoInstalacao = {
  job_id: string;
  os_number: string;
  tipo_servico: string;
  status_campo: string;
  data_agendada: string;
  started_at: string | null;
  finished_at: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  issues: string | null;
  signature_url: string | null;
  store_id: string | null;
  loja_nome: string | null;
  loja_marca: string | null;
  loja_endereco: string | null;
  loja_estado: string | null;
  cliente_id: string | null;
  cliente_unidade_id: string | null;
  tecnico_id: string | null;
  tecnico_nome: string | null;
  tecnico_role: string | null;
  fotos_antes: number;
  fotos_depois: number;
  total_videos: number;
  duracao_minutos: number | null;
  ordem_instalacao_id: string | null;
  pedido_id: string | null;
  pedido_item_id: string | null;
  assigned_to: string | null;
  created_at: string;
};

export type CampoFoto = {
  id: string;
  job_id: string;
  photo_type: string;
  photo_url: string;
  description: string | null;
  note: string | null;
  created_at: string;
  os_number: string | null;
  ordem_instalacao_id: string | null;
  pedido_id: string | null;
  loja_nome: string | null;
  loja_marca: string | null;
};

export type PedidoItemResumo = {
  id: string;
  descricao: string | null;
  especificacao: string | null;
  instrucoes: string | null;
  largura_cm: number | null;
  altura_cm: number | null;
  area_m2: number | null;
  quantidade: number;
  valor_unitario: number | null;
  valor_total: number | null;
};

export type FiltrosCampo = {
  status?: string;
  dataInicio?: string;
  dataFim?: string;
  tecnicoId?: string;
};

// ============================================================
// SERVICE
// ============================================================

export const instalacaoService = {
  /**
   * Lista todas as OS agendadas para hoje.
   */
  async listarHoje(): Promise<CampoInstalacao[]> {
    const hoje = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('vw_campo_instalacoes' as any)
      .select('*')
      .eq('data_agendada', hoje)
      .order('data_agendada', { ascending: true });

    if (error) throw error;
    return (data || []) as unknown as CampoInstalacao[];
  },

  /**
   * Lista todas as OS de um pedido específico do CRM.
   */
  async listarPorPedido(pedidoId: string): Promise<CampoInstalacao[]> {
    const { data, error } = await supabase
      .from('vw_campo_instalacoes' as any)
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('data_agendada', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as CampoInstalacao[];
  },

  /**
   * Lista as fotos de um job específico.
   */
  async buscarFotosPorJob(jobId: string): Promise<CampoFoto[]> {
    const { data, error } = await supabase
      .from('vw_campo_fotos' as any)
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as unknown as CampoFoto[];
  },

  /**
   * Lista todas as OS com filtros opcionais.
   */
  async listarTodos(filtros?: FiltrosCampo): Promise<CampoInstalacao[]> {
    let query = (supabase
      .from('vw_campo_instalacoes' as any)
      .select('*') as any)
      .order('data_agendada', { ascending: false });

    if (filtros?.status) {
      query = query.eq('status_campo', filtros.status);
    }
    if (filtros?.dataInicio) {
      query = query.gte('data_agendada', filtros.dataInicio);
    }
    if (filtros?.dataFim) {
      query = query.lte('data_agendada', filtros.dataFim);
    }
    if (filtros?.tecnicoId) {
      query = query.eq('assigned_to', filtros.tecnicoId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as CampoInstalacao[];
  },

  /**
   * Busca os itens do pedido vinculado a um job (para seção "Arte a instalar").
   */
  async buscarItensPedido(pedidoId: string): Promise<PedidoItemResumo[]> {
    const { data, error } = await supabase
      .from('pedido_itens')
      .select('id, descricao, especificacao, instrucoes, largura_cm, altura_cm, area_m2, quantidade, valor_unitario, valor_total')
      .eq('pedido_id', pedidoId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as PedidoItemResumo[];
  },

  /**
   * Busca fotos de layout/referência de um job (photo_type = 'layout').
   */
  async buscarFotosLayout(jobId: string): Promise<CampoFoto[]> {
    const { data, error } = await supabase
      .from('job_photos')
      .select('id, job_id, photo_type, photo_url, description, note, created_at')
      .eq('job_id', jobId)
      .eq('photo_type', 'layout')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((f: any) => ({
      ...f,
      os_number: null,
      ordem_instalacao_id: null,
      pedido_id: null,
      loja_nome: null,
      loja_marca: null,
    })) as CampoFoto[];
  },

  /**
   * Busca os sumários de instalações por status para os cards de KPI.
   */
  async resumoHoje(): Promise<{
    total: number;
    pendentes: number;
    emAndamento: number;
    concluidas: number;
  }> {
    const lista = await instalacaoService.listarHoje();
    return {
      total: lista.length,
      pendentes: lista.filter((j) => j.status_campo === 'Pendente').length,
      emAndamento: lista.filter((j) => j.status_campo === 'Em Andamento').length,
      concluidas: lista.filter((j) => j.status_campo === 'Concluído').length,
    };
  },
};

// src/domains/qualidade/services/qualidadeService.ts

import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const qualidadeService = {
  // === OCORRÊNCIAS ===
  async listarOcorrencias(filtros?: { status?: string; prioridade?: string; tipo?: string }) {
    let q = db
      .from("ocorrencias")
      .select("id, descricao, tipo, prioridade, status, created_at, resolved_at, responsavel:profiles(first_name, last_name)")
      .order("created_at", { ascending: false });
    if (filtros?.status) q = q.eq("status", filtros.status);
    if (filtros?.prioridade) q = q.eq("prioridade", filtros.prioridade);
    if (filtros?.tipo) q = q.eq("tipo", filtros.tipo);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async buscarOcorrencia(id: string) {
    const { data, error } = await db
      .from("ocorrencias")
      .select("*, tratativas:ocorrencia_tratativas(*), responsavel:profiles(first_name, last_name)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async criarOcorrencia(dados: Record<string, any>) {
    const { data, error } = await db
      .from("ocorrencias")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarOcorrencia(id: string, dados: Record<string, any>) {
    const { data, error } = await db
      .from("ocorrencias")
      .update(dados)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // === TRATATIVAS ===
  async adicionarTratativa(dados: { ocorrencia_id: string; acao_corretiva: string; prazo?: string; data_conclusao?: string; observacoes?: string; responsavel_id?: string }) {
    const { data, error } = await db
      .from("ocorrencia_tratativas")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // === KPIs ===
  async buscarKPIs(): Promise<any> {
    const { data: todas, error } = await db
      .from("ocorrencias")
      .select("id, tipo, prioridade, status, created_at, resolved_at");
    if (error) throw error;

    const items = todas ?? [];
    const abertas = items.filter((o: any) => !['resolvida', 'encerrada'].includes(o.status));
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();
    const resolvidasMes = items.filter((o: any) => {
      if (!o.resolved_at) return false;
      const d = new Date(o.resolved_at);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    // MTTR (horas)
    const comResolucao = items.filter((o: any) => o.resolved_at);
    const mttr = comResolucao.length > 0
      ? comResolucao.reduce((acc: number, o: any) => {
          const diff = new Date(o.resolved_at).getTime() - new Date(o.created_at).getTime();
          return acc + diff / (1000 * 60 * 60);
        }, 0) / comResolucao.length
      : 0;

    // Agrupar por tipo e prioridade
    const porTipo = Object.entries(
      items.reduce((acc: any, o: any) => { acc[o.tipo] = (acc[o.tipo] || 0) + 1; return acc; }, {})
    ).map(([tipo, count]) => ({ tipo, count }));

    const porPrioridade = Object.entries(
      items.reduce((acc: any, o: any) => { acc[o.prioridade] = (acc[o.prioridade] || 0) + 1; return acc; }, {})
    ).map(([prioridade, count]) => ({ prioridade, count }));

    return {
      total_ocorrencias: items.length,
      abertas: abertas.length,
      resolvidas_mes: resolvidasMes.length,
      mttr_horas: Math.round(mttr * 10) / 10,
      por_tipo: porTipo,
      por_prioridade: porPrioridade,
    };
  },
};

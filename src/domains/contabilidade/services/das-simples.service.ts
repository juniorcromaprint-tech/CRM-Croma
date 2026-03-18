// src/domains/contabilidade/services/das-simples.service.ts

import { supabase } from '@/integrations/supabase/client';
import {
  ANEXO_III,
  ANEXO_V,
  FATOR_R_THRESHOLD,
  type DASApuracao,
  type FaixaSimples,
} from '../types/contabilidade.types';

function findFaixa(rbt12: number, tabela: FaixaSimples[]): FaixaSimples {
  for (const f of tabela) {
    if (rbt12 <= f.limiteSuperior) return f;
  }
  return tabela[tabela.length - 1];
}

function calcAliquotaEfetiva(rbt12: number, aliquotaNominal: number, deducao: number): number {
  if (rbt12 === 0) return 0;
  return (rbt12 * aliquotaNominal - deducao) / rbt12;
}

export interface DASCalculo {
  competencia: string;
  receita_bruta_mes: number;
  rbt12: number;
  folha_pagamento_12m: number;
  fator_r: number;
  anexo: 'III' | 'V';
  faixa: number;
  aliquota_nominal: number;
  deducao: number;
  aliquota_efetiva: number;
  valor_das: number;
  data_vencimento: string;
}

export async function calcularDAS(competenciaDate: string): Promise<DASCalculo> {
  // 1. Buscar config tributária
  const { data: config } = await supabase
    .from('config_tributaria')
    .select('*')
    .limit(1)
    .single();

  const proLaboreMensal = config?.pro_labore_mensal || 0;

  // 2. Buscar receita bruta do mês (CR pagos no mês de competência)
  const mesInicio = competenciaDate; // ex: '2026-03-01'
  const mesFim = new Date(new Date(competenciaDate).getFullYear(), new Date(competenciaDate).getMonth() + 1, 0)
    .toISOString().split('T')[0]; // último dia do mês

  const { data: crMes } = await supabase
    .from('contas_receber')
    .select('valor_pago')
    .eq('status', 'pago')
    .gte('data_pagamento', mesInicio)
    .lte('data_pagamento', mesFim)
    .is('excluido_em', null);

  const receitaBrutaMes = (crMes || []).reduce((sum, cr) => sum + (cr.valor_pago || 0), 0);

  // 3. Calcular RBT12 (últimos 12 meses incluindo o atual)
  const inicio12m = new Date(new Date(competenciaDate).getFullYear() - 1, new Date(competenciaDate).getMonth() + 1, 1)
    .toISOString().split('T')[0];

  const { data: cr12m } = await supabase
    .from('contas_receber')
    .select('valor_pago')
    .eq('status', 'pago')
    .gte('data_pagamento', inicio12m)
    .lte('data_pagamento', mesFim)
    .is('excluido_em', null);

  const rbt12 = (cr12m || []).reduce((sum, cr) => sum + (cr.valor_pago || 0), 0);

  // 4. Calcular folha 12m (pró-labore × meses)
  const folhaPagamento12m = proLaboreMensal * 12;

  // 5. Fator R
  const fatorR = rbt12 > 0 ? folhaPagamento12m / rbt12 : 0;

  // 6. Determinar anexo
  const anexo: 'III' | 'V' = fatorR >= FATOR_R_THRESHOLD ? 'III' : 'V';
  const tabela = anexo === 'III' ? ANEXO_III : ANEXO_V;

  // 7. Determinar faixa
  const faixa = findFaixa(rbt12, tabela);

  // 8. Calcular alíquota efetiva
  const aliquotaEfetiva = calcAliquotaEfetiva(rbt12, faixa.aliquota, faixa.deducao);

  // 9. Calcular DAS
  const valorDas = receitaBrutaMes * aliquotaEfetiva;

  // 10. Data vencimento (dia 20 do mês seguinte)
  const compDate = new Date(competenciaDate);
  const vencimento = new Date(compDate.getFullYear(), compDate.getMonth() + 1, 20)
    .toISOString().split('T')[0];

  return {
    competencia: competenciaDate,
    receita_bruta_mes: receitaBrutaMes,
    rbt12,
    folha_pagamento_12m: folhaPagamento12m,
    fator_r: fatorR,
    anexo,
    faixa: faixa.faixa,
    aliquota_nominal: faixa.aliquota,
    deducao: faixa.deducao,
    aliquota_efetiva: aliquotaEfetiva,
    valor_das: Math.round(valorDas * 100) / 100,
    data_vencimento: vencimento,
  };
}

export async function salvarDAS(calculo: DASCalculo): Promise<DASApuracao> {
  const { data, error } = await supabase
    .from('das_apuracoes')
    .upsert({
      competencia: calculo.competencia,
      receita_bruta_mes: calculo.receita_bruta_mes,
      rbt12: calculo.rbt12,
      folha_pagamento_12m: calculo.folha_pagamento_12m,
      fator_r: calculo.fator_r,
      anexo: calculo.anexo,
      faixa: calculo.faixa,
      aliquota_nominal: calculo.aliquota_nominal,
      deducao: calculo.deducao,
      aliquota_efetiva: calculo.aliquota_efetiva,
      valor_das: calculo.valor_das,
      data_vencimento: calculo.data_vencimento,
      status: 'calculado',
    }, { onConflict: 'competencia' })
    .select()
    .single();

  if (error) throw error;
  return data as DASApuracao;
}

export async function fetchDASHistorico(ano?: number) {
  let query = supabase
    .from('das_apuracoes')
    .select('*')
    .order('competencia', { ascending: false });

  if (ano) {
    query = query
      .gte('competencia', `${ano}-01-01`)
      .lte('competencia', `${ano}-12-31`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as DASApuracao[];
}

export async function marcarDASPago(id: string, dataPagamento: string) {
  const { error } = await supabase
    .from('das_apuracoes')
    .update({ status: 'pago', data_pagamento: dataPagamento })
    .eq('id', id);

  if (error) throw error;
}

// Alertas tributários
export interface AlertaTributario {
  tipo: 'faixa' | 'fator_r' | 'limite_simples' | 'economia';
  severidade: 'info' | 'warning' | 'danger';
  titulo: string;
  descricao: string;
}

export function gerarAlertas(calculo: DASCalculo, configProLabore: number): AlertaTributario[] {
  const alertas: AlertaTributario[] = [];

  // Alerta: Fator R próximo de 28%
  if (calculo.fator_r >= 0.24 && calculo.fator_r < FATOR_R_THRESHOLD) {
    const faltaPercent = (FATOR_R_THRESHOLD - calculo.fator_r) * 100;
    alertas.push({
      tipo: 'fator_r',
      severidade: 'warning',
      titulo: `Fator R em ${(calculo.fator_r * 100).toFixed(1)}% — faltam ${faltaPercent.toFixed(1)}% para Anexo III`,
      descricao: `Se aumentar o pró-labore, o Fator R pode atingir 28% e migrar para o Anexo III com alíquota menor.`,
    });
  }

  // Alerta: já no Anexo III
  if (calculo.anexo === 'III') {
    alertas.push({
      tipo: 'economia',
      severidade: 'info',
      titulo: 'Enquadrado no Anexo III — alíquota mais favorável',
      descricao: `Fator R em ${(calculo.fator_r * 100).toFixed(1)}%. Manter pró-labore acima de 28% do faturamento.`,
    });
  }

  // Alerta: simulação de economia
  if (calculo.anexo === 'V' && calculo.rbt12 > 0) {
    const proLaboreNecessario = calculo.rbt12 * FATOR_R_THRESHOLD / 12;
    const diferencaMensal = proLaboreNecessario - configProLabore;
    if (diferencaMensal > 0 && diferencaMensal < 5000) {
      // Calcular economia
      const faixaIII = findFaixa(calculo.rbt12, ANEXO_III);
      const aliqEfIII = calcAliquotaEfetiva(calculo.rbt12, faixaIII.aliquota, faixaIII.deducao);
      const economiaAnual = (calculo.aliquota_efetiva - aliqEfIII) * calculo.rbt12;
      if (economiaAnual > 0) {
        alertas.push({
          tipo: 'economia',
          severidade: 'info',
          titulo: `Economia potencial: R$ ${economiaAnual.toFixed(0)}/ano`,
          descricao: `Se pró-labore subir R$ ${diferencaMensal.toFixed(0)}/mês (para R$ ${proLaboreNecessario.toFixed(0)}), migra pro Anexo III. Economia de R$ ${(economiaAnual / 12).toFixed(0)}/mês em impostos.`,
        });
      }
    }
  }

  // Alerta: mudança de faixa iminente
  const tabelaAtual = calculo.anexo === 'III' ? ANEXO_III : ANEXO_V;
  const faixaAtual = findFaixa(calculo.rbt12, tabelaAtual);
  const margemFaixa = faixaAtual.limiteSuperior - calculo.rbt12;
  if (margemFaixa < 20000 && margemFaixa > 0 && faixaAtual.faixa < 6) {
    alertas.push({
      tipo: 'faixa',
      severidade: 'warning',
      titulo: `Próximo de mudar para faixa ${faixaAtual.faixa + 1}`,
      descricao: `RBT12 está a R$ ${margemFaixa.toFixed(0)} do limite da faixa ${faixaAtual.faixa}. Alíquota pode subir.`,
    });
  }

  // Alerta: limite do Simples
  if (calculo.rbt12 > 4200000) {
    alertas.push({
      tipo: 'limite_simples',
      severidade: 'danger',
      titulo: 'Atenção: próximo do limite do Simples Nacional',
      descricao: `RBT12 de R$ ${calculo.rbt12.toFixed(0)} — limite é R$ 4.800.000. Considerar planejamento tributário.`,
    });
  }

  return alertas;
}

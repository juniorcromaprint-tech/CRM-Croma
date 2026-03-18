// src/domains/contabilidade/services/classificacao.service.ts

import { supabase } from '@/integrations/supabase/client';
import type { ExtratoItem, RegraClassificacao } from '../types/contabilidade.types';

interface ClassificacaoResult {
  itemId: string;
  contaPlanoId: string | null;
  centroCustoId: string | null;
  confianca: number;
  classificadoPor: 'regra' | 'ia';
}

export async function classificarItensAutomatico(
  itens: ExtratoItem[]
): Promise<ClassificacaoResult[]> {
  // 1. Buscar regras ativas
  const { data: regras } = await supabase
    .from('extrato_regras_classificacao')
    .select('*')
    .eq('ativo', true)
    .order('vezes_usado', { ascending: false });

  const results: ClassificacaoResult[] = [];

  for (const item of itens) {
    if (item.ignorado || item.lancamento_id) continue;

    // Tentar match por regra
    const matched = matchByRule(item.descricao_original, regras || []);
    if (matched) {
      results.push({
        itemId: item.id,
        contaPlanoId: matched.conta_plano_id,
        centroCustoId: matched.centro_custo_id || null,
        confianca: 0.95,
        classificadoPor: 'regra',
      });
      // Incrementar uso da regra
      await supabase
        .from('extrato_regras_classificacao')
        .update({ vezes_usado: (matched.vezes_usado || 0) + 1 })
        .eq('id', matched.id);
      continue;
    }

    // Sem match por regra — será classificado por IA na Edge Function
    results.push({
      itemId: item.id,
      contaPlanoId: null,
      centroCustoId: null,
      confianca: 0,
      classificadoPor: 'ia',
    });
  }

  return results;
}

function matchByRule(descricao: string, regras: RegraClassificacao[]): RegraClassificacao | null {
  const desc = descricao.toUpperCase();

  for (const regra of regras) {
    const padrao = regra.padrao.toUpperCase();

    switch (regra.tipo_match) {
      case 'exact':
        if (desc === padrao) return regra;
        break;
      case 'starts_with':
        if (desc.startsWith(padrao)) return regra;
        break;
      case 'contains':
      default:
        if (desc.includes(padrao)) return regra;
        break;
    }
  }

  return null;
}

// Chamar Edge Function para classificação IA dos itens sem match
export async function classificarPorIA(itens: { id: string; descricao: string; valor: number }[]) {
  const { data, error } = await supabase.functions.invoke('ai-classificar-extrato', {
    body: { itens },
  });

  if (error) throw error;
  return data as { itemId: string; contaPlanoId: string; confianca: number }[];
}

// Salvar classificações no banco
export async function salvarClassificacoes(results: ClassificacaoResult[]) {
  for (const r of results) {
    if (!r.contaPlanoId) continue;

    await supabase
      .from('extrato_bancario_itens')
      .update({
        conta_plano_id: r.contaPlanoId,
        centro_custo_id: r.centroCustoId,
        confianca_ia: r.confianca,
        classificado_por: r.classificadoPor,
      })
      .eq('id', r.itemId);
  }
}

// Criar regra a partir de classificação manual (após 3x)
export async function checkAndCreateRule(descricao: string, contaPlanoId: string, centroCustoId?: string) {
  const keyword = extractKeyword(descricao);

  // Verificar se já existe regra
  const { data: existing } = await supabase
    .from('extrato_regras_classificacao')
    .select('id')
    .ilike('padrao', `%${keyword}%`)
    .eq('conta_plano_id', contaPlanoId)
    .limit(1);

  if (existing && existing.length > 0) return;

  // Contar quantas vezes esse padrão foi classificado manualmente na mesma conta
  const { count } = await supabase
    .from('extrato_bancario_itens')
    .select('id', { count: 'exact', head: true })
    .ilike('descricao_original', `%${keyword}%`)
    .eq('conta_plano_id', contaPlanoId)
    .eq('classificado_por', 'usuario');

  if ((count || 0) >= 3) {
    await supabase
      .from('extrato_regras_classificacao')
      .insert({
        padrao: keyword,
        tipo_match: 'contains',
        conta_plano_id: contaPlanoId,
        centro_custo_id: centroCustoId || null,
      });
  }
}

function extractKeyword(descricao: string): string {
  // Extrair parte mais significativa da descrição
  // Remove números de transação, datas, etc.
  return descricao
    .replace(/\d{2}\/\d{2}\/?\d{0,4}/g, '')  // datas
    .replace(/\d{10,}/g, '')                    // números longos
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50);
}

/**
 * precificacaoService.ts
 * Lógica de precificação baseada em BOM — integra o motor Mubisys com o catálogo de produtos.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  calcOrcamentoItem,
  type OrcamentoItemInput,
  type OrcamentoMaterial,
  type OrcamentoProcesso,
} from '@/shared/services/orcamento-pricing.service';
import type { PricingConfig } from '@/shared/services/pricing-engine';
import type {
  ConfigPrecificacao,
  RegrasPrecificacao,
  PrecificacaoItemInput,
  PrecificacaoItemResult,
  PrecificacaoBreakdown,
  ComponenteBreakdown,
} from '../types/precificacao.types';

// Suppress TS until generated types are regenerated
const db = supabase as unknown as any;

// ---------------------------------------------------------------------------
// Config de precificação
// ---------------------------------------------------------------------------

/**
 * Busca a configuração de precificação ativa (primeira linha da tabela).
 */
export async function fetchConfigPrecificacao(): Promise<ConfigPrecificacao | null> {
  const { data, error } = await db
    .from('config_precificacao')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ConfigPrecificacao | null;
}

// ---------------------------------------------------------------------------
// Regras de precificação
// ---------------------------------------------------------------------------

/**
 * Lista todas as regras de precificação ordenadas por categoria.
 */
export async function fetchRegrasPrecificacao(): Promise<RegrasPrecificacao[]> {
  const { data, error } = await db
    .from('regras_precificacao')
    .select('*')
    .order('categoria', { ascending: true });
  if (error) throw error;
  return data as RegrasPrecificacao[];
}

// ---------------------------------------------------------------------------
// Helpers de mapeamento
// ---------------------------------------------------------------------------

/**
 * Converte ConfigPrecificacao (snake_case do banco) para PricingConfig (camelCase do motor).
 */
function configToPricingConfig(config: ConfigPrecificacao): PricingConfig {
  return {
    faturamentoMedio: config.faturamento_medio,
    custoOperacional: config.custo_operacional,
    custoProdutivo: config.custo_produtivo,
    qtdFuncionarios: config.qtd_funcionarios,
    horasMes: config.horas_mes,
    percentualComissao: config.percentual_comissao,
    percentualImpostos: config.percentual_impostos,
    percentualJuros: config.percentual_juros,
    percentualEncargos: config.percentual_encargos,
  };
}

/**
 * Encontra a regra de precificação correspondente a uma categoria de produto.
 * Fallback: regra "geral".
 */
function findRegra(
  categoria: string | null | undefined,
  regras: RegrasPrecificacao[],
): RegrasPrecificacao | null {
  const ativas = regras.filter((r) => r.ativo);
  if (categoria) {
    const especifica = ativas.find((r) => r.categoria === categoria);
    if (especifica) return especifica;
  }
  return ativas.find((r) => r.categoria === 'geral') ?? null;
}

// ---------------------------------------------------------------------------
// Cálculo de preço a partir do BOM
// ---------------------------------------------------------------------------

/**
 * Calcula o preço real de venda a partir do BOM do modelo.
 *
 * Fluxo:
 * 1. Busca materiais e processos do modelo via Supabase
 * 2. Monta arrays no formato OrcamentoItemInput
 * 3. Chama calcOrcamentoItem (motor Mubisys)
 * 4. Monta PrecificacaoBreakdown com os 10 componentes
 */
export async function calcPrecoBOM(
  input: PrecificacaoItemInput,
  config: ConfigPrecificacao,
  regras: RegrasPrecificacao[],
): Promise<PrecificacaoItemResult> {
  // 1. Busca materiais do BOM com join na tabela materiais para obter preco_medio
  const { data: materiaisData, error: errMat } = await db
    .from('modelo_materiais')
    .select(`
      id,
      quantidade_por_unidade,
      percentual_desperdicio,
      custo_unitario,
      unidade_medida,
      materiais (
        id,
        nome,
        preco_medio
      )
    `)
    .eq('modelo_id', input.modelo_id);

  if (errMat) throw errMat;

  // 2. Busca processos do BOM
  const { data: processosData, error: errProc } = await db
    .from('modelo_processos')
    .select(`
      id,
      etapa,
      tempo_por_unidade_min,
      tempo_setup_min,
      custo_unitario
    `)
    .eq('modelo_id', input.modelo_id);

  if (errProc) throw errProc;

  // 3. Busca informações do modelo para obter categoria (via produto)
  const { data: modeloData, error: errModelo } = await db
    .from('produto_modelos')
    .select(`
      id,
      markup_padrao,
      produtos (
        categoria
      )
    `)
    .eq('id', input.modelo_id)
    .maybeSingle();

  if (errModelo) throw errModelo;

  // 4. Determina regra de precificação
  const categoriaProduto = modeloData?.produtos?.categoria ?? null;
  const regra = findRegra(categoriaProduto, regras);
  const aproveitamentoPadrao = regra?.aproveitamento_padrao ?? 85;

  // 5. Determina markup a usar
  const markupUsado =
    input.markup_percentual ??
    modeloData?.markup_padrao ??
    regra?.markup_sugerido ??
    40;

  // 6. Monta materiais no formato OrcamentoMaterial
  const materiais: OrcamentoMaterial[] = (materiaisData ?? []).map((mm: any) => ({
    material_id: mm.materiais?.id ?? null,
    descricao: mm.materiais?.nome ?? 'Material',
    quantidade: mm.quantidade_por_unidade ?? 0,
    unidade: mm.unidade_medida ?? 'un',
    custo_unitario: mm.custo_unitario ?? mm.materiais?.preco_medio ?? 0,
    // aproveitamento: 0-100. percentual_desperdicio é a perda → aproveitamento = 100 - desperdicio
    aproveitamento:
      mm.percentual_desperdicio != null
        ? 100 - mm.percentual_desperdicio
        : aproveitamentoPadrao,
  }));

  // 7. Monta processos no formato OrcamentoProcesso
  const processos: OrcamentoProcesso[] = (processosData ?? []).map((mp: any) => ({
    etapa: mp.etapa,
    tempo_minutos: mp.tempo_por_unidade_min ?? 0,
    tempo_setup_min: mp.tempo_setup_min ?? 0,
  }));

  // 8. Monta OrcamentoItemInput
  const itemInput: OrcamentoItemInput = {
    descricao: `Modelo ${input.modelo_id}`,
    quantidade: input.quantidade,
    largura_cm: input.largura_cm ?? null,
    altura_cm: input.altura_cm ?? null,
    materiais,
    acabamentos: [],
    processos,
    markup_percentual: markupUsado,
  };

  // 9. Chama o motor Mubisys
  const pricingConfig = configToPricingConfig(config);
  const result = calcOrcamentoItem(itemInput, pricingConfig, aproveitamentoPadrao);

  // 10. Monta breakdown com os 10 componentes
  const precoVenda = result.precoUnitario;
  const custoTotal = result.custoTotal;
  const detalhes = result.detalhes;

  const makeComponente = (
    componente: PrecificacaoBreakdown['componentes'][number]['componente'],
    valor: number,
  ): ComponenteBreakdown => ({
    componente,
    valor,
    percentual: precoVenda > 0 ? (valor / precoVenda) * 100 : 0,
  });

  // PricingResult fields (pricing-engine.ts):
  //   custoMP, custoMO, custoMaquinas, percFixo, percentualVendas,
  //   custoBase, valorAntesMarkup, precoVenda, custoTotal, margemBruta
  // Derivamos cada componente a partir dos percentuais e custos disponíveis
  const custoFixoValor = precoVenda > 0 ? (detalhes.percFixo / 100) * precoVenda : 0;
  const custosVendasValor = precoVenda > 0 ? (detalhes.percentualVendas / 100) * precoVenda : 0;
  // Distribui percentualVendas nos sub-componentes TF/TB/TR/DT proporcionalmente (sem breakdown detalhado no motor)
  const custosVendasQuarto = custosVendasValor / 4;

  const breakdown: PrecificacaoBreakdown = {
    precoVenda,
    custoTotal,
    margemBruta: result.margemBruta,
    componentes: [
      makeComponente('MP', result.custoMP),
      makeComponente('CF', custoFixoValor),
      makeComponente('MO', result.custoMO),
      makeComponente('TF', custosVendasQuarto), // Taxa Financeira ≈ juros (parte do percentualVendas)
      makeComponente('CI', 0),                  // Custo de impressão — não segregado no motor base
      makeComponente('CE', result.custoMaquinas ?? 0),
      makeComponente('TB', custosVendasQuarto), // Taxa de Benefício ≈ comissão (parte do percentualVendas)
      makeComponente('TR', custosVendasQuarto), // Taxa de Retrabalho ≈ encargos (parte do percentualVendas)
      makeComponente('DT', custosVendasQuarto), // Desconto Tardio ≈ impostos (parte do percentualVendas)
      makeComponente('ML', precoVenda - custoTotal),
    ],
  };

  return {
    precoUnitario: result.precoUnitario,
    precoTotal: result.precoTotal,
    margemBruta: result.margemBruta,
    breakdown,
    markup_usado: markupUsado,
    regra_categoria: categoriaProduto,
  };
}

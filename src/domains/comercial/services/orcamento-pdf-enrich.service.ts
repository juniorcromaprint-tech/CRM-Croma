// ============================================================================
// orcamento-pdf-enrich.service.ts
// ============================================================================
// Enriquece um Orcamento com dados reais para renderizacao em PDF multi-modo
// (cliente / producao / tecnico). Busca:
//  - vendedor (nome completo via profiles)
//  - percentual e valor de comissao do vendedor
//  - comissao externa (pct e valor) + se eh absorvida
//  - processos por item (etapa + tempo em minutos) para o modo 'producao'
// ============================================================================

import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_PRICING_CONFIG } from '@/shared/services/pricing-engine';

async function fetchPercentualComissaoAtivo(): Promise<number> {
  try {
    const { data } = await supabase
      .from('config_precificacao')
      .select('percentual_comissao')
      .eq('ativo', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const pct = (data as { percentual_comissao?: number } | null)?.percentual_comissao;
    if (typeof pct === 'number' && pct > 0) return pct;
  } catch {
    // silencioso: cai no default
  }
  return DEFAULT_PRICING_CONFIG.percentualComissao;
}

export interface ProcessoItemPDF {
  etapa: string;
  tempo_minutos: number;
  ordem: number;
}

export interface ClientePDF {
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  email: string | null;
  telefone: string | null;
  contato_financeiro: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
}

/** Informação de local de instalação / referência de loja extraída das observações */
export interface LocalInstalacaoPDF {
  referencia: string | null;
  responsavel: string | null;
  endereco_completo: string | null;
  marca: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  condicoes_locais: string | null;
}

export interface OrcamentoEnriquecidoPDF {
  vendedor_nome: string | null;
  vendedor_comissao_pct: number | null;
  vendedor_comissao_valor: number | null;
  comissao_externa_pct: number | null;
  comissao_externa_valor: number | null;
  comissao_externa_nome: string | null;
  absorver_comissao: boolean;
  /** Processos agrupados por proposta_item_id */
  processos_por_item: Record<string, ProcessoItemPDF[]>;
  /** Tempo total em minutos somando todos os itens */
  tempo_producao_total_min: number;
  /** Tempo total agregado por etapa */
  tempo_por_etapa: Record<string, number>;
  /** Cliente completo (endereço, contato, IE) */
  cliente: ClientePDF | null;
  /** Local de instalação parseado das observações */
  local_instalacao: LocalInstalacaoPDF | null;
  /** Observações sem a parte de local de instalação (limpo para exibir) */
  observacoes_limpas: string | null;
}

/**
 * Parseia o campo observacoes de uma proposta procurando seções
 * "LOCAL DE INSTALAÇÃO", "Ref.:" / "Ref:", "Responsável local:", "CONDIÇÕES:" etc.
 * Retorna dados estruturados + o texto limpo (sem essas seções estruturadas).
 */
export function parseObservacoesInstalacao(
  observacoes: string | null | undefined,
): { local: LocalInstalacaoPDF | null; limpas: string | null } {
  if (!observacoes || !observacoes.trim()) return { local: null, limpas: null };

  const texto = observacoes.replace(/\r\n/g, '\n');
  const local: LocalInstalacaoPDF = {
    referencia: null,
    responsavel: null,
    endereco_completo: null,
    marca: null,
    contato_nome: null,
    contato_telefone: null,
    condicoes_locais: null,
  };
  const linhasRestantes: string[] = [];
  const linhas = texto.split('\n');

  let bloco: 'local' | 'condicoes' | null = null;
  let localBuf: string[] = [];
  let condicoesBuf: string[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const raw = linhas[i];
    const linha = raw.trim();
    const baixo = linha.toLowerCase();

    // Marcadores de início de bloco
    if (/^local de instala[cç][aã]o:?$/i.test(linha)) {
      bloco = 'local';
      continue;
    }
    if (/^condi[cç][oõ]es:?$/i.test(linha)) {
      bloco = 'condicoes';
      continue;
    }
    if (/^escopo:?$/i.test(linha)) {
      // bloco escopo já está representado nos itens — ignorar o bloco do texto
      bloco = null;
      continue;
    }

    // Ref.:
    if (/^ref\.?:\s*/i.test(linha)) {
      local.referencia = linha.replace(/^ref\.?:\s*/i, '').trim() || null;
      continue;
    }

    // Contato <Marca>: Nome — telefone  (ex: "Contato Beira Rio: Larissa — (51) 3584-2200")
    const mContato = linha.match(/^contato\s+(.+?):\s*(.+)$/i);
    if (mContato) {
      const partes = mContato[2].split(/\s*[—\-]\s*/);
      local.marca = (local.marca || mContato[1]).trim();
      local.contato_nome = (partes[0] || '').trim() || null;
      local.contato_telefone = (partes[1] || '').trim() || null;
      continue;
    }

    if (/^respons[aá]vel\s+local:?\s*/i.test(linha)) {
      local.responsavel = linha.replace(/^respons[aá]vel\s+local:?\s*/i, '').trim() || null;
      continue;
    }

    if (/^faturamento:/i.test(linha) || /^instala[cç][aã]o:/i.test(baixo)) {
      // Linhas informativas de faturamento/instalação — mantemos em observações limpas
      linhasRestantes.push(raw);
      bloco = null;
      continue;
    }

    if (bloco === 'local') {
      if (linha) localBuf.push(linha);
      continue;
    }
    if (bloco === 'condicoes') {
      if (linha) condicoesBuf.push(linha);
      continue;
    }

    linhasRestantes.push(raw);
  }

  if (localBuf.length > 0) {
    local.endereco_completo = localBuf.join(' ').replace(/\s+/g, ' ').trim();
  }
  if (condicoesBuf.length > 0) {
    local.condicoes_locais = condicoesBuf.join(' ').replace(/\s+/g, ' ').trim();
  }

  const temAlgumaCoisa = Object.values(local).some((v) => v != null && v !== '');
  const limpas = linhasRestantes.join('\n').trim() || null;
  return { local: temAlgumaCoisa ? local : null, limpas };
}

export async function enriquecerOrcamentoParaPDF(orc: {
  id: string;
  vendedor_id: string | null;
  total: number;
  itens: { id: string }[];
  cliente_id?: string | null;
  observacoes?: string | null;
}): Promise<OrcamentoEnriquecidoPDF> {
  const result: OrcamentoEnriquecidoPDF = {
    vendedor_nome: null,
    vendedor_comissao_pct: null,
    vendedor_comissao_valor: null,
    comissao_externa_pct: null,
    comissao_externa_valor: null,
    comissao_externa_nome: null,
    absorver_comissao: false,
    processos_por_item: {},
    tempo_producao_total_min: 0,
    tempo_por_etapa: {},
    cliente: null,
    local_instalacao: null,
    observacoes_limpas: null,
  };

  // 1) Buscar propostas com dados de comissao + vendedor profile
  const { data: proposta } = await supabase
    .from('propostas')
    .select('vendedor_id, comissao_externa_pct, comissionado_externo_id, absorver_comissao, total, cliente_id, observacoes')
    .eq('id', orc.id)
    .maybeSingle();

  if (proposta) {
    result.absorver_comissao = !!proposta.absorver_comissao;
    result.comissao_externa_pct = proposta.comissao_externa_pct ?? null;
  }

  // 1.1) Cliente completo (endereço, contato, IE)
  const clienteId = orc.cliente_id ?? proposta?.cliente_id ?? null;
  if (clienteId) {
    const { data: cli } = await supabase
      .from('clientes')
      .select(
        'razao_social, nome_fantasia, cnpj, inscricao_estadual, email, telefone, contato_financeiro, endereco, numero, complemento, bairro, cidade, estado, cep',
      )
      .eq('id', clienteId)
      .maybeSingle();
    if (cli) {
      result.cliente = cli as ClientePDF;
    }
  }

  // 1.2) Parse de observações → local de instalação
  const observacoesFonte = orc.observacoes ?? proposta?.observacoes ?? null;
  const parsed = parseObservacoesInstalacao(observacoesFonte);
  result.local_instalacao = parsed.local;
  result.observacoes_limpas = parsed.limpas;

  // 2) Nome do vendedor (via profiles)
  if (orc.vendedor_id) {
    const { data: vendedor } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', orc.vendedor_id)
      .maybeSingle();
    if (vendedor) {
      const nome = [vendedor.first_name, vendedor.last_name].filter(Boolean).join(' ').trim();
      result.vendedor_nome = nome || null;
    }
  }

  // 3) Nome do comissionado externo
  if (proposta?.comissionado_externo_id) {
    const { data: ext } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', proposta.comissionado_externo_id)
      .maybeSingle();
    if (ext) {
      const nome = [ext.first_name, ext.last_name].filter(Boolean).join(' ').trim();
      result.comissao_externa_nome = nome || null;
    }
  }

  // 4) Percentual de comissao do vendedor: config_precificacao ativa ou default
  result.vendedor_comissao_pct = await fetchPercentualComissaoAtivo();

  // 5) Calcula valores em R$
  const valorBase = orc.total ?? 0;
  if (result.vendedor_comissao_pct != null && valorBase > 0) {
    result.vendedor_comissao_valor = +((valorBase * result.vendedor_comissao_pct) / 100).toFixed(2);
  }
  if (result.comissao_externa_pct != null && valorBase > 0) {
    result.comissao_externa_valor = +((valorBase * result.comissao_externa_pct) / 100).toFixed(2);
  }

  // 6) Processos por item
  const itemIds = orc.itens.map((i) => i.id);
  if (itemIds.length > 0) {
    const { data: processos } = await supabase
      .from('proposta_item_processos')
      .select('proposta_item_id, etapa, tempo_minutos, ordem')
      .in('proposta_item_id', itemIds)
      .order('ordem', { ascending: true });

    if (processos) {
      for (const p of processos) {
        const id = p.proposta_item_id as string;
        if (!result.processos_por_item[id]) result.processos_por_item[id] = [];
        const tempo = Number(p.tempo_minutos) || 0;
        result.processos_por_item[id].push({
          etapa: p.etapa ?? 'Outro',
          tempo_minutos: tempo,
          ordem: p.ordem ?? 0,
        });
        result.tempo_producao_total_min += tempo;
        result.tempo_por_etapa[p.etapa ?? 'Outro'] =
          (result.tempo_por_etapa[p.etapa ?? 'Outro'] || 0) + tempo;
      }
    }
  }

  return result;
}

/** Formata minutos como "X h Ymin" */
export function formatMinutos(min: number): string {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

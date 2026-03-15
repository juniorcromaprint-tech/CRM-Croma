// src/domains/ai/types/ai.types.ts

export interface AIResponse {
  summary: string;
  confidence: 'alta' | 'media' | 'baixa';
  risks: AIRisk[];
  suggestions: AISuggestion[];
  required_actions: string[];
  structured_data: Record<string, unknown>;
  model_used: string;
  tokens_used: number;
}

export interface AIRisk {
  level: 'alta' | 'media' | 'baixa';
  description: string;
  action: string;
}

export interface AISuggestion {
  priority: 'alta' | 'media' | 'baixa';
  text: string;
  impact: string;
}

// Structured data per function
export interface OrcamentoAnaliseData {
  margem_estimada: number;
  itens_faltantes: string[];
  preco_sugerido: number;
  comparativo_historico: string;
}

export interface ClienteResumoData {
  ticket_medio: number;
  total_pedidos: number;
  produtos_frequentes: string[];
  risco: string;
  padrao_compra: string;
  sugestao_abordagem: string;
}

export interface BriefingProducaoData {
  itens_briefing: {
    produto: string;
    medidas: string;
    material: string;
    acabamento: string;
    quantidade: number;
    observacoes: string;
  }[];
  materiais_necessarios: {
    nome: string;
    quantidade: number;
    unidade: string;
    disponivel_estoque: boolean;
  }[];
  pendencias: string[];
  prazo_producao: string;
  observacoes_criticas: string[];
}

export interface DetectarProblemasData {
  problemas: {
    tipo: string;
    severidade: 'alta' | 'media' | 'baixa';
    titulo: string;
    descricao: string;
    entity_type: string;
    entity_id: string;
    acao_sugerida: string;
  }[];
  total_por_severidade: { alta: number; media: number; baixa: number };
}

export interface ComposicaoProdutoData {
  modelo_sugerido: { id: string | null; nome: string; categoria: string };
  materiais: {
    material_id: string | null;
    nome: string;
    quantidade_estimada: number;
    unidade: string;
    preco_unitario: number;
  }[];
  acabamentos: {
    acabamento_id: string | null;
    nome: string;
    obrigatorio: boolean;
  }[];
  processos: {
    processo: string;
    ordem: number;
    tempo_estimado_min: number;
  }[];
  servicos_sugeridos: {
    servico_id: string | null;
    nome: string;
    motivo: string;
  }[];
  custo_estimado: number;
  observacoes: string[];
}

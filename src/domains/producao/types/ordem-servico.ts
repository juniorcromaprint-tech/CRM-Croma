// Types for Ordem de Serviço (OS) — consolidated view, not a DB entity

export interface OSMaterial {
  id: string;
  material_id: string;
  nome: string;
  unidade: string;
  quantidade_prevista: number;
  quantidade_consumida: number;
  custo_unitario: number;
  custo_total: number;
}

export interface OSEtapa {
  id: string;
  nome: string;
  ordem: number;
  status: string;
  tempo_estimado_min: number | null;
  tempo_real_min: number | null;
  inicio: string | null;
  fim: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
}

export interface OSItem {
  id: string;
  descricao: string;
  especificacao: string | null;
  largura_cm: number | null;
  altura_cm: number | null;
  area_m2: number | null;
  quantidade: number;
  unidade: string;
  modelo_nome: string | null;
  produto_nome: string | null;
  arte_url: string | null;
  instrucoes: string | null;
  status: string | null;
  // OP vinculada
  op_id: string | null;
  op_numero: string | null;
  op_status: string | null;
  op_prioridade: number | null;
  // Materiais da OP
  materiais: OSMaterial[];
  // Acabamentos do item
  acabamentos: string[];
}

export interface OSCliente {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
}

export interface OSData {
  // Pedido
  pedido_id: string;
  numero: string;
  status: string;
  prioridade: string;
  data_prometida: string | null;
  data_conclusao: string | null;
  aprovado_em: string | null;
  aprovado_por: string | null;
  observacoes: string | null;
  created_at: string;
  // Vendedor
  vendedor_nome: string | null;
  // Cliente
  cliente: OSCliente;
  // Etapas consolidadas (de todas as OPs)
  etapas: OSEtapa[];
  // Itens com materiais
  itens: OSItem[];
}

export interface OSOPData {
  // OP
  op_id: string;
  op_numero: string;
  op_status: string;
  op_prioridade: number;
  data_inicio: string | null;
  data_conclusao: string | null;
  tempo_estimado_min: number | null;
  tempo_real_min: number | null;
  observacoes: string | null;
  // Pedido (resumo)
  pedido_id: string;
  pedido_numero: string;
  pedido_status: string;
  data_prometida: string | null;
  // Vendedor
  vendedor_nome: string | null;
  // Cliente
  cliente: OSCliente;
  // Etapas desta OP
  etapas: OSEtapa[];
  // Item vinculado com materiais
  item: OSItem;
}

// Status colors mapping
export const OS_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  rascunho: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Rascunho' },
  aguardando_aprovacao: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Aguardando Aprovação' },
  aprovado: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Aprovado' },
  em_producao: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Em Produção' },
  em_acabamento: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Em Acabamento' },
  produzido: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Produzido' },
  aguardando_instalacao: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Aguardando Instalação' },
  em_instalacao: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Em Instalação' },
  concluido: { bg: 'bg-green-100', text: 'text-green-700', label: 'Concluído' },
  cancelado: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelado' },
};

export const OP_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  aguardando_programacao: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Aguardando Programação' },
  em_fila: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Em Fila' },
  em_producao: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Em Produção' },
  em_acabamento: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Em Acabamento' },
  em_conferencia: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Em Conferência' },
  liberado: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Liberado' },
  retrabalho: { bg: 'bg-red-100', text: 'text-red-700', label: 'Retrabalho' },
  finalizado: { bg: 'bg-green-100', text: 'text-green-700', label: 'Finalizado' },
};

// Print status for timeline (used in etapas)
export const ETAPA_STATUS_ICON: Record<string, string> = {
  pendente: '⏳',
  em_andamento: '🔄',
  concluida: '✅',
  cancelada: '❌',
};

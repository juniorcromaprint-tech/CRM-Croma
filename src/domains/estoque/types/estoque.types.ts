// src/domains/estoque/types/estoque.types.ts

export type SemaforoStatus = 'verde' | 'amarelo' | 'vermelho';

export interface EstoqueSaldo {
  id: string;
  material_id: string;
  material?: { nome: string; unidade: string; estoque_minimo: number; estoque_ideal: number };
  quantidade_disponivel: number;
  quantidade_reservada?: number;
  updated_at: string;
}

/** Saldo computado da view v_estoque_saldos */
export interface EstoqueSaldoView {
  material_id: string;
  nome: string;
  unidade: string;
  estoque_minimo: number;
  estoque_ideal: number;
  preco_medio: number | null;
  saldo_disponivel: number;
  saldo_reservado: number;
  total_movimentacoes: number;
  ultima_movimentacao: string | null;
}

/** Saldo enriquecido com semáforo (da view v_estoque_semaforo) */
export interface EstoqueSemaforo extends EstoqueSaldoView {
  semaforo: SemaforoStatus;
  qtd_reposicao_sugerida: number;
}

export interface EstoqueMovimentacao {
  id: string;
  material_id: string;
  material?: { nome: string; unidade: string };
  tipo: 'entrada' | 'saida' | 'reserva' | 'liberacao_reserva' | 'ajuste' | 'devolucao';
  quantidade: number;
  referencia_tipo?: string;
  referencia_id?: string;
  motivo?: string;
  lote?: string;
  custo_unitario?: number;
  usuario_id?: string;
  created_at: string;
}

export interface EstoqueReserva {
  id: string;
  material_id: string;
  material?: { nome: string; unidade: string };
  ordem_producao_id: string | null;
  ordem_producao?: { numero: string };
  quantidade: number;
  status: 'ativa' | 'liberada' | 'consumida';
  liberada_em?: string | null;
  consumida_em?: string | null;
  observacao?: string;
  created_at: string;
}

export interface Inventario {
  id: string;
  data_inventario: string;
  status: 'aberto' | 'finalizado';
  responsavel_id?: string;
  observacoes?: string;
  created_at: string;
  itens?: InventarioItem[];
}

export interface InventarioItem {
  id: string;
  inventario_id: string;
  material_id: string;
  material?: { nome: string; unidade: string };
  quantidade_sistema: number;
  quantidade_contada?: number;
  diferenca?: number;
  observacoes?: string;
}

export interface EstoqueKPIs {
  totalMateriais: number;
  abaixoMinimo: number;
  movimentacoesHoje: number;
  valorTotal: number;
  emAlertaAmarelo: number;
}

export type MovimentacaoCreate = {
  material_id: string;
  tipo: EstoqueMovimentacao['tipo'];
  quantidade: number;
  referencia_tipo?: string;
  referencia_id?: string;
  motivo?: string;
  lote?: string;
  custo_unitario?: number;
};

export type InventarioCreate = Omit<Inventario, 'id' | 'created_at' | 'itens'>;
export type InventarioItemCreate = Omit<InventarioItem, 'id' | 'diferenca' | 'material'>;

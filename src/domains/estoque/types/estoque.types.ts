export interface EstoqueSaldo {
  id: string;
  material_id: string;
  material?: { nome: string; unidade: string; estoque_minimo: number };
  quantidade_disponivel: number;
  quantidade_reservada?: number;
  updated_at: string;
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
  usuario_id?: string;
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
}

export type MovimentacaoCreate = Omit<EstoqueMovimentacao, 'id' | 'created_at' | 'material'>;
export type InventarioCreate = Omit<Inventario, 'id' | 'created_at' | 'itens'>;
export type InventarioItemCreate = Omit<InventarioItem, 'id' | 'diferenca' | 'material'>;

// src/domains/estoque/types/estoque.types.ts

export interface EstoqueSaldo {
  id: string;
  material_id: string;
  material?: { nome: string; unidade: string; estoque_minimo: number };
  quantidade: number;
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
  observacao?: string;
  created_at: string;
  usuario_id?: string;
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
  diferenca: number;
  justificativa?: string;
}

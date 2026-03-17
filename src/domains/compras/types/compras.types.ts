export interface Fornecedor {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  contato_nome?: string;
  categorias?: string[];
  lead_time_dias?: number;
  condicao_pagamento?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
}

export type PedidoCompraStatus = 'rascunho' | 'aprovado' | 'enviado' | 'parcial' | 'recebido' | 'cancelado';

export interface PedidoCompra {
  id: string;
  numero?: string;
  fornecedor_id: string;
  fornecedor?: Fornecedor;
  status: PedidoCompraStatus;
  valor_total: number;
  data_emissao?: string;
  data_vencimento?: string;
  observacoes?: string;
  created_at: string;
  updated_at?: string;
  itens?: PedidoCompraItem[];
}

export interface PedidoCompraItem {
  id: string;
  pedido_compra_id: string;
  material_id: string;
  material?: { nome: string; unidade: string };
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  quantidade_recebida?: number;
  created_at?: string;
}

export type PedidoCompraCreate = Omit<PedidoCompra, 'id' | 'created_at' | 'updated_at' | 'fornecedor' | 'itens'>;
export type PedidoCompraItemCreate = Omit<PedidoCompraItem, 'id' | 'created_at' | 'material'>;

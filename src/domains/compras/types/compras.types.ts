// src/domains/compras/types/compras.types.ts

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  contato?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
}

export interface PedidoCompra {
  id: string;
  numero?: string;
  fornecedor_id: string;
  fornecedor?: Fornecedor;
  status: 'rascunho' | 'pendente' | 'aprovado' | 'enviado' | 'recebido' | 'cancelado';
  valor_total: number;
  data_entrega?: string;
  observacoes?: string;
  created_at: string;
  itens?: PedidoCompraItem[];
}

export interface PedidoCompraItem {
  id: string;
  pedido_compra_id: string;
  material_id: string;
  material?: { nome: string; unidade: string };
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

export type PedidoCompraCreate = Omit<PedidoCompra, 'id' | 'created_at' | 'fornecedor' | 'itens'>;
export type PedidoCompraItemCreate = Omit<PedidoCompraItem, 'id' | 'material'>;

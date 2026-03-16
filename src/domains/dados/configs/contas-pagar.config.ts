// src/domains/dados/configs/contas-pagar.config.ts
// Note: DB table has 'fornecedor_id' (UUID FK), not a denormalized cnpj field.
// For import, we use 'fornecedor_cnpj' as a lookup column resolved by the import engine.
// The actual column 'valor_original' maps to what the plan called 'valor'.
// There is a 'categoria' column (text) and 'numero_nf' for NF reference.
import { registerEntity, type EntityConfig } from './entity-registry';

export const contasPagarConfig: EntityConfig = {
  key: 'contas-pagar',
  table: 'contas_pagar',
  label: 'Conta a Pagar',
  labelPlural: 'Contas a Pagar',
  icon: 'TrendingDown',
  updateKeys: ['id'],
  requiredColumns: ['valor_original', 'data_vencimento'],
  importOrder: 11,
  columns: [
    { key: 'id', label: 'ID', type: 'text', required: false, editable: false },
    { key: 'fornecedor_cnpj', label: 'CNPJ do Fornecedor', type: 'text', required: false, exportable: true },
    { key: 'numero_titulo', label: 'Número do Título', type: 'text', required: false },
    { key: 'numero_nf', label: 'Número da NF', type: 'text', required: false },
    { key: 'categoria', label: 'Categoria', type: 'text', required: false },
    { key: 'valor_original', label: 'Valor', type: 'number', required: true },
    { key: 'data_emissao', label: 'Data de Emissão', type: 'date', required: false },
    { key: 'data_vencimento', label: 'Data de Vencimento', type: 'date', required: true },
    { key: 'data_pagamento', label: 'Data de Pagamento', type: 'date', required: false },
    { key: 'valor_pago', label: 'Valor Pago', type: 'number', required: false },
    { key: 'forma_pagamento', label: 'Forma de Pagamento', type: 'select', required: false, options: ['boleto', 'pix', 'cartao_credito', 'transferencia', 'dinheiro', 'cheque', 'debito_automatico'] },
    { key: 'status', label: 'Status', type: 'select', required: false, options: ['pendente', 'pago', 'vencido', 'cancelado', 'parcial'] },
    { key: 'observacoes', label: 'Observações', type: 'text', required: false },
  ],
  templateExamples: [
    { fornecedor_cnpj: '12.345.678/0001-90', numero_nf: 'NF-5001', categoria: 'Matéria-Prima', valor_original: '2500.00', data_emissao: '2026-03-01', data_vencimento: '2026-04-01', forma_pagamento: 'boleto', status: 'pendente' },
    { fornecedor_cnpj: '98.765.432/0001-10', numero_nf: 'NF-8832', categoria: 'Serviços', valor_original: '1200.00', data_emissao: '2026-03-05', data_vencimento: '2026-03-20', data_pagamento: '2026-03-18', valor_pago: '1200.00', forma_pagamento: 'pix', status: 'pago' },
    { fornecedor_cnpj: '55.444.333/0001-22', numero_nf: 'NF-3210', categoria: 'Equipamentos', valor_original: '850.00', data_emissao: '2026-02-01', data_vencimento: '2026-03-01', status: 'vencido' },
  ],
  bulkActions: [
    { field: 'status', label: 'Alterar Status', type: 'select', options: ['pendente', 'pago', 'vencido', 'cancelado', 'parcial'] },
    { field: 'forma_pagamento', label: 'Alterar Forma de Pagamento', type: 'select', options: ['boleto', 'pix', 'cartao_credito', 'transferencia', 'dinheiro', 'cheque', 'debito_automatico'] },
  ],
};

registerEntity(contasPagarConfig);

// src/domains/dados/configs/contas-receber.config.ts
// Note: DB table has 'cliente_id' (UUID FK), not a denormalized cpf_cnpj field.
// For import, we use 'cliente_cpf_cnpj' as a lookup column resolved by the import engine.
// The actual column 'valor_original' maps to what the plan called 'valor'.
// There is no 'descricao' column — using 'observacoes' instead.
import { registerEntity, type EntityConfig } from './entity-registry';

export const contasReceberConfig: EntityConfig = {
  key: 'contas-receber',
  table: 'contas_receber',
  label: 'Conta a Receber',
  labelPlural: 'Contas a Receber',
  icon: 'TrendingUp',
  updateKeys: ['id'],
  requiredColumns: ['valor_original', 'data_vencimento'],
  importOrder: 10,
  columns: [
    { key: 'id', label: 'ID', type: 'text', required: false, editable: false },
    { key: 'cliente_cpf_cnpj', label: 'CPF/CNPJ do Cliente', type: 'text', required: false, exportable: true },
    { key: 'numero_titulo', label: 'Número do Título', type: 'text', required: false },
    { key: 'valor_original', label: 'Valor', type: 'number', required: true },
    { key: 'data_emissao', label: 'Data de Emissão', type: 'date', required: false },
    { key: 'data_vencimento', label: 'Data de Vencimento', type: 'date', required: true },
    { key: 'data_pagamento', label: 'Data de Pagamento', type: 'date', required: false },
    { key: 'valor_pago', label: 'Valor Pago', type: 'number', required: false },
    { key: 'forma_pagamento', label: 'Forma de Pagamento', type: 'select', required: false, options: ['boleto', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia', 'dinheiro', 'cheque'] },
    { key: 'status', label: 'Status', type: 'select', required: false, options: ['pendente', 'pago', 'vencido', 'cancelado', 'parcial'] },
    { key: 'observacoes', label: 'Observações', type: 'text', required: false },
  ],
  templateExamples: [
    { cliente_cpf_cnpj: '12.345.678/0001-90', numero_titulo: 'NF-001', valor_original: '1500.00', data_emissao: '2026-03-01', data_vencimento: '2026-04-01', forma_pagamento: 'boleto', status: 'pendente' },
    { cliente_cpf_cnpj: '98.765.432/0001-10', numero_titulo: 'NF-002', valor_original: '3200.00', data_emissao: '2026-03-05', data_vencimento: '2026-04-05', data_pagamento: '2026-03-20', valor_pago: '3200.00', forma_pagamento: 'pix', status: 'pago' },
    { cliente_cpf_cnpj: '111.222.333-44', numero_titulo: 'NF-003', valor_original: '800.00', data_emissao: '2026-02-01', data_vencimento: '2026-03-01', status: 'vencido' },
  ],
  bulkActions: [
    { field: 'status', label: 'Alterar Status', type: 'select', options: ['pendente', 'pago', 'vencido', 'cancelado', 'parcial'] },
    { field: 'forma_pagamento', label: 'Alterar Forma de Pagamento', type: 'select', options: ['boleto', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia', 'dinheiro', 'cheque'] },
  ],
};

registerEntity(contasReceberConfig);

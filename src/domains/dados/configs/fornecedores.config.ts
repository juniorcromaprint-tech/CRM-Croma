// src/domains/dados/configs/fornecedores.config.ts
import { registerEntity, type EntityConfig } from './entity-registry';

export const fornecedoresConfig: EntityConfig = {
  key: 'fornecedores',
  table: 'fornecedores',
  label: 'Fornecedor',
  labelPlural: 'Fornecedores',
  icon: 'Truck',
  updateKeys: ['id', 'cnpj'],
  requiredColumns: ['cnpj', 'razao_social'],
  importOrder: 1,
  columns: [
    { key: 'id', label: 'ID', type: 'text', required: false, editable: false },
    { key: 'cnpj', label: 'CNPJ', type: 'text', required: true },
    { key: 'razao_social', label: 'Razão Social', type: 'text', required: true },
    { key: 'nome_fantasia', label: 'Nome Fantasia', type: 'text', required: false },
    { key: 'email', label: 'E-mail', type: 'text', required: false },
    { key: 'telefone', label: 'Telefone', type: 'text', required: false },
    { key: 'contato_nome', label: 'Nome do Contato', type: 'text', required: false },
    { key: 'condicao_pagamento', label: 'Condição de Pagamento', type: 'text', required: false },
    { key: 'lead_time_dias', label: 'Lead Time (dias)', type: 'number', required: false },
    { key: 'observacoes', label: 'Observações', type: 'text', required: false },
    { key: 'ativo', label: 'Ativo', type: 'boolean', required: false },
  ],
  templateExamples: [
    { cnpj: '12.345.678/0001-90', razao_social: 'Gráfica ABC Ltda', nome_fantasia: 'Gráfica ABC', email: 'compras@graficaabc.com.br', telefone: '(11) 3333-4444', ativo: 'true' },
    { cnpj: '98.765.432/0001-10', razao_social: 'Distribuidora XYZ S.A.', nome_fantasia: 'Distribuidora XYZ', email: 'vendas@distxyz.com.br', telefone: '(21) 2222-3333', ativo: 'true' },
    { cnpj: '55.444.333/0001-22', razao_social: 'Fornecedor de Tintas Ltda', nome_fantasia: 'Tintas Pro', lead_time_dias: '7', ativo: 'true' },
  ],
  bulkActions: [
    { field: 'ativo', label: 'Ativar/Inativar', type: 'boolean' },
    { field: 'condicao_pagamento', label: 'Alterar Condição de Pagamento', type: 'text' },
  ],
};

registerEntity(fornecedoresConfig);

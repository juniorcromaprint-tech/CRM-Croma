// src/domains/dados/configs/clientes.config.ts
// Note: DB column is 'cpf_cnpj' (not 'cnpj_cpf' as in the plan).
// There is also a separate 'cnpj' column. 'cpf_cnpj' is the primary identifier.
import { registerEntity, type EntityConfig } from './entity-registry';

export const clientesConfig: EntityConfig = {
  key: 'clientes',
  table: 'clientes',
  label: 'Cliente',
  labelPlural: 'Clientes',
  icon: 'Building2',
  updateKeys: ['id', 'cpf_cnpj'],
  requiredColumns: ['cpf_cnpj', 'razao_social'],
  importOrder: 8,
  columns: [
    { key: 'id', label: 'ID', type: 'text', required: false, editable: false },
    { key: 'cpf_cnpj', label: 'CPF/CNPJ', type: 'text', required: true },
    { key: 'razao_social', label: 'Razão Social', type: 'text', required: true },
    { key: 'nome_fantasia', label: 'Nome Fantasia', type: 'text', required: false },
    { key: 'email', label: 'E-mail', type: 'text', required: false },
    { key: 'telefone', label: 'Telefone', type: 'text', required: false },
    { key: 'endereco', label: 'Endereço', type: 'text', required: false },
    { key: 'numero', label: 'Número', type: 'text', required: false },
    { key: 'complemento', label: 'Complemento', type: 'text', required: false },
    { key: 'bairro', label: 'Bairro', type: 'text', required: false },
    { key: 'cidade', label: 'Cidade', type: 'text', required: false },
    { key: 'estado', label: 'Estado', type: 'text', required: false },
    { key: 'cep', label: 'CEP', type: 'text', required: false },
    { key: 'segmento', label: 'Segmento', type: 'select', required: false, options: ['varejo', 'franquia', 'industria', 'servicos', 'governo', 'outros'] },
    { key: 'classificacao', label: 'Classificação', type: 'select', required: false, options: ['A', 'B', 'C', 'D'] },
    { key: 'tipo_cliente', label: 'Tipo de Cliente', type: 'select', required: false, options: ['pessoa_fisica', 'pessoa_juridica'] },
    { key: 'contato_financeiro', label: 'Contato Financeiro', type: 'text', required: false },
    { key: 'limite_credito', label: 'Limite de Crédito', type: 'number', required: false },
    { key: 'observacoes', label: 'Observações', type: 'text', required: false },
    { key: 'ativo', label: 'Ativo', type: 'boolean', required: false },
  ],
  templateExamples: [
    { cpf_cnpj: '12.345.678/0001-90', razao_social: 'Empresa ABC Ltda', nome_fantasia: 'ABC', email: 'contato@abc.com.br', telefone: '(11) 9999-8888', cidade: 'São Paulo', estado: 'SP', segmento: 'varejo', ativo: 'true' },
    { cpf_cnpj: '98.765.432/0001-10', razao_social: 'Rede XYZ Franquias', nome_fantasia: 'XYZ', email: 'compras@xyz.com.br', telefone: '(21) 8888-7777', cidade: 'Rio de Janeiro', estado: 'RJ', segmento: 'franquia', ativo: 'true' },
    { cpf_cnpj: '111.222.333-44', razao_social: 'João da Silva', email: 'joao@email.com', telefone: '(31) 7777-6666', cidade: 'Belo Horizonte', estado: 'MG', tipo_cliente: 'pessoa_fisica', ativo: 'true' },
  ],
  bulkActions: [
    { field: 'segmento', label: 'Alterar Segmento', type: 'select', options: ['varejo', 'franquia', 'industria', 'servicos', 'governo', 'outros'] },
    { field: 'classificacao', label: 'Alterar Classificação', type: 'select', options: ['A', 'B', 'C', 'D'] },
    { field: 'limite_credito', label: 'Alterar Limite de Crédito', type: 'number' },
    { field: 'ativo', label: 'Ativar/Inativar', type: 'boolean' },
  ],
};

registerEntity(clientesConfig);

// src/domains/dados/configs/leads.config.ts
// Note: leads table uses 'empresa' (required) as the company field, not 'nome'.
// The plan said required: 'nome' but the DB requires 'empresa'. Using empresa as required.
// Also: no direct 'origem' text field — origem is via FK (origem_id). Using 'segmento' and 'status' instead.
import { registerEntity, type EntityConfig } from './entity-registry';

export const leadsConfig: EntityConfig = {
  key: 'leads',
  table: 'leads',
  label: 'Lead',
  labelPlural: 'Leads',
  icon: 'UserPlus',
  updateKeys: ['id', 'email'],
  requiredColumns: ['empresa'],
  importOrder: 9,
  columns: [
    { key: 'id', label: 'ID', type: 'text', required: false, editable: false },
    { key: 'empresa', label: 'Empresa', type: 'text', required: true },
    { key: 'razao_social', label: 'Razão Social', type: 'text', required: false },
    { key: 'nome_fantasia', label: 'Nome Fantasia', type: 'text', required: false },
    { key: 'cnpj', label: 'CNPJ/CPF', type: 'text', required: false },
    { key: 'contato_nome', label: 'Nome do Contato', type: 'text', required: false },
    { key: 'cargo', label: 'Cargo', type: 'text', required: false },
    { key: 'email', label: 'E-mail', type: 'text', required: false },
    { key: 'email2', label: 'E-mail 2', type: 'text', required: false },
    { key: 'telefone', label: 'Telefone', type: 'text', required: false },
    { key: 'telefone2', label: 'Telefone 2', type: 'text', required: false },
    { key: 'whatsapp', label: 'WhatsApp', type: 'text', required: false },
    { key: 'site', label: 'Site', type: 'text', required: false },
    { key: 'endereco', label: 'Endereço', type: 'text', required: false },
    { key: 'bairro', label: 'Bairro', type: 'text', required: false },
    { key: 'cidade', label: 'Cidade', type: 'text', required: false },
    { key: 'uf', label: 'UF', type: 'text', required: false },
    { key: 'cep', label: 'CEP', type: 'text', required: false },
    { key: 'segmento', label: 'Segmento', type: 'text', required: false },
    { key: 'classificacao', label: 'Classificação', type: 'select', required: false, options: ['A', 'B', 'C'] },
    { key: 'status', label: 'Status', type: 'select', required: false, options: ['novo', 'contatado', 'em_contato', 'qualificado', 'proposta_enviada', 'negociacao', 'convertido', 'perdido', 'inativo', 'reativado', 'bloqueado', 'sem_interesse'] },
    { key: 'prioridade', label: 'Prioridade', type: 'select', required: false, options: ['A', 'B', 'C'] },
    { key: 'temperatura', label: 'Temperatura', type: 'select', required: false, options: ['frio', 'morno', 'quente'] },
    { key: 'score', label: 'Score', type: 'number', required: false },
    { key: 'valor_estimado', label: 'Valor Estimado', type: 'number', required: false },
    { key: 'origens', label: 'Origens', type: 'text', required: false },
    { key: 'observacoes', label: 'Observações', type: 'text', required: false },
  ],
  templateExamples: [
    { empresa: 'Loja das Flores', razao_social: 'Loja das Flores Ltda', cnpj: '12.345.678/0001-90', contato_nome: 'Maria Santos', email: 'maria@lojaflores.com.br', telefone: '+5511999991111', whatsapp: '+5511999991111', cidade: 'São Paulo', uf: 'SP', segmento: 'varejo', classificacao: 'B', status: 'novo', temperatura: 'quente' },
    { empresa: 'Rede Café Expresso', contato_nome: 'Carlos Lima', email: 'carlos@cafexpresso.com.br', telefone: '+5521988882222', cidade: 'Rio de Janeiro', uf: 'RJ', segmento: 'franquia', status: 'contatado', valor_estimado: '5000' },
    { empresa: 'Indústria Têxtil SA', contato_nome: 'Ana Costa', email: 'ana@textil.com.br', telefone: '+5531977773333', cidade: 'Belo Horizonte', uf: 'MG', segmento: 'industria', classificacao: 'A', status: 'qualificado', temperatura: 'morno' },
  ],
  bulkActions: [
    { field: 'status', label: 'Alterar Status', type: 'select', options: ['novo', 'contatado', 'em_contato', 'qualificado', 'proposta_enviada', 'negociacao', 'convertido', 'perdido', 'inativo', 'bloqueado'] },
    { field: 'temperatura', label: 'Alterar Temperatura', type: 'select', options: ['frio', 'morno', 'quente'] },
    { field: 'classificacao', label: 'Alterar Classificação', type: 'select', options: ['A', 'B', 'C'] },
    { field: 'prioridade', label: 'Alterar Prioridade', type: 'select', options: ['A', 'B', 'C'] },
  ],
};

registerEntity(leadsConfig);

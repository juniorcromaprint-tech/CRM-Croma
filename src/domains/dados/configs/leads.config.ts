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
    { key: 'contato_nome', label: 'Nome do Contato', type: 'text', required: false },
    { key: 'email', label: 'E-mail', type: 'text', required: false },
    { key: 'contato_email', label: 'E-mail do Contato', type: 'text', required: false },
    { key: 'telefone', label: 'Telefone', type: 'text', required: false },
    { key: 'contato_telefone', label: 'Telefone do Contato', type: 'text', required: false },
    { key: 'cargo', label: 'Cargo', type: 'text', required: false },
    { key: 'segmento', label: 'Segmento', type: 'select', required: false, options: ['varejo', 'franquia', 'industria', 'servicos', 'governo', 'outros'] },
    { key: 'status', label: 'Status', type: 'select', required: false, options: ['novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'] },
    { key: 'temperatura', label: 'Temperatura', type: 'select', required: false, options: ['frio', 'morno', 'quente'] },
    { key: 'score', label: 'Score', type: 'number', required: false },
    { key: 'valor_estimado', label: 'Valor Estimado', type: 'number', required: false },
    { key: 'observacoes', label: 'Observações', type: 'text', required: false },
  ],
  templateExamples: [
    { empresa: 'Loja das Flores', contato_nome: 'Maria Santos', email: 'maria@lojaflores.com.br', telefone: '(11) 9999-1111', segmento: 'varejo', status: 'novo', temperatura: 'quente' },
    { empresa: 'Rede Café Expresso', contato_nome: 'Carlos Lima', email: 'carlos@cafexpresso.com.br', telefone: '(21) 8888-2222', segmento: 'franquia', status: 'contato', valor_estimado: '5000' },
    { empresa: 'Indústria Têxtil SA', contato_nome: 'Ana Costa', email: 'ana@textil.com.br', telefone: '(31) 7777-3333', segmento: 'industria', status: 'qualificado', temperatura: 'morno' },
  ],
  bulkActions: [
    { field: 'status', label: 'Alterar Status', type: 'select', options: ['novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'] },
    { field: 'temperatura', label: 'Alterar Temperatura', type: 'select', options: ['frio', 'morno', 'quente'] },
    { field: 'segmento', label: 'Alterar Segmento', type: 'select', options: ['varejo', 'franquia', 'industria', 'servicos', 'governo', 'outros'] },
  ],
};

registerEntity(leadsConfig);

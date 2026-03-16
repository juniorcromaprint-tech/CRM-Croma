// src/domains/dados/configs/modelo-processos.config.ts
// The DB table uses UUID FK (modelo_id).
// For import/export, we use lookup codes (produto_codigo, modelo_nome)
// so users can work with human-readable identifiers. The import engine resolves UUIDs.
import { registerEntity, type EntityConfig } from './entity-registry';

export const modeloProcessosConfig: EntityConfig = {
  key: 'modelo-processos',
  table: 'modelo_processos',
  label: 'Processo do Modelo',
  labelPlural: 'Processos dos Modelos',
  icon: 'GitBranch',
  updateKeys: ['modelo_id+etapa'],
  requiredColumns: ['produto_codigo', 'modelo_nome', 'etapa'],
  importOrder: 7,
  columns: [
    { key: 'produto_codigo', label: 'Código do Produto', type: 'text', required: true, exportable: true },
    { key: 'modelo_nome', label: 'Nome do Modelo', type: 'text', required: true, exportable: true },
    { key: 'etapa', label: 'Etapa', type: 'text', required: true },
    { key: 'tempo_por_unidade_min', label: 'Tempo por Unidade (min)', type: 'number', required: false },
    { key: 'tipo_processo', label: 'Tipo de Processo', type: 'select', required: false, options: ['impressao', 'corte', 'acabamento', 'instalacao', 'montagem', 'expedicao'] },
    { key: 'ordem', label: 'Ordem', type: 'number', required: false },
  ],
  templateExamples: [
    { produto_codigo: 'BAN-001', modelo_nome: 'Banner Lona 380g P', etapa: 'Impressão', tempo_por_unidade_min: '10', tipo_processo: 'impressao', ordem: '1' },
    { produto_codigo: 'BAN-001', modelo_nome: 'Banner Lona 380g P', etapa: 'Acabamento', tempo_por_unidade_min: '5', tipo_processo: 'acabamento', ordem: '2' },
    { produto_codigo: 'FAC-001', modelo_nome: 'Fachada ACM Simples', etapa: 'Corte', tempo_por_unidade_min: '15', tipo_processo: 'corte', ordem: '1' },
  ],
  bulkActions: [
    { field: 'tipo_processo', label: 'Alterar Tipo de Processo', type: 'select', options: ['impressao', 'corte', 'acabamento', 'instalacao', 'montagem', 'expedicao'] },
    { field: 'tempo_por_unidade_min', label: 'Alterar Tempo por Unidade', type: 'number' },
  ],
};

registerEntity(modeloProcessosConfig);

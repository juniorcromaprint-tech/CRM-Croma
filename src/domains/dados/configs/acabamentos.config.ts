// src/domains/dados/configs/acabamentos.config.ts
import { registerEntity, type EntityConfig } from './entity-registry';

export const acabamentosConfig: EntityConfig = {
  key: 'acabamentos',
  table: 'acabamentos',
  label: 'Acabamento',
  labelPlural: 'Acabamentos',
  icon: 'Scissors',
  updateKeys: ['id', 'nome'],
  requiredColumns: ['nome'],
  importOrder: 3,
  columns: [
    { key: 'id', label: 'ID', type: 'text', required: false, editable: false },
    { key: 'nome', label: 'Nome', type: 'text', required: true },
    { key: 'descricao', label: 'Descrição', type: 'text', required: false },
    { key: 'custo_unitario', label: 'Custo Unitário', type: 'number', required: false },
    { key: 'unidade', label: 'Unidade', type: 'select', required: false, options: ['un', 'm', 'm²', 'par', 'conjunto'] },
    { key: 'ordem', label: 'Ordem', type: 'number', required: false },
    { key: 'ativo', label: 'Ativo', type: 'boolean', required: false },
  ],
  templateExamples: [
    { nome: 'Ilhós', descricao: 'Ilhós metálicos a cada 50cm', custo_unitario: '0.50', unidade: 'un', ativo: 'true' },
    { nome: 'Bastão', descricao: 'Bastão de alumínio para banners', custo_unitario: '8.00', unidade: 'un', ativo: 'true' },
    { nome: 'Laminação Fosca', descricao: 'Laminação fosca protetora', custo_unitario: '5.00', unidade: 'm²', ativo: 'true' },
  ],
  bulkActions: [
    { field: 'custo_unitario', label: 'Alterar Custo Unitário', type: 'number' },
    { field: 'ativo', label: 'Ativar/Inativar', type: 'boolean' },
  ],
};

registerEntity(acabamentosConfig);

// src/domains/dados/configs/servicos.config.ts
import { registerEntity, type EntityConfig } from './entity-registry';

export const servicosConfig: EntityConfig = {
  key: 'servicos',
  table: 'servicos',
  label: 'Serviço',
  labelPlural: 'Serviços',
  icon: 'Wrench',
  updateKeys: ['id', 'nome'],
  requiredColumns: ['nome'],
  importOrder: 4,
  columns: [
    { key: 'id', label: 'ID', type: 'text', required: false, editable: false },
    { key: 'nome', label: 'Nome', type: 'text', required: true },
    { key: 'descricao', label: 'Descrição', type: 'text', required: false },
    { key: 'categoria', label: 'Categoria', type: 'select', required: false, options: ['instalacao', 'arte', 'transporte', 'montagem', 'manutencao', 'outros'] },
    { key: 'custo_hora', label: 'Custo por Hora', type: 'number', required: false },
    { key: 'horas_estimadas', label: 'Horas Estimadas', type: 'number', required: false },
    { key: 'preco_fixo', label: 'Preço Fixo', type: 'number', required: false },
    { key: 'ativo', label: 'Ativo', type: 'boolean', required: false },
  ],
  templateExamples: [
    { nome: 'Instalação de Banner', descricao: 'Instalação de banner em local indicado', categoria: 'instalacao', custo_hora: '80.00', horas_estimadas: '2', ativo: 'true' },
    { nome: 'Criação de Arte', descricao: 'Criação de arte gráfica profissional', categoria: 'arte', custo_hora: '120.00', horas_estimadas: '3', ativo: 'true' },
    { nome: 'Frete Capital', descricao: 'Entrega na capital', categoria: 'transporte', preco_fixo: '50.00', ativo: 'true' },
  ],
  bulkActions: [
    { field: 'categoria', label: 'Alterar Categoria', type: 'select', options: ['instalacao', 'arte', 'transporte', 'montagem', 'manutencao', 'outros'] },
    { field: 'custo_hora', label: 'Alterar Custo/Hora', type: 'number' },
    { field: 'ativo', label: 'Ativar/Inativar', type: 'boolean' },
  ],
};

registerEntity(servicosConfig);

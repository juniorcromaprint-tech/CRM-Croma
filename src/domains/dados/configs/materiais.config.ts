// src/domains/dados/configs/materiais.config.ts
import { registerEntity, type EntityConfig } from './entity-registry';

export const materiaisConfig: EntityConfig = {
  key: 'materiais',
  table: 'materiais',
  label: 'Matéria-Prima',
  labelPlural: 'Matérias-Primas',
  icon: 'Package',
  updateKeys: ['id', 'codigo'],
  requiredColumns: ['nome', 'codigo'],
  importOrder: 2,
  columns: [
    { key: 'id', label: 'ID', type: 'text', required: false, editable: false },
    { key: 'codigo', label: 'Código', type: 'text', required: true },
    { key: 'nome', label: 'Nome', type: 'text', required: true },
    { key: 'categoria', label: 'Categoria', type: 'select', required: false, options: ['lona', 'vinil', 'papel', 'chapa', 'perfil', 'tinta', 'substrato', 'acessorio', 'outros'] },
    { key: 'unidade', label: 'Unidade', type: 'select', required: false, options: ['m²', 'm', 'un', 'kg', 'litro', 'rolo', 'folha', 'par', 'cx'] },
    { key: 'preco_medio', label: 'Preço Médio', type: 'number', required: false },
    { key: 'estoque_minimo', label: 'Estoque Mínimo', type: 'number', required: false },
    { key: 'aproveitamento', label: 'Aproveitamento (%)', type: 'number', required: false },
    { key: 'localizacao', label: 'Localização', type: 'text', required: false },
    { key: 'ncm', label: 'NCM', type: 'text', required: false },
    { key: 'venda_direta', label: 'Venda Direta', type: 'boolean', required: false },
    { key: 'ativo', label: 'Ativo', type: 'boolean', required: false },
  ],
  templateExamples: [
    { codigo: 'LONA-380G', nome: 'Lona Front 380g', categoria: 'lona', unidade: 'm²', preco_medio: '25.50', ativo: 'true' },
    { codigo: 'VINIL-ADH', nome: 'Vinil Adesivo Brilho', categoria: 'vinil', unidade: 'm²', preco_medio: '18.00', ativo: 'true' },
    { codigo: 'TINTA-ECO', nome: 'Tinta Eco-solvente Cyan', categoria: 'tinta', unidade: 'litro', preco_medio: '320.00', ativo: 'true' },
  ],
  bulkActions: [
    { field: 'categoria', label: 'Alterar Categoria', type: 'select', options: ['lona', 'vinil', 'papel', 'chapa', 'perfil', 'tinta', 'substrato', 'acessorio', 'outros'] },
    { field: 'preco_medio', label: 'Alterar Preço Médio', type: 'number' },
    { field: 'unidade', label: 'Alterar Unidade', type: 'select', options: ['m²', 'm', 'un', 'kg', 'litro', 'rolo', 'folha', 'par', 'cx'] },
    { field: 'ativo', label: 'Ativar/Inativar', type: 'boolean' },
  ],
};

registerEntity(materiaisConfig);

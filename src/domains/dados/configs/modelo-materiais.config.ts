// src/domains/dados/configs/modelo-materiais.config.ts
// The DB table uses UUID FKs (modelo_id, material_id).
// For import/export, we use lookup codes (produto_codigo, modelo_nome, material_codigo)
// so users can work with human-readable identifiers. The import engine resolves UUIDs.
import { registerEntity, type EntityConfig } from './entity-registry';

export const modeloMateriaisConfig: EntityConfig = {
  key: 'modelo-materiais',
  table: 'modelo_materiais',
  label: 'Material do Modelo',
  labelPlural: 'Materiais dos Modelos',
  icon: 'Link',
  updateKeys: ['modelo_id+material_id'],
  requiredColumns: ['produto_codigo', 'modelo_nome', 'material_codigo', 'quantidade_por_unidade'],
  importOrder: 6,
  columns: [
    { key: 'produto_codigo', label: 'Código do Produto', type: 'text', required: true, exportable: true },
    { key: 'modelo_nome', label: 'Nome do Modelo', type: 'text', required: true, exportable: true },
    { key: 'material_codigo', label: 'Código do Material', type: 'text', required: true, exportable: true },
    { key: 'quantidade_por_unidade', label: 'Quantidade por Unidade', type: 'number', required: true },
    { key: 'unidade', label: 'Unidade', type: 'select', required: false, options: ['m²', 'm', 'un', 'kg', 'litro', 'rolo', 'folha', 'par', 'cx'] },
    { key: 'tipo', label: 'Tipo', type: 'select', required: false, options: ['principal', 'auxiliar', 'acabamento'] },
  ],
  templateExamples: [
    { produto_codigo: 'BAN-001', modelo_nome: 'Banner Lona 380g P', material_codigo: 'LONA-380G', quantidade_por_unidade: '1', unidade: 'm²', tipo: 'principal' },
    { produto_codigo: 'BAN-001', modelo_nome: 'Banner Lona 380g P', material_codigo: 'TINTA-ECO', quantidade_por_unidade: '0.05', unidade: 'litro', tipo: 'auxiliar' },
    { produto_codigo: 'ADH-001', modelo_nome: 'Adesivo Brilho A4', material_codigo: 'VINIL-ADH', quantidade_por_unidade: '1', unidade: 'm²', tipo: 'principal' },
  ],
  bulkActions: [
    { field: 'tipo', label: 'Alterar Tipo', type: 'select', options: ['principal', 'auxiliar', 'acabamento'] },
    { field: 'quantidade_por_unidade', label: 'Alterar Quantidade por Unidade', type: 'number' },
  ],
};

registerEntity(modeloMateriaisConfig);

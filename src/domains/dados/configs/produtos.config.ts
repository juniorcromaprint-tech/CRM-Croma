// src/domains/dados/configs/produtos.config.ts
// Note: 'produtos' is the product family; 'produto_modelos' holds SKU-level details.
// This config targets the 'produtos' table (families/categories).
import { registerEntity, type EntityConfig } from './entity-registry';

export const produtosConfig: EntityConfig = {
  key: 'produtos',
  table: 'produtos',
  label: 'Produto',
  labelPlural: 'Produtos',
  icon: 'Box',
  updateKeys: ['id', 'codigo'],
  requiredColumns: ['nome', 'categoria'],
  importOrder: 5,
  columns: [
    { key: 'id', label: 'ID', type: 'text', required: false, editable: false },
    { key: 'codigo', label: 'Código', type: 'text', required: false },
    { key: 'nome', label: 'Nome', type: 'text', required: true },
    { key: 'categoria', label: 'Categoria', type: 'select', required: true, options: ['banner', 'adesivo', 'fachada', 'placa', 'letreiro', 'painel', 'totem', 'backdrop', 'pdv', 'envelopamento', 'outros'] },
    { key: 'descricao', label: 'Descrição', type: 'text', required: false },
    { key: 'markup_padrao', label: 'Markup Padrão (%)', type: 'number', required: false },
    { key: 'margem_minima', label: 'Margem Mínima (%)', type: 'number', required: false },
    { key: 'unidade_padrao', label: 'Unidade Padrão', type: 'select', required: false, options: ['m²', 'm', 'un', 'conjunto', 'par'] },
    { key: 'requer_instalacao', label: 'Requer Instalação', type: 'boolean', required: false },
    { key: 'ativo', label: 'Ativo', type: 'boolean', required: false },
  ],
  templateExamples: [
    { codigo: 'BAN-001', nome: 'Banner Lona', categoria: 'banner', markup_padrao: '150', unidade_padrao: 'm²', ativo: 'true' },
    { codigo: 'ADH-001', nome: 'Adesivo Vinil', categoria: 'adesivo', markup_padrao: '200', unidade_padrao: 'm²', ativo: 'true' },
    { codigo: 'FAC-001', nome: 'Fachada ACM', categoria: 'fachada', markup_padrao: '120', unidade_padrao: 'm²', requer_instalacao: 'true', ativo: 'true' },
  ],
  bulkActions: [
    { field: 'categoria', label: 'Alterar Categoria', type: 'select', options: ['banner', 'adesivo', 'fachada', 'placa', 'letreiro', 'painel', 'totem', 'backdrop', 'pdv', 'envelopamento', 'outros'] },
    { field: 'markup_padrao', label: 'Alterar Markup Padrão', type: 'number' },
    { field: 'ativo', label: 'Ativar/Inativar', type: 'boolean' },
  ],
};

registerEntity(produtosConfig);

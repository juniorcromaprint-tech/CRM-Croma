/**
 * catalogo.types.ts
 * Tipos TypeScript para o catálogo de produtos — refletem o schema real do banco.
 * Gerado em 2026-03-17 a partir de information_schema.columns.
 */

// ---------------------------------------------------------------------------
// categorias_produto
// ---------------------------------------------------------------------------
export interface CategoriaProduto {
  id: string;
  nome: string;
  slug: string | null;
  descricao: string | null;
  icone: string | null;
  ordem_exibicao: number | null;
  ativo: boolean;
  created_at: string;
  parent_id: string | null;
  cor: string | null;
  ordem: number | null;
  updated_at: string;
  // Relação hierárquica (populada em memória, não vem direto do banco)
  children?: CategoriaProduto[];
}

// ---------------------------------------------------------------------------
// produtos
// ---------------------------------------------------------------------------
export interface Produto {
  id: string;
  codigo: string;
  nome: string;
  /** Categoria legada (texto livre) — mantida para compatibilidade */
  categoria: string | null;
  descricao: string | null;
  unidade_padrao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  markup_padrao: number | null;
  margem_minima: number | null;
  /** FK para categorias_produto — adicionada na migration 041 */
  categoria_id: string | null;
  requer_instalacao: boolean | null;
  tipo_checklist_instalacao: string | null;
}

// ---------------------------------------------------------------------------
// produto_modelos
// ---------------------------------------------------------------------------
export interface ProdutoModelo {
  id: string;
  produto_id: string;
  nome: string;
  largura_cm: number | null;
  altura_cm: number | null;
  area_m2: number | null;
  markup_padrao: number | null;
  margem_minima: number | null;
  tempo_producao_min: number | null;
  ativo: boolean;
  created_at: string;
  linha_qualidade: string | null;
  descritivo_tecnico: string | null;
  descritivo_nf: string | null;
  garantia_meses: number | null;
  garantia_descricao: string | null;
  unidade_venda: string | null;
  updated_at: string;
  ncm: string | null;
  descricao_fiscal: string | null;
}

// ---------------------------------------------------------------------------
// materiais
// ---------------------------------------------------------------------------
export interface Material {
  id: string;
  codigo: string;
  nome: string;
  categoria: string | null;
  unidade: string;
  estoque_minimo: number | null;
  preco_medio: number | null;
  localizacao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  ncm: string | null;
  venda_direta: boolean | null;
  plano_contas_entrada: string | null;
  plano_contas_saida: string | null;
  data_referencia_preco: string | null;
  aproveitamento: number | null;
}

// ---------------------------------------------------------------------------
// modelo_materiais  (BOM — Bill of Materials)
// ---------------------------------------------------------------------------
export interface ModeloMaterial {
  id: string;
  modelo_id: string;
  material_id: string;
  quantidade_por_unidade: number;
  /** Unidade legada (coluna "unidade") */
  unidade: string | null;
  created_at: string;
  tipo: string | null;
  /** Percentual de desperdício esperado (ex: 0.10 = 10%) */
  percentual_desperdicio: number | null;
  /** Custo unitário calculado ou fixado */
  custo_unitario: number | null;
  /** Unidade de medida descritiva (coluna "unidade_medida") */
  unidade_medida: string | null;
}

// ---------------------------------------------------------------------------
// modelo_processos  (BOM — processos produtivos)
// ---------------------------------------------------------------------------
export interface ModeloProcesso {
  id: string;
  modelo_id: string;
  etapa: string;
  tempo_por_unidade_min: number;
  ordem: number | null;
  created_at: string;
  centro_custo_id: string | null;
  tipo_processo: string | null;
  /** Tempo de setup em minutos (fixo por lote) */
  tempo_setup_min: number | null;
  /** Custo unitário calculado ou fixado */
  custo_unitario: number | null;
  unidade_medida: string | null;
}

// ---------------------------------------------------------------------------
// View: v_produto_custo_completo
// ---------------------------------------------------------------------------
export interface ProdutoCustoCompleto {
  produto_id: string;
  modelo_id: string;
  produto_nome: string;
  modelo_nome: string;
  markup_padrao: number | null;
  margem_minima: number | null;
  custo_materiais: number | null;
  custo_processos: number | null;
  custo_total_bom: number | null;
  qtd_materiais: number | null;
  qtd_processos: number | null;
}

// ---------------------------------------------------------------------------
// View: v_material_sem_preco
// ---------------------------------------------------------------------------
export interface MaterialSemPreco {
  material_id: string;
  codigo: string;
  material_nome: string;
  categoria: string | null;
  unidade: string;
  preco_medio: number | null;
  qtd_modelos_afetados: number;
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export type CreateProdutoDto = Omit<Produto, 'id' | 'created_at' | 'updated_at'>;

export type UpdateProdutoDto = Partial<CreateProdutoDto>;

export type CreateModeloDto = Omit<ProdutoModelo, 'id' | 'created_at' | 'updated_at'>;

export type UpdateModeloDto = Partial<CreateModeloDto>;

export interface UpsertModeloMaterialDto {
  modelo_id: string;
  material_id: string;
  quantidade_por_unidade: number;
  unidade?: string | null;
  tipo?: string | null;
  percentual_desperdicio?: number | null;
  custo_unitario?: number | null;
  unidade_medida?: string | null;
}

export interface UpsertModeloProcessoDto {
  modelo_id: string;
  etapa: string;
  tempo_por_unidade_min: number;
  ordem?: number | null;
  centro_custo_id?: string | null;
  tipo_processo?: string | null;
  tempo_setup_min?: number | null;
  custo_unitario?: number | null;
  unidade_medida?: string | null;
}

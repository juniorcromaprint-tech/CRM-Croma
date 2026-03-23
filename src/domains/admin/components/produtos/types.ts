// ============================================================================
// ADMIN PRODUTOS — Shared Types
// ============================================================================

export interface Produto {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: string;
  descricao: string | null;
  unidade_padrao: string;
  ativo: boolean;
}

export interface ProdutoModelo {
  id: string;
  produto_id: string;
  nome: string;
  largura_cm: number | null;
  altura_cm: number | null;
  area_m2: number | null;
  markup_padrao: number;
  margem_minima: number;
  tempo_producao_min: number | null;
  ativo: boolean;
  ncm: string | null;
  descricao_fiscal: string | null;
  produto?: { nome: string; categoria: string } | null;
}

export interface ModeloMaterial {
  id: string;
  modelo_id: string;
  material_id: string;
  quantidade_por_unidade: number;
  unidade: string | null;
  material?: { nome: string; preco_medio: number | null };
}

export interface ModeloProcesso {
  id: string;
  modelo_id: string;
  etapa: string;
  tempo_por_unidade_min: number;
  ordem: number;
}

export interface Material {
  id: string;
  nome: string;
  unidade: string;
  preco_medio: number | null;
}

export interface MaterialSemPreco {
  id: string;
  codigo: string | null;
  nome: string;
  unidade: string;
  preco_medio: number | null;
}

export interface Acabamento {
  id: string;
  nome: string;
  custo_unitario: number;
  unidade: string;
  ativo: boolean;
  descricao: string | null;
}

export interface Servico {
  id: string;
  nome: string;
  categoria: string;
  custo_hora: number;
  preco_fixo: number | null;
  ativo: boolean;
  descricao: string | null;
}

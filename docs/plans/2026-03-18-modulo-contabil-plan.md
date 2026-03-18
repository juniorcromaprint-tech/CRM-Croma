# Módulo Contábil — Contabilidade Autônoma — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Model:** Use Sonnet para economizar tokens. Opus só se travar.

**Goal:** Automatizar 95% do trabalho contábil da Croma Print — calcular DAS do Simples Nacional, importar extratos bancários com classificação IA, gerar lançamentos contábeis automáticos (partida dobrada), balancete, razão e DEFIS.

**Architecture:** Novo domínio `contabilidade` seguindo o padrão existente (services/ + hooks/ + pages/ + components/ + types/). Motor contábil baseado em lançamentos de partida dobrada na tabela `lancamentos_contabeis`. Cada evento financeiro (CR pago, CP pago, DAS calculado) gera lançamento automático. Balancete e Razão são views/queries sobre lançamentos. Importador OFX usa parser client-side + classificação via Edge Function OpenRouter.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query v5 + Supabase (Postgres + Edge Functions) + OpenRouter (classificação IA) + Zod + Recharts

**Design doc:** `docs/plans/2026-03-18-modulo-contabil-design.md`

---

## Convenções do projeto (LEIA ANTES DE CODAR)

- **UI em português brasileiro** — todo texto visível ao usuário
- **Código em inglês** — variáveis, funções, tipos
- **Cards**: `rounded-2xl`, **Inputs**: `rounded-xl`
- **Cor primária**: `bg-blue-600 hover:bg-blue-700`
- **Toasts**: `showSuccess()` / `showError()` de `@/utils/toast.ts`
- **Formatação**: `brl()`, `formatDate()` de `@/shared/utils/format.ts`
- **Supabase**: `import { supabase } from '@/integrations/supabase/client'`
- **Rotas**: lazy loading com `LazyPage` wrapper em `src/routes/`
- **Domínio**: `src/domains/{dominio}/pages|hooks|components|services|types|schemas/`
- **Estado vazio**: card com ícone cinza + título + sugestão de ação

---

## Task 1: Migration — Expandir plano_contas + criar tabelas base

**Files:**
- Create: `supabase/migrations/070_modulo_contabil.sql`
- Modify: `src/integrations/supabase/types.ts` (regenerar depois da migration)

**Step 1: Escrever a migration SQL**

```sql
-- 070_modulo_contabil.sql
-- Módulo Contábil: lançamentos, DAS, extrato bancário, config tributária

-- 1. Expandir plano_contas para incluir ativo/passivo/patrimonio
ALTER TABLE plano_contas DROP CONSTRAINT IF EXISTS plano_contas_tipo_check;
ALTER TABLE plano_contas ADD CONSTRAINT plano_contas_tipo_check
  CHECK (tipo IN ('ativo', 'passivo', 'receita', 'despesa', 'patrimonio'));

-- 2. Tabela de lançamentos contábeis (partida dobrada)
CREATE TABLE lancamentos_contabeis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_lancamento DATE NOT NULL,
  data_competencia DATE NOT NULL,
  numero_lancamento SERIAL,
  conta_debito_id UUID NOT NULL REFERENCES plano_contas(id),
  conta_credito_id UUID NOT NULL REFERENCES plano_contas(id),
  valor NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  historico TEXT NOT NULL,
  origem_tipo VARCHAR(20) NOT NULL CHECK (origem_tipo IN ('conta_receber', 'conta_pagar', 'extrato', 'manual', 'das', 'pro_labore')),
  origem_id UUID,
  centro_custo_id UUID REFERENCES centros_custo(id),
  conciliado BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lancamentos_data ON lancamentos_contabeis(data_lancamento);
CREATE INDEX idx_lancamentos_competencia ON lancamentos_contabeis(data_competencia);
CREATE INDEX idx_lancamentos_debito ON lancamentos_contabeis(conta_debito_id);
CREATE INDEX idx_lancamentos_credito ON lancamentos_contabeis(conta_credito_id);
CREATE INDEX idx_lancamentos_origem ON lancamentos_contabeis(origem_tipo, origem_id);

-- RLS
ALTER TABLE lancamentos_contabeis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lancamentos_select_authenticated" ON lancamentos_contabeis
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lancamentos_insert_financeiro" ON lancamentos_contabeis
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro')
    )
    OR
    (SELECT is_admin())
  );

CREATE POLICY "lancamentos_update_financeiro" ON lancamentos_contabeis
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro')
    )
    OR
    (SELECT is_admin())
  );

-- 3. Tabela de apurações DAS
CREATE TABLE das_apuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia DATE NOT NULL UNIQUE,
  receita_bruta_mes NUMERIC(15,2) NOT NULL DEFAULT 0,
  rbt12 NUMERIC(15,2) NOT NULL DEFAULT 0,
  folha_pagamento_12m NUMERIC(15,2) NOT NULL DEFAULT 0,
  fator_r NUMERIC(5,4) NOT NULL DEFAULT 0,
  anexo VARCHAR(3) NOT NULL CHECK (anexo IN ('III', 'V')),
  faixa INTEGER NOT NULL CHECK (faixa BETWEEN 1 AND 6),
  aliquota_nominal NUMERIC(5,4) NOT NULL,
  deducao NUMERIC(15,2) NOT NULL DEFAULT 0,
  aliquota_efetiva NUMERIC(5,4) NOT NULL,
  valor_das NUMERIC(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'calculado' CHECK (status IN ('calculado', 'conferido', 'pago')),
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE das_apuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "das_select_authenticated" ON das_apuracoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "das_write_financeiro" ON das_apuracoes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro')
    )
    OR (SELECT is_admin())
  );

-- 4. Tabelas de extrato bancário
CREATE TABLE extrato_bancario_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco VARCHAR(50) NOT NULL,
  conta VARCHAR(30),
  arquivo_nome VARCHAR(255) NOT NULL,
  formato VARCHAR(10) NOT NULL CHECK (formato IN ('ofx', 'csv')),
  data_inicio DATE,
  data_fim DATE,
  total_registros INTEGER DEFAULT 0,
  total_classificados INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'importado' CHECK (status IN ('importado', 'classificando', 'classificado', 'lancado')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE extrato_bancario_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES extrato_bancario_importacoes(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  descricao_original TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('credito', 'debito')),
  conta_plano_id UUID REFERENCES plano_contas(id),
  centro_custo_id UUID REFERENCES centros_custo(id),
  confianca_ia NUMERIC(3,2),
  classificado_por VARCHAR(10) CHECK (classificado_por IN ('ia', 'usuario', 'regra')),
  lancamento_id UUID REFERENCES lancamentos_contabeis(id),
  conciliado_com_id UUID,
  conciliado_com_tipo VARCHAR(20),
  ignorado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_extrato_itens_importacao ON extrato_bancario_itens(importacao_id);
CREATE INDEX idx_extrato_itens_data ON extrato_bancario_itens(data);

ALTER TABLE extrato_bancario_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE extrato_bancario_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extrato_imp_select" ON extrato_bancario_importacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "extrato_imp_write" ON extrato_bancario_importacoes
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor', 'financeiro'))
    OR (SELECT is_admin())
  );

CREATE POLICY "extrato_itens_select" ON extrato_bancario_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "extrato_itens_write" ON extrato_bancario_itens
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor', 'financeiro'))
    OR (SELECT is_admin())
  );

-- 5. Regras de classificação automática
CREATE TABLE extrato_regras_classificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  padrao TEXT NOT NULL,
  tipo_match VARCHAR(15) DEFAULT 'contains' CHECK (tipo_match IN ('contains', 'starts_with', 'exact')),
  conta_plano_id UUID NOT NULL REFERENCES plano_contas(id),
  centro_custo_id UUID REFERENCES centros_custo(id),
  vezes_usado INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE extrato_regras_classificacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regras_class_select" ON extrato_regras_classificacao
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "regras_class_write" ON extrato_regras_classificacao
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor', 'financeiro'))
    OR (SELECT is_admin())
  );

-- 6. Configuração tributária
CREATE TABLE config_tributaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regime VARCHAR(20) NOT NULL DEFAULT 'simples_nacional',
  pro_labore_mensal NUMERIC(15,2) NOT NULL DEFAULT 0,
  inss_pro_labore_percentual NUMERIC(5,2) DEFAULT 11.00,
  cnae_principal VARCHAR(10),
  anexo_padrao VARCHAR(3) DEFAULT 'V',
  observacoes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE config_tributaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_trib_select" ON config_tributaria
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_trib_write" ON config_tributaria
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor'))
    OR (SELECT is_admin())
  );

-- Seed config tributária padrão
INSERT INTO config_tributaria (regime, pro_labore_mensal, anexo_padrao)
VALUES ('simples_nacional', 0, 'V');

-- 7. Seed plano de contas — contas de ativo/passivo/patrimônio
-- Atualizar contas existentes de receita/despesa mantendo os dados

-- Ativo
INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza) VALUES
('1', 'ATIVO', NULL, 'ativo', 'sintetica'),
('1.1', 'Ativo Circulante', (SELECT id FROM plano_contas WHERE codigo = '1'), 'ativo', 'sintetica'),
('1.1.01', 'Caixa', (SELECT id FROM plano_contas WHERE codigo = '1.1'), 'ativo', 'analitica'),
('1.1.02', 'Banco Itaú', (SELECT id FROM plano_contas WHERE codigo = '1.1'), 'ativo', 'analitica'),
('1.1.03', 'Clientes a Receber', (SELECT id FROM plano_contas WHERE codigo = '1.1'), 'ativo', 'analitica'),
('1.2', 'Ativo Não Circulante', (SELECT id FROM plano_contas WHERE codigo = '1'), 'ativo', 'sintetica'),
('1.2.01', 'Imobilizado', (SELECT id FROM plano_contas WHERE codigo = '1.2'), 'ativo', 'analitica');

-- Passivo
INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza) VALUES
('2', 'PASSIVO', NULL, 'passivo', 'sintetica'),
('2.1', 'Passivo Circulante', (SELECT id FROM plano_contas WHERE codigo = '2'), 'passivo', 'sintetica'),
('2.1.01', 'Fornecedores a Pagar', (SELECT id FROM plano_contas WHERE codigo = '2.1'), 'passivo', 'analitica'),
('2.1.02', 'DAS a Pagar', (SELECT id FROM plano_contas WHERE codigo = '2.1'), 'passivo', 'analitica'),
('2.1.03', 'Comissões a Pagar', (SELECT id FROM plano_contas WHERE codigo = '2.1'), 'passivo', 'analitica'),
('2.1.04', 'Pró-labore a Pagar', (SELECT id FROM plano_contas WHERE codigo = '2.1'), 'passivo', 'analitica');

-- Patrimônio Líquido
INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza) VALUES
('2.2', 'Patrimônio Líquido', (SELECT id FROM plano_contas WHERE codigo = '2'), 'patrimonio', 'sintetica'),
('2.2.01', 'Capital Social', (SELECT id FROM plano_contas WHERE codigo = '2.2'), 'patrimonio', 'analitica'),
('2.2.02', 'Lucros Acumulados', (SELECT id FROM plano_contas WHERE codigo = '2.2'), 'patrimonio', 'analitica');

-- 8. Views para balancete e razão
CREATE OR REPLACE VIEW v_balancete AS
SELECT
  pc.id AS conta_id,
  pc.codigo,
  pc.nome,
  pc.tipo,
  pc.natureza,
  lc.data_competencia,
  COALESCE(SUM(CASE WHEN lc.conta_debito_id = pc.id THEN lc.valor ELSE 0 END), 0) AS total_debitos,
  COALESCE(SUM(CASE WHEN lc.conta_credito_id = pc.id THEN lc.valor ELSE 0 END), 0) AS total_creditos,
  COALESCE(SUM(CASE WHEN lc.conta_debito_id = pc.id THEN lc.valor ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN lc.conta_credito_id = pc.id THEN lc.valor ELSE 0 END), 0) AS saldo
FROM plano_contas pc
LEFT JOIN lancamentos_contabeis lc
  ON lc.conta_debito_id = pc.id OR lc.conta_credito_id = pc.id
WHERE pc.natureza = 'analitica'
GROUP BY pc.id, pc.codigo, pc.nome, pc.tipo, pc.natureza, lc.data_competencia;
```

**Step 2: Executar a migration no Supabase**

Abrir `https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql` e colar o SQL.

**Step 3: Regenerar types do Supabase**

Run: `npx supabase gen types typescript --project-id djwjmfgplnqyffdcgdaw > src/integrations/supabase/types.ts`

Se o CLI do Supabase não estiver instalado, adicionar os tipos manualmente no `types.ts`.

**Step 4: Commit**

```bash
git add supabase/migrations/070_modulo_contabil.sql src/integrations/supabase/types.ts
git commit -m "feat(contabilidade): add migration 070 - lancamentos, DAS, extrato, config tributaria"
```

---

## Task 2: Types + Services base do domínio contabilidade

**Files:**
- Create: `src/domains/contabilidade/types/contabilidade.types.ts`
- Create: `src/domains/contabilidade/services/lancamento.service.ts`
- Create: `src/domains/contabilidade/services/das-simples.service.ts`

**Step 1: Criar types**

```typescript
// src/domains/contabilidade/types/contabilidade.types.ts

export interface LancamentoContabil {
  id: string;
  data_lancamento: string;
  data_competencia: string;
  numero_lancamento: number;
  conta_debito_id: string;
  conta_credito_id: string;
  valor: number;
  historico: string;
  origem_tipo: OrigemTipo;
  origem_id: string | null;
  centro_custo_id: string | null;
  conciliado: boolean;
  created_by: string | null;
  created_at: string;
  // joins
  conta_debito?: { codigo: string; nome: string };
  conta_credito?: { codigo: string; nome: string };
  centro_custo?: { codigo: string; nome: string };
}

export type OrigemTipo = 'conta_receber' | 'conta_pagar' | 'extrato' | 'manual' | 'das' | 'pro_labore';

export interface DASApuracao {
  id: string;
  competencia: string;
  receita_bruta_mes: number;
  rbt12: number;
  folha_pagamento_12m: number;
  fator_r: number;
  anexo: 'III' | 'V';
  faixa: number;
  aliquota_nominal: number;
  deducao: number;
  aliquota_efetiva: number;
  valor_das: number;
  data_vencimento: string;
  status: 'calculado' | 'conferido' | 'pago';
  data_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface ConfigTributaria {
  id: string;
  regime: string;
  pro_labore_mensal: number;
  inss_pro_labore_percentual: number;
  cnae_principal: string | null;
  anexo_padrao: 'III' | 'V';
  observacoes: string | null;
  updated_at: string;
}

export interface ExtratoImportacao {
  id: string;
  banco: string;
  conta: string | null;
  arquivo_nome: string;
  formato: 'ofx' | 'csv';
  data_inicio: string | null;
  data_fim: string | null;
  total_registros: number;
  total_classificados: number;
  status: 'importado' | 'classificando' | 'classificado' | 'lancado';
  created_at: string;
}

export interface ExtratoItem {
  id: string;
  importacao_id: string;
  data: string;
  descricao_original: string;
  valor: number;
  tipo: 'credito' | 'debito';
  conta_plano_id: string | null;
  centro_custo_id: string | null;
  confianca_ia: number | null;
  classificado_por: 'ia' | 'usuario' | 'regra' | null;
  lancamento_id: string | null;
  conciliado_com_id: string | null;
  conciliado_com_tipo: string | null;
  ignorado: boolean;
  created_at: string;
  // joins
  conta_plano?: { codigo: string; nome: string };
}

export interface RegraClassificacao {
  id: string;
  padrao: string;
  tipo_match: 'contains' | 'starts_with' | 'exact';
  conta_plano_id: string;
  centro_custo_id: string | null;
  vezes_usado: number;
  ativo: boolean;
  created_at: string;
  // joins
  conta_plano?: { codigo: string; nome: string };
}

export interface BalanceteRow {
  conta_id: string;
  codigo: string;
  nome: string;
  tipo: string;
  natureza: string;
  total_debitos: number;
  total_creditos: number;
  saldo: number;
}

export interface RazaoRow {
  id: string;
  data_lancamento: string;
  historico: string;
  debito: number;
  credito: number;
  saldo_acumulado: number;
}

// Tabelas do Simples Nacional
export interface FaixaSimples {
  faixa: number;
  limiteInferior: number;
  limiteSuperior: number;
  aliquota: number;
  deducao: number;
}

export const ANEXO_III: FaixaSimples[] = [
  { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquota: 0.06, deducao: 0 },
  { faixa: 2, limiteInferior: 180000, limiteSuperior: 360000, aliquota: 0.112, deducao: 9360 },
  { faixa: 3, limiteInferior: 360000, limiteSuperior: 720000, aliquota: 0.135, deducao: 17640 },
  { faixa: 4, limiteInferior: 720000, limiteSuperior: 1800000, aliquota: 0.16, deducao: 35640 },
  { faixa: 5, limiteInferior: 1800000, limiteSuperior: 3600000, aliquota: 0.21, deducao: 125640 },
  { faixa: 6, limiteInferior: 3600000, limiteSuperior: 4800000, aliquota: 0.33, deducao: 648000 },
];

export const ANEXO_V: FaixaSimples[] = [
  { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquota: 0.155, deducao: 0 },
  { faixa: 2, limiteInferior: 180000, limiteSuperior: 360000, aliquota: 0.18, deducao: 4500 },
  { faixa: 3, limiteInferior: 360000, limiteSuperior: 720000, aliquota: 0.195, deducao: 9900 },
  { faixa: 4, limiteInferior: 720000, limiteSuperior: 1800000, aliquota: 0.205, deducao: 17100 },
  { faixa: 5, limiteInferior: 1800000, limiteSuperior: 3600000, aliquota: 0.23, deducao: 62100 },
  { faixa: 6, limiteInferior: 3600000, limiteSuperior: 4800000, aliquota: 0.305, deducao: 540000 },
];

export const FATOR_R_THRESHOLD = 0.28;
```

**Step 2: Criar serviço de lançamentos**

```typescript
// src/domains/contabilidade/services/lancamento.service.ts

import { supabase } from '@/integrations/supabase/client';
import type { LancamentoContabil, OrigemTipo } from '../types/contabilidade.types';

interface CreateLancamentoInput {
  data_lancamento: string;
  data_competencia: string;
  conta_debito_id: string;
  conta_credito_id: string;
  valor: number;
  historico: string;
  origem_tipo: OrigemTipo;
  origem_id?: string;
  centro_custo_id?: string;
}

export async function createLancamento(input: CreateLancamentoInput) {
  const { data, error } = await supabase
    .from('lancamentos_contabeis')
    .insert({
      data_lancamento: input.data_lancamento,
      data_competencia: input.data_competencia,
      conta_debito_id: input.conta_debito_id,
      conta_credito_id: input.conta_credito_id,
      valor: input.valor,
      historico: input.historico,
      origem_tipo: input.origem_tipo,
      origem_id: input.origem_id || null,
      centro_custo_id: input.centro_custo_id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createLancamentosBatch(inputs: CreateLancamentoInput[]) {
  const { data, error } = await supabase
    .from('lancamentos_contabeis')
    .insert(inputs.map(i => ({
      data_lancamento: i.data_lancamento,
      data_competencia: i.data_competencia,
      conta_debito_id: i.conta_debito_id,
      conta_credito_id: i.conta_credito_id,
      valor: i.valor,
      historico: i.historico,
      origem_tipo: i.origem_tipo,
      origem_id: i.origem_id || null,
      centro_custo_id: i.centro_custo_id || null,
    })))
    .select();

  if (error) throw error;
  return data;
}

export async function fetchLancamentos(filters: {
  dataInicio?: string;
  dataFim?: string;
  contaId?: string;
  origemTipo?: OrigemTipo;
  page?: number;
  pageSize?: number;
}) {
  const { dataInicio, dataFim, contaId, origemTipo, page = 1, pageSize = 50 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('lancamentos_contabeis')
    .select(`
      *,
      conta_debito:plano_contas!lancamentos_contabeis_conta_debito_id_fkey(codigo, nome),
      conta_credito:plano_contas!lancamentos_contabeis_conta_credito_id_fkey(codigo, nome),
      centro_custo:centros_custo(codigo, nome)
    `, { count: 'exact' })
    .order('data_lancamento', { ascending: false })
    .range(from, to);

  if (dataInicio) query = query.gte('data_competencia', dataInicio);
  if (dataFim) query = query.lte('data_competencia', dataFim);
  if (contaId) query = query.or(`conta_debito_id.eq.${contaId},conta_credito_id.eq.${contaId}`);
  if (origemTipo) query = query.eq('origem_tipo', origemTipo);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as LancamentoContabil[], count: count || 0 };
}

// Buscar contas analíticas do plano para selects
export async function fetchContasAnaliticas() {
  const { data, error } = await supabase
    .from('plano_contas')
    .select('id, codigo, nome, tipo')
    .eq('natureza', 'analitica')
    .eq('ativo', true)
    .order('codigo');

  if (error) throw error;
  return data;
}
```

**Step 3: Criar serviço DAS do Simples Nacional**

```typescript
// src/domains/contabilidade/services/das-simples.service.ts

import { supabase } from '@/integrations/supabase/client';
import {
  ANEXO_III,
  ANEXO_V,
  FATOR_R_THRESHOLD,
  type DASApuracao,
  type FaixaSimples,
} from '../types/contabilidade.types';

function findFaixa(rbt12: number, tabela: FaixaSimples[]): FaixaSimples {
  for (const f of tabela) {
    if (rbt12 <= f.limiteSuperior) return f;
  }
  return tabela[tabela.length - 1];
}

function calcAliquotaEfetiva(rbt12: number, aliquotaNominal: number, deducao: number): number {
  if (rbt12 === 0) return 0;
  return (rbt12 * aliquotaNominal - deducao) / rbt12;
}

export interface DASCalculo {
  competencia: string;
  receita_bruta_mes: number;
  rbt12: number;
  folha_pagamento_12m: number;
  fator_r: number;
  anexo: 'III' | 'V';
  faixa: number;
  aliquota_nominal: number;
  deducao: number;
  aliquota_efetiva: number;
  valor_das: number;
  data_vencimento: string;
}

export async function calcularDAS(competenciaDate: string): Promise<DASCalculo> {
  // 1. Buscar config tributária
  const { data: config } = await supabase
    .from('config_tributaria')
    .select('*')
    .limit(1)
    .single();

  const proLaboreMensal = config?.pro_labore_mensal || 0;

  // 2. Buscar receita bruta do mês (CR pagos no mês de competência)
  const mesInicio = competenciaDate; // ex: '2026-03-01'
  const mesFim = new Date(new Date(competenciaDate).getFullYear(), new Date(competenciaDate).getMonth() + 1, 0)
    .toISOString().split('T')[0]; // último dia do mês

  const { data: crMes } = await supabase
    .from('contas_receber')
    .select('valor_pago')
    .eq('status', 'pago')
    .gte('data_pagamento', mesInicio)
    .lte('data_pagamento', mesFim)
    .is('excluido_em', null);

  const receitaBrutaMes = (crMes || []).reduce((sum, cr) => sum + (cr.valor_pago || 0), 0);

  // 3. Calcular RBT12 (últimos 12 meses incluindo o atual)
  const inicio12m = new Date(new Date(competenciaDate).getFullYear() - 1, new Date(competenciaDate).getMonth() + 1, 1)
    .toISOString().split('T')[0];

  const { data: cr12m } = await supabase
    .from('contas_receber')
    .select('valor_pago')
    .eq('status', 'pago')
    .gte('data_pagamento', inicio12m)
    .lte('data_pagamento', mesFim)
    .is('excluido_em', null);

  const rbt12 = (cr12m || []).reduce((sum, cr) => sum + (cr.valor_pago || 0), 0);

  // 4. Calcular folha 12m (pró-labore × meses)
  const folhaPagamento12m = proLaboreMensal * 12;

  // 5. Fator R
  const fatorR = rbt12 > 0 ? folhaPagamento12m / rbt12 : 0;

  // 6. Determinar anexo
  const anexo: 'III' | 'V' = fatorR >= FATOR_R_THRESHOLD ? 'III' : 'V';
  const tabela = anexo === 'III' ? ANEXO_III : ANEXO_V;

  // 7. Determinar faixa
  const faixa = findFaixa(rbt12, tabela);

  // 8. Calcular alíquota efetiva
  const aliquotaEfetiva = calcAliquotaEfetiva(rbt12, faixa.aliquota, faixa.deducao);

  // 9. Calcular DAS
  const valorDas = receitaBrutaMes * aliquotaEfetiva;

  // 10. Data vencimento (dia 20 do mês seguinte)
  const compDate = new Date(competenciaDate);
  const vencimento = new Date(compDate.getFullYear(), compDate.getMonth() + 1, 20)
    .toISOString().split('T')[0];

  return {
    competencia: competenciaDate,
    receita_bruta_mes: receitaBrutaMes,
    rbt12,
    folha_pagamento_12m: folhaPagamento12m,
    fator_r: fatorR,
    anexo,
    faixa: faixa.faixa,
    aliquota_nominal: faixa.aliquota,
    deducao: faixa.deducao,
    aliquota_efetiva: aliquotaEfetiva,
    valor_das: Math.round(valorDas * 100) / 100,
    data_vencimento: vencimento,
  };
}

export async function salvarDAS(calculo: DASCalculo): Promise<DASApuracao> {
  const { data, error } = await supabase
    .from('das_apuracoes')
    .upsert({
      competencia: calculo.competencia,
      receita_bruta_mes: calculo.receita_bruta_mes,
      rbt12: calculo.rbt12,
      folha_pagamento_12m: calculo.folha_pagamento_12m,
      fator_r: calculo.fator_r,
      anexo: calculo.anexo,
      faixa: calculo.faixa,
      aliquota_nominal: calculo.aliquota_nominal,
      deducao: calculo.deducao,
      aliquota_efetiva: calculo.aliquota_efetiva,
      valor_das: calculo.valor_das,
      data_vencimento: calculo.data_vencimento,
      status: 'calculado',
    }, { onConflict: 'competencia' })
    .select()
    .single();

  if (error) throw error;
  return data as DASApuracao;
}

export async function fetchDASHistorico(ano?: number) {
  let query = supabase
    .from('das_apuracoes')
    .select('*')
    .order('competencia', { ascending: false });

  if (ano) {
    query = query
      .gte('competencia', `${ano}-01-01`)
      .lte('competencia', `${ano}-12-31`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as DASApuracao[];
}

export async function marcarDASPago(id: string, dataPagamento: string) {
  const { error } = await supabase
    .from('das_apuracoes')
    .update({ status: 'pago', data_pagamento: dataPagamento })
    .eq('id', id);

  if (error) throw error;
}

// Alertas tributários
export interface AlertaTributario {
  tipo: 'faixa' | 'fator_r' | 'limite_simples' | 'economia';
  severidade: 'info' | 'warning' | 'danger';
  titulo: string;
  descricao: string;
}

export function gerarAlertas(calculo: DASCalculo, configProLabore: number): AlertaTributario[] {
  const alertas: AlertaTributario[] = [];

  // Alerta: Fator R próximo de 28%
  if (calculo.fator_r >= 0.24 && calculo.fator_r < FATOR_R_THRESHOLD) {
    const faltaPercent = (FATOR_R_THRESHOLD - calculo.fator_r) * 100;
    alertas.push({
      tipo: 'fator_r',
      severidade: 'warning',
      titulo: `Fator R em ${(calculo.fator_r * 100).toFixed(1)}% — faltam ${faltaPercent.toFixed(1)}% para Anexo III`,
      descricao: `Se aumentar o pró-labore, o Fator R pode atingir 28% e migrar para o Anexo III com alíquota menor.`,
    });
  }

  // Alerta: já no Anexo III
  if (calculo.anexo === 'III') {
    alertas.push({
      tipo: 'economia',
      severidade: 'info',
      titulo: 'Enquadrado no Anexo III — alíquota mais favorável',
      descricao: `Fator R em ${(calculo.fator_r * 100).toFixed(1)}%. Manter pró-labore acima de 28% do faturamento.`,
    });
  }

  // Alerta: simulação de economia
  if (calculo.anexo === 'V' && calculo.rbt12 > 0) {
    const proLaboreNecessario = calculo.rbt12 * FATOR_R_THRESHOLD / 12;
    const diferencaMensal = proLaboreNecessario - configProLabore;
    if (diferencaMensal > 0 && diferencaMensal < 5000) {
      // Calcular economia
      const faixaIII = findFaixa(calculo.rbt12, ANEXO_III);
      const aliqEfIII = calcAliquotaEfetiva(calculo.rbt12, faixaIII.aliquota, faixaIII.deducao);
      const economiaAnual = (calculo.aliquota_efetiva - aliqEfIII) * calculo.rbt12;
      if (economiaAnual > 0) {
        alertas.push({
          tipo: 'economia',
          severidade: 'info',
          titulo: `Economia potencial: R$ ${economiaAnual.toFixed(0)}/ano`,
          descricao: `Se pró-labore subir R$ ${diferencaMensal.toFixed(0)}/mês (para R$ ${proLaboreNecessario.toFixed(0)}), migra pro Anexo III. Economia de R$ ${(economiaAnual / 12).toFixed(0)}/mês em impostos.`,
        });
      }
    }
  }

  // Alerta: mudança de faixa iminente
  const faixaAtual = findFaixa(calculo.rbt12, calculo.anexo === 'III' ? ANEXO_III : ANEXO_V);
  const margemFaixa = faixaAtual.limiteSuperior - calculo.rbt12;
  if (margemFaixa < 20000 && margemFaixa > 0 && faixaAtual.faixa < 6) {
    alertas.push({
      tipo: 'faixa',
      severidade: 'warning',
      titulo: `Próximo de mudar para faixa ${faixaAtual.faixa + 1}`,
      descricao: `RBT12 está a R$ ${margemFaixa.toFixed(0)} do limite da faixa ${faixaAtual.faixa}. Alíquota pode subir.`,
    });
  }

  // Alerta: limite do Simples
  if (calculo.rbt12 > 4200000) {
    alertas.push({
      tipo: 'limite_simples',
      severidade: 'danger',
      titulo: 'Atenção: próximo do limite do Simples Nacional',
      descricao: `RBT12 de R$ ${calculo.rbt12.toFixed(0)} — limite é R$ 4.800.000. Considerar planejamento tributário.`,
    });
  }

  return alertas;
}
```

**Step 4: Commit**

```bash
git add src/domains/contabilidade/
git commit -m "feat(contabilidade): add types, lancamento service, DAS simples service"
```

---

## Task 3: Parser OFX + Serviço de extrato bancário

**Files:**
- Create: `src/domains/contabilidade/services/ofx-parser.service.ts`
- Create: `src/domains/contabilidade/services/extrato-bancario.service.ts`
- Create: `src/domains/contabilidade/services/classificacao.service.ts`

**Step 1: Parser OFX (client-side)**

O formato OFX é XML-like. O Itaú exporta OFX 2.0. O parser extrai `<STMTTRN>` (transações).

```typescript
// src/domains/contabilidade/services/ofx-parser.service.ts

export interface OFXTransaction {
  trntype: string;      // DEBIT, CREDIT, XFER, etc.
  dtposted: string;     // YYYYMMDD
  trnamt: number;       // valor (negativo = débito)
  fitid: string;        // ID único da transação
  memo: string;         // descrição
}

export interface OFXResult {
  bankId: string;
  acctId: string;
  dtStart: string;
  dtEnd: string;
  transactions: OFXTransaction[];
}

export function parseOFX(content: string): OFXResult {
  // OFX pode ter header SGML antes do XML
  const xmlStart = content.indexOf('<OFX>');
  const xml = xmlStart >= 0 ? content.substring(xmlStart) : content;

  // Extrair info da conta
  const bankId = extractTag(xml, 'BANKID') || '';
  const acctId = extractTag(xml, 'ACCTID') || '';
  const dtStart = extractTag(xml, 'DTSTART') || '';
  const dtEnd = extractTag(xml, 'DTEND') || '';

  // Extrair transações
  const transactions: OFXTransaction[] = [];
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = trnRegex.exec(xml)) !== null) {
    const block = match[1];
    const trnamt = parseFloat(extractTag(block, 'TRNAMT') || '0');

    transactions.push({
      trntype: extractTag(block, 'TRNTYPE') || 'OTHER',
      dtposted: extractTag(block, 'DTPOSTED')?.substring(0, 8) || '',
      trnamt,
      fitid: extractTag(block, 'FITID') || '',
      memo: extractTag(block, 'MEMO') || extractTag(block, 'NAME') || '',
    });
  }

  return { bankId, acctId, dtStart: formatOFXDate(dtStart), dtEnd: formatOFXDate(dtEnd), transactions };
}

function extractTag(xml: string, tag: string): string | null {
  // OFX tags podem não ter closing tag (SGML style)
  const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function formatOFXDate(d: string): string {
  if (!d || d.length < 8) return '';
  return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
}
```

**Step 2: Serviço de extrato bancário**

```typescript
// src/domains/contabilidade/services/extrato-bancario.service.ts

import { supabase } from '@/integrations/supabase/client';
import { parseOFX, type OFXTransaction } from './ofx-parser.service';
import type { ExtratoImportacao, ExtratoItem } from '../types/contabilidade.types';

export async function importarOFX(file: File): Promise<{ importacao: ExtratoImportacao; itens: ExtratoItem[] }> {
  const content = await file.text();
  const result = parseOFX(content);

  // 1. Criar registro de importação
  const { data: importacao, error: impError } = await supabase
    .from('extrato_bancario_importacoes')
    .insert({
      banco: result.bankId || 'Itaú',
      conta: result.acctId,
      arquivo_nome: file.name,
      formato: 'ofx',
      data_inicio: result.dtStart,
      data_fim: result.dtEnd,
      total_registros: result.transactions.length,
      status: 'importado',
    })
    .select()
    .single();

  if (impError) throw impError;

  // 2. Inserir itens
  const itensToInsert = result.transactions.map((trn: OFXTransaction) => ({
    importacao_id: importacao.id,
    data: formatOFXDate(trn.dtposted),
    descricao_original: trn.memo,
    valor: trn.trnamt,
    tipo: trn.trnamt >= 0 ? 'credito' as const : 'debito' as const,
  }));

  const { data: itens, error: itensError } = await supabase
    .from('extrato_bancario_itens')
    .insert(itensToInsert)
    .select();

  if (itensError) throw itensError;

  return { importacao: importacao as ExtratoImportacao, itens: itens as ExtratoItem[] };
}

function formatOFXDate(d: string): string {
  if (!d || d.length < 8) return '';
  return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
}

export async function fetchImportacoes() {
  const { data, error } = await supabase
    .from('extrato_bancario_importacoes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ExtratoImportacao[];
}

export async function fetchExtratoItens(importacaoId: string) {
  const { data, error } = await supabase
    .from('extrato_bancario_itens')
    .select(`
      *,
      conta_plano:plano_contas(codigo, nome)
    `)
    .eq('importacao_id', importacaoId)
    .order('data', { ascending: true });

  if (error) throw error;
  return data as ExtratoItem[];
}

export async function classificarItem(itemId: string, contaPlanoId: string, centroCustoId?: string) {
  const { error } = await supabase
    .from('extrato_bancario_itens')
    .update({
      conta_plano_id: contaPlanoId,
      centro_custo_id: centroCustoId || null,
      classificado_por: 'usuario',
    })
    .eq('id', itemId);

  if (error) throw error;
}

export async function ignorarItem(itemId: string) {
  const { error } = await supabase
    .from('extrato_bancario_itens')
    .update({ ignorado: true })
    .eq('id', itemId);

  if (error) throw error;
}

export async function gerarLancamentosFromExtrato(importacaoId: string) {
  // Buscar itens classificados e não ignorados
  const { data: itens, error } = await supabase
    .from('extrato_bancario_itens')
    .select('*')
    .eq('importacao_id', importacaoId)
    .eq('ignorado', false)
    .not('conta_plano_id', 'is', null)
    .is('lancamento_id', null);

  if (error) throw error;
  if (!itens || itens.length === 0) return [];

  // Buscar conta do banco Itaú
  const { data: contaBanco } = await supabase
    .from('plano_contas')
    .select('id')
    .eq('codigo', '1.1.02')
    .single();

  if (!contaBanco) throw new Error('Conta "1.1.02 Banco Itaú" não encontrada no plano de contas');

  // Gerar lançamentos
  const lancamentos = itens.map(item => {
    const isCredito = item.valor >= 0;
    const valorAbs = Math.abs(item.valor);

    return {
      data_lancamento: item.data,
      data_competencia: item.data.substring(0, 7) + '-01', // primeiro dia do mês
      conta_debito_id: isCredito ? contaBanco.id : item.conta_plano_id!,
      conta_credito_id: isCredito ? item.conta_plano_id! : contaBanco.id,
      valor: valorAbs,
      historico: `Extrato: ${item.descricao_original}`,
      origem_tipo: 'extrato' as const,
      origem_id: item.id,
      centro_custo_id: item.centro_custo_id,
    };
  });

  const { data: created, error: createError } = await supabase
    .from('lancamentos_contabeis')
    .insert(lancamentos)
    .select();

  if (createError) throw createError;

  // Atualizar itens com lancamento_id
  for (let i = 0; i < itens.length; i++) {
    if (created[i]) {
      await supabase
        .from('extrato_bancario_itens')
        .update({ lancamento_id: created[i].id })
        .eq('id', itens[i].id);
    }
  }

  // Atualizar status da importação
  await supabase
    .from('extrato_bancario_importacoes')
    .update({ status: 'lancado' })
    .eq('id', importacaoId);

  return created;
}
```

**Step 3: Serviço de classificação (regras + IA)**

```typescript
// src/domains/contabilidade/services/classificacao.service.ts

import { supabase } from '@/integrations/supabase/client';
import type { ExtratoItem, RegraClassificacao } from '../types/contabilidade.types';

interface ClassificacaoResult {
  itemId: string;
  contaPlanoId: string | null;
  centroCustoId: string | null;
  confianca: number;
  classificadoPor: 'regra' | 'ia';
}

export async function classificarItensAutomatico(
  itens: ExtratoItem[]
): Promise<ClassificacaoResult[]> {
  // 1. Buscar regras ativas
  const { data: regras } = await supabase
    .from('extrato_regras_classificacao')
    .select('*')
    .eq('ativo', true)
    .order('vezes_usado', { ascending: false });

  const results: ClassificacaoResult[] = [];

  for (const item of itens) {
    if (item.ignorado || item.lancamento_id) continue;

    // Tentar match por regra
    const matched = matchByRule(item.descricao_original, regras || []);
    if (matched) {
      results.push({
        itemId: item.id,
        contaPlanoId: matched.conta_plano_id,
        centroCustoId: matched.centro_custo_id || null,
        confianca: 0.95,
        classificadoPor: 'regra',
      });
      // Incrementar uso da regra
      await supabase
        .from('extrato_regras_classificacao')
        .update({ vezes_usado: (matched.vezes_usado || 0) + 1 })
        .eq('id', matched.id);
      continue;
    }

    // Sem match por regra — será classificado por IA na Edge Function
    results.push({
      itemId: item.id,
      contaPlanoId: null,
      centroCustoId: null,
      confianca: 0,
      classificadoPor: 'ia',
    });
  }

  return results;
}

function matchByRule(descricao: string, regras: RegraClassificacao[]): RegraClassificacao | null {
  const desc = descricao.toUpperCase();

  for (const regra of regras) {
    const padrao = regra.padrao.toUpperCase();

    switch (regra.tipo_match) {
      case 'exact':
        if (desc === padrao) return regra;
        break;
      case 'starts_with':
        if (desc.startsWith(padrao)) return regra;
        break;
      case 'contains':
      default:
        if (desc.includes(padrao)) return regra;
        break;
    }
  }

  return null;
}

// Chamar Edge Function para classificação IA dos itens sem match
export async function classificarPorIA(itens: { id: string; descricao: string; valor: number }[]) {
  const { data, error } = await supabase.functions.invoke('ai-classificar-extrato', {
    body: { itens },
  });

  if (error) throw error;
  return data as { itemId: string; contaPlanoId: string; confianca: number }[];
}

// Salvar classificações no banco
export async function salvarClassificacoes(results: ClassificacaoResult[]) {
  for (const r of results) {
    if (!r.contaPlanoId) continue;

    await supabase
      .from('extrato_bancario_itens')
      .update({
        conta_plano_id: r.contaPlanoId,
        centro_custo_id: r.centroCustoId,
        confianca_ia: r.confianca,
        classificado_por: r.classificadoPor,
      })
      .eq('id', r.itemId);
  }
}

// Criar regra a partir de classificação manual (após 3x)
export async function checkAndCreateRule(descricao: string, contaPlanoId: string, centroCustoId?: string) {
  // Verificar se já existe regra
  const { data: existing } = await supabase
    .from('extrato_regras_classificacao')
    .select('id')
    .ilike('padrao', `%${extractKeyword(descricao)}%`)
    .eq('conta_plano_id', contaPlanoId)
    .limit(1);

  if (existing && existing.length > 0) return;

  // Contar quantas vezes esse padrão foi classificado manualmente na mesma conta
  const keyword = extractKeyword(descricao);
  const { count } = await supabase
    .from('extrato_bancario_itens')
    .select('id', { count: 'exact', head: true })
    .ilike('descricao_original', `%${keyword}%`)
    .eq('conta_plano_id', contaPlanoId)
    .eq('classificado_por', 'usuario');

  if ((count || 0) >= 3) {
    await supabase
      .from('extrato_regras_classificacao')
      .insert({
        padrao: keyword,
        tipo_match: 'contains',
        conta_plano_id: contaPlanoId,
        centro_custo_id: centroCustoId || null,
      });
  }
}

function extractKeyword(descricao: string): string {
  // Extrair parte mais significativa da descrição
  // Remove números de transação, datas, etc.
  return descricao
    .replace(/\d{2}\/\d{2}\/?\d{0,4}/g, '')  // datas
    .replace(/\d{10,}/g, '')                    // números longos
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50);
}
```

**Step 4: Commit**

```bash
git add src/domains/contabilidade/services/
git commit -m "feat(contabilidade): add OFX parser, extrato service, classificacao service"
```

---

## Task 4: Edge Function — Classificação IA de extrato

**Files:**
- Create: `supabase/functions/ai-classificar-extrato/index.ts`

**Step 1: Criar Edge Function**

Seguir padrão das Edge Functions existentes (ex: `ai-detectar-problemas`).

```typescript
// supabase/functions/ai-classificar-extrato/index.ts

import { corsHeaders } from '../_shared/cors.ts';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { itens } = await req.json();

    if (!itens || itens.length === 0) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar plano de contas para contexto
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: contas } = await supabase
      .from('plano_contas')
      .select('id, codigo, nome, tipo')
      .eq('natureza', 'analitica')
      .eq('ativo', true)
      .order('codigo');

    const contasStr = (contas || [])
      .map(c => `${c.codigo} - ${c.nome} (${c.tipo})`)
      .join('\n');

    const itensStr = itens
      .map((i: any, idx: number) => `${idx + 1}. "${i.descricao}" | R$ ${i.valor}`)
      .join('\n');

    const systemPrompt = `Você é um assistente contábil especializado em classificação de extratos bancários para uma empresa de comunicação visual (Croma Print) optante pelo Simples Nacional.

Plano de contas disponível:
${contasStr}

Regras:
- Classifique cada transação do extrato na conta contábil mais adequada
- Para cada item, retorne o código da conta e um score de confiança (0.0 a 1.0)
- Transações entre contas da mesma titularidade (transferências) devem ser marcadas como "ignorar"
- PIX recebidos de pessoas/empresas geralmente são receita de vendas
- Boletos pagos com nomes de concessionárias são despesas operacionais
- Responda APENAS em JSON válido`;

    const userPrompt = `Classifique estas transações do extrato bancário:

${itensStr}

Responda em JSON:
[{"index": 1, "conta_codigo": "4.1.01", "confianca": 0.85, "ignorar": false}, ...]`;

    const result = await callOpenRouter(systemPrompt, userPrompt, {
      responseFormat: 'json_object',
      temperature: 0.1,
    });

    // Mapear resultado para IDs
    let parsed;
    try {
      parsed = JSON.parse(result.content);
      if (!Array.isArray(parsed)) {
        parsed = parsed.classificacoes || parsed.items || parsed.results || [];
      }
    } catch {
      parsed = [];
    }

    const contasMap = new Map((contas || []).map(c => [c.codigo, c.id]));

    const classificacoes = parsed.map((p: any) => {
      const idx = (p.index || 1) - 1;
      const item = itens[idx];
      if (!item) return null;

      return {
        itemId: item.id,
        contaPlanoId: contasMap.get(p.conta_codigo) || null,
        confianca: p.confianca || 0.5,
        ignorar: p.ignorar || false,
      };
    }).filter(Boolean);

    return new Response(JSON.stringify(classificacoes), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-classificar-extrato/
git commit -m "feat(contabilidade): add Edge Function for AI-powered bank statement classification"
```

---

## Task 5: Hooks (TanStack Query)

**Files:**
- Create: `src/domains/contabilidade/hooks/useLancamentos.ts`
- Create: `src/domains/contabilidade/hooks/useDAS.ts`
- Create: `src/domains/contabilidade/hooks/useExtratoBancario.ts`
- Create: `src/domains/contabilidade/hooks/useBalancete.ts`
- Create: `src/domains/contabilidade/hooks/useConfigTributaria.ts`
- Create: `src/domains/contabilidade/hooks/index.ts`

Seguir padrão de `src/domains/financeiro/hooks/` — cada hook usa `useQuery`/`useMutation` do TanStack Query v5.

**Step 1: Criar cada hook**

Cada hook deve:
- Exportar `useQuery` para leitura com `queryKey` padronizado
- Exportar `useMutation` para escrita com `onSuccess` que invalida o query
- Usar `supabase` de `@/integrations/supabase/client`
- Usar `showSuccess()`/`showError()` de `@/utils/toast.ts`

Os hooks chamam os services criados nas tasks anteriores.

**Padrão para cada hook:**

```typescript
// Exemplo: useDAS.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calcularDAS, salvarDAS, fetchDASHistorico, marcarDASPago } from '../services/das-simples.service';
import { showSuccess, showError } from '@/utils/toast';

export function useDASHistorico(ano?: number) {
  return useQuery({
    queryKey: ['das-historico', ano],
    queryFn: () => fetchDASHistorico(ano),
  });
}

export function useCalcularDAS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (competencia: string) => {
      const calculo = await calcularDAS(competencia);
      return salvarDAS(calculo);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['das-historico'] });
      showSuccess('DAS calculado com sucesso');
    },
    onError: (err: Error) => showError(`Erro ao calcular DAS: ${err.message}`),
  });
}

export function useMarcarDASPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: string }) => marcarDASPago(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['das-historico'] });
      showSuccess('DAS marcado como pago');
    },
    onError: (err: Error) => showError(`Erro: ${err.message}`),
  });
}
```

Criar hooks análogos para: `useLancamentos`, `useExtratoBancario`, `useBalancete`, `useConfigTributaria`.

**Step 2: Criar index.ts reexportando todos os hooks**

```typescript
// src/domains/contabilidade/hooks/index.ts
export * from './useLancamentos';
export * from './useDAS';
export * from './useExtratoBancario';
export * from './useBalancete';
export * from './useConfigTributaria';
```

**Step 3: Commit**

```bash
git add src/domains/contabilidade/hooks/
git commit -m "feat(contabilidade): add TanStack Query hooks for all contabilidade features"
```

---

## Task 6: Páginas — Dashboard Contábil + DAS

**Files:**
- Create: `src/domains/contabilidade/pages/ContabilidadeDashboardPage.tsx`
- Create: `src/domains/contabilidade/pages/DASPage.tsx`
- Create: `src/domains/contabilidade/components/DASStatsCards.tsx`
- Create: `src/domains/contabilidade/components/AlertasTributarios.tsx`

**Padrão de página:** Seguir `FinanceiroPage.tsx` — card `rounded-2xl`, botões `bg-blue-600`, filtros por período, estado vazio padrão.

**Dashboard mostra:** 4 cards (DAS mês, Fator R, Anexo, Vencimento) + alertas + resumo mensal + gráfico 12m + ações rápidas.

**DASPage mostra:** calculadora sob demanda + histórico em tabela + simulador + marcar como pago.

**Step 1:** Implementar os componentes e páginas seguindo o design doc.

**Step 2: Commit**

```bash
git add src/domains/contabilidade/pages/ src/domains/contabilidade/components/
git commit -m "feat(contabilidade): add dashboard and DAS pages"
```

---

## Task 7: Páginas — Balancete + Razão + Lançamentos

**Files:**
- Create: `src/domains/contabilidade/pages/BalancetePage.tsx`
- Create: `src/domains/contabilidade/pages/RazaoPage.tsx`
- Create: `src/domains/contabilidade/pages/LancamentosPage.tsx`

**Balancete:** Tabela com código, conta, débitos, créditos, saldo. Filtro por período. Totais devem fechar (débitos = créditos). Export PDF.

**Razão:** Select de conta + extrato detalhado com saldo acumulado. Filtro por período.

**Lançamentos:** Tabela paginada com todos os lançamentos. Filtro por origem, período, conta. Botão para lançamento manual (dialog com form: data, conta débito, conta crédito, valor, histórico).

**Step 1:** Implementar seguindo os wireframes do design doc.

**Step 2: Commit**

```bash
git add src/domains/contabilidade/pages/
git commit -m "feat(contabilidade): add balancete, razao, lancamentos pages"
```

---

## Task 8: Página — Extrato Bancário + Classificação

**Files:**
- Create: `src/domains/contabilidade/pages/ExtratoBancarioPage.tsx`
- Create: `src/domains/contabilidade/components/ExtratoUpload.tsx`
- Create: `src/domains/contabilidade/components/ExtratoRevisaoTable.tsx`
- Create: `src/domains/contabilidade/components/RegraClassificacaoDialog.tsx`

**Página principal:** Upload OFX → lista de importações → clicar para revisar.

**Revisão:** Tabela de itens com cor por confiança (🟢 >85%, 🟡 50-85%, 🔴 <50%). Select inline para conta/centro de custo. Botão "Classificar com IA" + "Gerar Lançamentos".

**Step 1:** Implementar componentes.

**Step 2: Commit**

```bash
git add src/domains/contabilidade/pages/ src/domains/contabilidade/components/
git commit -m "feat(contabilidade): add extrato bancario page with OFX import and AI classification"
```

---

## Task 9: Página — DEFIS + Config Tributária

**Files:**
- Create: `src/domains/contabilidade/pages/DEFISPage.tsx`
- Create: `src/domains/contabilidade/components/TabTributario.tsx`
- Modify: `src/domains/admin/pages/AdminConfigPage.tsx` (adicionar aba Tributário)

**DEFIS:** Agregador anual — receitas por mês, total DAS, despesas, folha. Botão copiar/exportar PDF.

**TabTributario:** Formulário simples — regime, pró-labore, INSS%, CNAE, anexo padrão.

**Step 1:** Implementar.

**Step 2: Commit**

```bash
git add src/domains/contabilidade/ src/domains/admin/pages/AdminConfigPage.tsx
git commit -m "feat(contabilidade): add DEFIS page and tributario config tab"
```

---

## Task 10: Rotas + Sidebar + Integração final

**Files:**
- Create: `src/routes/contabilidadeRoutes.tsx`
- Modify: `src/App.tsx` (adicionar contabilidadeRoutes)
- Modify: `src/shared/components/layout/Sidebar.tsx` (adicionar menu Contabilidade)

**Step 1: Criar rotas**

```typescript
// src/routes/contabilidadeRoutes.tsx
import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const ContabilidadeDashboardPage = lazy(() => import("@/domains/contabilidade/pages/ContabilidadeDashboardPage"));
const LancamentosPage = lazy(() => import("@/domains/contabilidade/pages/LancamentosPage"));
const BalancetePage = lazy(() => import("@/domains/contabilidade/pages/BalancetePage"));
const RazaoPage = lazy(() => import("@/domains/contabilidade/pages/RazaoPage"));
const DASPage = lazy(() => import("@/domains/contabilidade/pages/DASPage"));
const DEFISPage = lazy(() => import("@/domains/contabilidade/pages/DEFISPage"));
const ExtratoBancarioPage = lazy(() => import("@/domains/contabilidade/pages/ExtratoBancarioPage"));

export const contabilidadeRoutes = (
  <>
    <Route path="contabilidade" element={<LazyPage><ContabilidadeDashboardPage /></LazyPage>} />
    <Route path="contabilidade/lancamentos" element={<LazyPage><LancamentosPage /></LazyPage>} />
    <Route path="contabilidade/balancete" element={<LazyPage><BalancetePage /></LazyPage>} />
    <Route path="contabilidade/razao" element={<LazyPage><RazaoPage /></LazyPage>} />
    <Route path="contabilidade/das" element={<LazyPage><DASPage /></LazyPage>} />
    <Route path="contabilidade/defis" element={<LazyPage><DEFISPage /></LazyPage>} />
    <Route path="contabilidade/extrato-bancario" element={<LazyPage><ExtratoBancarioPage /></LazyPage>} />
  </>
);
```

**Step 2: Adicionar ao App.tsx**

```typescript
import { contabilidadeRoutes } from "./routes/contabilidadeRoutes";

// Dentro do <Route path="/" ...>:
{contabilidadeRoutes}
```

**Step 3: Adicionar ao Sidebar**

Adicionar seção "Contabilidade" com ícone `Calculator` do lucide-react, com subitens:
- Dashboard (`/contabilidade`)
- Lançamentos (`/contabilidade/lancamentos`)
- Balancete (`/contabilidade/balancete`)
- Razão (`/contabilidade/razao`)
- DAS (`/contabilidade/das`)
- Extrato Bancário (`/contabilidade/extrato-bancario`)
- DEFIS (`/contabilidade/defis`)

**Step 4: Build check**

Run: `npx vite build`
Expected: Build sem erros.

**Step 5: Commit**

```bash
git add src/routes/contabilidadeRoutes.tsx src/App.tsx src/shared/components/layout/Sidebar.tsx
git commit -m "feat(contabilidade): add routes, sidebar menu, integrate module"
```

---

## Task 11: Testes (Vitest)

**Files:**
- Create: `src/domains/contabilidade/services/__tests__/das-simples.service.test.ts`
- Create: `src/domains/contabilidade/services/__tests__/ofx-parser.service.test.ts`
- Create: `src/domains/contabilidade/services/__tests__/classificacao.service.test.ts`

**Testes prioritários:**

1. **DAS Simples** — testar cálculo de alíquota efetiva para cada faixa/anexo
2. **Parser OFX** — testar com OFX real do Itaú (mock)
3. **Classificação** — testar match por regras (contains, starts_with, exact)

```typescript
// Exemplo: das-simples.service.test.ts
import { describe, it, expect } from 'vitest';
import { ANEXO_III, ANEXO_V } from '../../types/contabilidade.types';

describe('DAS Simples Nacional', () => {
  it('faixa 1 anexo V: aliquota 15.5% sem deducao', () => {
    const rbt12 = 150000;
    const aliqEfetiva = (rbt12 * 0.155 - 0) / rbt12;
    expect(aliqEfetiva).toBe(0.155);

    const receitaMes = 12500;
    const das = receitaMes * aliqEfetiva;
    expect(das).toBe(1937.5);
  });

  it('faixa 1 anexo III: aliquota 6% sem deducao', () => {
    const rbt12 = 150000;
    const aliqEfetiva = (rbt12 * 0.06 - 0) / rbt12;
    expect(aliqEfetiva).toBe(0.06);

    const receitaMes = 12500;
    const das = receitaMes * aliqEfetiva;
    expect(das).toBe(750);
  });

  it('fator R >= 0.28 usa anexo III', () => {
    const folha = 50000;
    const rbt12 = 170000;
    const fatorR = folha / rbt12;
    expect(fatorR).toBeGreaterThanOrEqual(0.28);
  });

  it('fator R < 0.28 usa anexo V', () => {
    const folha = 30000;
    const rbt12 = 170000;
    const fatorR = folha / rbt12;
    expect(fatorR).toBeLessThan(0.28);
  });

  it('faixa 2 anexo V: aliquota efetiva com deducao', () => {
    const rbt12 = 250000;
    const aliqEfetiva = (rbt12 * 0.18 - 4500) / rbt12;
    expect(aliqEfetiva).toBeCloseTo(0.162, 3);
  });
});
```

**Step 1:** Escrever testes.

**Step 2:** Run: `npx vitest run src/domains/contabilidade/` — Expected: todos passam.

**Step 3: Commit**

```bash
git add src/domains/contabilidade/services/__tests__/
git commit -m "test(contabilidade): add unit tests for DAS, OFX parser, classification"
```

---

## Task 12: Build final + deploy

**Step 1:** Run: `npx vite build` — Expected: sem erros.

**Step 2:** Run: `npx vitest run` — Expected: todos os 102 testes existentes + novos passam.

**Step 3: Commit final e push**

```bash
git add -A
git commit -m "feat(contabilidade): complete accounting module - DAS, extrato, balancete, razao, DEFIS"
git push origin main
```

Deploy automático no Vercel (`crm-croma.vercel.app`).

---

## Resumo das Tasks

| # | Task | Estimativa | Dependências |
|---|------|-----------|-------------|
| 1 | Migration 070 (tabelas + seed) | Média | Nenhuma |
| 2 | Types + Services (lançamento + DAS) | Média | Task 1 |
| 3 | Parser OFX + Extrato + Classificação services | Média | Task 1 |
| 4 | Edge Function IA classificação | Baixa | Task 3 |
| 5 | Hooks TanStack Query | Média | Tasks 2, 3 |
| 6 | Dashboard + DAS pages | Alta | Task 5 |
| 7 | Balancete + Razão + Lançamentos pages | Alta | Task 5 |
| 8 | Extrato Bancário page | Alta | Tasks 5, 4 |
| 9 | DEFIS + Config Tributária | Média | Task 5 |
| 10 | Rotas + Sidebar + Integração | Baixa | Tasks 6-9 |
| 11 | Testes Vitest | Média | Tasks 2, 3 |
| 12 | Build + Deploy | Baixa | Tasks 10, 11 |

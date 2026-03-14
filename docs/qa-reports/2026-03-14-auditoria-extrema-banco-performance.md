# AUDITORIA EXTREMA -- BANCO DE DADOS E PERFORMANCE

> **Data**: 2026-03-14 | **Auditor**: Claude Opus 4.6 | **Projeto**: CRM-Croma
> **Supabase**: djwjmfgplnqyffdcgdaw | **Stack**: Postgres 15 + React 19 + TanStack Query v5

---

## SUMARIO EXECUTIVO

| Categoria | Critico | Alto | Medio | Baixo | Total |
|---|---|---|---|---|---|
| Performance/N+1 | 1 | 2 | 3 | 0 | 6 |
| Indices faltantes | 1 | 2 | 0 | 0 | 3 |
| Modelagem | 1 | 2 | 2 | 1 | 6 |
| RLS/Seguranca | 1 | 1 | 0 | 0 | 2 |
| Integridade | 1 | 1 | 1 | 0 | 3 |
| Frontend/Render | 0 | 1 | 3 | 2 | 6 |
| **TOTAL** | **5** | **9** | **9** | **3** | **26** |

---

## 1. GARGALOS DE PERFORMANCE (rankeados por impacto)

### [PERF-01] N+1 Query no buscarPorId do Orcamento Service
- **Categoria**: N+1
- **Tabela/Arquivo**: `src/domains/comercial/services/orcamento.service.ts` (linhas 281-307)
- **Severidade**: CRITICO
- **Descricao**: `buscarPorId()` faz 3 queries paralelas (proposta, itens, servicos), depois itera sobre CADA item fazendo 2 queries adicionais (proposta_item_materiais + proposta_item_acabamentos). Para um orcamento com N itens, isso gera 3 + 2*N queries.
- **Impacto**: Com 10 itens = 23 queries. Com 50 itens = 103 queries. Latencia proporcional. Essa funcao e chamada em visualizacao, duplicacao e conversao para pedido.
- **Query/Evidencia**:
```typescript
// linha 281-307: N+1 loop
const itensComDetalhes = await Promise.all(
  itens.map(async (item) => {
    // Query 1 por item
    const { data } = await supabase
      .from("proposta_item_materiais")
      .select("*")
      .eq("proposta_item_id", item.id);
    // Query 2 por item
    const { data } = await supabase
      .from("proposta_item_acabamentos")
      .select("*")
      .eq("proposta_item_id", item.id);
    return { ...item, materiais, acabamentos };
  }),
);
```
- **Correcao**: Usar nested select do Supabase:
```typescript
const itensResult = await supabase
  .from("proposta_itens")
  .select(`
    *,
    proposta_item_materiais(*),
    proposta_item_acabamentos(*)
  `)
  .eq("proposta_id", id)
  .order("ordem");
```
- **Sprint**: 1

---

### [PERF-02] Dashboard de producao faz 8 queries COUNT separadas
- **Categoria**: Performance
- **Tabela/Arquivo**: `src/domains/comercial/hooks/useDashboardStats.ts` (linhas 88-176, `useDashProducao`)
- **Severidade**: ALTO
- **Descricao**: O dashboard de producao faz 8 chamadas `SELECT * FROM ordens_producao WHERE status = X` em paralelo, cada uma com `{ count: "exact", head: true }`. Isso gera 8 round-trips ao banco.
- **Impacto**: 8 queries por load do dashboard. Com refetchInterval de 2min, sao 240 queries/hora por usuario ativo.
- **Correcao**: Consolidar em 1 query:
```typescript
const { data } = await supabase
  .from("ordens_producao")
  .select("status, prazo_interno")
  .is("excluido_em", null);
// Agregar no frontend
```
- **Sprint**: 1

---

### [PERF-03] useClienteStats baixa TODOS os clientes para contar
- **Categoria**: Performance
- **Tabela/Arquivo**: `src/domains/clientes/hooks/useClientes.ts` (linhas 219-258, `useClienteStats`)
- **Severidade**: ALTO
- **Descricao**: Busca `classificacao, segmento, ativo` de TODOS os 308 clientes para fazer count no JS. Sem paginacao, cresce linearmente.
- **Impacto**: Com 308 registros e aceitavel. Com 5.000+ clientes (cenario de 1 ano), fica lento e transfere dados desnecessarios.
- **Correcao**: Usar RPC ou view materializada:
```sql
CREATE OR REPLACE FUNCTION get_cliente_stats()
RETURNS json AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'ativos', COUNT(*) FILTER (WHERE ativo),
    'inativos', COUNT(*) FILTER (WHERE NOT ativo)
  ) FROM clientes;
$$ LANGUAGE sql STABLE;
```
- **Sprint**: 2

---

### [PERF-04] useLeads e useClientes sem paginacao
- **Categoria**: Performance
- **Tabela/Arquivo**: `src/domains/comercial/hooks/useLeads.ts`, `src/domains/clientes/hooks/useClientes.ts`
- **Severidade**: MEDIO
- **Descricao**: Ambos os hooks carregam `.select('*')` sem `.range()`. Clientes tem 308 registros; leads crescera.
- **Impacto**: Sem paginacao, a tabela e renderizada inteira no DOM. Funciona hoje com poucos registros mas degrada com crescimento.
- **Correcao**: Implementar paginacao com `.range(from, to)` e `useInfiniteQuery` ou paginacao offset.
- **Sprint**: 2

---

### [PERF-05] Dashboard financeiro baixa todas as contas_receber + contas_pagar
- **Categoria**: Performance
- **Tabela/Arquivo**: `src/domains/comercial/hooks/useDashboardStats.ts` (linhas 180-209, `useDashFinanceiro`)
- **Severidade**: MEDIO
- **Descricao**: Busca TODAS as contas_receber e contas_pagar e agrega no JS. Hoje tem 2 contas_receber; com 1000+ fica pesado.
- **Impacto**: Baixo agora, alto em 6 meses. Transfer de dados desnecessario.
- **Correcao**: Criar view ou RPC para agregar no banco.
- **Sprint**: 3

---

### [PERF-06] fiscal_audit_logs query com LIMIT 500 e .select('*')
- **Categoria**: Performance
- **Tabela/Arquivo**: `src/domains/fiscal/hooks/useFiscal.ts` (linha 109)
- **Severidade**: MEDIO
- **Descricao**: `supabase.from('fiscal_audit_logs').select('*').order('created_at', { ascending: false }).limit(500)` -- puxa 500 registros com todas as colunas.
- **Impacto**: Payload grande, muitas colunas desnecessarias (jsonb de dados). Renderizacao pesada.
- **Correcao**: Selecionar apenas colunas necessarias e reduzir limit:
```typescript
.select('id, tipo_operacao, entidade_tipo, descricao, created_at, user_id')
.limit(100)
```
- **Sprint**: 3

---

## 2. PROBLEMAS DE MODELAGEM (com SQL de correcao)

### [MOD-01] Campos criticos de negocio sem NOT NULL
- **Categoria**: Modelagem
- **Tabela/Arquivo**: Multiplas tabelas
- **Severidade**: CRITICO
- **Descricao**: Campos essenciais ao fluxo de negocio sao nullable quando nao deveriam ser:
  - `pedidos.status` -- nullable, pode ficar sem status
  - `pedidos.valor_total` -- nullable, pedido sem valor
  - `pedido_itens.quantidade` -- nullable, item sem quantidade
  - `pedido_itens.valor_unitario` -- nullable, item sem preco
  - `pedido_itens.valor_total` -- nullable, item sem total
  - `propostas.status` -- nullable, proposta sem estado
  - `propostas.total` -- nullable, proposta sem valor
  - `ordens_producao.status` -- nullable, OP sem estado
  - `ordens_producao.pedido_id` -- nullable, OP sem pedido vinculado
  - `contas_pagar.status` -- nullable
  - `contas_pagar.valor_original` -- NOT NULL (OK), mas `saldo` nullable
  - `profiles.role` -- nullable, usuario sem permissao definida
- **Impacto**: Dados inconsistentes. Queries precisam de coalescencia (NULL safety). O frontend faz `Number(x) || 0` em todo lugar como workaround.
- **Correcao**:
```sql
-- Primeiro, preencher NULLs existentes:
UPDATE pedidos SET status = 'rascunho' WHERE status IS NULL;
UPDATE pedidos SET valor_total = 0 WHERE valor_total IS NULL;
UPDATE pedido_itens SET quantidade = 1 WHERE quantidade IS NULL;
UPDATE pedido_itens SET valor_unitario = 0 WHERE valor_unitario IS NULL;
UPDATE pedido_itens SET valor_total = 0 WHERE valor_total IS NULL;
UPDATE propostas SET status = 'rascunho' WHERE status IS NULL;
UPDATE propostas SET total = 0 WHERE total IS NULL;
UPDATE ordens_producao SET status = 'aguardando_programacao' WHERE status IS NULL;
UPDATE profiles SET role = 'admin' WHERE role IS NULL;

-- Depois, adicionar constraints:
ALTER TABLE pedidos ALTER COLUMN status SET NOT NULL;
ALTER TABLE pedidos ALTER COLUMN status SET DEFAULT 'rascunho';
ALTER TABLE pedido_itens ALTER COLUMN quantidade SET NOT NULL;
ALTER TABLE pedido_itens ALTER COLUMN quantidade SET DEFAULT 1;
ALTER TABLE propostas ALTER COLUMN status SET NOT NULL;
ALTER TABLE propostas ALTER COLUMN status SET DEFAULT 'rascunho';
ALTER TABLE ordens_producao ALTER COLUMN status SET NOT NULL;
ALTER TABLE ordens_producao ALTER COLUMN status SET DEFAULT 'aguardando_programacao';
```
- **Sprint**: 1

---

### [MOD-02] stores.cliente_id e stores.cliente_unidade_id sem FK constraint
- **Categoria**: Modelagem
- **Tabela/Arquivo**: `stores` (1306 registros -- maior tabela)
- **Severidade**: ALTO
- **Descricao**: A tabela `stores` tem `cliente_id` e `cliente_unidade_id` sem FK constraints, apesar de referenciar `clientes` e `cliente_unidades`. Tambem nao tem FK para `jobs.store_id -> stores.id` (ja tem).
- **Impacto**: Registros orfaos possiveis. Sem cascade delete. Integridade referencial nao garantida.
- **Correcao**:
```sql
ALTER TABLE stores
  ADD CONSTRAINT stores_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

ALTER TABLE stores
  ADD CONSTRAINT stores_cliente_unidade_id_fkey
  FOREIGN KEY (cliente_unidade_id) REFERENCES cliente_unidades(id) ON DELETE SET NULL;
```
- **Sprint**: 2

---

### [MOD-03] jobs.pedido_id, jobs.ordem_instalacao_id, jobs.pedido_item_id sem FK
- **Categoria**: Modelagem
- **Tabela/Arquivo**: `jobs` (3 registros, mas cresce)
- **Severidade**: ALTO
- **Descricao**: A tabela `jobs` referencia `pedidos`, `ordens_instalacao` e `pedido_itens` mas nao tem FK constraints para essas 3 colunas.
- **Impacto**: Jobs podem apontar para pedidos/ordens que nao existem mais. Integridade nao garantida.
- **Correcao**:
```sql
ALTER TABLE jobs
  ADD CONSTRAINT jobs_pedido_id_fkey
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_ordem_instalacao_id_fkey
  FOREIGN KEY (ordem_instalacao_id) REFERENCES ordens_instalacao(id) ON DELETE SET NULL;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_pedido_item_id_fkey
  FOREIGN KEY (pedido_item_id) REFERENCES pedido_itens(id) ON DELETE SET NULL;
```
- **Sprint**: 2

---

### [MOD-04] Campos monetarios sem precisao definida em proposta_itens
- **Categoria**: Modelagem
- **Tabela/Arquivo**: `proposta_itens`, `pedido_itens`
- **Severidade**: MEDIO
- **Descricao**: Os campos monetarios tem `numeric(12,2)` o que e adequado. Porem `materiais.preco_medio` usa `numeric(12,4)` (4 casas decimais) que e correto para materiais. Consistencia OK.
- **Impacto**: Baixo. A modelagem monetaria esta correta.
- **Sprint**: N/A (OK)

---

### [MOD-05] registros_auditoria cresce sem politica de retencao
- **Categoria**: Modelagem
- **Tabela/Arquivo**: `registros_auditoria` (536 registros, 536 KB)
- **Severidade**: MEDIO
- **Descricao**: A tabela de auditoria e populada por triggers em 15+ tabelas (INSERT/UPDATE/DELETE). Nao existe politica de retencao/particionamento.
- **Impacto**: Cresce indefinidamente. Com uso normal do ERP (100 operacoes/dia), em 1 ano tera 36.500+ registros. Performance de insert degrada com tabela grande.
- **Correcao**:
```sql
-- Politica de retencao: manter apenas 6 meses
CREATE OR REPLACE FUNCTION limpar_auditoria_antiga()
RETURNS void AS $$
BEGIN
  DELETE FROM registros_auditoria
  WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;

-- Agendar via pg_cron (se disponivel) ou Edge Function semanal
```
- **Sprint**: 3

---

### [MOD-06] Dois triggers de numeracao na tabela propostas
- **Categoria**: Modelagem
- **Tabela/Arquivo**: `propostas`
- **Severidade**: BAIXO
- **Descricao**: Existem 2 triggers de INSERT que geram numero: `trg_proposta_numero` (executa `set_proposta_numero()`) e `trigger_auto_numero_propostas` (executa `gerar_numero_auto()`). Alem disso, o `orcamento.service.ts` tambem gera numero manualmente no JavaScript (linha 326).
- **Impacto**: Conflito potencial de numeracao. O numero gerado no JS pode ser sobrescrito pelo trigger, ou vice-versa.
- **Correcao**: Escolher UMA estrategia de numeracao (idealmente o trigger) e remover a geracao manual do JS.
- **Sprint**: 2

---

## 3. FALHAS DE INTEGRIDADE (dados corrompidos/inconsistentes)

### [INT-01] 8 propostas ativas com total = R$ 0,00
- **Categoria**: Integridade
- **Tabela/Arquivo**: `propostas`
- **Severidade**: CRITICO
- **Descricao**: 8 de 15 propostas nao-excluidas tem `total = 0.00`, incluindo:
  - `PROP-2026-013` com status `aprovada` e total R$ 0,00
  - `PROP-2026-015` com status `enviada` e total R$ 0,00
  - `PROP-2026-001` com status `em_revisao` e total R$ 0,00
- **Impacto**: Propostas aprovadas/enviadas com R$ 0,00 geram pedidos sem valor. Bug confirmado no CLAUDE.md ("Orcamento gera R$ 0,00").
- **Evidencia**:
```
PROP-2026-013 | aprovada    | R$ 0,00
PROP-2026-015 | enviada     | R$ 0,00
PROP-2026-001 | em_revisao  | R$ 0,00
+ 5 rascunhos com R$ 0,00
```
- **Correcao**:
```sql
-- Impedir propostas aprovadas/enviadas com total 0
ALTER TABLE propostas ADD CONSTRAINT chk_propostas_total_aprovacao
CHECK (
  status IN ('rascunho') OR total > 0
);

-- Corrigir dados existentes: reverter para rascunho
UPDATE propostas SET status = 'rascunho'
WHERE total <= 0 AND status NOT IN ('rascunho') AND excluido_em IS NULL;
```
- **Sprint**: 1

---

### [INT-02] 3 materiais sem preco_medio
- **Categoria**: Integridade
- **Tabela/Arquivo**: `materiais` (3 de 467)
- **Severidade**: ALTO
- **Descricao**: 3 materiais tem `preco_medio IS NULL OR preco_medio <= 0`. Se usados em orcamentos, o custo de materia-prima sera R$ 0,00.
- **Impacto**: Orcamentos com custo de MP zero, distorcendo markup e preco de venda.
- **Correcao**:
```sql
-- Identificar quais materiais estao sem preco
SELECT id, nome, codigo, preco_medio FROM materiais
WHERE preco_medio IS NULL OR preco_medio <= 0;

-- Desativar ate preco ser informado
UPDATE materiais SET ativo = false
WHERE preco_medio IS NULL OR preco_medio <= 0;
```
- **Sprint**: 1

---

### [INT-03] proposta_views com dados de tracking
- **Categoria**: Integridade
- **Tabela/Arquivo**: `proposta_views` (1 registro)
- **Severidade**: MEDIO
- **Descricao**: A tabela de tracking comportamental tem apenas 1 registro. Funcionalidade de tracking pode nao estar funcionando corretamente ou falta de uso real.
- **Impacto**: Metricas de interesse do cliente nao confiaveais.
- **Sprint**: 3

---

## 4. INDICES FALTANTES (com CREATE INDEX exato)

### [IDX-01] 78 Foreign Keys sem indice
- **Categoria**: Indice
- **Tabela/Arquivo**: 78 FKs em ~40 tabelas
- **Severidade**: CRITICO
- **Descricao**: A query de FK sem indice retornou 78 colunas FK que NAO possuem indice correspondente. FKs sem indice degradam JOINs e cascades (ON DELETE).
- **Impacto**: Toda query com JOIN nessas colunas faz sequential scan. DELETE com cascade e O(n) em vez de O(log n).
- **Correcao** (indices mais criticos para as tabelas com dados):
```sql
-- PRIORIDADE 1: Tabelas grandes (>100 registros) com FK sem indice
-- Nenhuma das tabelas grandes (stores, modelo_processos, modelo_materiais, etc)
-- tem FKs sem indice nas colunas de join frequente - as FKs sem indice sao
-- majoritariamente em colunas _by (uploaded_by, criado_por, aprovado_por, etc)

-- PRIORIDADE 2: Tabelas de transacao com FK de lookup frequente
CREATE INDEX idx_pedido_itens_proposta_item_id ON pedido_itens(proposta_item_id);
CREATE INDEX idx_pedido_itens_produto_id ON pedido_itens(produto_id);
CREATE INDEX idx_fiscal_documentos_regra_operacao_id ON fiscal_documentos(regra_operacao_id);
CREATE INDEX idx_fiscal_documentos_certificado_id ON fiscal_documentos(certificado_id);
CREATE INDEX idx_fiscal_filas_emissao_doc_id ON fiscal_filas_emissao(fiscal_documento_id);
CREATE INDEX idx_bank_slips_pedido_id ON bank_slips(pedido_id);
CREATE INDEX idx_bank_remittance_items_slip_id ON bank_remittance_items(bank_slip_id);
CREATE INDEX idx_bank_return_items_slip_id ON bank_return_items(bank_slip_id);
CREATE INDEX idx_job_photos_job_id ON job_photos(job_id);
CREATE INDEX idx_job_videos_job_id ON job_videos(job_id);
CREATE INDEX idx_cotacoes_compra_material_id ON cotacoes_compra(material_id);
CREATE INDEX idx_recebimento_itens_material_id ON recebimento_itens(material_id);
CREATE INDEX idx_produtos_categoria_id ON produtos(categoria_id);
CREATE INDEX idx_leads_campanha_id ON leads(campanha_id);

-- PRIORIDADE 3: Colunas _by (usuario) -- menos criticas, mas boas para auditoria
CREATE INDEX idx_propostas_aprovado_por ON propostas(aprovado_por);
CREATE INDEX idx_pedidos_aprovado_por ON pedidos(aprovado_por);
CREATE INDEX idx_campo_audit_logs_user_id ON campo_audit_logs(user_id);
CREATE INDEX idx_fiscal_audit_logs_user_id ON fiscal_audit_logs(user_id);
```
- **Sprint**: 1 (prioridade 2), 2 (prioridade 3)

---

### [IDX-02] Tabelas sem nenhum indice alem da PK
- **Categoria**: Indice
- **Tabela/Arquivo**: 11 tabelas
- **Severidade**: ALTO
- **Descricao**: As seguintes tabelas nao tem NENHUM indice alem da primary key:
  - `checklists` (6 registros)
  - `ferramentas`
  - `checkout_almoxarife`
  - `diario_bordo`
  - `campanhas`
  - `proposta_item_processos`
  - `fiscal_certificados`
  - `campo_audit_logs`
  - `job_videos`
  - `company_settings`
  - `job_photos` (29 registros)
- **Impacto**: Sequential scan para qualquer filtro. `job_photos` com 29 registros e a mais impactada (cresce com uso).
- **Correcao**:
```sql
CREATE INDEX idx_job_photos_job_id ON job_photos(job_id);
CREATE INDEX idx_job_videos_job_id ON job_videos(job_id);
CREATE INDEX idx_campo_audit_logs_user_id ON campo_audit_logs(user_id);
CREATE INDEX idx_campo_audit_logs_created_at ON campo_audit_logs(created_at);
CREATE INDEX idx_checkout_almoxarife_pedido_id ON checkout_almoxarife(pedido_id);
CREATE INDEX idx_checkout_almoxarife_usuario_id ON checkout_almoxarife(usuario_id);
CREATE INDEX idx_diario_bordo_data ON diario_bordo(data);
CREATE INDEX idx_proposta_item_processos_item_id ON proposta_item_processos(proposta_item_id);
CREATE INDEX idx_fiscal_certificados_ambiente_id ON fiscal_certificados(ambiente_id);
```
- **Sprint**: 1

---

### [IDX-03] clientes sem indice trigram para busca textual
- **Categoria**: Indice
- **Tabela/Arquivo**: `clientes` (308 registros)
- **Severidade**: ALTO
- **Descricao**: O hook `useClientes` faz busca com `.or('razao_social.ilike.%term%,nome_fantasia.ilike.%term%,...')` que gera `ILIKE '%term%'` -- sequential scan. A extensao `pg_trgm` ja esta instalada (funcoes trigram existem).
- **Impacto**: Busca de clientes faz full scan. Com 308 registros e rapido, mas com 5.000+ sera lento.
- **Correcao**:
```sql
CREATE INDEX idx_clientes_razao_social_trgm ON clientes
  USING gin (razao_social gin_trgm_ops);
CREATE INDEX idx_clientes_nome_fantasia_trgm ON clientes
  USING gin (nome_fantasia gin_trgm_ops);
```
- **Sprint**: 2

---

## 5. RLS GAPS (tabelas expostas)

### [RLS-01] 80 tabelas sem Row Level Security
- **Categoria**: RLS
- **Tabela/Arquivo**: 80 de ~90 tabelas publicas
- **Severidade**: CRITICO
- **Descricao**: A vasta maioria das tabelas NAO tem RLS habilitado. Apenas as seguintes tabelas TEM RLS:
  - `acabamentos` (com policies)
  - `agenda_instalacao` (com policies)
  - `servicos` (com policies)
  - `regras_precificacao` (com policies)
  - `config_precificacao` (com policies)
  - `templates_orcamento` (com policies)
  - `proposta_item_materiais` (com policies)
  - `proposta_item_acabamentos` (com policies)
  - `proposta_servicos` (com policies)
  - `proposta_item_processos` (com policies)
  - `proposta_views` (com policies para anon)
  - `proposta_attachments` (com policies para anon)
  - `notifications` (com policies)
  - `bank_accounts`, `bank_slips`, `bank_remittances`, etc (com policies)
  - `stores`, `jobs`, `job_photos`, `job_videos` (com policies)

  **Tabelas CRITICAS sem RLS**:
  - `clientes` -- dados de todos os clientes expostos
  - `propostas` -- todas as propostas comerciais
  - `pedidos` -- todos os pedidos
  - `pedido_itens` -- todos os itens
  - `contas_receber` / `contas_pagar` -- dados financeiros
  - `leads` -- pipeline comercial
  - `profiles` -- dados de usuarios
  - `materiais` -- custos de materia-prima
  - `ordens_producao` -- producao
- **Impacto**: Qualquer usuario autenticado (incluindo instaladores e tecnicos de campo) pode ler/escrever em TODAS essas tabelas. Um tecnico de campo pode ver custos, margens, dados financeiros.
- **Correcao**: Habilitar RLS em todas as tabelas criticas com policies baseadas em `get_user_role()`:
```sql
-- Exemplo para clientes:
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_clientes" ON clientes
  FOR ALL USING (get_user_role() IN ('admin', 'diretor'));

CREATE POLICY "vendedor_ver_clientes" ON clientes
  FOR SELECT USING (get_user_role() IN ('vendedor', 'comercial'));

CREATE POLICY "vendedor_editar_proprios" ON clientes
  FOR UPDATE USING (
    get_user_role() IN ('vendedor') AND vendedor_id = auth.uid()
  );

-- Repetir para: propostas, pedidos, pedido_itens, contas_receber,
-- contas_pagar, leads, materiais, ordens_producao, profiles
```
- **Sprint**: 1

---

### [RLS-02] Policies com `qual = true` (bypass total)
- **Categoria**: RLS
- **Tabela/Arquivo**: `anexos`
- **Severidade**: ALTO
- **Descricao**: A tabela `anexos` tem RLS habilitada mas com policy `authenticated_all_anexos` que permite `ALL` com `qual = true` (todos os usuarios autenticados podem fazer tudo).
- **Impacto**: RLS e efetivamente nula. Qualquer usuario pode ler/escrever/deletar qualquer anexo.
- **Correcao**: Restringir por role ou por ownership.
- **Sprint**: 2

---

## 6. FRONTEND - RENDERING E TANSTACK QUERY

### [FE-01] Hooks sem staleTime -- refetch excessivo
- **Categoria**: Frontend/Render
- **Tabela/Arquivo**: Multiplos hooks
- **Severidade**: ALTO
- **Descricao**: Os seguintes hooks NAO definem `staleTime`, usando o default de 0ms do TanStack Query (refetch em cada mount):
  - `useClientes()` -- 308 registros, refetch a cada navegacao
  - `useContatos()` -- refetch a cada mount
  - `useLeads()` -- refetch a cada mount
  - `useLead()` -- refetch a cada mount
  - `useLeadStats()` -- agrega todos os leads, sem cache
  - `useClienteStats()` -- agrega todos os clientes, sem cache
  - `usePedidos()` -- refetch a cada mount
  - `usePedido()` -- refetch a cada mount
  - `usePedidoStats()` -- agrega todos pedidos, sem cache
  - `useContasReceber()` -- refetch a cada mount
  - `useContasReceberStats()` -- agrega todos, sem cache
  - `useBoletos()` -- refetch a cada mount
  - `useBoletoStats()` -- agrega todos, sem cache
  - `useBankAccounts()` -- refetch a cada mount
  - `useRemessas()` -- refetch a cada mount

  **Nota**: O app define `staleTime: 1000 * 60 * 2` no QueryClient global (`App.tsx` linha 26), o que mitiga parcialmente. Mas hooks que definem `staleTime: 0` explicitamente (como useChecklist) sobrescrevem o global.
- **Impacto**: Com staleTime global de 2min, o impacto e moderado. Mas navegacao rapida entre paginas (< 2min) causa refetch desnecessario em hooks de stats/agregacao.
- **Correcao**: Definir `staleTime` explicito nos hooks de dados que mudam pouco:
```typescript
// Stats e agregacoes: 5 minutos
staleTime: 1000 * 60 * 5

// Listagens: 2 minutos (ja e o global, OK)

// Dados de referencia (categorias, produtos, acabamentos): 10 minutos (ja feito)
```
- **Sprint**: 2

---

### [FE-02] 40+ queries com .select('*') -- payload excessivo
- **Categoria**: Frontend/Render
- **Tabela/Arquivo**: 40+ arquivos (ver grep acima)
- **Severidade**: MEDIO
- **Descricao**: 40+ chamadas Supabase usam `.select('*')` em vez de selecionar colunas especificas. Tabelas como `clientes` (35 colunas), `propostas` (30+ colunas), `fiscal_audit_logs` (jsonb) transferem dados que nunca sao renderizados.
- **Impacto**: Payload de rede inflado. Para `useClientes` com 308 registros * 35 colunas, o JSON transferido e significativamente maior que o necessario.
- **Correcao**: Substituir `.select('*')` por colunas especificas nos hooks de listagem:
```typescript
// Exemplo para useClientes (listagem)
.select('id, razao_social, nome_fantasia, cnpj, segmento, classificacao, ativo, email, telefone, cidade, estado')
```
- **Sprint**: 3

---

### [FE-03] Mutations sem optimistic update
- **Categoria**: Frontend/Render
- **Tabela/Arquivo**: Todos os hooks de mutation
- **Severidade**: MEDIO
- **Descricao**: Nenhuma mutation usa optimistic updates do TanStack Query. Todas usam `invalidateQueries` no `onSuccess`, causando refetch completo apos cada operacao.
- **Impacto**: Delay perceptivel apos criar/editar/excluir. O usuario precisa esperar o refetch completo para ver a mudanca. Em operacoes frequentes (editar item de orcamento), a UX degrada.
- **Correcao**: Implementar optimistic update para operacoes frequentes:
```typescript
// Exemplo: useUpdateCliente com optimistic update
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey: [CLIENTES_KEY] });
  const previous = queryClient.getQueryData([CLIENTES_KEY]);
  queryClient.setQueryData([CLIENTES_KEY], (old) =>
    old?.map(c => c.id === newData.id ? { ...c, ...newData } : c)
  );
  return { previous };
},
onError: (err, newData, context) => {
  queryClient.setQueryData([CLIENTES_KEY], context.previous);
},
```
- **Sprint**: 3

---

### [FE-04] useClientes com .select('*') usado em ClienteCombobox
- **Categoria**: Frontend/Render
- **Tabela/Arquivo**: `src/shared/components/ClienteCombobox.tsx`
- **Severidade**: MEDIO
- **Descricao**: O combobox de selecao de cliente provavelmente carrega todos os clientes com todas as colunas para popular um dropdown.
- **Impacto**: Carrega 308 registros * 35 colunas para exibir apenas nome. Payload desnecessario.
- **Correcao**: Selecionar apenas `id, razao_social, nome_fantasia`:
```typescript
.select('id, razao_social, nome_fantasia')
```
- **Sprint**: 2

---

### [FE-05] useDashComercial faz 3 queries paralelas sem paginacao
- **Categoria**: Frontend/Render
- **Tabela/Arquivo**: `src/domains/comercial/hooks/useDashboardStats.ts` (linhas 8-49)
- **Severidade**: BAIXO
- **Descricao**: Busca todos os clientes, leads e propostas para agregar. Tem staleTime de 2min e refetchInterval adequado.
- **Impacto**: Aceitavel com volume atual. Escala mal com crescimento.
- **Sprint**: 3

---

### [FE-06] updated_at manual no frontend
- **Categoria**: Frontend/Render
- **Tabela/Arquivo**: Multiplos hooks (useUpdateCliente, useUpdateLead, etc)
- **Severidade**: BAIXO
- **Descricao**: Todos os hooks de update definem `updated_at: new Date().toISOString()` manualmente. Mas os triggers `update_updated_at()` ja fazem isso automaticamente no banco.
- **Impacto**: Redundancia. O timestamp do frontend pode divergir do servidor (timezone, clock skew). Sem bug real, mas desnecessario.
- **Correcao**: Remover `updated_at` manual dos updates no frontend.
- **Sprint**: 3

---

## 7. PLANO DE CORRECAO PRIORIZADO

### Sprint 1 -- URGENTE (Semana 1-2)

| ID | Acao | Esforco | Impacto |
|---|---|---|---|
| PERF-01 | Corrigir N+1 no orcamento.service.ts (nested select) | 1h | CRITICO |
| PERF-02 | Consolidar 8 queries do dashboard producao em 1 | 1h | ALTO |
| INT-01 | Reverter propostas enviadas/aprovadas com R$ 0,00 para rascunho | 15min | CRITICO |
| INT-02 | Desativar materiais sem preco | 10min | ALTO |
| MOD-01 | Adicionar NOT NULL em campos criticos (status, valor_total, quantidade) | 1h | CRITICO |
| IDX-02 | Criar indices nas 11 tabelas sem indice | 30min | ALTO |
| IDX-01 | Criar indices de prioridade 2 (FKs de transacao) | 30min | CRITICO |
| RLS-01 | Habilitar RLS em clientes, propostas, pedidos, contas_receber, contas_pagar, leads, profiles | 4h | CRITICO |

**Total Sprint 1: ~8h**

### Sprint 2 -- ESTABILIZACAO (Semana 3-4)

| ID | Acao | Esforco | Impacto |
|---|---|---|---|
| PERF-03 | Criar RPC para stats de clientes | 1h | ALTO |
| PERF-04 | Implementar paginacao em useClientes e useLeads | 3h | MEDIO |
| MOD-02 | Adicionar FK em stores | 30min | ALTO |
| MOD-03 | Adicionar FK em jobs | 30min | ALTO |
| MOD-06 | Resolver dupla numeracao de propostas | 1h | BAIXO |
| IDX-03 | Criar indices trigram para busca textual | 30min | ALTO |
| IDX-01 | Criar indices de prioridade 3 (colunas _by) | 30min | MEDIO |
| RLS-02 | Corrigir policy de bypass em anexos | 30min | ALTO |
| FE-01 | Adicionar staleTime explicito nos hooks de stats | 1h | ALTO |
| FE-04 | Otimizar ClienteCombobox (select parcial) | 30min | MEDIO |

**Total Sprint 2: ~9h**

### Sprint 3 -- REFINAMENTO (Semana 5-6)

| ID | Acao | Esforco | Impacto |
|---|---|---|---|
| PERF-05 | Criar RPC para dashboard financeiro | 1h | MEDIO |
| PERF-06 | Otimizar query de fiscal_audit_logs | 30min | MEDIO |
| MOD-05 | Implementar politica de retencao na auditoria | 1h | MEDIO |
| FE-02 | Substituir .select('*') por colunas especificas (top 10 hooks) | 3h | MEDIO |
| FE-03 | Implementar optimistic updates nos 5 hooks mais usados | 3h | MEDIO |
| FE-06 | Remover updated_at manual | 1h | BAIXO |

**Total Sprint 3: ~9.5h**

### Sprint 4 -- ESCALA (Semana 7+)

| ID | Acao | Esforco | Impacto |
|---|---|---|---|
| - | RLS granular para TODAS as tabelas restantes | 8h | ALTO |
| - | Views materializadas para dashboards | 4h | MEDIO |
| - | Particionamento de registros_auditoria | 2h | MEDIO |
| - | Implementar virtualização para listas > 100 itens | 4h | MEDIO |
| - | Monitoring: pg_stat_statements + slow query log | 2h | MEDIO |

**Total Sprint 4: ~20h**

---

## APENDICE A -- TABELAS POR VOLUME

| Tabela | Registros | Indices | RLS |
|---|---|---|---|
| stores | 1306 | sim | SIM |
| modelo_processos | 912 | sim | NAO |
| modelo_materiais | 896 | sim | NAO |
| registros_auditoria | 536 | sim | NAO |
| materiais | 467 | sim | NAO |
| estoque_saldos | 467 | sim | NAO |
| clientes | 308 | sim | NAO |
| cliente_contatos | 295 | sim | NAO |
| produtos | 243 | sim | NAO |
| produto_modelos | 243 | sim | NAO |
| plano_contas | 222 | sim | NAO |
| permissoes_perfil | 201 | sim | NAO |
| checklist_itens | 134 | sim | NAO |
| permissions | 57 | sim | NAO |
| centros_custo | 41 | sim | NAO |
| job_photos | 29 | NAO | SIM |
| acabamentos | 20 | sim | SIM |
| servicos | 16 | sim | SIM |
| propostas | 15 | sim | NAO |
| producao_etapas | 15 | sim | NAO |

## APENDICE B -- FOREIGN KEYS SEM INDICE (TOP 20 MAIS CRITICAS)

| Tabela | Coluna FK | Referencia |
|---|---|---|
| pedido_itens | proposta_item_id | proposta_itens |
| pedido_itens | produto_id | produtos |
| fiscal_documentos | regra_operacao_id | fiscal_regras_operacao |
| fiscal_documentos | certificado_id | fiscal_certificados |
| fiscal_filas_emissao | fiscal_documento_id | fiscal_documentos |
| bank_slips | pedido_id | pedidos |
| bank_remittance_items | bank_slip_id | bank_slips |
| bank_return_items | bank_slip_id | bank_slips |
| job_photos | job_id | jobs |
| job_videos | job_id | jobs |
| cotacoes_compra | material_id | materiais |
| recebimento_itens | material_id | materiais |
| produtos | categoria_id | categorias_produto |
| leads | campanha_id | campanhas |
| propostas | aprovado_por | profiles |
| pedidos | aprovado_por | profiles |
| contas_receber | centro_custo_id | centros_custo |
| contas_pagar | centro_custo_id | centros_custo |
| fiscal_documentos | created_by | profiles |
| fiscal_audit_logs | user_id | profiles |

---

*Relatorio gerado em 2026-03-14 por Claude Opus 4.6*

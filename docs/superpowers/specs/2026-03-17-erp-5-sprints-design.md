# CRM-Croma ERP — Design Spec: 5 Sprints Temáticos

**Data:** 2026-03-17
**Autores:** xQuads Advisory Board + Cybersecurity + Design Squad + Claude Mastery
**Status:** Aprovado pelo usuário (brainstorming concluído)
**Modelo execução:** Opus planeja, Sonnet executa

---

## 1. Visão Geral

Transformar o CRM-Croma de um CRM com módulos decorativos (65% complete, orçamento mostra R$0, estoque sem saldo real, produção visual-only) em um ERP funcional de ponta a ponta para a Croma Print do Brasil.

### Cadeia de Dependências (ordem obrigatória)

```
Sprint 1: Catálogo + Precificação
    ↓ (produto_id, composição, custos reais)
Sprint 2: Estoque Real
    ↓ (saldo, reserva, material disponível)
Sprint 3: PCP / Produção
    ↓ (OS finalizada, custo real de produção)
Sprint 4: Motor Financeiro
    ↓ (CR/CP integrados, fluxo de caixa)
Sprint 5: NF-e
```

Segurança (RLS) aplicada incrementalmente em cada sprint via migrations dedicadas.

### Cronograma

| Sprint | Sessões | Horas | Dias úteis |
|--------|---------|-------|------------|
| 1 - Catálogo | 4-5 | ~8h | 3 |
| 2 - Estoque | 3 | ~5h | 1.5 |
| 3 - PCP | 4 | ~7h | 2.5 |
| 4 - Financeiro | 3 | ~5h | 1.5 |
| 5 - NF-e | 3 | ~5h | 1.5 |
| **TOTAL** | **17-19** | **~30h** | **~10 dias** |

---

## 2. Decisões Arquiteturais Transversais

### 2.1 State Machine Leve (não framework)

Criar `src/shared/lib/state-machine.ts` (~50 linhas):

```ts
export function createStateMachine<S extends string>(
  transitions: Record<S, S[]>
) {
  return {
    canTransition: (from: S, to: S): boolean =>
      transitions[from]?.includes(to) ?? false,
    validNext: (from: S): S[] =>
      transitions[from] ?? [],
  };
}
```

Cada domínio registra suas transições ao lado dos enums existentes em `status.ts`. Sem XState, sem framework — função pura testável.

**Justificativa (Advisory Board):** Os 8+ enums de status dispersos no codebase não definem transições válidas. Um framework seria over-engineering num sistema que ainda mostra R$0 no orçamento.

### 2.2 Saldos são COMPUTED, nunca editáveis

- **Estoque:** `saldo = SUM(entradas) - SUM(saídas)` via view/função
- **Financeiro:** `saldo = valor_original - valor_pago` via trigger
- **Nunca** uma coluna editável diretamente

### 2.3 Preços em numeric(12,4)

Armazenar custos unitários em `numeric(12,4)` no Postgres, `number` no TypeScript. Não usar centavos (integer) porque a precificação tem 10 componentes com percentuais fracionários.

### 2.4 Segurança Incremental (RLS por Sprint)

Cada sprint inclui sua migration RLS. Arquivo base de helpers SQL já gerado em `docs/rls-strategy.sql`.

| Migration | Sprint | Conteúdo |
|-----------|--------|----------|
| 041_rls_base_helpers | Base | `get_user_role()`, `is_admin()`, `is_role()`, `is_owner()`, `drop_all_policies()` |
| 042_rls_s1_catalogo | Sprint 1 | 11 tabelas: produtos, modelos, composições, precificação, máquinas |
| 043_rls_s2_estoque | Sprint 2 | 13 tabelas: materiais, saldos, movimentações, fornecedores, compras |
| 044_rls_s3_producao | Sprint 3 | 13 tabelas: OPs, etapas, apontamentos, almoxarife, checklists |
| 045_rls_s4_financeiro | Sprint 4 | 15 tabelas: CR/CP, parcelas, comissões, plano contas, bancos |
| 046_rls_s5_nfe | Sprint 5 | 11 tabelas: certificados, documentos fiscais, XMLs, audit logs |

**Nota:** Migration 027 (`rls_blindagem`) já aplica algumas policies. As novas migrations (041-046) usam `drop_all_policies()` para limpar policies existentes antes de aplicar as novas, portanto supersede a 027.

**Rollback:** Função `drop_all_policies(table)` permite reverter tabela por tabela ou sprint inteiro em emergência.

### 2.5 Estrutura de Execução por Sprint

Cada sprint segue 4 blocos sequenciais:

```
Bloco A: Schema (migrations + triggers + views + RLS)
    ↓
Bloco B: Services (types + services + hooks)
    ↓
Bloco C: UI (componentes + páginas)
    ↓
Bloco D: Integração (fluxo E2E + QA visual)
```

Dentro de cada bloco, tasks independentes rodam em subagents paralelos.

---

## 3. Sprint 1: Catálogo de Produtos + Precificação

### 3.1 Objetivo

**De:** Orçamento mostra R$0 (arrays vazios, sem produto selecionável)
**Para:** Orçamento com preço REAL calculado a partir de composição do produto

### 3.2 Escopo

- CRUD completo de Produtos com hierarquia Produto → Modelo → Composição
- Composição = BOM (Bill of Materials): materiais + equipamentos + acabamentos + % desperdício
- Precificação com 4 componentes iniciais (MP, MO, Acabamento, Máquina) — expandir para 10 depois
- Editor de orçamento conectado ao catálogo: selecionar produto → ver preço real
- RLS: vendedor vê só seus orçamentos, admin vê tudo, produção não vê preços

### 3.3 Critérios de Sucesso

1. CRUD completo de Produtos com hierarquia Produto → Modelo → Composição
2. Editor de orçamento calcula preço ≠ R$0 quando produto real selecionado
3. Pelo menos 20 produtos reais da Croma cadastrados e precificados
4. Regras de precificação (markup mínimo, desconto máximo) com validação visual
5. RLS aplicada nas 11 tabelas do catálogo

### 3.4 Riscos (Inversão - Munger)

- **NÃO** tentar replicar 100% dos 10 componentes Mubisys — começar com 4
- **NÃO** separar CRUD de produtos da tela de orçamento — testar juntos
- **NÃO** terminar com dados fake — precisa de produtos reais para validação

### 3.5 Componentes UI

#### TreeView — Hierarquia Produto > Modelo > Composição
**Arquivo:** `src/shared/components/TreeView.tsx`

- Nível 0 (Produto): Card com ícone, badge "X modelos", chevron expand
- Nível 1 (Modelo): Indentado 24px, badge "X composições", thumbnail
- Nível 2 (Composição): Indentado 48px, lista material + equipamento + acabamento
- Click seleciona e abre painel lateral
- Searchable com filtro inline

#### PricingBreakdown — Calculadora de componentes
**Arquivo:** `src/shared/components/PricingBreakdown.tsx` (shared — reusado em orçamento, OS, simulador)

- Tabela 2 colunas: Componente | Valor R$ | % do total
- Barra visual empilhada (stacked bar) com proporção de cada componente
- Cores fixas: MP(azul), CF(slate), MO(amber), TF(purple), CI(cyan), CE(orange), TB(teal), TR(rose), DT(indigo), ML(emerald)
- Modo compacto: apenas total + tooltip
- Modo edição: inputs inline com recálculo em tempo real

#### StepWizard — Reutilizável
**Arquivo:** `src/shared/components/StepWizard.tsx`

- Barra horizontal com círculos numerados
- Step ativo: bg-blue-600 text-white
- Steps completos: bg-emerald-100 text-emerald-600 + check
- Steps futuros: bg-slate-100 text-slate-400
- Responsivo: em mobile mostra "2 de 5"

### 3.6 Layouts de Página

#### Catálogo de Produtos (`/dados/produtos`)
Master-detail com TreeView sidebar (320px) + painel de detalhe (flex-1) com Tabs: Modelos, Composições, Precificação, Histórico.

#### Editor de Orçamento (`/pedidos/:id/precificacao`)
Tabela editável com linhas expandíveis mostrando PricingBreakdown por item. Recálculo em cascata: alterar MP recalcula total, alterar condição pagamento recalcula TF.

### 3.7 Decisões que Travam

1. **Hierarquia de produto:** `produtos` → `produto_modelos` → BOM via tabelas existentes `modelo_materiais` + `modelo_processos` — NÃO mudar depois. Tabelas `modelo_materiais` e `modelo_processos` já existem (migration 001); Sprint 1 aprimora-as com colunas de desperdício e custo
2. **Composição = BOM:** cada modelo compõe-se de materiais (`modelo_materiais`), processos/equipamentos (`modelo_processos`) e acabamentos. Cada entrada tem % desperdício
3. **`produto_id` como FK:** em `proposta_itens` e `pedido_itens` — obrigatório para itens de produto, nullable para serviços avulsos
4. **Preço:** `numeric(12,4)` no Postgres

**Nota sobre tabelas existentes:** As tabelas `modelo_materiais` e `modelo_processos` já existem no schema atual. Sprint 1 não cria novas tabelas BOM — aprimora as existentes com colunas `percentual_desperdicio`, `custo_unitario`, `unidade_medida`. A tabela `modelo_composicoes` referenciada em migration 038 é condicional (IF EXISTS) e não será criada; usamos `modelo_materiais` + `modelo_processos` diretamente.

### 3.8 Decomposição de Tasks

#### Bloco A — Schema (Sessão 1, sequencial)
| # | Task | Dep |
|---|------|-----|
| A1 | Migration: tabela `categorias_produto` (árvore hierárquica com parent_id) | - |
| A2 | Migration: ALTER `modelo_materiais` e `modelo_processos` — adicionar colunas BOM (percentual_desperdicio, custo_unitario, unidade_medida) | - |
| A3 | Migration: `regras_precificacao` (10 componentes: MP,CF,MO,TF,CI,CE,TB,TR,DT,ML) | - |
| A4 | Migration: views — ver definições abaixo | A1-A3 |
| A5 | Migration: RLS policies (041 helpers + 042 catálogo). Nota: supersede policies de migration 027 via `drop_all_policies()` | A1-A4 |

**Definições das views (Task A4):**

`v_produto_custo_completo`:
```sql
-- Custo total de cada produto/modelo baseado na composição BOM
SELECT p.id AS produto_id, pm.id AS modelo_id, p.nome, pm.nome AS modelo_nome,
  SUM(CASE WHEN mm.material_id IS NOT NULL
    THEN m.preco_unitario * mm.quantidade * (1 + COALESCE(mm.percentual_desperdicio, 0) / 100.0)
    ELSE 0 END) AS custo_materiais,
  SUM(CASE WHEN mp.processo_id IS NOT NULL
    THEN mp.custo_unitario * mp.tempo_estimado
    ELSE 0 END) AS custo_processos
FROM produtos p
JOIN produto_modelos pm ON pm.produto_id = p.id
LEFT JOIN modelo_materiais mm ON mm.modelo_id = pm.id
LEFT JOIN materiais m ON m.id = mm.material_id
LEFT JOIN modelo_processos mp ON mp.modelo_id = pm.id
GROUP BY p.id, pm.id, p.nome, pm.nome;
```

`v_material_sem_preco`:
```sql
-- Materiais referenciados em composições que não têm preço cadastrado
SELECT DISTINCT m.id, m.nome, m.codigo, m.unidade_medida
FROM modelo_materiais mm
JOIN materiais m ON m.id = mm.material_id
WHERE m.preco_unitario IS NULL OR m.preco_unitario = 0;
```

**Paralelismo:** A1 ∥ A2 ∥ A3 (todos independentes). A4 depende tudo.

#### Bloco B — Services (Sessão 1-2)
| # | Task | Dep |
|---|------|-----|
| B1 | Types: `catalogo.types.ts` | A |
| B2 | Types: `precificacao.types.ts` | A |
| B3 | Service: `catalogoService.ts` (CRUD produto+modelo+composição) | B1 |
| B4 | Service: `precificacaoService.ts` (cálculo 10 componentes) | B2 |
| B5 | Hook: `useCatalogo.ts` (TanStack Query) | B3 |
| B6 | Hook: `usePrecificacao.ts` | B4 |

**Paralelismo:** B1 ∥ B2. B3 dep B1. B4 dep B2. B5 ∥ B6.

#### Bloco C — UI (Sessão 2-3)
| # | Task | Dep |
|---|------|-----|
| C1 | Refactor: AdminProdutosPage — hierarquia categorias | B5 |
| C2 | Componente: ComposicaoEditor (BOM visual) | B5 |
| C3 | Componente: PrecificacaoSimulador (preview tempo real) | B6 |
| C4 | Refactor: AdminPrecificacaoPage — integrar simulador | C3 |
| C5 | Refactor: AdminProdutosPage → renomear para CatalogoProdutosPage em `src/domains/admin/pages/`, adicionar filtros e busca | B5 |

**Paralelismo:** C1 ∥ C3.

#### Bloco D — Integração (Sessão 3-4)
| # | Task | Dep |
|---|------|-----|
| D1 | Integração: Orçamento busca preço do catálogo | C2,C4 |
| D2 | Testes: catalogoService + precificacaoService | B3,B4 |
| D3 | Visual QA: fluxo completo no browser | D1 |
| D4 | Seed data: produtos exemplo da Croma | A5 |

---

## 4. Sprint 2: Estoque Real

### 4.1 Objetivo

**De:** Estoque decorativo (3 telas sem integração real)
**Para:** Saldo real com semáforo, reserva por OP, alertas automáticos

### 4.2 Escopo

- Saldo real por material (computed, não stored)
- Semáforo verde/amarelo/vermelho baseado em estoque mínimo/ideal
- Movimentação rastreável: toda entrada/saída com `referencia_tipo` + `referencia_id`
- Recebimento de compra → entrada automática no estoque
- Custo médio automático recalculado a cada entrada
- **NÃO incluir** estoque fracionado (retalhos) — complexidade adiada para sprint futuro

### 4.3 Critérios de Sucesso

1. Saldo real por material visível no dashboard (disponível vs reservado vs total)
2. Toda movimentação tem `referencia_tipo` + `referencia_id`
3. Alerta automático quando material < estoque_mínimo
4. Recebimento de compra gera entrada automática
5. RLS: almoxarife edita estoque, vendedor só consulta

### 4.4 Riscos

- **NÃO** implementar estoque fracionado neste sprint (armadilha de complexidade)
- **NÃO** deixar movimentações sem `usuario_id` — sem rastreabilidade
- Testar ciclo completo: compra → recebimento → entrada → reserva → consumo → baixa

### 4.5 Componentes UI

#### SemaforoBadge
**Arquivo:** `src/shared/components/SemaforoBadge.tsx`

- Círculo preenchido (8/12/16px) + label opcional
- Verde: `bg-emerald-500` (acima do ideal)
- Amarelo: `bg-amber-500` (entre mínimo e ideal), `animate-pulse` quando pulsing
- Vermelho: `bg-red-500` (abaixo do mínimo), `animate-pulse`

#### MovementTimeline
**Arquivo:** `src/domains/estoque/components/MovementTimeline.tsx`

- Timeline vertical com ícone por tipo (entrada=verde, saída=laranja, ajuste=slate)
- Agrupamento por dia com separador de data
- Data relativa, usuário, quantidade, observação

### 4.6 Layouts

#### Dashboard Estoque (refatorar)
- Usar KpiCard do shared (eliminar duplicata local)
- Adicionar SemaforoBadge em cada card de saldo
- Tabs: Saldos | Movimentações | Alertas
- Tab Alertas com ação rápida "Solicitar compra"

#### Detalhe Material
- Ficha com AreaChart (evolução saldo 30 dias) + MovementTimeline

### 4.7 Decisões que Travam

1. **Saldo = computed:** `SUM(entradas) - SUM(saídas)`. View materializada ou função, NUNCA coluna updatable
2. **Reserva = movimentação:** `tipo = 'reserva'` com `referencia_id = ordem_producao_id`
3. **Lote/rastreabilidade:** coluna `lote` nullable agora — mais barato que alterar depois
4. **Custo médio:** `preco_medio` recalculado a cada entrada via trigger

### 4.8 Decomposição de Tasks

#### Bloco A — Schema
| # | Task | Dep |
|---|------|-----|
| A1 | Migration: ALTER `estoque_saldos` — converter de colunas stored para view materializada `v_estoque_saldos` calculada como SUM(entradas)-SUM(saídas) de `estoque_movimentacoes`. Manter tabela original como backup temporário, criar view com mesma interface | - |
| A2 | Migration: tabela `estoque_reservas` (reserva por OS, tipo, status, liberação automática via trigger) | - |
| A3 | Migration: ADD COLUMN `lote` VARCHAR nullable em `estoque_movimentacoes` (rastreabilidade futura) | - |
| A4 | Migration: triggers `auto_reserva_os` (OP criada → reserva), `auto_baixa_producao` (OP concluída → saída), `auto_custo_medio` (entrada → recalcula preço médio) | A1,A2 |
| A5 | Migration: view `v_estoque_semaforo` (saldo vs mínimo vs ideal → verde/amarelo/vermelho) | A1 |
| A6 | Migration: RLS (043) — 13 tabelas | A1-A5 |

**Paralelismo:** A1 ∥ A2 ∥ A3. A4 depende A1+A2. A5 depende A1.

#### Bloco B — Services
| B1 | Types: atualizar `estoque.types.ts` com Reserva, Lote, Semaforo |
| B2 | Service: `reservaService.ts` (reservar/liberar por OS) |
| B3 | Refactor: `useEstoqueSaldos.ts` — integrar semáforo + reservas |

#### Bloco C — UI
| C1 | Refactor: EstoqueDashboardPage — semáforo + KPIs reais (usar shared KpiCard) |
| C2 | Componente: ReservaOS (mostrar reservas por OS) |
| C3 | Refactor: MovimentacoesPage — filtros avançados, export CSV |

#### Bloco D — Integração
| D1 | Trigger: OS aprovada → reserva automática de materiais |
| D2 | Trigger: Etapa produção concluída → baixa automática |
| D3 | Visual QA completo |

---

## 5. Sprint 3: PCP / Produção

### 5.1 Objetivo

**De:** Kanban visual-only (sem integração com pedidos/estoque)
**Para:** Produção integrada: pedido aprovado → OP → reserva material → apontamento → baixa estoque

### 5.2 Escopo

- Pedido aprovado gera OP automaticamente com etapas baseadas na composição
- Routing automático (9 setores, regras configuráveis)
- Apontamento por operador (início/pausa/fim) via tablet
- Reserva de material ao iniciar OP, baixa ao concluir
- Dashboard PCP: OPs atrasadas, utilização por setor, retrabalho

### 5.3 Critérios de Sucesso

1. Pedido aprovado gera OP com etapas automáticas
2. Operador faz apontamento via mobile/tablet
3. Reserva/baixa de material integrada com estoque
4. Dashboard PCP: atrasadas, utilização, retrabalho
5. OP finalizada → pedido_itens.status = 'produzido'

### 5.4 Riscos

- **NÃO** construir PCP sem validação do Edmar (operador real)
- Começar com apontamento simples ("concluído") antes de complexo (por operador/máquina/etapa)
- Produção desconectada do estoque diverge em dias

### 5.5 Componentes UI

#### KanbanBoard — Quadro de produção real
**Arquivo:** `src/shared/components/KanbanBoard.tsx`

- Colunas lado a lado com scroll horizontal
- Header: cor (left border 4px) + título + count badge
- Cards arrastáveis: OS número, cliente, badge prioridade, prazo com cor
- Drop zone com visual feedback
- Colunas padrão: Aguardando | Criação | Impressão | Router | Acabamento | Serralheria | Expedição

#### GanttTimeline — Carga de máquinas
**Arquivo:** `src/shared/components/GanttTimeline.tsx`

- Eixo Y: recursos (máquinas), agrupados por tipo
- Eixo X: horas do dia (8h-18h)
- Barras coloridas por status: produção(blue), agendado(blue-200), atraso(red), concluído(emerald)
- Linha vermelha vertical "agora"
- Implementar com SVG + divs (Recharts não suporta Gantt)

#### SectorQueue — Fila por setor
**Arquivo:** `src/domains/producao/components/SectorQueue.tsx`

- Interface mobile-first para operador no chão de fábrica
- Próximo item priorizado automaticamente
- Botões rápidos: Iniciar / Pausar / Concluir
- Progress bar por OS

### 5.6 Layouts

#### PCP Dashboard (`/producao/pcp`)
KPIs (OS em prod, atrasadas, capacidade %, entregas hoje) + GanttTimeline + Routing Rules + Alertas Capacidade.

#### Kanban Produção (`/producao/kanban`)
Board fullscreen, 7 colunas, drag & drop real, filtro por setor.

#### Fila do Setor (`/producao/setor/:sectorId`)
Interface mobile-first: próximo item destacado com "INICIAR PRODUÇÃO", lista de fila priorizada, progress bars.

### 5.7 Decisões que Travam

1. **Etapas = templates configuráveis:** por categoria de produto, não hardcoded
2. **Apontamento = evento imutável:** cada início/fim é registro. Status derivado do último apontamento
3. **Trigger OP finalizada → pedido_itens.status:** integração via trigger Postgres
4. **Restrição financeira:** coluna `restricao_financeira` na OP, atualizada pelo módulo financeiro

### 5.8 Mobile / Tablet (chão de fábrica)

- Tablet é interface principal da produção
- Cards com touch targets ≥ 44px
- QR Code scan: câmera do tablet lê QR da OS e abre detalhes
- Orientação paisagem forçada no Gantt

---

## 6. Sprint 4: Motor Financeiro

### 6.1 Objetivo

**De:** CR/CP básicos com DRE de percentuais fixos
**Para:** Fluxo de caixa projetado, bloqueio inadimplência, comissão automática, DRE real

### 6.2 Escopo

- Pedido aprovado → CR automática (respeitando parcelas/condição pagamento)
- Baixa de pagamento (total/parcial/desconto) com atualização de saldo
- Fluxo de caixa realizado vs previsto
- Comissão do vendedor gerada ao faturar
- Badge visual para cliente inadimplente (sem bloquear produção neste sprint — regra impactante requer consenso)
- DRE com dados reais (não percentuais fixos)

### 6.3 Critérios de Sucesso

1. Pedido aprovado gera CR automática com parcelas
2. Baixa atualiza status e saldo automaticamente
3. Fluxo de caixa com acurácia > 90% vs extrato
4. Comissão gerada automaticamente ao faturar
5. Cliente inadimplente recebe badge visual

### 6.4 Riscos

- **NÃO** implementar bloqueio de produção por inadimplência sem validação da diretoria
- **NÃO** fazer conciliação sem parser OFX/CSV robusto (cada banco = formato diferente)
- Saldo como campo computed, NUNCA editável

### 6.5 Componentes UI

#### CashFlowChart — Projeção de fluxo de caixa
**Arquivo:** `src/domains/financeiro/components/CashFlowChart.tsx`

- Barras: entradas(verde) + saídas(vermelha)
- Linha: saldo acumulado(azul)
- Projeção futura: opacidade 40% + stroke tracejado
- Zona de perigo: área vermelha quando saldo projetado < 0
- Períodos: 7d, 30d, 90d, 12m

#### AgingTable — Análise de envelhecimento
**Arquivo:** `src/domains/financeiro/components/AgingTable.tsx`

- 5 buckets: A vencer | 1-30 | 31-60 | 61-90 | 90+
- Gradiente de cor: verde → amarelo → laranja → vermelho → vermelho escuro
- Click no bucket filtra tabela detalhada
- Subtotal por cliente (colapsável)

#### CreditBlockBanner — Banner inadimplência
**Arquivo:** `src/shared/components/CreditBlockBanner.tsx`

- Alert vermelho (`bg-red-50 border-red-300`) fixo no topo
- Ícone ShieldAlert + "Cliente BLOQUEADO"
- Botão "Liberar (Admin)" com Dialog de confirmação + motivo obrigatório
- Aparece em: orçamento, OS, pedido

### 6.6 Layouts

#### Fluxo de Caixa (`/financeiro/fluxo-caixa`)
KPIs (saldo atual, entradas 30d, saídas 30d, projeção) + CashFlowChart + Tabs dia-a-dia/categorias/projeção.

#### Contas a Receber (refatorar)
AgingTable no topo + tabela com busca/filtros + ações (baixar, enviar).

#### DRE (refatorar)
- Eliminar percentuais fixos (45/25/30%)
- Usar categorias reais de plano de contas
- Drill-down: click na linha abre diálogo com títulos
- Toggle regime de caixa/competência

### 6.7 Decisões que Travam

1. **Saldo = valor_original - valor_pago:** computed via trigger
2. **Parcelas filhas da conta:** `contas_receber` 1→N `parcelas_receber` (já existe em migration 001)
3. **Lançamento de caixa = registro fiscal:** TUDO que entra/sai é `lancamentos_caixa`
4. **Comissão vincula CR:** `comissoes.conta_receber_id` (já existe em migration 001) — comissão paga quando cliente paga

---

## 7. Sprint 5: NF-e

### 7.1 Objetivo

**De:** Módulo fiscal com schemas mas sem emissão real
**Para:** NF-e emitida, autorizada pela SEFAZ, com DANFE PDF

### 7.2 Escopo

- Emissão de NF-e a partir de OS concluída
- Provedor externo (Focus NFe ou Nuvem Fiscal) — NÃO construir XML do zero
- XML assinado → SEFAZ → protocolo de autorização
- DANFE PDF para impressão/email
- NF vinculada a CR no financeiro
- Cancelamento e carta de correção

### 7.3 Critérios de Sucesso

1. NF-e emitida com campos fiscais corretos (CFOP, NCM, ICMS, PIS, COFINS)
2. XML assinado, enviado, com protocolo de autorização
3. DANFE PDF gerado
4. NF vinculada a CR
5. Cancelamento dentro do prazo legal (24h)

### 7.4 Riscos

- **USAR** provedor externo — 500+ campos com regras por UF
- **NÃO** testar direto em produção SEFAZ — multa por nota inválida
- Verificar regime tributário da Croma (Simples? Lucro Presumido? Lucro Real?)
- Certificado A1 vs A3 muda completamente a implementação

### 7.5 Componentes UI

#### InvoiceWizard — Wizard de emissão (usa StepWizard do Sprint 1)
5 steps: Dados Gerais → Destinatário → Itens (com "Buscar dados de O.S.") → Impostos (cálculo auto) → Revisão + Emitir

#### TaxDisplay — Exibição de impostos
**Arquivo:** `src/domains/fiscal/components/TaxDisplay.tsx`

- Grid 3-col com mini-cards por imposto (ICMS, IPI, PIS, COFINS, ISS)
- Total destacado
- Modo inline para tabelas compactas

#### DocumentStatusTracker — Timeline de status NF-e
**Arquivo:** `src/domains/fiscal/components/DocumentStatusTracker.tsx`

- 5 checkpoints horizontais: Criada → Validada → Assinada → Transmitida → Autorizada/Rejeitada
- Step ativo com spinner
- Step com erro: ícone X vermelho + tooltip com código SEFAZ

### 7.6 Decisões que Travam

1. **Provedor como abstraction layer:** `fiscal-provider.ts` já existe como interface. Manter
2. **XML imutável:** armazenar no Supabase Storage, nunca editar após envio
3. **NCM/CFOP obrigatórios:** em produtos a partir deste sprint. Produtos sem NCM bloqueados para faturamento
4. **Certificado digital:** .pfx criptografado no vault, chave em env var da edge function

---

## 8. Componentes Shared — Resumo

| Componente | Sprint | Reuso |
|---|---|---|
| `TreeView` | 1 | Catálogo, plano de contas, categorias |
| `PricingBreakdown` | 1 | Orçamento, OS, simulador |
| `StepWizard` | 1 | NF-e wizard, import wizard |
| `SemaforoBadge` | 2 | Estoque, produção, financeiro |
| `MovementTimeline` | 2 | Estoque, audit log |
| `KanbanBoard` | 3 | Produção, funil vendas |
| `GanttTimeline` | 3 | PCP, cronograma instalação |
| `SectorQueue` | 3 | Fila produção |
| `CashFlowChart` | 4 | Fluxo de caixa, projeção |
| `AgingTable` | 4 | AR, AP, inadimplência |
| `CreditBlockBanner` | 4 | Orçamento, OS, pedido |
| `TaxDisplay` | 5 | NF-e, simulador fiscal |
| `DocumentStatusTracker` | 5 | NF-e, boletos |

---

## 9. Refatorações Necessárias (antes dos sprints)

1. **EstoqueDashboardPage:** Substituir KpiCard local pelo shared
2. **FiscalDashboardPage:** Remover `brl()` e `formatDate()` locais, importar de `@/shared/utils/format`
3. **DrePage:** Eliminar percentuais fixos (45/25/30%), usar categorias reais

---

## 10. Dependências de Pacotes

- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop para Kanban (se não instalado)
- Recharts (já instalado) — suficiente para todos os charts exceto Gantt
- **NÃO adicionar** libs pesadas (ag-grid, devextreme, fullcalendar)

---

## 11. Estratégia de Execução

### Modelo
- **Opus** planeja (specs, plans, arquitetura)
- **Sonnet** executa (código, migrations, UI)

### Princípios
1. Migrations primeiro, sempre (via Supabase MCP)
2. 1 commit atômico por task
3. Quality gates por bloco (SELECT validação → testes → screenshot → E2E)
4. Máximo 3-4 tasks por sessão
5. Ao atingir ~60% da janela de contexto → salvar estado e nova sessão

### Checklist Pré-Sessão
```
CONTEXTO: Sprint [X] — [Nome] — Sessão [Y] de [Z]
BLOCO: [A/B/C/D]
TASKS: [lista das tasks desta sessão]
ESTADO: [o que já foi feito]
ARQUIVOS-CHAVE: [3-5 arquivos que serão tocados]
MIGRATION PENDENTE: [sim/não]
```

### Documentos de Referência
- **RLS Strategy:** `docs/rls-strategy.sql` (SQL pronto para cada sprint)
- **Execution Strategy:** Inline neste documento (seção 11) + detalhes por sprint nas seções 3-7
- **Nomes corretos de tabelas:** pedidos_compra, pedido_compra_itens, estoque_movimentacoes, fiscal_documentos, proposta_itens

---

## 12. Meta-Princípio (Peter Thiel)

> O CRM-Croma só se diferencia do Mubisys se for mais RÁPIDO de usar, não se tiver mais funcionalidades. Cada sprint deve REDUZIR cliques, não adicionar telas. O orçamento que mostra R$0 é mais danoso que 10 features faltantes.

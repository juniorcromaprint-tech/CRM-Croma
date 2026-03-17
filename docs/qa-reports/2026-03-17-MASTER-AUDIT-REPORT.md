# AUDITORIA MASTER — ERP CROMA PRINT
## 2026-03-17 | Força Máxima | 5 Agentes Opus em Paralelo

---

## RESUMO EXECUTIVO

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AUDITORIA MASTER — CROMA ERP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Agentes executados:
    [✓] Sistema 2 — Multi-Agente (5 sub-agentes)     26 issues
    [✓] xQuads Design Squad — UX/UI                  10 top issues
    [✓] xQuads Data Squad — Arquitetura de Dados      36 issues
    [✓] xQuads Hormozi — Valor de Negócio             18 módulos avaliados
    [✓] Sistema 1 — QA Sequencial (17 passos)        19 issues

  RESULTADO CONSOLIDADO:
    CRÍTICOS:  15
    ALTOS:     26
    MÉDIOS:    26
    BAIXOS:    17
    ─────────────────
    TOTAL:     84

  SCORES:
    UX/UI:           6.8/10
    Dados:           5.3/10
    Valor Negócio:   CRM com precificação (não é ERP ainda)
    Fluxo E2E:       PARCIALMENTE APTO (65% dos passos OK)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VEREDITO: PARCIALMENTE APTO — 3 BLOQUEADORES CRÍTICOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## TOP 12 PROBLEMAS CRÍTICOS (consolidados de todos os agentes)

### BUGS DE CÓDIGO (corrigir HOJE — <4h)

| # | Issue | Fonte | Arquivo | Fix |
|---|-------|-------|---------|-----|
| 1 | **Import supabase ausente** — crash ao deletar leads | Sistema 2 | `LeadDetailPage.tsx` | Adicionar import + mudar para soft delete |
| 2 | **Status pedido incorreto** — "aguardando_aprovacao" quebra fluxo Venda→Produção | Sistema 2 | `orcamento.service.ts:788` | Mudar para "aprovado" ou "em_producao" |
| 3 | **area_m2 não calculada** — custo de materiais por área = zero | Sistema 2 | Schema modelos | Trigger: area_m2 = largura*altura/10000 |

### DADOS E SEGURANÇA (corrigir esta semana)

| # | Issue | Fonte | Impacto |
|---|-------|-------|---------|
| 4 | **Soft delete ausente em 68/70 tabelas** | Data Squad | Exclusões permanentes sem rastreabilidade |
| 5 | **3 triggers INOPERANTES** (producao→estoque, compras→estoque, compras→financeiro) | Data Squad | Dados inconsistentes silenciosamente |
| 6 | **RLS permissiva em ~47 tabelas** — `USING (true)` | Data Squad | Qualquer usuário acessa dados financeiros |
| 7 | **FKs polimórficas sem constraint** (attachments, movimentacoes) | Data Squad | Orphan records inevitáveis |
| 8 | **TypeScript desalinhado do schema** em 3 domínios | Data Squad | Bugs silenciosos em runtime |

### UX/UI (corrigir no próximo sprint)

| # | Issue | Fonte | Impacto |
|---|-------|-------|---------|
| 9 | **Dual toast system** (Toaster + Sonner) | Design Squad | Notificações duplicadas/inconsistentes |
| 10 | **Paleta gray vs slate misturada** em 4 módulos | Design Squad | Parece dois sistemas diferentes |
| 11 | **29 aria-labels em 441 arquivos** | Design Squad | WCAG violation, inacessível |

### NEGÓCIO (estratégico)

| # | Issue | Fonte | Impacto |
|---|-------|-------|---------|
| 12 | **3 motores ausentes**: PCP/Produção, Financeiro (CP/CR), Estoque | Hormozi Squad | "CRM com precificação, não ERP" |

---

## DIAGNÓSTICO POR CAMADA

### Camada 1 — Fluxo E2E (Sistema 2)

```
Lead → Cliente → Orçamento → Portal → Aprovação → Pedido → Produção → Financeiro → Entrega
  ✓       ⚠         ✓          ✓         ✓          ⚠         ✓          ⚠           ✓

⚠ Lead: import faltando (crash no delete)
⚠ Pedido: status incorreto (produção não enxerga)
⚠ Financeiro: NF-e sem SEFAZ, boleto sem banco configurado
```

**3 quebras de fluxo identificadas:**
1. Pedido→Produção: status "aguardando_aprovacao" não é reconhecido
2. NF-e→SEFAZ: edge function não conectada
3. Boleto→Banco: bank_accounts vazia

### Camada 2 — Dados (Data Squad)

**Score: 5.3/10**

| Domínio | Score | Pior Issue |
|---------|:-----:|------------|
| Fiscal (NF-e) | 8.5 | Melhor módulo — schema maduro |
| Banking/Boletos | 7.5 | Naming em inglês |
| Produtos/Precificação | 7.0 | Faltam 7 componentes de preço vs Mubisys |
| Propostas | 6.5 | Conflito de sequences |
| Pedidos | 6.0 | Sem soft delete |
| Instalação/Campo | 6.0 | Naming misto |
| Clientes | 5.5 | cnpj vs cpf_cnpj duplicado |
| Produção | 5.0 | Trigger estoque INOPERANTE |
| Estoque/Compras | 4.5 | 2 triggers INOPERANTES |
| Financeiro | 4.5 | Saldo nullable, RLS aberta |
| Comercial | 4.0 | Sem soft delete, sem funil visual |
| Qualidade | 3.5 | TypeScript com campos fantasma |
| Core/Admin | 3.0 | Permissões existem mas não são usadas |

### Camada 3 — UX/UI (Design Squad)

**Score: 6.8/10**

| Módulo | Score | Destaque |
|--------|:-----:|----------|
| Comissões | 8.5 | Melhor UX do sistema |
| TV Produção | 8.5 | Dark theme dedicado, zero interação |
| Dashboard | 8.0 | 4 roles, skeleton loaders, AI |
| Orçamentos | 8.0 | KPIs + tabela/cards responsivos |
| Almoxarife | 6.0 | Pior — paleta errada, padding duplo |
| Campanhas | 6.5 | Badge local conflita com shadcn |

**Design System Maturity: 2.5/5 (Managed)**
- Tokens parciais, componentes não compartilhados
- 6 componentes deveriam ser extraídos para shared/

### Camada 4 — Valor de Negócio (Hormozi Squad)

**Diagnóstico: "CRM com precificação sofisticada, mas falta o backend operacional"**

**Top 3 módulos de maior valor (já implementados):**
1. TV Produção — Score 72.0 (zero esforço, elimina interrupções)
2. Dashboards — Score 56.0 (visibilidade instantânea por role)
3. Faturamento em Lote — Score 16.0 (economia 2-3h/semana)

**Módulos que NÃO agregam valor para gráfica 10-30 func:**
- Campanhas (0.80) — gráfica vende por relacionamento
- OneDrive Integration (0.40) — frágil, complexo
- ProgressTracker (3.75) — útil só para dev

**3 motores ausentes para ser ERP:**
1. Motor Operacional (PCP + Board Produção interativo)
2. Motor Financeiro (CP/CR + Fluxo de Caixa)
3. Motor de Estoque (materiais + fracionado + reserva por OS)

---

## 20 GAPS vs MUBISYS (consolidados)

| # | Gap | Prioridade | Esforço |
|---|-----|:----------:|---------|
| 1 | PCP / Board Produção interativo (9 setores) | URGENTE | 2-3 dias |
| 2 | Contas a Pagar / Contas a Receber completo | URGENTE | 2-3 dias |
| 3 | Fluxo de Caixa (dashboard receitas vs despesas) | ALTA | 1-2 dias |
| 4 | Funil de Vendas Kanban visual | ALTA | 1-2 dias |
| 5 | Permissões granulares por menu/submenu | ALTA | 3-4 dias |
| 6 | Estoque fracionado (mapa visual de retalhos) | ALTA | 1 semana |
| 7 | Bloqueio financeiro de produção | ALTA | 3h |
| 8 | 10 componentes de preço (faltam TF, CI, CE, TB, TR, DT, ML) | ALTA | 4h |
| 9 | Acabamento com BOM + alteração dimensional | MÉDIA | 2-3 dias |
| 10 | NF-e conectada ao SEFAZ | MÉDIA | depende de API |
| 11 | Equipamento com custo por tipo (m²/h vs R$/hora) | MÉDIA | 2h |
| 12 | MubiChat (chat interno por tickets) | MÉDIA | 1 semana |
| 13 | Log de acesso completo (audit trail) | MÉDIA | 4h |
| 14 | Auto-routing produção (Instalação, Terceirizados, Expedição) | MÉDIA | 3h |
| 15 | 3 canais de observação por OS (Cliente, Produção, Financeiro) | MÉDIA | 2h |
| 16 | Cadastro operacional (Produtos > Modelos > Composição com BOM) | MÉDIA | 3 dias |
| 17 | Condição de pagamento impacta precificação (TF) | MÉDIA | 4h |
| 18 | Classificação dupla de clientes (Perfil + Origem) | BAIXA | 2h |
| 19 | MubiDrive (file manager organizado por OS) | BAIXA | 1 semana |
| 20 | Quadro de Avisos | BAIXA | 1 dia |

---

## PLANO DE AÇÃO PRIORIZADO

### 🔴 SEMANA 1 — BLOQUEADORES (fazer AGORA)

**Dia 1-2: Bugs Críticos de Código**
```
[ ] Fix #1: Adicionar import supabase em LeadDetailPage.tsx + soft delete
[ ] Fix #2: Mudar status pedido para "aprovado" em orcamento.service.ts:788
[ ] Fix #3: Trigger area_m2 = largura_cm * altura_cm / 10000
[ ] Fix #4: Validar CNPJ no cadastro direto de clientes
[ ] Fix #5: Propagar condições de pagamento para pedido
```

**Dia 3-4: Triggers e Dados**
```
[ ] Fix #6: Corrigir fn_producao_estoque (modelo_id)
[ ] Fix #7: Corrigir fn_compra_gera_conta_pagar (colunas)
[ ] Fix #8: Corrigir fn_compra_recebimento_estoque (quantidade_disponivel)
[ ] Fix #9: Corrigir TypeScript types (compras, qualidade, estoque)
[ ] Fix #10: Resolver conflito de sequences em propostas
```

**Dia 5: UX Quick Fixes**
```
[ ] Fix #11: Remover dual toast — manter apenas Sonner
[ ] Fix #12: Substituir gray-* por slate-* em 4 arquivos
[ ] Fix #13: Remover padding duplicado p-6 em ~15 páginas
[ ] Fix #14: Configurar Calendar locale ptBR
```

### 🟡 SEMANA 2-3 — MOTORES CORE

**Sprint 1: Motor Financeiro (Semana 2)**
```
[ ] Contas a Pagar básico (tabela + vencimentos + semáforo)
[ ] Contas a Receber básico (vinculado a pedido/OS)
[ ] Fluxo de Caixa simplificado (3 cards + gráfico 6 meses)
[ ] Soft delete nas 10 tabelas transacionais críticas
[ ] RLS granular mínima em dados financeiros
```

**Sprint 2: Motor Operacional (Semana 3)**
```
[ ] Board Produção interativo (Kanban 9 setores, drag-and-drop)
[ ] PCP básico (OS → fila de produção por setor)
[ ] Funil de Vendas Kanban (transformar Propostas)
[ ] Permissões por role nos menus laterais
```

### 🟢 SEMANA 4-6 — COMPLETUDE

**Sprint 3: Motor de Estoque + Integrações**
```
[ ] Estoque de materiais (semáforo verde/amarelo/vermelho)
[ ] Estoque fracionado (mapa visual de retalhos)
[ ] Bloqueio financeiro de produção
[ ] Indexes faltantes (6 tabelas)
```

**Sprint 4: Polish + Gaps Mubisys**
```
[ ] Acabamento com BOM + alteração dimensional
[ ] 10 componentes de preço
[ ] Audit trail global
[ ] Componentes shared extraídos (KpiCard, EmptyState, etc.)
[ ] aria-labels em todos os botões icon-only
```

### 🔵 BACKLOG

```
[ ] NF-e conectada ao SEFAZ
[ ] MubiChat (chat interno)
[ ] MubiDrive nativo
[ ] Auto-routing produção
[ ] Dark mode toggle
[ ] Storybook / design system docs
```

---

## GRAND SLAM OFFER (Hormozi Squad)

Se o Croma ERP for vendido como SaaS para gráficas:

| Plano | Preço | Vs Mubisys |
|-------|-------|------------|
| Starter (até 5 usuários) | R$297/mês | -63% |
| Pro (até 15 usuários) | R$597/mês | -25% |
| Enterprise (até 30 usuários) | R$997/mês | +25% |

**Garantia**: "Em 30 dias, identifique R$5.000/mês em margem perdida ou devolvemos 100%"

**ROI projetado**: R$60.000 recuperados / R$7.164 investidos = **8.4x de retorno**

**Caminho para vendável**: 6 semanas focadas (Sprints 1-4 acima)

---

## RELATÓRIOS DETALHADOS

| Relatório | Arquivo |
|-----------|---------|
| Multi-Agente (26 issues) | `2026-03-17-sistema2-operations-sim-report.md` |
| UX/UI Design (10 top issues) | `2026-03-17-xquads-design-audit.md` |
| Arquitetura de Dados (36 issues) | `2026-03-17-xquads-data-audit.md` |
| Valor de Negócio (18 módulos) | `2026-03-17-xquads-hormozi-value-audit.md` |
| QA Sequencial (19 issues) | `2026-03-17-sistema1-qa-report.md` ✅ |

### Issues NOVOS do Sistema 1 (não detectados pelos outros agentes)

| # | Severidade | Issue | Impacto |
|---|:----------:|-------|---------|
| 1 | CRÍTICO | OP com status "Concluído 100%" presa na coluna "Em Produção" do Kanban | Produção parece atrasada quando já terminou |
| 2 | CRÍTICO | Sem integração automática pedido → conta a receber | Financeiro manual, risco de esquecer cobrança |
| 3 | CRÍTICO | Data corrompida "20/02/60320" no módulo financeiro | Dados financeiros não confiáveis |
| 4 | ALTO | Valor negativo aceito em Leads | Dados inconsistentes |
| 5 | ALTO | OPs atrasadas sem destaque visual no Kanban | Atrasos passam despercebidos |
| 6 | ALTO | Boletos sem vínculo automático a pedidos | Rastreabilidade perdida |
| 7 | ALTO | Taxa de conversão 0.0% incorreta no Pipeline | Métrica de vendas errada |
| 8 | ALTO | Módulo fiscal sem integração SEFAZ | NF-e não pode ser emitida |

---

*Auditoria Master compilada em 2026-03-17*
*Agentes: Sistema 2 Multi-Agente + xQuads Design Squad + xQuads Data Squad + xQuads Hormozi Squad*
*Modelo: Claude Opus 4.6 (planejamento) + Sonnet 4.6 (execução)*
*Tempo total de execução: ~15 minutos (5 agentes em paralelo)*

# RELATÓRIO DE QA — CENÁRIO BANNER-TESTE
**Agente**: QA Croma ERP
**Data**: 2026-03-13
**Ambiente auditado**: `tender-archimedes.vercel.app` (demo) + `campo-croma.vercel.app` (produção)
**Cenário**: Fluxo E2E completo — Lead → Orçamento → Pedido → Produção → Financeiro → NF-e → Campo

---

## RESUMO EXECUTIVO

| Categoria | Qtd | Impacto |
|---|---|---|
| **BUGS CRÍTICOS** | 11 | Bloqueiam fluxo operacional |
| **BUGS UX** | 12 | Degradam usabilidade |
| **FEATURES PENDENTES** | 3 | Não implementadas |
| **Etapas do fluxo executadas** | 17/17 | 100% cobertura |

**Veredito**: O ERP **NÃO está pronto para uso em produção** como sistema integrado. O fluxo principal (Lead → Faturamento) está quebrado em pelo menos 4 pontos críticos independentes.

---

## BUGS CRÍTICOS

### BC-01 — Motor de Orçamento retorna R$ 0,00
- **Módulo**: Orçamentos
- **Severidade**: P0 — inviabiliza uso comercial
- **Sintoma**: Qualquer novo orçamento criado resulta em valor total R$ 0,00
- **Causa raiz**: Editor envia arrays vazios de `itens_materiais` e `itens_processos` ao motor Mubisys; `modelo_materiais` não está vinculado aos modelos de produto
- **Evidência**: PED-2026-0002 CALÇADOS SERGIO aprovado a R$ 0,00; todos os orçamentos testados = R$ 0,00
- **Fix necessário**: Vincular `modelo_materiais` + corrigir migration 006 + corrigir envio de arrays no editor

### BC-02 — WSOD no "+ Adicionar Item" do Editor de Orçamento
- **Módulo**: Orçamentos → Editor
- **Severidade**: P0 — crash completo da UI
- **Sintoma**: Clicar em "+ Adicionar Item" causa White Screen of Death (WSOD)
- **Causa raiz**: Componente Radix `<Select.Item value="">` recebe `value=""` (string vazia) — prop inválida que derruba o React tree
- **Fix necessário**: Garantir que nenhum `<Select.Item>` receba `value` vazio; usar placeholder separado

### BC-03 — Pedido sem botões de workflow
- **Módulo**: Pedidos → Detalhe
- **Severidade**: P0 — impossível avançar status de pedido via UI
- **Sintoma**: Página de detalhe do pedido não exibe nenhum botão de ação (Confirmar, Cancelar, Avançar status)
- **Evidência**: PED-2026-0002 — zero botões de ação presentes na tela
- **Fix necessário**: Verificar renderização condicional baseada em `status` e `role`; restaurar botões de workflow

### BC-04 — Todos os custos de OP a R$ 0,00
- **Módulo**: Produção → Ordens de Produção
- **Severidade**: P1 — gestão de custos inutilizável
- **Sintoma**: MP Estimado, MP Real, MO Estimado, MO Real todos R$ 0,00 em toda OP
- **Causa raiz**: Tabela `modelo_processos` com 0 registros; `modelo_materiais` desvinculado
- **Fix necessário**: Seed de `modelo_processos` + vinculação de `modelo_materiais` aos modelos

### BC-05 — Rota `/fiscal/emissao` inexistente
- **Módulo**: Fiscal
- **Severidade**: P1 — link quebrado na UI
- **Sintoma**: Navegar para `/fiscal/emissao` (mencionado em vários lugares da UI) redireciona silenciosamente para o Dashboard sem 404
- **Causa raiz**: Rota não registrada no router; rota correta é `/fiscal/fila`
- **Fix necessário**: Criar alias `/fiscal/emissao` → `/fiscal/fila` OU corrigir todos os links

### BC-06 — Rota `/financeiro/boletos` inexistente (Módulo Boleto não implementado)
- **Módulo**: Financeiro
- **Severidade**: P1 — feature anunciada mas ausente
- **Sintoma**: `/financeiro/boletos` redireciona para Dashboard; sem tab de Boleto no módulo Financeiro
- **Fix necessário**: Implementar módulo de boleto ou remover referências da UI

### BC-07 — Kanban de Produção não exibe OPs com status "Retrabalho"
- **Módulo**: Produção → Kanban
- **Severidade**: P1 — OP fica invisível no kanban
- **Sintoma**: OP-2026-9812 com status "Retrabalho" não aparece em nenhuma coluna do Kanban (colunas: Fila, Em Produção, Acabamento, Conferência, Liberado)
- **Fix necessário**: Adicionar coluna "Retrabalho" ao Kanban OU mapear "Retrabalho" para coluna existente

### BC-08 — Módulos Admin inacessíveis em produção
- **Módulo**: Auth / Admin
- **Severidade**: P1 — admins não conseguem configurar o sistema em produção
- **Sintoma**: Em `crm-croma.vercel.app`, usuário sem `role` definida não acessa nenhum módulo admin
- **Causa raiz**: `AuthContext.tsx` → `can()` retorna `import.meta.env.DEV` (false em produção para usuário sem role); `accessibleModules` retorna `[]`
- **Fix necessário**: Atribuir role adequada ao usuário admin em produção; revisar lógica de `accessibleModules`

### BC-09 — Sidebar completamente vazia para usuário sem role em produção
- **Módulo**: Auth / Sidebar
- **Severidade**: P1 — usuário vê tela em branco sem navegação
- **Sintoma**: Em `crm-croma.vercel.app` com usuário sem role: sidebar mostra apenas "Dashboard" e "Configurações" — nenhum módulo operacional
- **Causa raiz**: Mesma raiz que BC-08
- **Fix necessário**: Resolver BC-08 (atribuir roles)

### BC-10 — Orçamento com multiplicação dupla de valor
- **Módulo**: Orçamentos → Motor de precificação
- **Severidade**: P1 — precificação incorreta quando motor funcionar
- **Sintoma**: `precoTotal = precoVenda * quantidade` mas `precoVenda` já contém a quantidade multiplicada internamente
- **Fix necessário**: Revisar fórmula no motor Mubisys; `precoTotal` deve usar preço unitário × quantidade

### BC-11 — Migration 006 schema incompatível
- **Módulo**: Database
- **Severidade**: P1 — migration não pode ser executada
- **Sintoma**: `006_orcamento_module.sql` tem 3 definições de schema conflitantes; não foi executada
- **Fix necessário**: Consolidar schema de `acabamentos`, `servicos`, `regras_precificacao` em uma única versão consistente

---

## BUGS UX

### BU-01 — Botões de etapa de produção sem feedback imediato
- **Módulo**: Produção → OP Modal
- **Sintoma**: Após clicar "Iniciar" ou "Concluir" numa etapa, a UI não atualiza — precisa fechar e reabrir o modal
- **Causa raiz**: Mutation do React Query não invalida o cache do modal aberto
- **Fix**: Adicionar `invalidateQueries` na chave correta após mutação de etapa

### BU-02 — Corrupção de data em input do Financeiro
- **Módulo**: Financeiro → Nova Conta
- **Sintoma**: Digitar data "2026-03-20" no campo `type="date"` produz "20/02/60320" (ano 60320) — dado corrompido persistido no banco
- **Causa raiz**: Input controlado React + manipulação nativa simultânea de `input[type=date]`
- **Fix**: Usar date picker gerenciado (ex: react-day-picker) em vez de `input[type=date]` nativo para entrada manual

### BU-03 — Acentos/cedilhas faltando sistematicamente
- **Módulos**: Produção, Financeiro, Fiscal, App de Campo
- **Sintoma**: "Producao", "Operacoes", "Homologacao", "Comunicacao Visual", "ordenms" — dezenas de textos sem codificação UTF-8 correta
- **Fix**: Revisar todos os seeds SQL e strings hardcoded; garantir encoding UTF-8 nos arquivos .sql e .ts

### BU-04 — Valores monetários truncados nos cards
- **Módulos**: Produção, Financeiro
- **Sintoma**: "R$ 1.000," sem casas decimais; "RECEBIDO R$ 1.500,0" sem o segundo decimal
- **Fix**: Usar `brl()` de `@/shared/utils/format.ts` consistentemente em todos os cards

### BU-05 — TEMPO REAL mostra "---" após conclusão total da OP
- **Módulo**: Produção → OP Detail
- **Sintoma**: Com todas as 5 etapas concluídas (progresso 100%), TEMPO REAL ainda exibe "---"
- **Fix**: Calcular soma dos tempos reais de todas as etapas quando todas estiverem concluídas

### BU-06 — Labels de estatísticas truncados em Instalações
- **Módulo**: Instalações (ERP)
- **Sintoma**: Cards de estatísticas mostram "T...", "P...", "E...", "C...", "C..." — ilegíveis sem contexto
- **Fix**: Aumentar width dos cards OU usar abreviações explícitas com tooltip

### BU-07 — OS com tempo negativo (-1h -2min)
- **Módulo**: Instalações (ERP) + App de Campo
- **Sintoma**: OS "teste" mostra duração "-1h -2min" no ERP e "0m" no App de Campo — inconsistência entre sistemas para o mesmo dado inválido
- **Fix**: Validar Fim ≥ Início na criação/edição de OS; exibir aviso em vez de valor negativo

### BU-08 — OS cards não clicáveis no ERP
- **Módulo**: Instalações (ERP)
- **Sintoma**: Clicar em qualquer OS na lista de Instalações do ERP não abre detalhe — apenas monitoramento passivo sem drill-down
- **Fix**: Adicionar link/drawer de detalhe ao clicar num card de OS no ERP

### BU-09 — Sem link entre Contas a Receber e Pedido/Orçamento
- **Módulo**: Financeiro
- **Sintoma**: Conta criada manualmente sem referência ao pedido/orçamento de origem — sem rastreabilidade financeira
- **Fix**: Campo `pedido_id` / `orcamento_id` no modal "Nova Conta" com autocomplete

### BU-10 — Valor Pipeline truncado no Dashboard
- **Módulo**: Dashboard
- **Sintoma**: Card "Pipeline Comercial" mostra "R$ 85.000," (truncado) — não cabe no card
- **Fix**: Responsividade do card ou formatação abreviada ("R$ 85K")

### BU-11 — Typo "ordenms" na produção
- **Módulo**: Produção
- **Sintoma**: Subtítulo da tabela de OPs exibe "ordenms" em vez de "ordens"
- **Fix**: Corrigir string

### BU-12 — Gráfico de Desempenho Mensal ausente no App de Campo
- **Módulo**: App de Campo → Relatórios
- **Sintoma**: "Gráfico de evolução de instalações (Em breve)" — placeholder sem conteúdo
- **Status**: Feature pendente / não implementada

---

## FEATURES PENDENTES (não implementadas)

| # | Feature | Local | Impacto |
|---|---|---|---|
| FP-01 | Módulo Boleto | `/financeiro/boletos` | Alto — cobrança bancária ausente |
| FP-02 | Gráfico Desempenho Mensal | App de Campo → Relatórios | Médio |
| FP-03 | Emissão NF-e via pedido | ERP → Pedidos | Alto — integração fiscal incompleta |

---

## FLUXO E2E — STATUS POR ETAPA

| Passo | Etapa | Status | Observações |
|---|---|---|---|
| 1 | Materiais (Admin) | ⚠️ Parcial | Materiais existem; UI admin bloqueada em produção (BC-08) |
| 2-4 | Produto/BOM (Admin) | ⚠️ Via Supabase | UI admin inacessível; executado direto no banco |
| 5 | Cadastrar Lead | ✅ OK | Pipeline comercial funcional |
| 6 | Converter Lead → Cliente | ✅ OK | Fluxo de cliente funcional |
| 7 | Criar Orçamento | ❌ QUEBRADO | Motor retorna R$ 0,00 (BC-01); WSOD no editor (BC-02) |
| 8 | Gerar Proposta PDF | ✅ OK | Geração de PDF funcional |
| 9 | Aprovar Orçamento → Pedido | ⚠️ Parcial | Aprovação funciona; pedido criado a R$ 0,00 |
| 10 | Confirmar Pedido → OP | ⚠️ Parcial | OP criada; sem botões de workflow no detalhe (BC-03) |
| 11-12 | Produção — Etapas OP | ⚠️ Parcial | Etapas concluídas com workaround; custos todos R$ 0,00 (BC-04) |
| 13 | Financeiro | ⚠️ Parcial | Contas a receber/pagar/DRE funcionam; bug data (BU-02) |
| 14 | NF-e | ⚠️ Parcial | Dashboard/Fila OK; `/fiscal/emissao` quebrado (BC-05) |
| 15 | Boleto | ❌ NÃO IMPLEMENTADO | Módulo ausente (BC-06) |
| 16 | Instalações (ERP) | ⚠️ Parcial | Monitoramento OK; labels truncados (BU-06); sem drill-down (BU-08) |
| 17 | App de Campo | ✅ OK | Login, Nova OS, Mapa (1196 lojas), Relatórios, PDF+WhatsApp |

---

## PONTOS POSITIVOS

- **App de Campo** está funcional e robusto: login real, OS management, mapa com 1196 lojas, relatório PDF + WhatsApp ✅
- **Dashboard** com métricas em tempo real (clientes, propostas, pipeline) ✅
- **Portal do Cliente** (`/p/:token`) com tracking de interesse e condições de pagamento ✅
- **Módulo Fiscal** bem estruturado: fila, configurações, séries, ambientes HML+PRD ✅
- **Produção Kanban** e detalhe de OP com etapas sequenciais bem modelados ✅
- **Auth real** funcionando em `crm-croma.vercel.app` ✅

---

## PRIORIDADE DE CORREÇÃO

### Sprint Crítica (P0 — esta semana)
1. **BC-01 + BC-10**: Vincular `modelo_materiais`, seed `modelo_processos`, corrigir motor orçamento
2. **BC-02**: Fix Radix `Select.Item` com value vazio
3. **BC-03**: Restaurar botões de workflow no detalhe do pedido
4. **BU-02**: Substituir `input[type=date]` por date picker no Financeiro

### Sprint Importante (P1 — próxima semana)
5. **BC-05 + BC-06**: Corrigir rotas fiscal/boleto
6. **BC-07**: Adicionar "Retrabalho" ao Kanban
7. **BC-08 + BC-09**: Configurar roles em produção
8. **BU-01**: Invalidação de cache após mutação de etapa
9. **BU-03**: Corrigir encoding UTF-8 sistêmico

### Backlog (P2)
10. BC-04, BC-11 (schema migration)
11. BU-04 a BU-12
12. FP-01 (módulo boleto), FP-03 (emissão NF-e)

---

*Gerado automaticamente pelo Agente QA Croma — 2026-03-13*

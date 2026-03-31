# 📋 Relatório de Auditoria UI/UX — CRM Croma ERP

**Data:** 12 de março de 2026
**Ambiente:** https://crm-croma.vercel.app (produção)
**Usuário teste:** Junior Croma (Administrador)
**Método:** Teste manual página-a-página via navegador, simulando usuário real
**Repo:** `C:\Users\Caldera\Claude\CRM-Croma` (branch: main)
**Stack:** React 19 + Vite + TypeScript + shadcn/ui + TanStack Query v5 + Supabase

---

## Resumo Executivo

| Categoria | Qtd |
|-----------|-----|
| 🔴 Bugs Críticos (app quebra / ilegível) | 2 |
| 🟠 Bugs Médios (funcionalidade comprometida) | 4 |
| 🟡 Bugs Menores (visual / polish) | 4 |
| ✅ Páginas 100% funcionais | 18+ |

**Total de rotas testadas:** 30+
**Total de rotas registradas no Router:** 46
**Total de itens no sidebar:** 32

---

## 🔴 BUGS CRÍTICOS

### BUG-001 — Conciliação Bancária: Tela Branca (App Crash)

- **Rota:** `/financeiro/conciliacao`
- **Componente:** `src/domains/financeiro/pages/ConciliacaoPage.tsx`
- **Severidade:** 🔴 Crítica
- **Impacto:** Aplicação inteira crasha — sem sidebar, sem header, tela 100% branca. Usuário precisa navegar manualmente para outra URL para recuperar.
- **Erro no console:**
  ```
  Error: Minified React error #301
  https://react.dev/errors/301
  ```
  React Error #301 = `useContext` chamado fora do Provider correspondente.
- **Provável causa:** O componente `ConciliacaoPage` utiliza um hook (`useLancamentos()` ou similar) que depende de um Context Provider que não está wrapping essa rota. Pode ser um provider específico que foi adicionado em outras páginas mas não nesta, ou um hook customizado que precisa de um provider intermediário.
- **Como reproduzir:**
  1. Login no sistema
  2. Sidebar → FINANCEIRO → Conciliação Bancária
  3. Tela fica completamente branca
- **Sugestão de fix:** Verificar qual `useContext` está falhando no `ConciliacaoPage.tsx`. Adicionar o Provider faltante no nível correto da árvore de componentes (idealmente no Layout ou no App.tsx se for compartilhado).

---

### BUG-002 — Ocorrências: Caracteres Unicode Não Renderizados

- **Rota:** `/ocorrencias`
- **Componente:** `src/domains/qualidade/pages/OcorrenciasPage.tsx`
- **Severidade:** 🔴 Crítica
- **Impacto:** Toda a página de Gestão de Qualidade exibe texto corrompido/ilegível para o usuário.
- **48 ocorrências** de escapes `\u00XX` renderizados literalmente no texto visível.
- **Exemplos na tela:**

  | Exibido | Esperado |
  |---------|----------|
  | `Gest\u00e3o de Qualidade` | Gestão de Qualidade |
  | `Ocorr\u00eancias` | Ocorrências |
  | `TAXA RESOLU\u00E7\u00E3O` | TAXA RESOLUÇÃO |
  | `t\u00edtulo, n\u00famero ou cliente...` | título, número ou cliente... |
  | `Nova Ocorr\u00eancia` | Nova Ocorrência |
  | `Devolu\u00e7\u00e3o` | Devolução |
  | `Em An\u00e1lise` | Em Análise |
  | `Conclu\u00edda` | Concluída |

- **Provável causa:** As strings no arquivo `.tsx` contêm escapes Unicode literais (como texto `"\\u00e3"` com barra dupla, ou foram geradas por ferramenta que não preservou UTF-8). O browser renderiza o texto literal em vez de interpretar como Unicode.
- **Como reproduzir:**
  1. Login no sistema
  2. Sidebar → QUALIDADE → Ocorrências
  3. Observar texto corrompido em título, tabs, KPIs, campo de busca e botão
- **Sugestão de fix:** Substituir todas as 48 instâncias de `\u00XX` pelos caracteres UTF-8 reais no arquivo `OcorrenciasPage.tsx`. Exemplo: `"Gest\u00e3o"` → `"Gestão"`.

---

## 🟠 BUGS MÉDIOS

### BUG-003 — Pedido Detail: Seção "Itens do Pedido" Ausente

- **Rota:** `/pedidos/:id` (testado com PED-2026-0001)
- **Componente:** `src/domains/pedidos/pages/PedidoDetailPage.tsx`
- **Severidade:** 🟠 Média
- **Impacto:** Ao abrir o detalhe de um pedido, apenas o cabeçalho é exibido (número, status "Concluído", prioridade "Normal", data de entrega). A seção que deveria listar os itens do pedido (2 itens neste caso) simplesmente **não existe** na view.
- **Como reproduzir:**
  1. Sidebar → Pedidos
  2. Clicar em PED-2026-0001
  3. Observar que não há seção de itens
- **Sugestão de fix:** Verificar se o componente de detalhe possui a query para buscar `pedido_itens` e se há um componente de listagem de itens sendo renderizado. Possível que a seção exista no código mas não carregue os dados, ou que a seção nunca foi implementada.

---

### BUG-004 — Templates: Rota Inexistente no Router

- **Rota sidebar:** `/orcamentos/templates`
- **Registro no Router:** ❌ Não existe
- **Severidade:** 🟠 Média
- **Impacto:** Ao clicar em "Templates" no sidebar (dentro de Orçamentos), o catch-all `*` redireciona silenciosamente para o Dashboard. Usuário não recebe feedback de que a página não existe.
- **Localização do link:** `src/shared/navigation.ts` linha ~36
- **Como reproduzir:**
  1. Sidebar → COMERCIAL → Orçamentos → Templates
  2. Redirecionado para Dashboard sem mensagem
- **Sugestão de fix:** Opção A: Criar a rota e componente `TemplatesPage`. Opção B: Remover o item "Templates" do sidebar até ser implementado. Opção C: Criar uma página 404 para rotas inexistentes em vez do redirect silencioso.

---

### BUG-005 — Dashboard Fiscal: Link "Configurações Fiscais" com Typo na URL

- **Link clicado:** `/fiscal/configuracoes` (com **'s'** no final)
- **Rota registrada:** `/fiscal/configuracao` (sem **'s'**)
- **Severidade:** 🟠 Média
- **Impacto:** Ao clicar em "Configurações Fiscais" nas Ações Rápidas do Dashboard Fiscal, redireciona para o Dashboard principal em vez de abrir a página de configurações.
- **Componente do link:** Provavelmente em `src/domains/fiscal/pages/FiscalDashboardPage.tsx`
- **Como reproduzir:**
  1. Sidebar → FISCAL → NF-e Dashboard
  2. Clicar em "Configurações Fiscais" na seção "Ações Rápidas"
  3. Redirecionado para Dashboard
- **Sugestão de fix:** Corrigir o `href`/`to` do link de `/fiscal/configuracoes` para `/fiscal/configuracao`, ou renomear a rota no App.tsx. Verificar se há outros links internos apontando para a URL incorreta.

---

### BUG-006 — Centros de Custo e Plano de Contas: Mensagem Técnica Exposta

- **Rotas:** `/admin/centros-custo` e `/admin/plano-contas`
- **Severidade:** 🟠 Média
- **Impacto:** O empty state exibe mensagem interna para devs: **"Execute a migration 012 no Supabase"**. Usuário final não deve ver referências a migrations ou banco de dados.
- **Texto exibido:**
  - Centros de Custo: `"Nenhum centro de custo cadastrado. Execute a migration 012 no Supabase."`
  - Plano de Contas: `"Nenhuma conta de receita cadastrada. Execute a migration 012 no Supabase."`
- **Como reproduzir:**
  1. Sidebar → FINANCEIRO → Centros de Custo (ou Plano de Contas)
  2. Mensagem técnica visível no empty state
- **Sugestão de fix:** Opção A: Executar a migration 012 para popular os dados seed. Opção B: Substituir a mensagem por um empty state amigável, ex: "Nenhum centro de custo cadastrado. Clique em + para criar o primeiro." e mover a instrução de migration para um README ou log de console.

---

## 🟡 BUGS MENORES

### BUG-007 — Produção: Título Sem Acento

- **Rota:** `/producao`
- **Impacto:** Visual — título da página exibe "Producao" em vez de "Produção".
- **Fix:** Corrigir a string no componente `ProducaoPage.tsx`.

### BUG-008 — Propostas: Sidebar Não Destaca Item Ativo

- **Rota:** `/propostas`
- **Impacto:** Visual — quando o usuário está na página de Propostas, o item "Propostas" no sidebar não fica visualmente destacado (highlighted). Outros itens como "Dashboard", "Clientes" etc. destacam normalmente.
- **Provável causa:** O matching de rota ativa no sidebar pode não estar reconhecendo `/propostas` como sub-item de "Orçamentos".

### BUG-009 — 6 Ícones Faltando no Sidebar

- **Impacto:** Visual — os itens usam o ícone genérico `LayoutDashboard` como fallback em vez dos ícones corretos.
- **Ícones não importados no `Layout.tsx`:**
  - `Calendar` (Calendário)
  - `Megaphone` (Campanhas)
  - `Package2` (referência de pacote)
  - `BarChart2` (relatórios/gráficos)
  - `ArrowLeftRight` (conciliação)
  - `Layers` (centros de custo)
- **Fix:** Adicionar os imports de `lucide-react` e incluir no `ICON_MAP` do `Layout.tsx`.

### BUG-010 — Redirect Silencioso (Sem Página 404)

- **Impacto:** UX — qualquer rota inexistente (ex: `/materia-prima`, `/configuracoes`, `/abc123`) redireciona silenciosamente para o Dashboard. Não há feedback visual de que a página não foi encontrada.
- **Sugestão:** Criar uma página 404 amigável que informe o usuário e ofereça link para voltar ao Dashboard.

---

## ✅ PÁGINAS FUNCIONANDO CORRETAMENTE

| # | Página | Rota | Observações |
|---|--------|------|-------------|
| 1 | Dashboard | `/` | 4 KPI cards, 7 contadores, gráficos, progress tracker 91.6% |
| 2 | Leads | `/leads` | Lista com busca e filtros |
| 3 | Pipeline | `/pipeline` | Kanban visual com drag & drop |
| 4 | Clientes | `/clientes` | 307 registros, busca, detalhe funcional |
| 5 | Orçamentos | `/orcamentos` | Lista + editor + "Adicionar Item" ✅ (bug anterior corrigido) |
| 6 | Propostas | `/propostas` | Lista com badges de status e origem |
| 7 | Calendário | `/calendario` | Hub integrado: entregas + vencimentos |
| 8 | Campanhas | `/campanhas` | KPIs + CRUD + badges funcionais |
| 9 | Pedidos (lista) | `/pedidos` | Lista com filtros e status badges |
| 10 | Produção | `/producao` | Board 9 setores, rotação TV |
| 11 | Produtos | `/produtos` | Lista de produtos |
| 12 | Financeiro | `/financeiro` | Tabs A Receber/A Pagar + filtros + totais |
| 13 | DRE | `/dre` | Relatório demonstrativo |
| 14 | Comissões | `/comissoes` | Lista de comissões |
| 15 | Faturamento em Lote | `/financeiro/faturamento` | Checkbox + botão "Faturar Selecionados" |
| 16 | Dashboard Fiscal | `/fiscal` | KPIs + Documentos Recentes + Ações Rápidas |
| 17 | Fila de Emissão | `/fiscal/fila` | KPIs + tabela + auto-refresh 15s |
| 18 | Configurações | `/settings` | 4 tabs (Conta, App, Empresa, Ferramentas) todas OK |
| 19 | Centros de Custo | `/admin/centros-custo` | Estrutura funcional (empty state precisa ajuste) |
| 20 | Plano de Contas | `/admin/plano-contas` | Tabs Receitas/Despesas + busca funcional |

---

## Mapeamento Completo de Rotas

### Rotas no Router (App.tsx) — 46 rotas

```
/login, /tv, /, /leads, /pipeline, /orcamentos, /orcamentos/novo,
/orcamentos/:id, /orcamentos/:id/editar, /propostas, /calendario,
/campanhas, /clientes, /clientes/:id, /pedidos, /pedidos/:id,
/producao, /instalacoes, /almoxarife, /producao/diario-bordo,
/estoque, /compras, /produtos, /financeiro, /dre, /comissoes,
/financeiro/faturamento, /financeiro/conciliacao, /ocorrencias,
/fiscal, /fiscal/documentos, /fiscal/fila, /fiscal/configuracao,
/fiscal/certificado, /fiscal/auditoria, /admin/usuarios,
/admin/precificacao, /admin/config, /admin/produtos,
/admin/auditoria, /admin/setup, /admin/centros-custo,
/admin/plano-contas, /admin/materiais, /relatorios,
/admin/progresso, /settings, * (catch-all → /)
```

### Links no Sidebar (navigation.ts) — 32 links

```
/, /leads, /pipeline, /clientes, /orcamentos, /propostas,
/calendario, /campanhas, /orcamentos/templates ⚠️, /pedidos,
/producao, /instalacoes, /almoxarife, /producao/diario-bordo,
/estoque, /compras, /produtos, /admin/materiais, /financeiro,
/dre, /comissoes, /financeiro/faturamento, /financeiro/conciliacao,
/admin/centros-custo, /admin/plano-contas, /ocorrencias, /fiscal,
/fiscal/documentos, /fiscal/fila, /fiscal/configuracao,
/fiscal/certificado, /fiscal/auditoria, /admin/usuarios,
/admin/config, /admin/auditoria, /admin/precificacao,
/relatorios, /admin/progresso
```

### Discrepâncias Encontradas

| Sidebar Link | Rota no Router | Status |
|--------------|----------------|--------|
| `/orcamentos/templates` | ❌ Não existe | **Link órfão** |
| `/fiscal/configuracoes` (via Ações Rápidas) | `/fiscal/configuracao` | **Typo na URL** |

---

## Prioridade de Correção Sugerida

| Prioridade | Bug | Esforço Estimado | Impacto |
|------------|-----|------------------|---------|
| P0 | BUG-001 Conciliação crash | 30min–1h | App inutilizável nesta rota |
| P0 | BUG-002 Ocorrências encoding | 30min | Texto ilegível |
| P1 | BUG-003 Pedido sem itens | 1–2h | Funcionalidade core incompleta |
| P1 | BUG-005 Fiscal link typo | 5min | Link quebrado |
| P2 | BUG-004 Templates rota | 15min (remover) ou 4h (criar) | Feature faltante |
| P2 | BUG-006 Migration message | 15min | UX inadequada |
| P3 | BUG-007 Acento Producao | 2min | Visual |
| P3 | BUG-008 Sidebar highlight | 15min | Visual |
| P3 | BUG-009 Ícones faltando | 15min | Visual |
| P3 | BUG-010 Página 404 | 30min | UX |

---

## Notas para o Analista

1. **Error Boundary:** O sistema não possui Error Boundary visível — quando o React crasha (BUG-001), toda a página fica branca sem mensagem. Recomenda-se adicionar um `<ErrorBoundary>` no nível do Layout para capturar erros e exibir fallback amigável.

2. **Catch-all silencioso:** O `<Route path="*" element={<Navigate to="/" />} />` mascara URLs inválidas. Considerar substituir por uma página 404 que ajude o usuário a navegar de volta.

3. **Encoding pattern:** O BUG-002 sugere que o arquivo `OcorrenciasPage.tsx` foi gerado por uma ferramenta que escaped os caracteres UTF-8 em vez de preservá-los. Verificar se outros arquivos gerados na mesma sessão possuem o mesmo problema.

4. **Migration 012:** Os empty states de Centros de Custo e Plano de Contas referem-se a uma migration que provavelmente popula dados seed. Verificar se foi criada mas não executada no Supabase de produção.

5. **Testes automatizados:** Nenhum dos bugs encontrados seria capturado por testes unitários simples. Recomenda-se adicionar testes de integração (Playwright ou Cypress) para as rotas principais, validando ao menos que cada rota renderiza sem crash.

---

*Relatório gerado por auditoria automatizada via Claude Code em 12/03/2026.*
*Versão do deploy testado: commit 9b07da7 (Vercel)*

# Plano de Ação — ERP Croma Print

> **Data**: 2026-03-14 | **Status**: Aprovado pelo dono
> **Executores**: Claude (Opus para planejar, Sonnet para executar) + ChatGPT em paralelo
> **Objetivo**: Deixar o ERP pronto para uso real pela equipe da Croma Print o mais rápido possível
> **Meta futura**: Transformar em SaaS para empresas de comunicação visual

---

## Contexto

O ERP Croma Print é um sistema completo de gestão para comunicação visual, cobrindo o fluxo Lead→Orçamento→Pedido→Produção→Instalação→Faturamento. Está em fase de validação — será usado internamente pela Croma Print antes de virar SaaS.

Uma auditoria completa em 2026-03-14 identificou 66 problemas (14 críticos, 22 altos, 18 médios, 12 baixos). 19 bugs já foram corrigidos (PR #5). Restam ~47 itens abertos.

### Stack
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- Backend: Supabase (Postgres + Auth + Storage + Edge Functions)
- Deploy: Vercel (auto-deploy de `main`)
- URL: `https://crm-croma.vercel.app`

### Módulos em uso (todos)
- Comercial (Leads, Pipeline, Clientes, Orçamentos, Portal, Calendário, Templates, Campanhas)
- Operacional (Pedidos, Produção, Instalações)
- Financeiro (Contas, Boletos, DRE)
- Fiscal (NF-e via NFeWizard-io)
- Admin (Usuários, Configurações, Precificação)
- App de Campo (PWA separado)

---

## Abordagem

**Blindagem primeiro, com ritmo de execução paralela.**

Prioridade de segurança (fundamental para SaaS futuro), executada com agentes paralelos em worktrees isolados para maximizar velocidade. Cada sprint termina com deploy funcional.

---

## Sprint 1 — Blindagem

**Objetivo**: Sistema seguro para uso com dados reais. Cada pessoa só vê o que a role permite. Nenhuma ação destrutiva acontece sem validação.

### Frente A — Banco de Dados

Uma migration única executada no Supabase:

1. **RLS nas 8 tabelas críticas**: `clientes`, `propostas`, `proposta_itens`, `pedidos`, `pedido_itens`, `leads`, `contas_receber`, `contas_pagar`. Policies baseadas em `auth.uid()` e role do perfil.
2. **14 índices em FKs de transação**: Foco em `pedidos.cliente_id`, `pedidos.proposta_id`, `proposta_itens.proposta_id`, `pedido_itens.pedido_id`, `ordens_producao.pedido_id`, `contas_receber.pedido_id`, etc.
3. **NOT NULL + DEFAULT em campos críticos**: `pedidos.status DEFAULT 'novo'`, `propostas.status DEFAULT 'rascunho'`, `pedido_itens.quantidade DEFAULT 1`.
4. **Limpar dados sujos**: Reverter propostas ativas com total R$ 0,00 para status `rascunho`.

Entregável: 1 migration, zero downtime.

### Frente B — Edge Functions + Permissões

Código frontend + Edge Functions:

1. **Validar JWT** nas 3 Edge Functions públicas: `enviar-email-proposta`, `onedrive-criar-pasta`, `onedrive-upload-proposta`. Extrair token do header `Authorization`, validar via `supabase.auth.getUser()`.
2. **PermissionGuard** nas rotas `/admin/*` — verificar `role in ('admin', 'diretor')` antes de renderizar.
3. **Auth na rota `/tv`** — aceitar token via query string (`/tv?token=xxx`), validar contra tabela `tv_tokens` ou similar.
4. **Remover URL `tender-archimedes`** do fallback em `enviar-email-proposta`. Substituir por `https://crm-croma.vercel.app`.

Entregável: PR com 6-8 arquivos editados.

### Frente C — Guards de Negócio

Validações no código frontend/service:

1. **Bloquear edição de orçamento aprovado/convertido** — `orcamento.service.ts` verifica status antes de permitir update.
2. **Bloquear conversão de orçamento recusado** — guard em `converterParaPedido()`.
3. **Mapa de transições de status do pedido** — definir transições válidas (`novo→em_producao→produzido→concluido`), rejeitar saltos.
4. **`gerarContasReceber` transacional** — remover `.catch` silencioso em `PedidoDetailPage.tsx`, relançar erro ao usuário.
5. **Validação de vencimento futuro no boleto** — `.refine(d => d >= hoje)` no `bankSlipCreateSchema`.
6. **Check de boleto duplicado** — query `conta_id + status = 'pendente'` antes de inserir novo boleto.
7. **Quantidade mínima 1** no orçamento — `if (quantidade <= 0) return showError(...)`.

Entregável: PR com 5-7 arquivos editados.

### Critério de conclusão Sprint 1

A equipe da Croma pode logar em `crm-croma.vercel.app`, cada pessoa só vê dados da role dela, nenhuma ação destrutiva acontece sem validação prévia, e nenhum dado corrompido entra no banco.

---

## Sprint 2 — Fluxo Completo

**Objetivo**: Cada passo do fluxo Lead→Faturamento funciona sem interrupção. A equipe consegue fazer o ciclo completo de um pedido real sem intervenção fora do sistema.

### Frente D — Fluxo Comercial (Lead → Pedido)

1. **Corrigir N+1 no orçamento** — `orcamento.service.ts:buscarPorId()` faz 3+2×N queries. Substituir loop de Promise.all por nested select do Supabase (`.select('*, proposta_itens(*)')`) para carregar tudo em 1-2 queries.
2. **Aprovação no portal gera pedido automaticamente** — após `portal_aprovar_proposta`, chamar `converterParaPedido()` automaticamente via trigger ou hook.
3. **Detecção de leads duplicados** — verificar CNPJ, email e telefone contra leads existentes antes de salvar.
4. **Excluir pedidos cancelados do dashboard** — adicionar `.neq('status', 'cancelado')` nos hooks de stats.
5. **Idempotência em inserts críticos** — check de existência antes de criar OP e conta a receber. Evita duplicação por double-click ou refresh.

### Frente E — Fluxo Operacional + Financeiro (Pedido → Faturamento)

1. **Dashboard produção otimizado** — consolidar 8 queries COUNT separadas em 1 query com GROUP BY status.
2. **NF-e com itens e impostos** — preencher itens da NF-e a partir dos itens do pedido, com NCM, CSOSN 400 (Simples Nacional), e impostos básicos.
3. **Tela de expedição básica** — lista de pedidos com status `produzido`, controle de liberação para envio/retirada.
4. **Templates de orçamento** — CRUD de templates + opção "usar template" no wizard de orçamento. Cada template é um conjunto de itens pré-configurados.
5. **Calendário comercial** — vincular eventos a leads/clientes, agenda de follow-ups e visitas.

### Critério de conclusão Sprint 2

Um pedido real pode percorrer todas as etapas do sistema sem nenhuma intervenção manual fora dele — do lead capturado até a NF-e emitida e o boleto gerado.

---

## Sprint 3 — Experiência

**Objetivo**: O sistema parece um ERP profissional, não um protótipo. Performance rápida, feedback visual correto, codebase limpo.

### Frente F — Performance + Infraestrutura

1. **Lazy loading nas 38 rotas protegidas** — converter imports para `React.lazy()` com `Suspense`. Reduz bundle inicial de ~2MB para carregamento sob demanda.
2. **Gerar tipos TypeScript do Supabase** — `supabase gen types typescript` para eliminar 279 usos de `any` e dar autocomplete real na IDE.
3. **Paginação** em Clientes, Leads, Pedidos, Orçamentos — usar `.range()` do Supabase + componente de paginação do shadcn/ui.
4. **staleTime explícito** nos hooks de stats — definir 5 minutos para evitar refetch desnecessário.
5. **Selecionar colunas específicas** nas top 10 queries que usam `.select('*')`.

### Frente G — UX e Polimento

1. **Loading state** em todos os botões de submit — `disabled + Loader2` enquanto processa. Evita double-click.
2. **AlertDialog** em ações destrutivas — excluir cliente, cancelar pedido, remover regra de precificação.
3. **Substituir window.confirm** nativo por AlertDialog do shadcn/ui (4 locais).
4. **Corrigir rota `/admin/auditoria`** — renderiza `AdminUsuariosPage` (componente errado).
5. **Remover 35 console.log** em produção.
6. **Remover 10 páginas dead code** (~6.700 linhas em `src/pages/`).

### Critério de conclusão Sprint 3

Sistema carrega rápido, IDE tem autocomplete real, toda interação do usuário tem feedback visual correto, codebase enxuto e sem código morto.

---

## Sprint 4 — Crescimento

**Objetivo**: Funcionalidades que diferenciam o Croma ERP e preparam o terreno para SaaS multi-tenant.

1. **NF-e real via NFeWizard-io** — integrar [nfewizard-io](https://github.com/nfewizard-org/nfewizard-io) nas Edge Functions existentes. Emissão, consulta e cancelamento de NF-e direto do sistema. Começar em homologação SEFAZ.
2. **Parser CNAB 400 retorno** — ler arquivo de retorno do Itaú, dar baixa automática nos boletos pagos, marcar contas a receber como quitadas.
3. **Relatórios exportáveis** — PDF/Excel para: pedidos do mês, faturamento, produção, contas a receber. Usar biblioteca como `jspdf` + `xlsx`.
4. **Lock otimista** — campo `version INTEGER DEFAULT 1` nas tabelas de transação. Check `WHERE version = X` antes de update. Se conflito, avisa o usuário.
5. **Campanhas comerciais** — CRUD de campanhas, selecionar clientes por segmento/classificação, enviar comunicação (email via Resend).
6. **Testes automatizados** — cobertura mínima de 30% focando: pricing engine, boleto CNAB, orçamento (conversão), auth context. Usar Vitest.

### Critério de conclusão Sprint 4

NF-e real emitida em homologação, boletos com baixa automática, relatórios exportáveis, sistema preparado tecnicamente para atender múltiplas empresas.

---

## Fora de Escopo (backlog futuro)

- Multi-tenant (separação por empresa) — depois do SaaS validar
- API REST pública — quando houver integrações externas
- Importação CSV de clientes — onboarding
- NFS-e (nota de serviço) — apenas NF-e por agora
- Conciliação bancária real (OFX) — após retorno CNAB funcionar
- SPED/ECD — contabilidade fiscal avançada

---

## Estratégia de Execução

- **Opus** para planejar e revisar decisões de arquitetura
- **Sonnet** para executar código, commits, SQL, deploys
- **Agentes paralelos** em worktrees isolados dentro de cada sprint
- **Cada sprint** termina com PR mergeado + deploy + teste no site real
- **ChatGPT** pode trabalhar em frentes complementares (documentação, testes, pesquisa de libs)

---

*Spec aprovada pelo dono em 2026-03-14*

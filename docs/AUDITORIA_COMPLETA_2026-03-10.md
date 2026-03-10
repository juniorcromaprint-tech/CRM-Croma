# AUDITORIA COMPLETA — CRM CROMA PRINT
> Data: 2026-03-10 | Auditor: Claude (6 agentes paralelos) | Escopo: Projeto inteiro

---

# ==================================================
# PARTE 1 — RESUMO EXECUTIVO
# ==================================================

## O que esta bom
- **Motor de precificacao Mubisys**: Implementacao matematica dos 9 passos correta e bem documentada
- **Design visual**: Consistencia alta (rounded-2xl, palette slate/blue-600, shadcn/ui completo)
- **App de Campo**: PWA funcional com auth real, upload de fotos, assinatura digital, mapa
- **Dashboards**: 4 dashboards por role com dados REAIS do Supabase, KPIs corretos
- **Linguagem**: Todo o frontend em portugues consistente (botoes, labels, toasts, empty states)
- **Componentes reutilizaveis**: KpiCard com sparkline, CommandPalette, Breadcrumbs, Layout responsivo
- **Utilitarios**: Biblioteca completa de formatacao (BRL, CNPJ, CPF, datas, telefone)
- **Estados vazios**: Consistentes em todas as paginas com icone + titulo + acao sugerida
- **Loading states**: Skeletons consistentes, Suspense para dashboards

## O que esta ruim
- **ERP nao tem autenticacao**: DemoRoute e um pass-through — qualquer pessoa acessa tudo
- **Orcamento gera R$ 0,00**: Editor envia arrays vazios para o motor — pricing e bypassed
- **Cadastro de produtos e read-only**: Nao ha CRUD real — nao cria, edita ou deleta produtos/modelos
- **Permissoes nunca sao verificadas**: Funcao `can()` existe mas NUNCA e chamada em nenhuma pagina
- **Migration 006 nao executada**: 7 tabelas criticas ausentes (acabamentos, servicos, regras_precificacao)
- **Migration 004 nao executada**: Bridge ERP-Campo incompleta
- **19 paginas legacy mortas**: Codigo duplicado nao utilizado

## O que esta confuso
- **Duas paginas de config iguais**: AdminConfigPage e AdminPrecificacaoPage fazem a mesma coisa
- **Schema regras_precificacao**: 3 definicoes incompativeis (migration, AdminPrecificacaoPage, service)
- **produto_modelos**: Tabela existe mas editor de orcamento NUNCA a usa
- **467 materiais** no banco mas NENHUM e selecionavel no orcamento
- **Rota admin/auditoria** renderiza AdminUsuariosPage (bug de copiar/colar)

## O que esta perigoso
- **Sem auth = qualquer um acessa dados de 307 clientes, propostas, financeiro**
- **Bug de multiplicacao dupla**: `precoTotal = precoVenda * quantidade` onde `precoVenda` JA inclui quantidade
- **Race condition**: Numeracao sequencial de propostas (PROP-YYYY-###) usa count+1, nao e atomica
- **Sem ErrorBoundary**: Se um componente crashar, o app inteiro morre sem recuperacao
- **signUp aberto**: Qualquer pessoa pode criar conta no endpoint de Login (que esta orfao)
- **Anon key hardcoded no bundle**: Supabase anonKey exposta no client.ts

## O que ja esta maduro
- Dashboard Diretor/Comercial/Financeiro/Producao (dados reais, KPIs corretos)
- App de Campo (auth real, jobs, fotos, assinatura, mapa, analytics)
- Listagem de orcamentos (busca, filtro, duplicar, soft delete)
- Visualizacao de proposta para cliente (print view limpa)
- Modulo fiscal (6 paginas com schemas Zod — unico dominio com validacao real)
- Layout responsivo (sidebar colapsavel, mobile com bottom nav, CommandPalette)

## O que ainda parece prototipo
- Editor de orcamento (pricing sempre R$ 0,00, sem selecao de produto)
- AdminProdutosPage (read-only, sem CRUD real)
- Pedidos (lista basica sem workflow real)
- Producao (Kanban visual mas sem integracao com pedidos)
- DRE (usa percentuais estimados fixos, nao categorias reais)
- Estoque (3 abas mas sem movimentacao integrada)
- Compras (lista sem workflow de aprovacao)

## NOTAS (0 a 10)

| Area | Nota | Justificativa |
|---|---|---|
| **Arquitetura** | 7/10 | Boa separacao por dominios, services/hooks bem organizados. Pontos negativos: 19 paginas mortas, sem lazy loading, sem ErrorBoundary |
| **Seguranca** | 2/10 | Auth inexistente no ERP, permissoes decorativas, anon key exposta |
| **Usabilidade** | 6/10 | Design bonito e consistente, mas muitas features sao read-only ou incompletas |
| **Orcamento** | 3/10 | Motor excelente (9/10), mas editor completamente desconectado dos produtos/materiais |
| **Precificacao** | 4/10 | Engine Mubisys perfeita, mas dados nunca chegam nela (arrays vazios) |
| **Cadastro de Produtos** | 2/10 | Read-only para produtos/modelos. Sem CRUD. Sem vinculo material->modelo |
| **Financeiro** | 5/10 | Contas a pagar/receber funcionam. DRE usa estimativas. Comissoes basicas |
| **Producao** | 4/10 | Kanban visual bonito. Sem integracao real com pedidos ou ordens |
| **App de Campo** | 7/10 | Funcional com auth, fotos, jobs, mapa. Falta offline sync e checklists |
| **Prontidao para uso interno real** | 3/10 | NAO esta pronto. Auth ausente, pricing zerado, cadastros read-only |

---

# ==================================================
# PARTE 2 — VISAO DE USUARIO REAL
# ==================================================

## A) VENDEDOR

### O que funciona
- Lista de orcamentos com busca e filtro por status — rapido de encontrar
- Duplicar orcamento existente — util para clientes recorrentes
- Visualizacao de proposta para cliente — formato limpo, imprimivel
- Status workflow claro: Rascunho -> Enviada -> Aprovada -> Pedido
- Labels em portugues claro

### O que NAO funciona
- **NAO consigo selecionar um produto do catalogo**: Tenho que digitar tudo na mao
- **NAO consigo ver materiais nem processos**: Arrays sempre vazios
- **PricingCalculator mostra R$ 0,00 para TUDO**: O widget de preco e inutil
- **NAO consigo selecionar acabamentos**: Nao existe selector
- **NAO consigo editar um item ja adicionado**: So posso deletar e readicionar
- **Markup padrao e 40% fixo**: Nao puxa da regra da categoria do produto
- **NAO sei se o preco esta certo**: Nenhum feedback sobre margem real
- **Templates nao existem**: Tenho que montar cada orcamento do zero

### O que esta confuso
- Porque existe um PricingCalculator se ele sempre mostra zero?
- Onde coloco os materiais? Nao tem campo pra isso
- Como sei se minha margem esta boa? Nao tem indicador de margem
- Qual a diferenca entre "valor unitario" e "valor total"? Ambos sao zero

### Pontos que fariam o vendedor voltar para planilha
- **Precificacao zerada**: Se o sistema nao calcula preco, a planilha e mais confiavel
- **Sem catalogo de produtos**: Na planilha tenho minha tabela de precos
- **Sem feedback de margem**: Na planilha faco conta rapida de lucro
- **Sem templates**: Na planilha copio a aba do mes passado

**VEREDITO DO VENDEDOR: Voltaria para a planilha em menos de 1 hora de uso.**

---

## B) FINANCEIRO

### O que funciona
- Dashboard Financeiro com saldo a receber vs a pagar — correto
- Contas a Receber e Pagar com filtros por status e data
- DRE basico com visao mensal e anual
- Comissoes listadas por vendedor
- Formatacao BRL correta em todos os valores

### O que NAO funciona
- **DRE usa percentuais estimados (45% CME, 25% admin, 30% pessoal)**: Nao reflete a realidade
- **NAO consigo rastrear o custo real de um orcamento**: O custo e R$ 0,00 no orcamento
- **Margem da proposta nao existe**: Como confiar num faturamento sem margem?
- **Comissao calculada sobre o que?**: Se o valor do orcamento esta errado, a comissao tambem esta

### Riscos de usar o sistema como fonte da verdade
- **CRITICO**: O sistema gera propostas com valor total baseado em markup sobre custo ZERO
- **ALTO**: Nao ha snapshot de preco do material na data da proposta (se o preco mudar, o historico se perde)
- **ALTO**: Se o financeiro confia no total da proposta para faturar, vai faturar valores errados
- **MEDIO**: DRE com percentuais fixos mascara a realidade operacional

**VEREDITO DO FINANCEIRO: Nao confiaria neste sistema para faturamento.**

---

## C) PRODUCAO

### O que funciona
- Kanban visual bonito com colunas de status
- Cards mostram prioridade, prazo, operador responsavel
- Contagem por coluna

### O que NAO funciona
- **Pedido nao tem detalhamento de materiais**: Campos `materiais`, `processos`, `acabamentos` estao vazios
- **Nao sei COMO produzir o item**: O item diz apenas "descricao livre" digitada pelo vendedor
- **Sem dimensoes claras**: Largura/altura sao opcionais no orcamento
- **Sem processos definidos**: Nenhum processo de producao e gerado automaticamente
- **Nao sei quanto material preciso separar**: Sem vinculo material -> quantidade
- **Sem checklist de qualidade**: Producao nao tem validacao de entrega

### Riscos operacionais
- **CRITICO**: Producao vai precisar ligar para o vendedor para CADA item
- **ALTO**: Sem bill of materials automatica, o consumo de material nao e rastreado
- **MEDIO**: Sem integracao com estoque, pode produzir sem ter material

**VEREDITO DA PRODUCAO: Sistema e inutilizavel para producao. Precisaria de informacao manual externa.**

---

## D) CAMPO / INSTALADOR

### O que funciona (App de Campo)
- Login real com Supabase Auth
- Lista de jobs com filtro por status
- Upload de fotos com compressao e watermark automatico
- Assinatura digital do cliente no local
- Mapa de lojas com Leaflet
- Analytics com graficos de produtividade
- Relatorio de faturamento

### O que NAO funciona
- **Jobs criados manualmente no campo, nao vem do ERP**: Nao ha trigger automatico pedido->job
- **Migration 004 (bridge) nao foi executada**: Views `vw_campo_instalacoes` e `vw_campo_fotos` nao existem
- **Sem sync offline**: Se perder sinal no local, perde o trabalho
- **Sem checklist de conclusao**: Instalador nao valida itens obrigatorios
- **Status mismatch**: ERP usa "agendada", Campo usa "Pendente" — nao sincronizam

### Risco de retrabalho
- **ALTO**: Informacao do item pode estar incompleta (descricao livre, sem especificacao tecnica)
- **MEDIO**: Sem checklist, instalador pode esquecer itens
- **BAIXO**: Fotos com watermark ajudam como evidencia

**VEREDITO DO CAMPO: App funciona bem como ferramenta standalone, mas nao recebe dados do ERP corretamente.**

---

# ==================================================
# PARTE 3 — VISAO DE DEV SENIOR / ARQUITETO
# ==================================================

## 1. Arquitetura do Projeto

**Positivo:**
- Monorepo com dois produtos (ERP desktop-first + Campo mobile-first PWA)
- Supabase compartilhado entre ambos
- React 19 + TypeScript + Vite + Tailwind + shadcn/ui — stack moderna e solida
- TanStack Query v5 para cache e data fetching

**Negativo:**
- Sem lazy loading nas rotas (tudo importado eagerly em App.tsx)
- Bundle principal tem 1.7MB (alerta do Vite por chunk > 500KB)
- Sem code splitting por dominio
- Sem ErrorBoundary em nenhum nivel

## 2. Organizacao por Dominios

```
src/domains/
  comercial/   — 11 pages, 5 hooks, 5 components, 1 service
  admin/       — 4 pages
  clientes/    — 2 pages
  pedidos/     — 1 page, 1 service
  producao/    — 1 page
  estoque/     — 1 page
  compras/     — 1 page
  instalacao/  — 1 page, 1 service, 2 hooks
  financeiro/  — 3 pages
  fiscal/      — 6 pages, 1 schema, 1 service
  qualidade/   — 1 page
```

**Positivo:** Dominios bem separados, cada um com pages/hooks/services proprios.
**Negativo:** Dominios menores (pedidos, producao, estoque) tem muito pouca logica — sao basicamente paginas com queries inline.

## 3. Qualidade da Separacao UI / Hooks / Services / Logica

**Bom:**
- pricing-engine.ts e TypeScript puro sem dependencias React
- orcamento-pricing.service.ts faz bridge entre engine e React
- Hooks (useOrcamentos, useDashboardStats) encapsulam data fetching
- Formatacao centralizada em shared/utils/format.ts

**Ruim:**
- Muitas paginas tem queries Supabase INLINE em vez de usar services
- Ex: AdminProdutosPage, AdminConfigPage fazem `supabase.from('x').select()` direto no componente
- Duplicacao de `formatBRL()` em 3 admin pages (deveria usar `brl()` de shared/utils)
- Hooks de dashboard (useDashboardStats) fazem calculos de negocios dentro de useQuery

## 4. Qualidade do Modelo de Banco

**51 tabelas base** (migration 001) + 14 tabelas adicionais (002) + campo tables (003) + fiscal (003_fiscal)

**Positivo:**
- Modelo relacional bem estruturado com FKs corretas
- Audit trail com campos `criado_por`, `atualizado_por`, `criado_em`, `atualizado_em`
- Soft delete com `excluido_em` / `excluido_por`
- Triggers de auditoria automaticos
- 467 materiais reais importados do Mubisys

**Negativo:**
- Migration 004 nao executada (bridge ERP-Campo)
- Migration 006 nao executada (7 tabelas de orcamento)
- Schema mismatch: `regras_precificacao` tem 3 definicoes incompativeis
- `modelo_materiais` nunca foi seedada — 0 registros
- `modelo_processos` nunca foi seedada — 0 registros
- Numeracao sequencial (PROP-YYYY-###) usa count+1 — race condition

## 5. Qualidade das Migrations

| Migration | Status | Qualidade |
|---|---|---|
| 001_complete_schema.sql | Executada | 7/10 — Completa mas RLS permissiva demais |
| 002_schema_corrections.sql | Executada | 8/10 — RLS granular, triggers, indices |
| 003_campo_migration.sql | Executada | 7/10 — Jobs, fotos, videos, checklists |
| 003_fiscal_module.sql | Executada | 8/10 — 11 tabelas fiscais, RPCs NF-e |
| 004_integracao_bridge.sql | NAO executada | 6/10 — Views e triggers uteis, mas status mismatch |
| 005_storage_security.sql | Executada | 7/10 — RLS nos buckets |
| 006_orcamento_module.sql | NAO executada | 4/10 — Schema incompativel com o codigo |
| 008_update_materiais_precos.sql | Executada | 9/10 — 464 materiais com preco real |
| 009_update_produtos_markups.sql | Executada | 8/10 — Markups em produto_modelos |

## 6. Integracao entre Modulos

| Integracao | Status | Problema |
|---|---|---|
| Lead -> Orcamento | Parcial | oportunidade_id nunca preenchido |
| Orcamento -> Pedido | Implementado | converterParaPedido() funciona mas perde detalhamento de custos |
| Pedido -> Producao | NAO implementado | Nenhum trigger ou fluxo automatico |
| Producao -> Instalacao | NAO implementado | Migration 004 nao executada |
| Instalacao -> Campo | Parcial | useCampoRealtime funciona, mas sem views/triggers do 004 |
| Pedido -> Financeiro | NAO implementado | Nenhuma conta a receber/pagar gerada automaticamente |
| Orcamento -> Estoque | NAO implementado | Sem verificacao de estoque |

## 7. Consistencia de Nomenclatura

**Mistura PT/EN:**
- Tabelas: portugues (`clientes`, `propostas`, `materiais`) — CORRETO
- Colunas: portugues (`preco_medio`, `custo_unitario`) com excecao de `created_at`, `updated_at` — ACEITAVEL
- Services: portugues (`orcamentoService.listar()`, `.criar()`) — CORRETO
- Tipos: mistura (`PricingConfig` EN, `ConfigPrecificacao` PT, `RegraPrecificacao` PT) — CONFUSO
- Components: mistura (`PricingCalculator` EN, `AlertasOrcamento` PT, `ResumoVendedor` PT) — CONFUSO
- Query keys: ingles (`"admin-produtos"`, `"orcamentos"`) — ACEITAVEL

**Veredicto:** Nomenclatura e maioritariamente coerente mas os tipos e componentes do pricing sao os mais confusos por misturar idiomas.

## 8. Riscos de Manutencao

- **19 paginas legacy mortas** em `src/pages/` — confundem novos devs
- **5 componentes legacy mortos** em `src/components/` — nunca usados
- **Duplicacao AdminConfigPage vs AdminPrecificacaoPage** — manutencao dobrada
- **`as unknown as any`** usado em 16+ lugares nos admin pages — sem type safety
- **Sem testes automatizados** — 0 arquivos de teste em todo o projeto
- **Sem CI/CD** — nenhum workflow GitHub Actions
- **Sem Storybook** — componentes nao sao documentados isoladamente

## 9. Riscos de Divida Tecnica

- Motor Mubisys excelente mas isolado — nenhuma tela o alimenta corretamente
- Componentes prontos (AlertasOrcamento, ResumoVendedor) mas nunca importados no editor
- Hook useOrcamentoAlerts implementado mas nunca chamado
- Sistema de permissoes completo mas nunca enforced
- Login.tsx existe mas nao tem rota

## 10. Riscos para Producao

| Risco | Impacto | Probabilidade |
|---|---|---|
| Alguem acessa o ERP sem login | Exposicao de dados de 307 clientes | CERTA (100%) |
| Orcamento gera valor errado | Faturamento incorreto | CERTA (100%) |
| Race condition na numeracao | Propostas com numero duplicado | Alta (multiplos usuarios) |
| Sem ErrorBoundary | App inteira crasha | Media |
| Bundle 1.7MB sem code splitting | Lentidao em mobile | Media |

---

# ==================================================
# PARTE 4 — UX/UI E USABILIDADE
# ==================================================

## Navegacao

**Positivo:**
- Sidebar colapsavel intuitiva (w-64 -> w-16)
- 8 grupos logicos (Painel, Comercial, Operacional, etc.)
- CommandPalette Ctrl+K com 20 atalhos
- Breadcrumbs auto-gerados com 28 segmentos mapeados
- Mobile: header sticky + bottom tab nav com 4 itens
- Print: navegacao oculta automaticamente

**Negativo:**
- CommandPalette nao filtra por permissao (mostra tudo)
- Sem indicador de loading global durante navegacao
- Bottom nav mobile tem so 4 itens (Dashboard, Comercial, Producao, Settings) — limita acesso rapido

## Formularios

**Positivo:**
- Labels claros em portugues
- Controlled inputs com useState
- Botoes de salvar com loading spinner
- Toasts de sucesso/erro apos mutacoes

**Negativo:**
- Sem validacao Zod/react-hook-form (exceto fiscal)
- Sem mascara de CNPJ/CPF nos inputs
- Sem feedback de campo invalido inline
- Sem aviso de dados nao salvos ao navegar
- Sem confirmacao de delete destrutivo (regras_precificacao)

## Feedbacks Visuais

**Positivo:**
- Status badges coloridos e consistentes
- KPI cards com cores por tipo (verde=bom, vermelho=atencao)
- Skeleton loading em todas as paginas
- Empty states informativos com icone + texto + acao

**Negativo:**
- Dual toaster (Toaster + Sonner renderizados simultaneamente)
- Sem feedback visual de margem no orcamento
- Sem indicador de "material sem preco" visivel no editor
- Sem progress bar de etapas no orcamento

## FOCO NO ORCAMENTO — Analise UX

### O que deixa o vendedor confuso
1. **PricingCalculator mostra R$ 0,00** — o widget mais importante esta vazio
2. **Onde coloco os materiais?** — Nao ha campo nem selector
3. **Porque o markup e 40%?** — Nao explica de onde vem
4. **Qual e minha margem?** — Nao existe indicador
5. **Posso confiar nesse preco?** — Com tudo zerado, a resposta e NAO

### O que deveria estar escondido
- Campos tecnicos como "Largura (cm)" e "Altura (cm)" — deveriam ser auto-preenchidos pelo modelo
- O campo "Markup %" — deveria ser sugerido automaticamente pela categoria
- A secao "Detalhes do Motor Mubisys" na pagina de config — e para dev, nao para admin

### O que deveria estar em modo avancado
- Edicao manual de markup (sobrescrever o sugerido)
- Edicao de config de precificacao (Cm, P%, Pv)
- Visualizacao de breakdown por passo Mubisys

### O que deveria estar mais evidente
- **PRECO FINAL DO ITEM** — deveria ser o numero mais visivel da tela
- **MARGEM DE LUCRO** — deveria ter indicador colorido (verde/amarelo/vermelho)
- **ALERTA DE MATERIAL SEM PRECO** — deveria ser banner grande, nao escondido
- **RESUMO DO ORCAMENTO** — subtotal, desconto, total sempre visivel

### O que deveria ser simplificado em 3 passos
1. **Selecionar produto + modelo** (auto-preenche materiais + processos + markup sugerido)
2. **Ajustar quantidade e dimensoes** (sistema calcula preco automaticamente)
3. **Revisar margem e adicionar** (indicador verde = ok, amarelo = margem baixa)

---

# ==================================================
# PARTE 5 — ORCAMENTO E PRECIFICACAO
# ==================================================

## 1. Como o orcamento funciona hoje

O vendedor:
1. Clica "Novo Orcamento" → cria proposta com titulo, cliente, validade
2. Clica "Adicionar Item" → abre formulario com descricao livre, quantidade, markup%
3. O sistema chama `calcOrcamentoItem()` passando `materiais: [], processos: [], acabamentos: []`
4. O motor Mubisys recebe custo zero, calcula sobre zero, retorna zero
5. PricingCalculator exibe R$ 0,00 para tudo
6. O item e salvo com `valor_unitario = 0`, `valor_total = 0`

**Resultado: Orcamentos ficam com valor R$ 0,00 sempre.**

## 2. A logica esta coerente com comunicacao visual?

**O motor sim. O editor nao.**

O motor Mubisys foi projetado corretamente para comunicacao visual:
- Custo de material por m2 (lona, adesivo, ACM)
- Tempo de producao por processo (impressao, corte, acabamento)
- Custo operacional distribuido
- Markup sobre custo total
- Impostos + comissao embutidos

MAS o editor nunca alimenta o motor com esses dados.

## 3. O vendedor entende como usar?

**NAO.** O formulario pede descricao livre e markup%. Nao ha selecao de produto, nao ha preenchimento automatico de materiais. O vendedor precisa saber de cor quanto custa cada material e qual markup aplicar.

## 4. O preco fica explicavel?

**NAO.** O PricingCalculator mostra breakdown com todos os campos zerados. Nao ha como explicar para o cliente porque o preco e X.

## 5. Existe risco de preco errado?

**SIM — CERTEZA.** Alem do valor zerado, existe um bug de multiplicacao dupla:
- `pricing-engine.ts` calcula `precoVenda = unitario * quantidade`
- `orcamento-pricing.service.ts` faz `precoTotal = precoVenda * quantidade` (multiplicacao dupla)
- `precoUnitario` recebe `precoVenda` (que ja inclui quantidade)

Se os dados chegassem no motor, o preco final seria `unitario * quantidade^2`.

## 6. O sistema depende demais de configuracao?

**SIM.** Para funcionar, o admin precisa:
1. Configurar `config_precificacao` (custo operacional, impostos, comissao) — FUNCIONA
2. Configurar `regras_precificacao` por categoria — TABELA NAO EXISTE
3. Vincular materiais a cada modelo de produto — SEM UI PARA ISSO
4. Vincular processos a cada modelo — SEM UI PARA ISSO
5. Garantir que todos materiais tenham preco — 3 materiais ainda sem preco

## 7. O cadastro sustenta o calculo?

**NAO.** Existem 467 materiais com preco_medio e 156 produto_modelos com markup. MAS:
- `modelo_materiais` tem 0 registros — nenhum material vinculado a nenhum modelo
- `modelo_processos` tem 0 registros — nenhum processo vinculado
- O editor ignora produto_modelos completamente

## 8. Risco de material/preco zerado?

**SIM.** 3 materiais ainda sem preco_medio. E como o editor envia arrays vazios, o custo de material e SEMPRE zero independente de ter preco ou nao.

## 9. Metodo de pricing bom mas mal exposto?

**EXATAMENTE.** O motor Mubisys de 9 passos e tecnicamente excelente:
- Calcula custo por minuto de mao de obra
- Distribui custo fixo proporcionalmente
- Absorve impostos e comissao no preco
- Margem real calculada corretamente

Mas a interface nao conecta os dados ao motor. E como ter um motor de Ferrari numa carcaca sem rodas.

## 10. Experiencia comercial intuitiva?

**NAO.**

### Perguntas e respostas claras:

**Onde o usuario coloca ou ajusta o preco?**
- O vendedor digita markup% no formulario do item. O preco unitario/total e calculado automaticamente. MAS como o custo base e zero, o preco final e zero.

**De onde o sistema tira o custo?**
- DEVERIA vir de: `materiais.preco_medio` (via modelo_materiais) + `modelo_processos.tempo_minutos` * `config_precificacao.custo_por_minuto`
- NA PRATICA: arrays vazios -> custo = R$ 0,00

**De onde vem o markup?**
- DEVERIA vir de: `regras_precificacao.markup_sugerido` para a categoria do produto
- NA PRATICA: hardcoded 40% no DEFAULT_ITEM

**O que acontece se o material estiver sem custo?**
- O motor calcula Vmp = 0 para aquele material. O custo final fica subestimado.
- O hook useOrcamentoAlerts tem logica para alertar, mas NUNCA e chamado no editor.

**Como o vendedor sabe se o preco final esta correto?**
- Nao sabe. Nao ha indicador de margem, nao ha comparacao com custo, nao ha alerta de preco zerado no fluxo normal.

**O que falta para esse modulo ficar nota 10/10?**
1. Conectar catalogo de produtos ao editor (selector produto -> modelo)
2. Auto-preencher materiais e processos a partir do modelo selecionado
3. Seedar modelo_materiais e modelo_processos
4. Executar migration 006 (com schema corrigido)
5. Corrigir bug de multiplicacao dupla
6. Integrar ResumoVendedor e AlertasOrcamento no editor
7. Usar markupSugerido como default em vez de 40% fixo
8. Adicionar edicao inline de itens ja adicionados
9. Adicionar templates de orcamento
10. Adicionar snapshot de precos na data da proposta

---

# ==================================================
# PARTE 6 — CADASTRO DE PRODUTOS E MATERIAIS
# ==================================================

## Estado atual

| Entidade | Tabela | Create | Read | Update | Delete | Admin UI |
|---|---|---|---|---|---|---|
| Produtos | produtos | NAO | SIM | NAO | NAO | AdminProdutosPage (read-only) |
| Modelos | produto_modelos | NAO | SIM | NAO | NAO | AdminProdutosPage (read-only) |
| Modelo-Materiais | modelo_materiais | NAO | NAO | NAO | NAO | NENHUMA |
| Modelo-Processos | modelo_processos | NAO | NAO | NAO | NAO | NENHUMA |
| Materiais | materiais | NAO | SIM | SIM (so preco) | NAO | AdminProdutosPage tab "Sem Preco" |
| Acabamentos | acabamentos | NAO | NAO | NAO | NAO | NENHUMA (tabela nao existe) |
| Servicos | servicos | NAO | NAO | NAO | NAO | NENHUMA (tabela nao existe) |
| Config Precificacao | config_precificacao | SIM | SIM | SIM | NAO | AdminConfigPage + AdminPrecificacaoPage |
| Regras Precificacao | regras_precificacao | SIM* | SIM* | SIM* | SIM* | AdminPrecificacaoPage |

*Codigo existe mas tabela NAO existe (migration 006 pendente) e schema incompativel.

## Isso esta realmente pronto para uso?

**NAO.** O cadastro e basicamente read-only. O admin nao consegue:
- Criar novos produtos
- Editar nome, categoria ou status de produtos
- Criar/editar modelos de produto
- Vincular materiais a modelos (a funcao MAIS CRITICA)
- Vincular processos a modelos
- Gerenciar acabamentos
- Gerenciar servicos

## Ainda parece mock?

**SIM, em varios pontos:**
- AdminProdutosPage tab Produtos: e uma lista sem acoes (sem botao Novo, sem Editar)
- AdminProdutosPage tab Modelos: idem — lista sem acoes
- AdminConfigPage e AdminPrecificacaoPage: duas paginas fazendo a mesma coisa (config duplicada)
- Categorias de produtos sao strings livres, sem dropdown controlado

## O cadastro esta conectado de verdade ao orcamento?

**NAO.**
- O OrcamentoEditorPage nao importa `useProdutos()` nem `useProdutoModelos()`
- O editor nao tem ProdutoSelector
- Os hooks existem e funcionam, mas sao dead code no contexto do editor
- Os arrays `materiais: []`, `acabamentos: []`, `processos: []` sao hardcoded vazios

## O modelo herda corretamente materiais e processos?

**Em teoria SIM (tabelas modelo_materiais e modelo_processos existem). Na pratica NAO (0 registros em ambas).**

O hook `useProdutoModelos(produtoId)` faz:
```
produto_modelos -> LEFT JOIN modelo_materiais -> LEFT JOIN materiais
produto_modelos -> LEFT JOIN modelo_processos
```
Essa query retornaria materiais e processos SE houvesse dados. Mas com 0 registros, retorna arrays vazios.

## A usabilidade do cadastro e boa?

**NAO.** Para um admin, o cadastro e frustrante:
- So consigo VER dados, nao consigo MUDAR nada
- A unica acao possivel e editar preco_medio de materiais sem preco
- Nao ha import CSV para atualizar precos em massa (467 materiais)
- Categorias aparecem como texto cru do banco (`comunicacao_interna` em vez de "Comunicacao Interna")

## A estrutura serve para a Croma ou esta generica demais?

**A estrutura de banco e boa para a Croma** (categorias como fachadas, pdv, campanhas, comunicacao_interna). **Mas a UI nao expoe essa especializacao.** O admin nao consegue filtrar por categoria, nao ve produtos agrupados por tipo, nao tem uma visao "catalogo" util.

---

# ==================================================
# PARTE 7 — PROBLEMAS POR SEVERIDADE
# ==================================================

## CRITICO

### 1. ERP sem autenticacao
- **Descricao**: DemoRoute e um pass-through. Qualquer pessoa que acesse a URL ve todos os dados.
- **Impacto no negocio**: Exposicao de dados de 307 clientes, propostas, financeiro
- **Impacto tecnico**: RLS nao protege porque acesso e via anon key
- **Impacto para usuario**: Nenhum — nao percebe que esta vulneravel
- **Recomendacao**: Substituir DemoRoute por ProtectedRoute. Adicionar rota /login. Forcar autenticacao.

### 2. Orcamento sempre gera R$ 0,00
- **Descricao**: OrcamentoEditorPage envia arrays vazios para materiais/processos/acabamentos
- **Impacto no negocio**: Sistema e inutilizavel para vendedores. Orcamentos sem valor.
- **Impacto tecnico**: Motor Mubisys e bypassed completamente
- **Impacto para usuario**: Vendedor nao confia no sistema, volta para planilha
- **Recomendacao**: Conectar catalogo de produtos ao editor. Implementar ProdutoSelector.

### 3. Bug de multiplicacao dupla no preco
- **Descricao**: `precoTotal = precoVenda * quantidade` onde `precoVenda` JA inclui `quantidade`
- **Impacto no negocio**: Quando dados reais chegarem, precos serao `unitario * quantidade^2`
- **Impacto tecnico**: Bug escondido porque 0 * qualquer coisa = 0
- **Impacto para usuario**: Precos errados por fator de N (onde N = quantidade)
- **Recomendacao**: Corrigir para `precoUnitario = precoVenda / quantidade, precoTotal = precoVenda`

### 4. Schema regras_precificacao incompativel (3 versoes)
- **Descricao**: Migration 006, AdminPrecificacaoPage e orcamento-pricing.service esperam colunas diferentes
- **Impacto no negocio**: Quando migration 006 for executada, AdminPrecificacao vai crashar
- **Impacto tecnico**: Runtime errors em 3 arquivos diferentes
- **Impacto para usuario**: Admin nao conseguira configurar markups
- **Recomendacao**: Reescrever migration 006 para usar schema da service (markup_minimo, markup_sugerido)

### 5. modelo_materiais e modelo_processos com 0 registros
- **Descricao**: Nenhum material ou processo vinculado a nenhum modelo de produto
- **Impacto no negocio**: Mesmo com ProdutoSelector, custo sera zero
- **Impacto tecnico**: LEFT JOIN retorna NULL
- **Impacto para usuario**: Preco calculado sera impreciso
- **Recomendacao**: Seedar dados reais da Croma: quais materiais cada produto usa, quanto tempo de producao

## ALTO

### 6. Permissoes nunca enforced
- **Descricao**: Funcao `can()` existe mas ZERO chamadas em paginas/componentes
- **Impacto no negocio**: Qualquer usuario faz qualquer coisa — excluir leads, aprovar propostas, etc.
- **Impacto tecnico**: RBAC e decorativo
- **Recomendacao**: Adicionar `can('modulo', 'acao')` em botoes e acoes criticas

### 7. Sem ErrorBoundary
- **Descricao**: Nenhum ErrorBoundary no app. Um erro em qualquer componente derruba tudo.
- **Impacto no negocio**: Usuario perde trabalho nao salvo
- **Impacto tecnico**: Nenhuma recuperacao possivel alem de F5
- **Recomendacao**: Adicionar ErrorBoundary no App.tsx e em cada dominio

### 8. Login.tsx orfao (sem rota)
- **Descricao**: Pagina de login implementada mas sem rota em App.tsx
- **Impacto no negocio**: Mesmo querendo habilitar auth, nao ha como logar
- **Recomendacao**: Adicionar rota /login e substituir DemoRoute por ProtectedRoute

### 9. Pedido nao gera Ordem de Producao automaticamente
- **Descricao**: Fluxo pedido -> producao nao existe
- **Impacto no negocio**: Producao nao recebe demanda automaticamente
- **Recomendacao**: Criar trigger ou service que gere OP ao aprovar pedido

### 10. Migration 004 nao executada (bridge ERP-Campo)
- **Descricao**: Views vw_campo_instalacoes e vw_campo_fotos nao existem
- **Impacto no negocio**: InstalacaoPage do ERP nao mostra dados corretos do campo
- **Recomendacao**: Executar migration 004 apos ajustar mapeamento de status

### 11. AlertasOrcamento e ResumoVendedor criados mas nunca usados
- **Descricao**: Componentes prontos mas nao importados no OrcamentoEditorPage
- **Impacto: UX do vendedor** permanece sem feedback de margem e alertas
- **Recomendacao**: Importar e renderizar ambos no editor de orcamento

## MEDIO

### 12. Duas paginas admin de config duplicadas
- **Descricao**: AdminConfigPage e AdminPrecificacaoPage editam a mesma tabela config_precificacao
- **Impacto**: Admin confuso, risco de dados stale
- **Recomendacao**: Manter AdminPrecificacaoPage (tem LivePreview), remover AdminConfigPage

### 13. AdminProdutosPage e read-only
- **Descricao**: Nao cria, edita nem deleta produtos/modelos
- **Impacto**: Admin nao consegue gerenciar catalogo
- **Recomendacao**: Implementar CRUD completo com dialogs

### 14. DRE usa percentuais estimados
- **Descricao**: 45% CME, 25% admin, 30% pessoal — nao reflete realidade
- **Impacto**: Financeiro nao confia no DRE
- **Recomendacao**: Categorizar despesas reais no banco

### 15. Race condition na numeracao de propostas/pedidos
- **Descricao**: count+1 nao e atomico — dois usuarios simultaneos podem gerar mesmo numero
- **Recomendacao**: Usar sequence PostgreSQL ou gen_random_uuid()

### 16. Rota admin/auditoria renderiza AdminUsuariosPage
- **Descricao**: Bug de copiar/colar no App.tsx
- **Recomendacao**: Criar AdminAuditoriaPage dedicada ou passar prop defaultTab

### 17. 19 paginas legacy mortas em src/pages/
- **Descricao**: Paginas antigas nao usadas pelo roteamento atual
- **Recomendacao**: Deletar para reduzir confusao

### 18. Sem validacao Zod nos formularios (exceto fiscal)
- **Descricao**: Forms usam validacao basica HTML, sem schema validation
- **Recomendacao**: Adicionar Zod + react-hook-form nos formularios criticos

## BAIXO

### 19. Bundle de 1.7MB sem code splitting
- **Recomendacao**: Adicionar React.lazy() nas rotas de App.tsx

### 20. Dual toaster (Toaster + Sonner)
- **Recomendacao**: Remover um dos dois

### 21. Acessibilidade abaixo da media
- **Recomendacao**: Adicionar ARIA labels, skip-to-content, live regions

### 22. Sem testes automatizados
- **Recomendacao**: Adicionar Vitest + Testing Library para componentes criticos

### 23. formatBRL duplicado em 3 admin pages
- **Recomendacao**: Usar brl() de shared/utils/format.ts

---

# ==================================================
# PARTE 8 — O QUE PRECISA SER FEITO PARA FICAR 10/10
# ==================================================

## FASE 1 — Correcoes Urgentes (bloqueiam uso real)

1. **Habilitar autenticacao no ERP**
   - Adicionar rota `/login` em App.tsx
   - Substituir `DemoRoute` por `ProtectedRoute` (igual ao campo)
   - Redirecionar para /login quando nao autenticado
   - Testar com os 4 perfis existentes (admin, tecnico1, tecnico2, supervisor)

2. **Corrigir bug de multiplicacao dupla**
   - Em `orcamento-pricing.service.ts`: `precoUnitario = precoVenda / quantidade`, `precoTotal = precoVenda`
   - Expor `precoVendaUnitario` do pricing-engine.ts

3. **Reescrever migration 006 com schema correto**
   - Usar colunas: `categoria, markup_minimo, markup_sugerido, desconto_maximo, preco_m2_minimo, taxa_urgencia, ativo`
   - Manter seeds de acabamentos e servicos
   - Executar no Supabase

4. **Executar migration 004 (bridge ERP-Campo)**
   - Ajustar mapeamento de status antes de executar

5. **Conectar catalogo ao editor de orcamento**
   - Adicionar ProdutoSelector (dropdown produto -> modelo)
   - Importar useProdutos() e useProdutoModelos() no editor
   - Auto-preencher materiais[] e processos[] a partir do modelo selecionado
   - Passar dados reais para calcOrcamentoItem()

6. **Seedar modelo_materiais e modelo_processos**
   - Para cada um dos 156 modelos, definir quais materiais usa e quanto
   - Para cada modelo, definir processos de producao com tempos

## FASE 2 — Melhorias Importantes (qualidade para uso real)

7. **Integrar ResumoVendedor e AlertasOrcamento no editor**
   - Importar e renderizar no OrcamentoEditorPage
   - ResumoVendedor: card principal com preco de venda, custo, margem
   - AlertasOrcamento: banner de avisos (material sem preco, markup baixo)

8. **Implementar CRUD de produtos e modelos**
   - AdminProdutosPage: botoes Novo Produto, Editar, Ativar/Desativar
   - Dialog de edicao com nome, categoria (dropdown), dimensoes
   - CRUD de modelos por produto

9. **Implementar vinculo modelo-materiais na admin**
   - UI para associar materiais a cada modelo com quantidade por unidade
   - UI para associar processos com tempo estimado

10. **Enforcar permissoes**
    - Adicionar `can()` checks em botoes de acao (criar, editar, excluir, aprovar)
    - Filtrar sidebar por modulos acessiveis

11. **Adicionar ErrorBoundary**
    - ErrorBoundary global em App.tsx
    - ErrorBoundary por dominio em cada section do layout

12. **Implementar pedido -> producao**
    - Trigger ou service: pedido aprovado -> gera ordem de producao
    - Passar materiais e processos do pedido para a OP

13. **Corrigir DRE com categorias reais**
    - Categorizar despesas no banco em vez de usar percentuais fixos

14. **Usar markupSugerido como default**
    - Buscar markup sugerido da regras_precificacao para a categoria do produto
    - Substituir hardcoded 40%

## FASE 3 — Refinamentos (robustez e confianca)

15. **Adicionar validacao Zod nos formularios criticos**
    - Orcamento: validar descricao, quantidade > 0, markup > 0
    - Cliente: validar CNPJ, email, telefone
    - Proposta: validar cliente obrigatorio, pelo menos 1 item

16. **Snapshot de precos na proposta**
    - Salvar preco_medio do material na data da proposta
    - Registrar config_precificacao vigente

17. **Implementar edicao inline de itens do orcamento**
    - Atualmente so pode adicionar/remover
    - Permitir editar quantidade, markup, materiais de item existente

18. **Adicionar templates de orcamento**
    - Salvar configuracao de itens como template reutilizavel
    - Botao "Iniciar de Template" no editor

19. **Implementar pedido -> financeiro**
    - Pedido aprovado gera conta a receber automaticamente
    - Parcelas conforme condicao de pagamento

20. **Corrigir race condition na numeracao**
    - Usar sequence PostgreSQL para PROP-YYYY-### e PED-YYYY-####

21. **Eliminar paginas legacy mortas**
    - Deletar 19 paginas em src/pages/ e 5 componentes mortos

22. **Consolidar AdminConfigPage e AdminPrecificacaoPage**
    - Manter AdminPrecificacaoPage (tem LivePreview)
    - Redirecionar admin/config para admin/precificacao

## FASE 4 — Polimento Final (SaaS-ready)

23. **Adicionar lazy loading em todas as rotas**
    - React.lazy() para cada dominio
    - Reduzir bundle inicial de 1.7MB

24. **Implementar CI/CD**
    - GitHub Actions: build + lint + type-check em cada PR
    - Deploy automatico para preview em cada branch

25. **Adicionar testes automatizados**
    - Vitest + Testing Library para pricing-engine (funcoes puras)
    - Testes de integracao para fluxo orcamento -> pedido

26. **Implementar offline sync no campo**
    - Service Worker com queue de sincronizacao
    - Indicador visual de status online/offline

27. **Adicionar acessibilidade**
    - ARIA labels em todos os botoes e links
    - Skip-to-content
    - ARIA live regions para atualizacoes dinamicas

28. **Import CSV de materiais/precos**
    - Upload de planilha para atualizar precos em massa
    - Validacao e preview antes de aplicar

29. **Documentacao de API interna**
    - Documentar cada service e hook
    - Storybook para componentes compartilhados

30. **Multi-tenant para SaaS**
    - Adicionar tenant_id nas tabelas
    - RLS por tenant
    - Onboarding de novos clientes

---

# ==================================================
# PARTE 9 — MANUAIS E DOCUMENTACAO NECESSARIA
# ==================================================

| Documento | Prioridade | Para quem | Conteudo |
|---|---|---|---|
| **Manual do Vendedor** | URGENTE | Vendedores | Como criar orcamento passo a passo, como interpretar preco, como enviar proposta |
| **Manual do Admin** | URGENTE | TI/Gestao | Como configurar precificacao, como gerenciar produtos, como executar migrations |
| **Documentacao do Pricing** | URGENTE | Todos | Explicacao do metodo Mubisys em linguagem de negocios, de onde vem cada componente do preco |
| **Fluxo do Orcamento** | ALTA | Vendedores + Financeiro | Diagrama visual: lead -> orcamento -> pedido -> producao -> instalacao -> faturamento |
| **Checklist de Go-Live** | ALTA | TI | Pre-requisitos para habilitar uso real (auth, migrations, seeds, testes) |
| **Manual do Financeiro** | ALTA | Financeiro | Como interpretar DRE, como rastrear custos, como validar margens |
| **Manual de Implantacao** | MEDIA | TI | Setup local, variaveis de ambiente, Supabase, deploy Vercel |
| **Arquitetura Tecnica** | MEDIA | Devs | Diagrama de dominios, fluxo de dados, integracao ERP-Campo |
| **Manual do Instalador (Campo)** | MEDIA | Tecnicos | Como usar o app de campo, como registrar fotos, como assinar |
| **Guia de Contribuicao** | BAIXA | Devs | Padroes de codigo, convenoes de naming, workflow git |
| **Documentacao de API Supabase** | BAIXA | Devs | Tabelas, RLS, triggers, Edge Functions |

---

# ==================================================
# PARTE 10 — VEREDITO FINAL
# ==================================================

## O sistema ja pode ser usado internamente na Croma?

**NAO na maioria das areas. SIM em algumas areas limitadas.**

### Areas que PODEM ser usadas hoje (com restricoes):

| Area | Restricao |
|---|---|
| **App de Campo** | Funcional para registrar jobs, fotos e assinaturas. Mas jobs nao vem automaticamente do ERP. |
| **Dashboards** | Podem ser vistos para ter nocao geral dos numeros. Mas dependem de dados que ainda nao fluem. |
| **Cadastro de Clientes** | 307 clientes importados. CRUD basico funciona. Pode ser usado como agenda. |
| **Listagem de Leads** | CRUD funciona. Pipeline Kanban funcional. Pode iniciar uso de prospeccao. |

### O que IMPEDIRIA uso real por vendedores:
1. Orcamento gera R$ 0,00 — vendedor nao confia no sistema
2. Sem selecao de produto/material — precisa digitar tudo manualmente
3. Sem feedback de margem — vendedor nao sabe se preco esta rentavel
4. Sem templates — cada orcamento e feito do zero

### O que IMPEDIRIA confianca do financeiro:
1. Custos zerados — nao ha base para faturamento
2. DRE com percentuais estimados — nao reflete realidade
3. Sem snapshot de precos — historico nao e confiavel
4. Sem fluxo automatico pedido -> conta a receber

### O que IMPEDIRIA operacao robusta:
1. Sem auth — dados expostos
2. Sem ErrorBoundary — sistema fragil
3. Sem testes — regressoes invisiveis
4. Sem CI/CD — deploy manual
5. Race conditions — numeracao pode duplicar

---

## CONCLUSAO FINAL

> **Hoje o sistema esta no estagio de PROTOTIPO AVANCADO (MVP incompleto).**

O projeto tem uma base tecnica solida: arquitetura por dominios bem organizada, motor de precificacao Mubisys correto, design visual profissional e consistente, App de Campo funcional, e dashboards com dados reais.

**Porem, o fluxo principal do negocio esta quebrado.** O caminho lead -> orcamento -> pedido -> producao -> instalacao -> faturamento nao funciona de ponta a ponta. O ponto mais critico e o orcamento: o motor de precificacao existe mas nunca recebe dados reais. O editor e desconectado do catalogo de produtos. O resultado e R$ 0,00.

> **Para virar sistema confiavel para uso interno, ainda faltam:**
> 1. Habilitar autenticacao (trocar DemoRoute por ProtectedRoute)
> 2. Conectar catalogo de produtos ao editor de orcamento
> 3. Seedar materiais e processos por modelo de produto
> 4. Executar migrations pendentes (004 e 006 corrigida)
> 5. Corrigir bug de multiplicacao dupla
> 6. Implementar enforcing de permissoes
> 7. Implementar fluxo pedido -> producao -> financeiro

**Estimativa de esforco para chegar a "sistema usavel internamente":**
- Fase 1 (urgente): ~2-3 sprints
- Fase 2 (importante): ~3-4 sprints
- Total para uso interno real: ~5-7 sprints (5-7 semanas com 1 dev dedicado)

**Nota geral do sistema: 4.5/10**
- Fundacao tecnica: 7/10
- Prontidao para uso real: 3/10
- O gap entre o que foi construido e o que falta conectar e a principal divida.

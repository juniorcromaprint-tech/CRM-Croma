# AUDITORIA EXTREMA -- CODIGO, SEGURANCA E UX

> **Data**: 2026-03-14 | **Auditor**: Claude Opus 4.6 | **Repositorio**: CRM-Croma
> **Escopo**: BLOCO 1 (Mapeamento), BLOCO 6 (Seguranca), BLOCO 7 (UX), BLOCO 9 (Codigo/Arquitetura)

---

## SUMARIO EXECUTIVO

| Metrica | Valor |
|---|---|
| Total de arquivos TS/TSX | ~180 |
| Total de linhas de codigo | 71.888 |
| Arquivos com 500+ linhas | 24 |
| Uso de `any` no codigo | 279 ocorrencias |
| console.log/warn/error | 35 ocorrencias em producao |
| Arquivos de teste | 1 unico arquivo |
| Paginas mortas (dead code) | 10 arquivos / ~6.700 linhas |
| Edge Functions sem auth | 3 de 12 |
| Acoes destrutivas sem confirmacao | 2 pontos criticos |
| Rotas admin sem PermissionGuard | 100% (nenhuma rota usa) |

**Nivel geral de risco**: ALTO

---

## BLOCO 1 -- MAPEAMENTO TOTAL DO SISTEMA

### Estrutura de Dominios

```
src/
  domains/
    admin/       - 10 paginas (config, materiais, precificacao, produtos, setup, usuarios, etc.)
    clientes/    - 2 paginas, 3 hooks
    comercial/   - 12 paginas, 10 hooks, 2 services, 8 componentes
    compras/     - 1 pagina (monolito 2099 linhas)
    estoque/     - 1 pagina (monolito 1933 linhas)
    financeiro/  - 7 paginas, 3 hooks, 4 services, 5 componentes
    fiscal/      - 6 paginas, 1 hook, schemas, types
    instalacao/  - 1 pagina, 2 hooks, 2 services
    pedidos/     - 2 paginas, 3 hooks
    portal/      - 1 pagina, 2 hooks, 3 services, 5 componentes
    producao/    - 4 paginas, 2 hooks, 1 service
    qualidade/   - 1 pagina (monolito 1505 linhas)
  pages/         - 21 paginas legadas (maioria dead code)
  routes/        - 6 arquivos de rotas
  shared/        - componentes, schemas, services, utils
```

### Todas as Rotas (45 rotas)

| Rota | Componente | Status |
|---|---|---|
| `/login` | LoginPage | OK |
| `/tv` | TvPage | OK - SEM AUTH (intencional?) |
| `/p/:token` | PortalOrcamentoPage | OK - publico |
| `/` (index) | DashboardPage | OK |
| `/leads` | LeadsPage | OK |
| `/leads/:id` | LeadDetailPage | OK |
| `/pipeline` | PipelinePage | OK |
| `/orcamentos` | OrcamentosPage | OK |
| `/orcamentos/novo` | OrcamentoEditorPage | OK |
| `/orcamentos/:id` | OrcamentoViewPage | OK |
| `/orcamentos/:id/editar` | OrcamentoEditorPage | OK |
| `/propostas` | PropostasPage | OK |
| `/calendario` | CalendarioPage | OK |
| `/campanhas` | CampanhasPage | OK |
| `/clientes` | ClientesPage | OK |
| `/clientes/:id` | ClienteDetailPage | OK |
| `/pedidos` | PedidosPage | OK |
| `/pedidos/:id` | PedidoDetailPage | OK |
| `/producao` | ProducaoPage | OK |
| `/instalacoes` | InstalacaoPage | OK |
| `/almoxarife` | AlmoxarifePage | OK |
| `/producao/diario-bordo` | DiarioBordoPage | OK |
| `/estoque` | EstoquePage | OK |
| `/compras` | ComprasPage | OK |
| `/produtos` | Produtos (legacy) | OK |
| `/ocorrencias` | OcorrenciasPage | OK |
| `/financeiro` | FinanceiroPage | OK |
| `/dre` | DrePage | OK |
| `/comissoes` | ComissoesPage | OK |
| `/financeiro/faturamento` | FaturamentoLotePage | OK |
| `/financeiro/conciliacao` | ConciliacaoPage | OK |
| `/financeiro/boletos` | BoletosPage | OK |
| `/financeiro/config-bancaria` | ConfigBancariaPage | OK |
| `/fiscal` | FiscalDashboardPage | OK |
| `/fiscal/documentos` | FiscalDocumentosPage | OK |
| `/fiscal/fila` | FiscalFilaPage | OK |
| `/fiscal/emissao` | FiscalFilaPage | OK (duplicada) |
| `/fiscal/configuracao` | FiscalConfiguracaoPage | OK |
| `/fiscal/certificado` | FiscalCertificadoPage | OK |
| `/fiscal/auditoria` | FiscalAuditoriaPage | OK |
| `/admin/usuarios` | AdminUsuariosPage | OK |
| `/admin/precificacao` | AdminPrecificacaoPage | OK |
| `/admin/config` | AdminConfigPage | OK |
| `/admin/produtos` | AdminProdutosPage | OK |
| `/admin/auditoria` | **AdminUsuariosPage** | BUG - rota reutiliza componente errado |
| `/admin/setup` | AdminSetupPage | OK |
| `/admin/centros-custo` | AdminCentrosCustoPage | OK |
| `/admin/plano-contas` | AdminPlanoContasPage | OK |
| `/admin/materiais` | AdminMateriaisPage | OK |
| `/relatorios` | RelatoriosPage | OK |
| `/admin/progresso` | ProgressoPage | OK |
| `/settings` | Settings | OK |

---

## PROBLEMAS ENCONTRADOS

---

### [SEC-01] Edge Functions sem autenticacao de usuario
- **Modulo**: Edge Functions
- **Arquivo(s)**: `supabase/functions/enviar-email-proposta/index.ts`, `supabase/functions/onedrive-criar-pasta/index.ts`, `supabase/functions/onedrive-upload-proposta/index.ts`
- **Severidade**: CRITICO
- **Descricao**: Essas 3 Edge Functions usam `SUPABASE_SERVICE_ROLE_KEY` para acessar o banco mas NAO validam se o chamador e um usuario autenticado. Qualquer pessoa com a URL do Supabase pode chamar essas funcoes diretamente. A funcao `enviar-email-proposta` permite enviar emails arbitrarios via Resend. A funcao `onedrive-criar-pasta` permite criar pastas no OneDrive da empresa.
- **Impacto**: Abuso de envio de email (spam em nome da Croma), acesso nao autorizado ao OneDrive, custo financeiro com API Resend.
- **Correcao**: Adicionar validacao de JWT do usuario no inicio de cada funcao:
  ```typescript
  const authHeader = req.headers.get('Authorization')!;
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !user) return new Response('Unauthorized', { status: 401 });
  ```
- **Sprint**: 1 (urgente)

---

### [SEC-02] URL antiga hardcoded no envio de email
- **Modulo**: Edge Functions
- **Arquivo(s)**: `supabase/functions/enviar-email-proposta/index.ts` (linha 33)
- **Severidade**: ALTO
- **Descricao**: O fallback da URL do portal aponta para `https://tender-archimedes.vercel.app` ao inves de `https://crm-croma.vercel.app`. Se a variavel `APP_URL` nao estiver configurada, clientes receberao links quebrados.
- **Impacto**: Emails de proposta com links que nao funcionam. Perda de vendas.
- **Correcao**: Alterar fallback para `https://crm-croma.vercel.app`.
- **Sprint**: 1 (urgente)

---

### [SEC-03] CORS wildcard em TODAS as Edge Functions
- **Modulo**: Edge Functions
- **Arquivo(s)**: Todos os 12 arquivos em `supabase/functions/*/index.ts`
- **Severidade**: MEDIO
- **Descricao**: Todas as Edge Functions usam `Access-Control-Allow-Origin: '*'`. Combinado com SEC-01, permite que qualquer site malicioso chame as funcoes.
- **Impacto**: Facilita ataques CSRF e abuso de API a partir de sites de terceiros.
- **Correcao**: Restringir origin para `['https://crm-croma.vercel.app', 'https://campo-croma.vercel.app']`.
- **Sprint**: 2 (estabilizacao)

---

### [SEC-04] Rotas /admin/* sem PermissionGuard
- **Modulo**: Rotas / Admin
- **Arquivo(s)**: `src/routes/adminRoutes.tsx`
- **Severidade**: ALTO
- **Descricao**: O componente `PermissionGuard` existe em `src/shared/components/PermissionGuard.tsx` mas NAO e usado em NENHUMA rota. Qualquer usuario autenticado (vendedor, tecnico) pode acessar `/admin/usuarios`, `/admin/config`, `/admin/precificacao` etc.
- **Impacto**: Operadores e vendedores podem alterar configuracoes do sistema, gerenciar usuarios, mudar precos.
- **Correcao**: Envolver as rotas admin com `<PermissionGuard module="admin" action="ver">` ou criar um wrapper de rota admin.
- **Sprint**: 1 (urgente)

---

### [SEC-05] Rota /tv sem autenticacao
- **Modulo**: Rotas
- **Arquivo(s)**: `src/App.tsx` (linha 59)
- **Severidade**: MEDIO
- **Descricao**: A rota `/tv` (TvPage - dashboard de producao para TV) esta fora do `ProtectedRoute`. Qualquer pessoa com a URL pode ver dados de producao.
- **Impacto**: Vazamento de informacoes operacionais (pedidos, status de producao).
- **Correcao**: Se e intencional (TV na fabrica), adicionar autenticacao por token. Se nao, mover para dentro do ProtectedRoute.
- **Sprint**: 2 (estabilizacao)

---

### [SEC-06] Rota admin/auditoria aponta para componente errado
- **Modulo**: Admin
- **Arquivo(s)**: `src/routes/adminRoutes.tsx` (linha 20)
- **Severidade**: MEDIO
- **Descricao**: A rota `admin/auditoria` renderiza `AdminUsuariosPage` ao inves de uma pagina de auditoria dedicada. O usuario que acessa "Auditoria" ve a lista de usuarios.
- **Impacto**: Funcionalidade de auditoria inexistente/enganosa.
- **Correcao**: Criar pagina `AdminAuditoriaPage` ou usar `FiscalAuditoriaPage` se for auditoria fiscal.
- **Sprint**: 3 (refinamento)

---

### [SEC-07] Busca com ilike sem sanitizacao
- **Modulo**: Clientes, Leads
- **Arquivo(s)**: `src/domains/clientes/pages/ClientesPage.tsx` (linha 61), `src/domains/comercial/pages/LeadsPage.tsx` (linha 64), `src/domains/clientes/hooks/useClientes.ts` (linha 95-96)
- **Severidade**: BAIXO
- **Descricao**: Campos de busca passam input do usuario diretamente para `.or()` com `ilike` sem escapar caracteres especiais de pattern matching (`%`, `_`). O Supabase/PostgREST faz escape, mas a concatenacao direta na string `.or()` pode causar resultados inesperados com caracteres especiais.
- **Impacto**: Risco baixo - PostgREST trata, mas a pratica nao e ideal.
- **Correcao**: Usar `.ilike('campo', `%${search}%`)` individual ao inves de concatenar na string `.or()`.
- **Sprint**: 4 (escala)

---

### [UX-01] Acoes destrutivas sem dialog de confirmacao
- **Modulo**: Admin, Comercial
- **Arquivo(s)**: `src/domains/admin/pages/AdminPrecificacaoPage.tsx` (linha 937), `src/domains/comercial/pages/TemplatesPage.tsx` (linha 219)
- **Severidade**: ALTO
- **Descricao**: Excluir regra de precificacao e excluir template de orcamento executam `mutation.mutate()` diretamente no onClick, sem AlertDialog ou window.confirm. Um clique acidental apaga dados.
- **Impacto**: Perda de regras de precificacao ou templates de orcamento sem possibilidade de desfazer.
- **Correcao**: Adicionar AlertDialog similar ao usado em `AdminMateriaisPage.tsx`.
- **Sprint**: 1 (urgente)

---

### [UX-02] window.confirm nativo em 4 locais (nao padronizado)
- **Modulo**: Fiscal, Jobs, Settings
- **Arquivo(s)**: `src/domains/fiscal/pages/FiscalDocumentosPage.tsx` (linhas 56, 96), `src/pages/JobDetail.tsx` (linhas 751, 780), `src/pages/Jobs.tsx` (linha 181), `src/pages/Settings.tsx` (linha 198)
- **Severidade**: MEDIO
- **Descricao**: Usa `window.confirm()` nativo do browser ao inves do componente AlertDialog do shadcn/ui. Inconsistente com o padrao usado em AdminMateriaisPage e outros.
- **Impacto**: UX inconsistente, confirmacao nativa e feia e nao permite customizacao.
- **Correcao**: Substituir por AlertDialog com texto descritivo em portugues.
- **Sprint**: 3 (refinamento)

---

### [UX-03] Botoes sem loading state na maioria dos formularios
- **Modulo**: Varios
- **Arquivo(s)**: Maioria das paginas exceto Financeiro
- **Severidade**: MEDIO
- **Descricao**: Apenas os formularios do modulo Financeiro (BankAccountForm, BoletoFormDialog, GerarRemessaDialog) mostram Loader2 no botao durante submissao. Nas demais paginas (Clientes, Leads, Orcamentos, Pedidos, etc.), o botao nao indica loading.
- **Impacto**: Usuario clica multiplas vezes pensando que nao funcionou, causando duplicacao de registros.
- **Correcao**: Adicionar `disabled={isPending}` e icone Loader2 em todos os botoes de submit.
- **Sprint**: 2 (estabilizacao)

---

### [UX-04] Sem paginacao em listagens grandes
- **Modulo**: Clientes, Leads, Orcamentos, Pedidos, etc.
- **Arquivo(s)**: `src/domains/clientes/pages/ClientesPage.tsx`, `src/domains/comercial/pages/LeadsPage.tsx`, `src/domains/pedidos/pages/PedidosPage.tsx`
- **Severidade**: MEDIO
- **Descricao**: Apenas `AdminUsuariosPage` implementa paginacao. Todas as outras listagens carregam todos os registros de uma vez. Com 307 clientes ja e pesado; com crescimento, ficara inutilizavel.
- **Impacto**: Performance degradada, alto consumo de banda, lentidao em dispositivos moveis.
- **Correcao**: Implementar paginacao com `.range()` do Supabase + componente Pagination do shadcn/ui.
- **Sprint**: 2 (estabilizacao)

---

### [UX-05] Navegacao para criar orcamento requer muitos cliques
- **Modulo**: Comercial
- **Arquivo(s)**: Fluxo de navegacao geral
- **Severidade**: BAIXO
- **Descricao**: Para criar orcamento: Dashboard > Orcamentos > Novo Orcamento > Preencher. Sao 3 cliques. Nao ha atalho direto ou botao "Novo Orcamento" no dashboard.
- **Impacto**: Operadores perdem tempo na navegacao repetitiva.
- **Correcao**: Adicionar botao rapido no Dashboard e/ou usar CommandPalette (ja existe em `src/shared/components/CommandPalette.tsx` mas verificar se esta ativo).
- **Sprint**: 3 (refinamento)

---

### [CODE-01] 10 paginas mortas (dead code) -- ~6.700 linhas
- **Modulo**: Legacy
- **Arquivo(s)**: `src/pages/Analytics.tsx`, `src/pages/BillingReport.tsx`, `src/pages/ClientesList.tsx`, `src/pages/Clients.tsx`, `src/pages/FunilVendas.tsx`, `src/pages/NewJob.tsx`, `src/pages/NotFound.tsx`, `src/pages/OrcamentoDetail.tsx`, `src/pages/OrcamentosList.tsx`, `src/pages/StoreDetail.tsx`, `src/pages/StoreMap.tsx`
- **Severidade**: MEDIO
- **Descricao**: 10 arquivos em `src/pages/` nao sao importados em nenhuma rota nem referenciados por nenhum outro arquivo. Sao paginas legadas do sistema antigo, substituidas por paginas em `src/domains/`.
- **Impacto**: Confusao para desenvolvedores, aumento do tamanho do bundle (se tree-shaking falhar), manutencao desnecessaria.
- **Correcao**: Mover para pasta `src/_deprecated/` ou deletar.
- **Sprint**: 3 (refinamento)

---

### [CODE-02] Paginas duplicadas entre src/pages e src/domains
- **Modulo**: Clientes, Financeiro
- **Arquivo(s)**: `src/pages/ClienteDetail.tsx` (1214 linhas) vs `src/domains/clientes/pages/ClienteDetailPage.tsx` (1554 linhas); `src/pages/Financeiro.tsx` (840 linhas) vs `src/domains/financeiro/pages/FinanceiroPage.tsx` (1844 linhas)
- **Severidade**: MEDIO
- **Descricao**: Existem versoes duplicadas de paginas. As rotas usam as versoes em `domains/`, mas as versoes em `pages/` ainda existem. Confusao sobre qual e a "verdadeira".
- **Impacto**: Risco de editar o arquivo errado, duplicacao de esforco.
- **Correcao**: Deletar as versoes legadas em `src/pages/`.
- **Sprint**: 3 (refinamento)

---

### [CODE-03] 24 arquivos com mais de 500 linhas (6 com mais de 1500)
- **Modulo**: Varios
- **Arquivo(s)**:
  - `AdminProdutosPage.tsx` - **2551 linhas** (CRUD produtos + modelos + materiais + processos + acabamentos + servicos)
  - `ComprasPage.tsx` - **2099 linhas** (pedidos compras + fornecedores + cotacoes)
  - `EstoquePage.tsx` - **1933 linhas** (inventario + movimentacoes + alerts)
  - `FinanceiroPage.tsx` - **1844 linhas** (contas pagar/receber + fluxo de caixa)
  - `ProducaoPage.tsx` - **1742 linhas** (kanban + alocacao + timeline)
  - `AdminUsuariosPage.tsx` - **1608 linhas** (usuarios + permissoes + audit log)
- **Severidade**: ALTO
- **Descricao**: Arquivos monoliticos com toda a logica de negocio, queries Supabase, componentes internos e UI num unico arquivo. Impossivel de manter, testar ou revisar.
- **Impacto**: Produtividade de desenvolvimento degradada, bugs dificeis de rastrear, impossivel de testar unitariamente.
- **Correcao**: Decompor em: `service.ts` (queries), `hooks/` (useQuery/useMutation), `components/` (subcomponentes). Meta: nenhum arquivo > 400 linhas.
- **Sprint**: 2 (estabilizacao)

---

### [CODE-04] 279 usos de `any` no codigo
- **Modulo**: Todos
- **Arquivo(s)**: Piores ofensores:
  - `AdminProdutosPage.tsx` - 27 `(supabase as unknown as any)` por query
  - `AdminPrecificacaoPage.tsx` - 16 `(supabase as unknown as any)`
  - `AdminConfigPage.tsx` - 10 `(supabase as unknown as any)`
  - `AdminSetupPage.tsx` - 8 `(supabase as unknown as any)`
  - `ClienteDetailPage.tsx` - `unidades.map((u: any))`
- **Severidade**: ALTO
- **Descricao**: O padrao `(supabase as unknown as any).from("tabela")` e usado em todo o codigo admin porque os tipos gerados do Supabase nao incluem todas as tabelas. Isso desabilita completamente o type-checking.
- **Impacto**: Nenhum erro de tipo e detectado em tempo de compilacao. Campos errados, typos em nomes de colunas passam despercebidos.
- **Correcao**: Regenerar tipos do Supabase com `supabase gen types typescript` e atualizar `src/integrations/supabase/`. Ou criar tipos manuais para as tabelas faltantes.
- **Sprint**: 2 (estabilizacao)

---

### [CODE-05] Logica de negocio direto nos componentes de pagina
- **Modulo**: Admin, Producao, Comercial
- **Arquivo(s)**: `AdminProdutosPage.tsx` (28 queries diretas), `AdminUsuariosPage.tsx` (13 queries diretas), `PipelinePage.tsx` (3 queries diretas), `ComprasPage.tsx`, `EstoquePage.tsx`, `ProducaoPage.tsx`, etc.
- **Severidade**: ALTO
- **Descricao**: A maioria dos dominios NAO tem `services/` ou `hooks/` separados. Queries Supabase, mutations, logica de calculo estao tudo dentro do componente React da pagina. Apenas `comercial/`, `financeiro/`, `portal/`, `instalacao/` seguem a arquitetura correta com services e hooks.
- **Impacto**: Impossivel reutilizar queries, impossivel testar logica isoladamente, componentes gigantescos.
- **Correcao**: Extrair para `domains/{dominio}/services/` e `domains/{dominio}/hooks/`.
- **Sprint**: 2 (estabilizacao)

---

### [CODE-06] Duplicacao: TEMP_CONFIG em 3 arquivos
- **Modulo**: Comercial
- **Arquivo(s)**: `src/domains/comercial/pages/LeadsPage.tsx` (linha 32), `src/domains/comercial/pages/LeadDetailPage.tsx` (linha 34), `src/domains/comercial/pages/PipelinePage.tsx` (linha 128)
- **Severidade**: BAIXO
- **Descricao**: A mesma constante `TEMP_CONFIG` (configuracao de cores/labels para temperatura do lead) e definida identicamente em 3 arquivos.
- **Impacto**: Se uma cor mudar, precisa mudar em 3 lugares. Risco de inconsistencia.
- **Correcao**: Extrair para `src/shared/constants/leads.ts`.
- **Sprint**: 4 (escala)

---

### [CODE-07] Apenas 1 arquivo de teste em todo o projeto
- **Modulo**: Testes
- **Arquivo(s)**: `src/shared/services/__tests__/pricing-engine.test.ts`
- **Severidade**: CRITICO
- **Descricao**: O projeto inteiro (71.888 linhas de codigo) tem UM UNICO arquivo de teste, que testa apenas o pricing engine. Nao ha testes para: services, hooks, componentes, integracao, E2E.
- **Impacto**: Qualquer mudanca pode quebrar funcionalidades sem deteccao. Regressoes constantes. Impossivel refatorar com seguranca.
- **Correcao**: Priorizar testes para: (1) pricing engine (ja tem), (2) boleto/CNAB service, (3) orcamento service, (4) auth flow. Usar Vitest + React Testing Library.
- **Sprint**: 2 (estabilizacao)

---

### [CODE-08] Validacao Zod usada em apenas 2 de ~20 formularios
- **Modulo**: Formularios
- **Arquivo(s)**: Schemas existem em `src/shared/schemas/` (7 arquivos) e `src/domains/financeiro/schemas/`, mas so sao usados em `BankAccountForm.tsx` e `BoletoFormDialog.tsx`
- **Severidade**: ALTO
- **Descricao**: Embora existam schemas Zod definidos para praticamente todos os dominios, apenas os formularios do financeiro usam `zodResolver` com React Hook Form. Todos os outros formularios fazem validacao manual com `if (!field)`.
- **Impacto**: Validacao inconsistente, campos podem receber dados invalidos, erros nao sao mostrados de forma padronizada.
- **Correcao**: Integrar zodResolver nos formularios de Clientes, Leads, Orcamentos, Pedidos.
- **Sprint**: 2 (estabilizacao)

---

### [CODE-09] 35 console.log/warn/error em codigo de producao
- **Modulo**: Varios
- **Arquivo(s)**: Ver lista completa na secao de mapeamento
- **Severidade**: BAIXO
- **Descricao**: 35 instrucoes de console espalhadas pelo codigo. A maioria sao `console.error` em catch blocks (aceitavel) e `console.warn` em fallbacks de migration (aceitavel temporariamente). Poucos sao `console.log` de debug esquecidos.
- **Impacto**: Informacao de debug visivel no console do usuario. Nenhum impacto funcional.
- **Correcao**: Remover os `console.log` de debug. Manter `console.error` em catch blocks mas considerar logger centralizado.
- **Sprint**: 4 (escala)

---

### [CODE-10] Componente `made-with-dyad.tsx` morto
- **Modulo**: Componentes
- **Arquivo(s)**: `src/components/made-with-dyad.tsx`
- **Severidade**: BAIXO
- **Descricao**: Componente watermark do Dyad (plataforma de geracao de codigo) nao e importado por nenhum outro arquivo. Dead code.
- **Impacto**: Nenhum, apenas polui o repositorio.
- **Correcao**: Deletar o arquivo.
- **Sprint**: 4 (escala)

---

### [CODE-11] Tratamento de erro: try/catch sem feedback ao usuario
- **Modulo**: Varios
- **Arquivo(s)**: `src/pages/Index.tsx` (linha 24), `src/components/JobFormSheet.tsx` (linha 140), `src/components/StoreFormSheet.tsx` (linha 200)
- **Severidade**: MEDIO
- **Descricao**: Varios blocos catch fazem apenas `console.error(error)` sem chamar `showError()` para informar o usuario. A operacao falha silenciosamente.
- **Impacto**: Usuario nao sabe que a acao falhou. Pode perder dados sem perceber.
- **Correcao**: Adicionar `showError(error.message || "Erro ao salvar")` em cada catch.
- **Sprint**: 2 (estabilizacao)

---

### [CODE-12] Upload de certificado .pfx sem validacao de tamanho
- **Modulo**: Fiscal
- **Arquivo(s)**: `src/domains/fiscal/pages/FiscalCertificadoPage.tsx`
- **Severidade**: MEDIO
- **Descricao**: O upload de certificado digital aceita `accept=".pfx,.p12"` mas nao valida tamanho maximo do arquivo. O portal de upload (`PortalFileUpload`) tem limite de 50MB, mas o upload de certificado nao tem nenhum.
- **Impacto**: Um arquivo muito grande pode travar o browser ou exceder limites do Supabase Storage.
- **Correcao**: Adicionar validacao de tamanho maximo (ex: 5MB para certificados .pfx).
- **Sprint**: 3 (refinamento)

---

### [CODE-13] XSS potencial em OrcamentoPDF
- **Modulo**: Comercial
- **Arquivo(s)**: `src/domains/comercial/components/OrcamentoPDF.tsx` (linha 90)
- **Severidade**: BAIXO
- **Descricao**: Usa `dangerouslySetInnerHTML` para injetar CSS de impressao. O conteudo e uma string estatica de CSS, nao dados do usuario. O outro uso em `chart.tsx` tambem e estatico.
- **Impacto**: Risco baixo - o conteudo e controlado (CSS estatico), nao dados do usuario.
- **Correcao**: Manter, mas documentar que o conteudo e estatico.
- **Sprint**: 4 (escala)

---

### [SEC-08] Supabase anon key no CLAUDE.md (nao no codigo)
- **Modulo**: Documentacao
- **Arquivo(s)**: `CLAUDE.md` (documentacao do projeto)
- **Severidade**: BAIXO
- **Descricao**: A anon key do Supabase esta exposta no CLAUDE.md. A anon key e publica por design (usada no frontend), mas sua exposicao no repositorio pode confundir. No codigo fonte, a key vem corretamente de `import.meta.env.VITE_SUPABASE_ANON_KEY`.
- **Impacto**: Risco baixo se RLS esta configurado. A anon key e publica por design do Supabase.
- **Correcao**: Verificar se RLS esta habilitado em TODAS as tabelas. Remover a key do CLAUDE.md se possivel.
- **Sprint**: 3 (refinamento)

---

### [SEC-09] resolve-geo sem rate limiting
- **Modulo**: Edge Functions
- **Arquivo(s)**: `supabase/functions/resolve-geo/index.ts`
- **Severidade**: MEDIO
- **Descricao**: A funcao resolve-geo nao tem autenticacao nem rate limiting. Qualquer pessoa pode chamar a funcao repetidamente, consumindo o quota gratuito do ipinfo.io (50k/mes).
- **Impacto**: Esgotamento do quota do ipinfo.io, custo se migrar para plano pago.
- **Correcao**: Adicionar rate limiting ou pelo menos autenticacao basica.
- **Sprint**: 3 (refinamento)

---

### [NFE-01] Todos os endpoints nfe-service validam NFE_INTERNAL_SECRET
- **Modulo**: NFE Service
- **Arquivo(s)**: `nfe-service/api/*.ts` (6 endpoints)
- **Severidade**: N/A (CONFORME)
- **Descricao**: Todos os 6 endpoints (`emitir`, `cancelar`, `consultar`, `danfe`, `recibo`, `inutilizar`, `certificado`) validam o header `x-internal-secret` via `validateInternalSecret()`.
- **Impacto**: Positivo - seguranca adequada.
- **Correcao**: Nenhuma necessaria.
- **Sprint**: N/A

---

## RESUMO POR SPRINT

### Sprint 1 (Urgente) -- 3 itens
| ID | Titulo | Severidade |
|---|---|---|
| SEC-01 | Edge Functions sem autenticacao | CRITICO |
| SEC-02 | URL antiga no envio de email | ALTO |
| SEC-04 | Rotas admin sem PermissionGuard | ALTO |
| UX-01 | Acoes destrutivas sem confirmacao | ALTO |

### Sprint 2 (Estabilizacao) -- 7 itens
| ID | Titulo | Severidade |
|---|---|---|
| CODE-03 | Arquivos monoliticos 500+ linhas | ALTO |
| CODE-04 | 279 usos de `any` | ALTO |
| CODE-05 | Logica de negocio nos componentes | ALTO |
| CODE-07 | 1 arquivo de teste total | CRITICO |
| CODE-08 | Zod usado em 2 de 20 formularios | ALTO |
| CODE-11 | Try/catch sem feedback ao usuario | MEDIO |
| UX-03 | Botoes sem loading state | MEDIO |
| UX-04 | Sem paginacao em listagens | MEDIO |
| SEC-03 | CORS wildcard | MEDIO |

### Sprint 3 (Refinamento) -- 6 itens
| ID | Titulo | Severidade |
|---|---|---|
| CODE-01 | 10 paginas dead code | MEDIO |
| CODE-02 | Paginas duplicadas | MEDIO |
| CODE-12 | Upload certificado sem validacao tamanho | MEDIO |
| SEC-05 | /tv sem auth | MEDIO |
| SEC-06 | admin/auditoria componente errado | MEDIO |
| UX-02 | window.confirm nativo | MEDIO |
| SEC-08 | Anon key no CLAUDE.md | BAIXO |
| SEC-09 | resolve-geo sem rate limiting | MEDIO |
| UX-05 | Muitos cliques para criar orcamento | BAIXO |

### Sprint 4 (Escala) -- 4 itens
| ID | Titulo | Severidade |
|---|---|---|
| CODE-06 | TEMP_CONFIG duplicado | BAIXO |
| CODE-09 | console.log em producao | BAIXO |
| CODE-10 | made-with-dyad morto | BAIXO |
| CODE-13 | dangerouslySetInnerHTML (baixo risco) | BAIXO |
| SEC-07 | ilike sem sanitizacao | BAIXO |

---

## METRICAS DE COBERTURA

| Area | Estado | Nota |
|---|---|---|
| Seguranca: Auth em rotas | ProtectedRoute OK, PermissionGuard NAO usado | 5/10 |
| Seguranca: Edge Functions | 9/12 validam auth (3 criticas expostas) | 6/10 |
| Seguranca: NFE Service | 6/6 endpoints protegidos | 10/10 |
| Seguranca: Secrets | .env no .gitignore, nao ha secrets hardcoded no codigo | 9/10 |
| UX: Loading states | Apenas modulo financeiro | 3/10 |
| UX: Confirmacao de exclusao | Parcial (4 com confirm nativo, 2 sem nada) | 5/10 |
| UX: Paginacao | Apenas 1 de 15+ listagens | 1/10 |
| UX: Busca/filtro | Maioria das listagens tem busca basica | 7/10 |
| Codigo: Tipagem | 279 `any`, tipos Supabase desatualizados | 3/10 |
| Codigo: Testes | 1 arquivo de teste | 1/10 |
| Codigo: Validacao | Schemas existem mas nao sao usados | 2/10 |
| Codigo: Separacao de responsabilidades | 4 de 12 dominios seguem arquitetura | 4/10 |

---

*Relatorio gerado automaticamente por Claude Opus 4.6 em 2026-03-14*

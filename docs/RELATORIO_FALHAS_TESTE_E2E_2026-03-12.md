# 🔴 RELATÓRIO COMPLETO DE FALHAS — CROMA PRINT ERP/CRM

## Teste Funcional End-to-End

| Campo | Detalhe |
|---|---|
| **Data do Teste** | 12 de março de 2026 |
| **Ambiente** | Produção — Vercel |
| **ERP URL** | `tender-archimedes.vercel.app` |
| **Campo URL** | `campo-croma.vercel.app` |
| **Supabase** | `djwjmfgplnqyffdcgdaw.supabase.co` |
| **Método** | Automação via browser (Chrome) simulando vendedor real |
| **Fluxo Testado** | Lead → Cliente → Produto → Orçamento → Pedido → Produção → Instalação → Campo → Financeiro |
| **Total de Falhas** | **46** |

---

## ÍNDICE

1. [Resumo Executivo](#resumo-executivo)
2. [Classificação por Severidade](#classificação-por-severidade)
3. [Falhas Críticas (16)](#-falhas-críticas-16--impedem-uso-em-produção)
4. [Falhas Graves (14)](#-falhas-graves-14--funcionalidade-quebrada-ou-incompleta)
5. [Falhas Médias (9)](#-falhas-médias-9--dificultam-uso-real)
6. [Falhas Baixas (7)](#-falhas-baixas-7--cosméticas--acentuação)
7. [Mapa de Fluxos Quebrados](#-mapa-de-fluxos-quebrados)
8. [O Que Funciona](#-o-que-funciona)
9. [Resumo por Módulo](#-resumo-por-módulo)
10. [Veredicto Final](#-veredicto-final)
11. [Plano de Correção Priorizado](#-plano-de-correção-priorizado)
12. [Dados de Teste Criados](#-dados-de-teste-criados)

---

## RESUMO EXECUTIVO

O sistema foi testado simulando o fluxo completo de um vendedor: desde a captação de lead até a emissão de nota fiscal. **O fluxo principal do negócio NÃO funciona end-to-end.** Das 8 transições entre módulos, **6 estão quebradas**. O sistema possui excelente estrutura visual e UI bem construída (shadcn/ui + Tailwind), mas os módulos operam como ilhas isoladas — dados não fluem automaticamente entre eles.

**O sistema NÃO está pronto para vendedores usarem em produção.**

---

## CLASSIFICAÇÃO POR SEVERIDADE

| Severidade | Qtd | Critério |
|---|---|---|
| 🔴 **CRÍTICO** | 16 | Impede o uso em produção — bloqueia fluxo principal ou compromete segurança |
| 🟠 **GRAVE** | 14 | Funcionalidade existe mas está quebrada, incompleta ou retorna dados errados |
| 🟡 **MÉDIO** | 9 | Problemas de UX que dificultam significativamente o uso real por vendedores |
| 🔵 **BAIXO** | 7 | Problemas cosméticos, acentuação, labels incorretos |

---

## 🔴 FALHAS CRÍTICAS (16) — IMPEDEM USO EM PRODUÇÃO

### FALHA #1 — Sistema sem autenticação
- **Módulo**: Autenticação
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: `DemoRoute` é pass-through. O sistema entra direto no modo Demo sem exigir login. Qualquer pessoa com a URL acessa todos os dados de clientes, orçamentos, financeiro.
- **Como reproduzir**: Acessar `tender-archimedes.vercel.app` — entra direto no dashboard.
- **Impacto**: Segurança zero. Impossível usar com dados reais de clientes. Viola LGPD.
- **Correção sugerida**: Trocar `DemoRoute` por `ProtectedRoute` em todas as rotas. Implementar login obrigatório com Supabase Auth.

---

### FALHA #2 — Lead não tem página de detalhe
- **Módulo**: Comercial / Leads
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Ao clicar em um lead na lista, nada acontece. Não existe rota/página de detalhe do lead.
- **Como reproduzir**: Ir em Leads → clicar em qualquer lead da lista.
- **Impacto**: Vendedor não consegue ver informações completas do lead, histórico de contatos, ou tomar ações.
- **Correção sugerida**: Criar página `/leads/:id` com dados do lead, histórico, e ações (converter, editar, excluir).

---

### FALHA #3 — Não existe fluxo Lead → Cliente
- **Módulo**: Comercial / Leads
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Não há botão "Converter em Cliente" no lead. O processo comercial fundamental de qualificar um lead e transformá-lo em cliente é inexistente na UI.
- **Como reproduzir**: Criar um lead → procurar opção de converter em cliente → não existe.
- **Impacto**: Processo comercial fundamental quebrado. Vendedor precisa criar cliente manualmente, sem vínculo com o lead original.
- **Correção sugerida**: Adicionar botão "Converter em Cliente" no detalhe do lead que pré-preenche o formulário de cliente com dados do lead.

---

### FALHA #4 — Cadastro de cliente crasha (coluna `website` inexistente)
- **Módulo**: Comercial / Clientes
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Ao tentar salvar um novo cliente via UI, o Supabase retorna erro porque o formulário envia campo `website` que não existe na tabela `clientes`.
- **Como reproduzir**: Ir em Clientes → + Novo Cliente → preencher dados → Salvar → erro no console.
- **Impacto**: Impossível cadastrar clientes pela interface. Workaround: inserir via SQL direto.
- **Correção sugerida**: Remover campo `website` do formulário ou adicionar coluna `website` na tabela `clientes` via migration.

---

### FALHA #5 — Frontend usa nomes de colunas errados para endereço
- **Módulo**: Comercial / Clientes
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: O formulário de cliente envia `endereco_cidade` e `endereco_estado`, mas a tabela usa `cidade` e `estado`. Dados de endereço não são salvos.
- **Como reproduzir**: Cadastrar cliente com cidade/estado → verificar no banco → campos null.
- **Impacto**: Endereços de clientes nunca são salvos corretamente.
- **Correção sugerida**: Alinhar nomes de campos no formulário com os nomes reais das colunas no banco, ou criar migration para renomear colunas.

---

### FALHA #13 — Tela branca ao adicionar item no orçamento
- **Módulo**: Orçamento / Editor
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Ao clicar em "+ Adicionar Item" no editor de orçamento, a tela fica branca (crash). Causa: componente `Select.Item` do Radix UI recebe `value=""` (string vazia), o que é proibido e causa exceção.
- **Como reproduzir**: Ir em Orçamentos → Novo Orçamento → selecionar cliente → clicar "+ Adicionar Item" → tela branca.
- **Impacto**: **Impossível adicionar itens ao orçamento.** O módulo de orçamento inteiro fica inutilizável.
- **Correção sugerida**: Filtrar itens com value vazio antes de renderizar `Select.Item`, ou usar fallback ID. Verificar se `produto_modelos` está sendo carregado corretamente no dropdown.

---

### FALHA #14 — Sistema permite enviar orçamento vazio (R$ 0,00)
- **Módulo**: Orçamento
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: É possível salvar, enviar e até aprovar um orçamento com 0 itens e valor R$ 0,00. Não há validação de itens mínimos.
- **Como reproduzir**: Criar orçamento → não adicionar itens → clicar Salvar → Enviar → funciona.
- **Impacto**: Orçamentos vazios vão para o cliente. Pedidos com R$ 0,00 entram no sistema.
- **Correção sugerida**: Adicionar validação: orçamento precisa de pelo menos 1 item com valor > 0 para ser salvo/enviado.

---

### FALHA #16 — Pedido gerado com 0 itens e R$ 0,00
- **Módulo**: Pedidos
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Ao aprovar orçamento vazio, o pedido gerado herda 0 itens e R$ 0,00. Não há validação na conversão orçamento→pedido.
- **Como reproduzir**: Aprovar orçamento vazio → pedido PED-2026-0002 criado com R$ 0,00.
- **Impacto**: Pedidos inválidos entram no fluxo de produção.
- **Correção sugerida**: Validar na conversão que o orçamento tem itens e valor > 0.

---

### FALHA #18 — Pedido aprovado não gera OP automaticamente
- **Módulo**: Produção
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Após aprovar um pedido, nenhuma Ordem de Produção (OP) é criada automaticamente. O gestor de produção precisa criar manualmente.
- **Como reproduzir**: Aprovar pedido → ir em Produção → nenhuma OP nova aparece.
- **Impacto**: Fluxo Pedido→Produção completamente manual. Pedidos podem ser esquecidos.
- **Correção sugerida**: Trigger ou service que ao aprovar pedido, cria OP automaticamente com itens do pedido vinculados.

---

### FALHA #27 — OP 100% concluída permanece na coluna "Fila" do Kanban
- **Módulo**: Produção
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Mesmo após concluir todas as 5 etapas de produção (Criação→Impressão→Acabamento→Conferência→Expedição), a OP permanece na coluna "Fila" do Kanban. Não move para "Liberado".
- **Como reproduzir**: Concluir todas as 5 etapas da OP → voltar ao Kanban → OP ainda em "Fila".
- **Impacto**: Gestor de produção não sabe o que está pronto para expedição. Dashboard mostra "0 liberadas".
- **Correção sugerida**: Trigger que ao concluir última etapa, atualiza `status_kanban` para "liberado" automaticamente.

---

### FALHA #28 — Produção concluída não gera registro de Instalação/Entrega
- **Módulo**: Produção → Instalação
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Após concluir produção de uma OP, nenhum registro de OS de instalação/entrega é criado. Não existe automação entre os módulos.
- **Como reproduzir**: Concluir OP → ir em Instalações → vazio.
- **Impacto**: Fluxo Produção→Instalação completamente quebrado.
- **Correção sugerida**: Service que ao concluir OP, cria OS de instalação vinculada ao pedido/cliente.

---

### FALHA #29 — Não existe botão para criar OS de instalação manualmente
- **Módulo**: Instalação
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: A página de Instalações no ERP é apenas monitoramento — não há botão "+ Nova OS" ou qualquer forma de criar uma ordem de serviço de instalação.
- **Como reproduzir**: Ir em Instalações → procurar botão de criar OS → não existe.
- **Impacto**: Impossível agendar instalação, mesmo manualmente.
- **Correção sugerida**: Adicionar botão "+ Nova OS" com formulário vinculado a pedido/OP + dados de endereço do cliente.

---

### FALHA #30 — ERP e App de Campo completamente desconectados
- **Módulo**: Integração ERP↔Campo
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Nenhuma OS criada no ERP aparece no App de Campo. Os dois sistemas compartilham o mesmo Supabase mas não compartilham dados de OS/instalação. Causa raiz: migration `004_integracao_bridge.sql` NÃO foi executada.
- **Como reproduzir**: Criar qualquer dado no ERP → abrir App de Campo → dados não aparecem.
- **Impacto**: Técnicos de campo não recebem trabalho do ERP. Dois sistemas operando independentemente.
- **Correção sugerida**: Executar migration 004 que cria views e triggers de sincronização entre os módulos.

---

### FALHA #32 — Nenhuma NF-e gerada automaticamente de pedido/produção
- **Módulo**: Fiscal
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Produção concluída e pedido finalizado não geram NF-e automaticamente. A tela "Fila de Emissão" permanece vazia.
- **Como reproduzir**: Concluir produção de OP → ir em Fiscal → Fila de Emissão → vazia.
- **Impacto**: Fluxo Produção→Faturamento inexistente.
- **Correção sugerida**: Service que ao finalizar pedido/produção, cria registro na fila de NF-e com dados fiscais do pedido.

---

### FALHA #33 — Não existe botão para criar NF-e manualmente a partir de pedido
- **Módulo**: Fiscal
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Na tela "Fila de Emissão" não há forma de adicionar manualmente um documento para emissão. Também não há link de pedidos para a tela fiscal.
- **Como reproduzir**: Ir em Fiscal → Fila de Emissão → procurar botão "+ Nova NF-e" → não existe.
- **Impacto**: Impossível emitir nota fiscal, mesmo manualmente.
- **Correção sugerida**: Adicionar botão "+ Nova NF-e" com seletor de pedido, ou adicionar ação "Gerar NF-e" na tela de detalhe do pedido.

---

### FALHA #34 — Pedido + produção concluída não geram conta a receber
- **Módulo**: Financeiro
- **Severidade**: 🔴 CRÍTICO
- **Descrição**: Ao concluir todo o fluxo (orçamento→pedido→produção), nenhuma conta a receber é criada automaticamente no módulo Financeiro. Tudo R$ 0,00, 0 títulos.
- **Como reproduzir**: Completar fluxo inteiro → ir em Financeiro → A Receber → vazio.
- **Impacto**: Financeiro completamente desconectado do fluxo de vendas. Contas precisam ser criadas manualmente.
- **Correção sugerida**: Trigger/service que ao aprovar pedido ou emitir NF-e, cria automaticamente contas a receber com valor e vencimento calculados.

---

## 🟠 FALHAS GRAVES (14) — FUNCIONALIDADE QUEBRADA OU INCOMPLETA

### FALHA #6 — Formulário de produto sem campos essenciais
- **Módulo**: Produtos / Catálogo
- **Severidade**: 🟠 GRAVE
- **Descrição**: O formulário de criação de produto tem apenas campos básicos (nome, SKU, dimensões). Não há campos para vincular materiais, definir versões, custos ou processos de produção.
- **Impacto**: Produtos ficam sem custo real. Motor de precificação não funciona.
- **Correção sugerida**: Expandir formulário com abas: Dados Básicos, Materiais (com link a `modelo_materiais`), Processos, Versões.

---

### FALHA #7 — Formulário de modelo sem seletor de produto pai
- **Módulo**: Produtos / Catálogo
- **Severidade**: 🟠 GRAVE
- **Descrição**: Ao criar um novo modelo de produto, não há campo para selecionar a qual produto ele pertence.
- **Impacto**: Modelos não ficam corretamente vinculados a seus produtos.

---

### FALHA #8 — Novo modelo auto-vincula ao produto errado
- **Módulo**: Produtos / Catálogo
- **Severidade**: 🟠 GRAVE
- **Descrição**: Ao criar modelo, ele é automaticamente associado ao último produto visualizado, não ao produto correto.
- **Impacto**: Dados inconsistentes no catálogo.

---

### FALHA #9 — Campo de material sem autocomplete/dropdown
- **Módulo**: Produtos / Catálogo
- **Severidade**: 🟠 GRAVE
- **Descrição**: Para vincular material a um modelo, o usuário precisa digitar o nome exato. Não há dropdown com os 467 materiais cadastrados.
- **Impacto**: Usuário não sabe quais materiais existem. Erros de digitação.

---

### FALHA #10 — Botão "+ Adicionar" material não funciona
- **Módulo**: Produtos / Catálogo
- **Severidade**: 🟠 GRAVE
- **Descrição**: Na tela de modelo, o botão para adicionar material não executa nenhuma ação ao ser clicado.
- **Impacto**: Impossível vincular materiais a modelos via UI. Tabela `modelo_materiais` tem 0 registros.

---

### FALHA #20 — UI não atualiza em tempo real nas etapas de produção
- **Módulo**: Produção
- **Severidade**: 🟠 GRAVE
- **Descrição**: Ao clicar "Iniciar" em uma etapa de produção, o PATCH no Supabase retorna 204 (sucesso), mas o modal não re-renderiza. O operador precisa fechar (Esc) e reabrir o modal para ver a mudança.
- **Como reproduzir**: Abrir OP → Clicar "Iniciar" em etapa → nada muda visualmente → fechar e reabrir → agora mostra "Concluir".
- **Impacto**: Operador pensa que o botão não funciona. UX muito ruim.
- **Correção sugerida**: Invalidar query do TanStack Query após PATCH bem-sucedido para forçar refetch.

---

### FALHA #22 — Status da OP não muda conforme etapas avançam
- **Módulo**: Produção
- **Severidade**: 🟠 GRAVE
- **Descrição**: O status geral da OP permanece "Aguardando programação" mesmo após iniciar e concluir etapas. Deveria mudar para "Em produção", "Em acabamento", etc.
- **Impacto**: Status não reflete realidade da produção.

---

### FALHA #23 — Custos da OP todos zerados
- **Módulo**: Produção
- **Severidade**: 🟠 GRAVE
- **Descrição**: Todos os campos de custo mostram R$ 0,00: MP Estimado, MP Real, MO Estimado, MO Real. Não calcula custo de material nem mão de obra.
- **Causa raiz**: Tabelas `modelo_materiais` e `modelo_processos` têm 0 registros.
- **Impacto**: Zero controle de custos de produção. Margem de lucro desconhecida.

---

### FALHA #24 — Tempo Real de produção mostra "---"
- **Módulo**: Produção
- **Severidade**: 🟠 GRAVE
- **Descrição**: Mesmo com 4+ etapas concluídas, o campo "Tempo Real" mostra "---". Não calcula soma dos tempos das etapas.
- **Impacto**: Sem métricas de produtividade.

---

### FALHA #25 — OP não avança no Kanban conforme etapas
- **Módulo**: Produção
- **Severidade**: 🟠 GRAVE
- **Descrição**: O status do Kanban (Fila→Em Produção→Acabamento→Conferência→Liberado) é independente das etapas de produção. OP com etapas avançadas fica estagnada na "Fila".
- **Impacto**: Kanban visual não reflete o progresso real.

---

### FALHA #26 — Botões de status permitem avançar e retroceder sem lógica
- **Módulo**: Produção
- **Severidade**: 🟠 GRAVE
- **Descrição**: Na tela de detalhe da OP, aparecem simultaneamente botões "→ Em produção" e "→ Aguardando programação", permitindo avançar e retroceder sem regra de negócio.
- **Impacto**: Status pode ser manipulado aleatoriamente.

---

### FALHA #35 — Conta a receber sem vínculo com pedido
- **Módulo**: Financeiro
- **Severidade**: 🟠 GRAVE
- **Descrição**: O formulário de "Nova Conta a Receber" não tem campo para selecionar Pedido. Contas ficam sem rastreabilidade ao pedido que as originou.
- **Impacto**: Impossível rastrear receita por pedido. Relatórios de rentabilidade impossíveis.

---

### FALHA #42 — Card "RECEBIDO" mostra R$ 0,00 com pagamento existente
- **Módulo**: Financeiro
- **Severidade**: 🟠 GRAVE
- **Descrição**: Após registrar pagamento parcial de R$ 500,00, o card "RECEBIDO" na tela de contas a receber continua mostrando R$ 0,00 / 0 títulos.
- **Como reproduzir**: Criar conta R$ 1.500 → registrar pagamento R$ 500 → card RECEBIDO = R$ 0,00.
- **Impacto**: Relatório financeiro incorreto. Gestor não sabe quanto já entrou.
- **Correção sugerida**: Query do card RECEBIDO precisa somar `valor_pago` de todas as contas (não apenas contas com status "pago").

---

### FALHA #43 — DRE mostra R$ 0,00 com pagamento registrado
- **Módulo**: Financeiro / DRE
- **Severidade**: 🟠 GRAVE
- **Descrição**: A aba DRE mostra Receita Bruta R$ 0,00 em todos os 6 meses, mesmo com R$ 500 de pagamento registrado. Nota: "Base: contas pagas (baixadas)" — o pagamento parcial tem status "Parcial", não "Pago", por isso não aparece.
- **Impacto**: DRE não reflete realidade financeira.
- **Correção sugerida**: DRE deveria considerar pagamentos parciais proporcionalmente, ou ter opção de base "regime de caixa" vs "regime de competência".

---

## 🟡 FALHAS MÉDIAS (9) — DIFICULTAM USO REAL

### FALHA #11 — Dropdown de clientes carrega apenas ~200 de 307 registros
- **Módulo**: Orçamento
- **Severidade**: 🟡 MÉDIO
- **Descrição**: No editor de orçamento, o dropdown de clientes carrega apenas cerca de 200 registros dos 307 existentes. Clientes recentes podem não aparecer.
- **Correção sugerida**: Implementar paginação no dropdown ou busca server-side.

---

### FALHA #12 — Dropdown de clientes sem campo de busca
- **Módulo**: Orçamento
- **Severidade**: 🟡 MÉDIO
- **Descrição**: O dropdown de clientes no editor de orçamento é uma lista gigante sem campo de busca/filtro. Com 307 clientes, é impraticável scrollar para encontrar o desejado.
- **Correção sugerida**: Usar componente Combobox (searchable select) em vez de Select simples.

---

### FALHA #15 — Aprovação de orçamento sem diálogo de confirmação
- **Módulo**: Orçamento
- **Severidade**: 🟡 MÉDIO
- **Descrição**: Ao clicar "Aprovar" em um orçamento, a ação é executada imediatamente sem diálogo "Tem certeza?". Ação irreversível sem confirmação.
- **Correção sugerida**: Adicionar modal de confirmação com resumo do orçamento antes de aprovar.

---

### FALHA #17 — Pedido sem ações de fluxo
- **Módulo**: Pedidos
- **Severidade**: 🟡 MÉDIO
- **Descrição**: Na tela de detalhe do pedido não há botões de ação (aprovar, cancelar, enviar para produção). O pedido fica parado sem próximo passo claro.
- **Correção sugerida**: Adicionar toolbar de ações baseada no status atual do pedido.

---

### FALHA #19 — Pedido de teste não aparece no dropdown de criação de OP
- **Módulo**: Produção
- **Severidade**: 🟡 MÉDIO
- **Descrição**: PED-2026-0002 (nosso pedido de teste) não apareceu no dropdown ao tentar criar OP manualmente. Possivelmente filtro de pedidos com itens > 0.
- **Impacto**: Pedidos sem itens ficam órfãos no sistema.

---

### FALHA #31 — Dashboard mostra "Produção 0" com OP existente
- **Módulo**: Dashboard
- **Severidade**: 🟡 MÉDIO
- **Descrição**: Card de Produção no dashboard mostra "0 na fila · 0 liberadas" mesmo com OP-2026-0012 existente e 100% concluída.
- **Correção sugerida**: Verificar query do dashboard — pode estar filtrando por status_kanban que não é atualizado (FALHA #27).

---

### FALHA #36 — Forma de Pagamento é texto livre
- **Módulo**: Financeiro
- **Severidade**: 🟡 MÉDIO
- **Descrição**: No formulário de conta a receber, "Forma de Pagamento" é um input de texto livre com placeholder "Ex: Boleto, PIX, Transferencia...". Deveria ser dropdown com opções padronizadas.
- **Impacto**: Sem padronização, relatórios por forma de pagamento são impossíveis.

---

### FALHA #37 — Dropdown de clientes no Financeiro sem busca
- **Módulo**: Financeiro
- **Severidade**: 🟡 MÉDIO
- **Descrição**: Mesmo problema da FALHA #12, repetido na tela de Financeiro. Dropdown de 307 clientes sem campo de busca.
- **Nota**: Este é um problema sistêmico — todos os dropdowns de clientes no sistema usam Select simples.

---

### FALHA #38 — Data de vencimento salva com 1 dia a menos (timezone)
- **Módulo**: Financeiro
- **Severidade**: 🟡 MÉDIO
- **Descrição**: Ao informar vencimento 15/04/2026, o sistema salva como 14/04/2026. Provável bug de conversão de timezone (UTC-3 → UTC sem ajuste).
- **Como reproduzir**: Criar conta com vencimento 15/04 → tabela mostra 14/04.
- **Correção sugerida**: Usar tipo `date` (sem timezone) no Postgres em vez de `timestamp with time zone`, ou ajustar conversão no frontend.

---

## 🔵 FALHAS BAIXAS (7) — COSMÉTICAS / ACENTUAÇÃO

### FALHA #21 — Etapas de produção sem acentos
- **Módulo**: Produção
- **Descrição**: Nomes das etapas aparecem como "Criacao", "Impressao", "Acabamento", "Conferencia", "Expedicao" — faltam acentos ("Criação", "Impressão", "Conferência", "Expedição").
- **Causa**: Dados seedados no banco sem acentuação.
- **Correção**: UPDATE na tabela de etapas ou ajuste no seed.

---

### FALHA #39 — Título da conta a receber vazio
- **Módulo**: Financeiro
- **Descrição**: Ao criar conta a receber, o campo TÍTULO fica como "–" (vazio). Deveria gerar numeração automática (ex: CR-2026-0001).
- **Correção**: Implementar sequence ou trigger para gerar número automático.

---

### FALHA #40 — "Ja Pago" sem acento
- **Módulo**: Financeiro
- **Descrição**: No modal de registro de pagamento, o label "Ja Pago" deveria ser "Já Pago".

---

### FALHA #41 — Modal de pagamento sem campo de data e comprovante
- **Módulo**: Financeiro
- **Descrição**: O modal "Registrar Pagamento" não tem campo de data do pagamento (assume data atual) nem campo para número de comprovante/referência bancária.
- **Impacto**: Não é possível registrar pagamento retroativo ou rastrear comprovante.

---

### FALHA #44 — Acentuação errada na aba DRE
- **Módulo**: Financeiro / DRE
- **Descrição**: "Ultimos 6 Meses" (→ "Últimos"), "RESULTADO LIQUIDO" (→ "LÍQUIDO"), "Marco 2026" (→ "Março").

---

### FALHA #45 — Não existe geração de boleto
- **Módulo**: Financeiro
- **Descrição**: O sistema permite registrar forma de pagamento "Boleto" como texto, mas não gera boleto bancário real. Apenas registra contas e pagamentos manualmente.
- **Nota**: Geração de boleto requer integração bancária (API do banco). Pode ser roadmap futuro, mas vendedor precisa pelo menos de um PDF com dados para pagamento.

---

### FALHA #46 — Acentuação incorreta no Dashboard
- **Módulo**: Dashboard
- **Descrição**: Atividade recente mostra "aguardando aprovacao" (→ "aprovação") e "concluido" (→ "concluído").
- **Causa**: Status armazenado no banco sem acentos.

---

## 🚫 MAPA DE FLUXOS QUEBRADOS

O fluxo principal do negócio:

```
Lead → Orçamento → Pedido → Produção → Instalação → Faturamento
```

### Status de cada transição:

```
Lead ──────────── ✅ cria (funciona)
  │
  ├──→ Converter em Cliente ── ❌ FALHA #3 (não existe botão)
  │
  └──→ Cliente (cadastro direto) ── ❌ FALHA #4 (crash por coluna website)

Cliente ──────── ✅ listagem funciona

Orçamento ─────── ⚠️ cria (mas sem itens)
  │
  ├──→ Adicionar Item ── ❌ FALHA #13 (tela branca, crash Radix)
  │
  ├──→ Enviar ── ⚠️ permite enviar vazio (FALHA #14)
  │
  └──→ Aprovar ── ⚠️ sem confirmação (FALHA #15), gera pedido R$ 0,00

Pedido ───────── ⚠️ criado mas sem itens/valor
  │
  └──→ Gerar OP ── ❌ FALHA #18 (não gera automaticamente)

Produção ──────── ⚠️ funciona manualmente (com bugs de UI)
  │
  ├──→ Etapas ── ⚠️ PATCH funciona mas UI não atualiza (FALHA #20)
  │
  ├──→ Kanban ── ❌ FALHA #25/#27 (não avança automaticamente)
  │
  └──→ Gerar Instalação ── ❌ FALHA #28 (fluxo inexistente)

Instalação ────── ❌ FALHA #29 (sem criação de OS)
  │
  └──→ App de Campo ── ❌ FALHA #30 (desconectado, migration 004 não executada)

Fiscal ────────── ❌ FALHA #32/#33 (sem geração de NF-e)

Financeiro ────── ⚠️ manual (FALHA #34 — não gera contas automaticamente)
  │
  ├──→ Contas a Receber ── ✅ CRUD funciona (manual)
  │
  ├──→ Pagamento Parcial ── ✅ funciona
  │
  └──→ DRE ── ❌ FALHA #43 (não reflete dados reais)
```

**Resultado: 6 de 8 transições quebradas.**

---

## ✅ O QUE FUNCIONA

| # | Funcionalidade | Status |
|---|---|---|
| 1 | Dashboard principal com cards de métricas | ✅ Visual bonito, dados parcialmente corretos |
| 2 | Listagem de clientes (307 registros) | ✅ Funcional |
| 3 | Listagem de leads | ✅ Funcional |
| 4 | Pipeline Kanban de leads | ✅ Visual funcional |
| 5 | Criação de lead | ✅ Funcional |
| 6 | Criação de orçamento (estrutura) | ✅ Salva, mas sem itens |
| 7 | Fluxo de status do orçamento (rascunho→enviado→aprovado) | ✅ Muda status corretamente |
| 8 | Conversão orçamento → pedido | ✅ Gera pedido (herda dados do orçamento) |
| 9 | CRUD etapas de produção (backend) | ✅ PATCH retorna 204 |
| 10 | Conta a receber — criar e registrar pagamento parcial | ✅ Funcional |
| 11 | Conta a receber — filtros (Todos, A vencer, Vencido, Parcial, Pago) | ✅ Funcional |
| 12 | Conta a pagar — estrutura simétrica | ✅ Funcional (sem dados) |
| 13 | App de Campo — login com Supabase Auth | ✅ Funcional |
| 14 | App de Campo — lista de jobs com infinite scroll | ✅ Funcional |
| 15 | App de Campo — upload de fotos com compressão | ✅ Funcional |
| 16 | App de Campo — captura de assinatura digital | ✅ Funcional |
| 17 | Módulo fiscal — telas de NF-e bem estruturadas | ✅ UI completa (sem dados) |
| 18 | Módulo fiscal — validação Zod dos campos fiscais | ✅ Implementado |
| 19 | UI/Design geral — shadcn/ui + Tailwind bem aplicados | ✅ Profissional |
| 20 | Responsividade do ERP (desktop) | ✅ Funcional |

---

## 📊 RESUMO POR MÓDULO

| Módulo | 🔴 | 🟠 | 🟡 | 🔵 | Total | % do Total |
|---|---|---|---|---|---|---|
| Autenticação | 1 | 0 | 0 | 0 | **1** | 2% |
| Comercial (Leads/Clientes) | 4 | 0 | 0 | 0 | **4** | 9% |
| Produtos/Catálogo | 0 | 5 | 0 | 0 | **5** | 11% |
| Orçamento/Precificação | 3 | 0 | 3 | 0 | **6** | 13% |
| Pedidos | 0 | 0 | 2 | 0 | **2** | 4% |
| Produção | 3 | 6 | 1 | 1 | **11** | 24% |
| Instalação/Campo | 2 | 0 | 0 | 0 | **2** | 4% |
| Fiscal | 2 | 0 | 0 | 0 | **2** | 4% |
| Financeiro | 1 | 3 | 3 | 3 | **10** | 22% |
| Dashboard | 0 | 0 | 1 | 1 | **2** | 4% |
| Geral (i18n) | 0 | 0 | 0 | 2 | **2** | 4% |
| **TOTAL** | **16** | **14** | **9** | **7** | **46** | 100% |

---

## 🎯 VEREDICTO FINAL

### ❌ O SISTEMA NÃO ESTÁ PRONTO PARA USO EM PRODUÇÃO

**Motivos principais**:

1. **Segurança**: Sem autenticação — qualquer pessoa acessa todos os dados
2. **Fluxo principal quebrado**: Vendedor não consegue criar orçamento com itens (crash)
3. **Módulos desconectados**: Cada etapa é uma ilha — dados não fluem automaticamente
4. **Dados críticos ausentes**: `modelo_materiais` e `modelo_processos` com 0 registros — pricing engine retorna R$ 0,00
5. **Crash no cadastro de cliente**: Campo `website` inexistente no banco

### Avaliação de Maturidade por Módulo

| Módulo | Maturidade | Nota |
|---|---|---|
| Dashboard | 70% | Visual bom, dados parcialmente incorretos |
| Leads | 40% | CRUD básico funciona, sem detalhe e conversão |
| Clientes | 30% | Listagem funciona, cadastro crasha |
| Produtos | 20% | Listagem funciona, CRUD de materiais/modelos quebrado |
| Orçamentos | 25% | Estrutura existe, editor de itens crasha |
| Pedidos | 35% | Criação via orçamento funciona, sem ações de fluxo |
| Produção | 40% | Etapas funcionam no backend, UI e automações quebradas |
| Instalação | 5% | Tela existe mas sem funcionalidade |
| Fiscal | 30% | Telas completas, sem integração com fluxo |
| Financeiro | 50% | CRUD de contas funciona, sem automação |
| App de Campo | 65% | Funcional isoladamente, desconectado do ERP |

---

## 🏗️ PLANO DE CORREÇÃO PRIORIZADO

### SPRINT 1 — Bloqueadores (1-2 semanas)
**Objetivo**: Tornar o fluxo básico funcional para demonstração.

| Prioridade | Tarefa | Falhas Resolvidas | Estimativa |
|---|---|---|---|
| P0 | Habilitar auth (trocar DemoRoute por ProtectedRoute) | #1 | 2h |
| P0 | Corrigir crash cadastro cliente (coluna `website`) | #4, #5 | 1h |
| P0 | Corrigir Select.Item vazio no editor de orçamento | #13 | 2h |
| P0 | Validação: orçamento precisa de itens para ser enviado | #14, #16 | 1h |
| P0 | Seedar `modelo_materiais` e `modelo_processos` | #23 | 4h |
| P1 | Implementar Lead → Cliente conversão | #2, #3 | 4h |

### SPRINT 2 — Conexões entre Módulos (2-3 semanas)
**Objetivo**: Fazer dados fluírem automaticamente entre módulos.

| Prioridade | Tarefa | Falhas Resolvidas | Estimativa |
|---|---|---|---|
| P0 | Pedido aprovado → gerar OP automaticamente | #18 | 4h |
| P0 | OP concluída → atualizar Kanban automaticamente | #25, #27 | 3h |
| P0 | Produção concluída → gerar registro de instalação | #28, #29 | 6h |
| P0 | Executar migration 004 (bridge ERP↔Campo) | #30 | 2h |
| P1 | Implementar geração de NF-e a partir de pedido | #32, #33 | 8h |
| P1 | Pedido/NF-e → gerar contas a receber automaticamente | #34 | 4h |

### SPRINT 3 — Polish e UX (1-2 semanas)
**Objetivo**: Tornar o sistema agradável para vendedores.

| Prioridade | Tarefa | Falhas Resolvidas | Estimativa |
|---|---|---|---|
| P1 | Invalidar queries após mutations (produção/financeiro) | #20, #22 | 3h |
| P1 | Searchable Combobox em todos os dropdowns de clientes | #11, #12, #37 | 4h |
| P1 | Corrigir bug timezone nas datas | #38 | 2h |
| P1 | Card RECEBIDO somando pagamentos parciais | #42 | 1h |
| P1 | DRE conectado às contas a receber/pagar | #43 | 3h |
| P2 | Corrigir todos os acentos (i18n audit) | #21, #40, #44, #46 | 2h |
| P2 | Diálogo de confirmação na aprovação | #15 | 1h |
| P2 | Forma de Pagamento como dropdown | #36 | 1h |
| P2 | Numeração automática de contas | #39 | 1h |
| P2 | Campo de data e comprovante no pagamento | #41 | 1h |
| P2 | Botões de status com lógica sequencial | #26 | 2h |
| P2 | Tempo real e custos na OP | #24 | 3h |
| P2 | Vinculação conta→pedido | #35 | 2h |
| P3 | Ações de fluxo no pedido (aprovar, cancelar) | #17 | 3h |
| P3 | Filtro de pedidos com itens no dropdown de OP | #19 | 1h |
| P3 | Dashboard produção refletindo dados reais | #31 | 2h |
| P3 | Formulário completo de produtos (materiais, versões) | #6, #7, #8, #9, #10 | 8h |
| P3 | Geração de boleto/PIX (PDF ou integração bancária) | #45 | 16h+ |

---

## 📋 DADOS DE TESTE CRIADOS

Durante o teste, os seguintes registros foram criados no banco de produção:

| Tipo | Identificador | Detalhes |
|---|---|---|
| Lead | "SuperMercado Teste Ltda" | Email: contato@supermercadoteste.com.br |
| Cliente | "CALCADOS SERGIO" | Criado via SQL (UI crashava) |
| Orçamento | PROP-2026-013 | Cliente: CALCADOS SERGIO, R$ 0,00, 0 itens |
| Pedido | PED-2026-0002 | Gerado da PROP-2026-013, R$ 0,00, 0 itens |
| Conta a Receber | (sem título) | Cliente: CARIBE, R$ 1.500, Parcial (R$ 500 pago) |

> ⚠️ **Recomendação**: Limpar esses dados de teste do banco de produção antes de liberar para vendedores.

---

## NOTAS TÉCNICAS PARA O DESENVOLVEDOR

### Causa raiz dos problemas de precificação (R$ 0,00)
A tabela `modelo_materiais` tem **0 registros**. O motor de precificação (Mubisys) precisa de:
1. `modelo_materiais` → custo de material por modelo
2. `modelo_processos` → custo de processo por modelo
3. `produto_modelos.markup` → markup sobre custo (já seedado, 156 registros)

Sem (1) e (2), qualquer cálculo retorna R$ 0,00.

### Causa raiz do App de Campo desconectado
A migration `004_integracao_bridge.sql` que cria views e triggers de sincronização **NÃO foi executada**. O ERP escreve em `ordens_servico` e o Campo lê de `campo_jobs` — sem a bridge, são tabelas independentes.

### Bug de multiplicação dupla (mencionado na auditoria anterior)
No pricing service: `precoTotal = precoVenda * quantidade` — mas `precoVenda` já inclui `quantidade` na sua fórmula. Isso causaria preços inflados quando o motor funcionar com dados reais.

### Stack técnica verificada
- React 19 + TypeScript + Vite ✅
- Tailwind CSS + shadcn/ui + Radix UI ✅
- TanStack Query v5 ✅ (mas falta invalidação de queries em vários pontos)
- Supabase (Postgres + Auth + Storage) ✅
- Sonner toasts ✅ (feedback visual funciona)
- Zod validation ✅ (módulo fiscal)

---

*Relatório gerado em 12/03/2026 por teste automatizado end-to-end.*
*Para dúvidas sobre reprodução de falhas específicas, consultar o log completo da sessão de teste.*

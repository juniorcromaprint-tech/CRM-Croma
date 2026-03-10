# Checklist Go-Live — CRM Croma Print

> Atualizado em: 2026-03-10 | Versão do sistema: 3.0

Este checklist deve ser executado completamente antes de colocar o sistema em uso com dados e usuários reais de produção.

---

## Como usar este checklist

1. Execute cada item na ordem apresentada
2. Marque como concluído somente quando verificado — não marque preventivamente
3. Itens marcados como CRÍTICO bloqueiam o go-live se não estiverem OK
4. Para cada item com problema, consulte `docs/MANUAL_IMPLANTACAO.md` (seção Troubleshooting)

---

## Categoria 1 — Infraestrutura

- [ ] **CRÍTICO** — Migrations 001, 002, 003, 003_fiscal executadas no Supabase

  Verificar:
  ```sql
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
  ```
  Deve retornar pelo menos 60 tabelas.

- [ ] **CRÍTICO** — Migration 005 (storage security) executada

  Verificar: Acesse Supabase > Storage > Policies e confirme que o bucket `job_photos` tem RLS habilitado.

- [ ] **CRÍTICO** — Migration 006 (módulo de orçamento) executada e schema verificado

  Verificar:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('acabamentos','servicos','regras_precificacao',
                     'proposta_item_materiais','proposta_item_acabamentos',
                     'proposta_servicos','templates_orcamento');
  ```
  Deve retornar 7 linhas. Se retornar menos, a migration 006 não foi executada ou teve erro.

- [ ] `modelo_materiais` com mais de 0 registros

  ```sql
  SELECT COUNT(*) FROM modelo_materiais;
  -- Deve ser > 0
  ```
  Se for 0, o módulo de orçamentos gera preço R$ 0,00 para todos os itens. Cadastrar via interface ou seed SQL.

- [ ] `regras_precificacao` com ao menos 1 registro por categoria principal

  ```sql
  SELECT COUNT(*) FROM regras_precificacao;
  -- Deve ser > 0 após migration 006 + seed
  ```

- [ ] `config_precificacao` configurado com custo operacional real da empresa

  Verificar via `/admin/precificacao`. Os valores padrão (custo operacional: R$ 36.800, etc.) são da Mubisys e precisam ser ajustados para a realidade atual da Croma Print.

- [ ] AdminSetupPage mostra 7/7 itens configurados

  Acesse `/admin/setup` e confirme que todos os 7 itens de configuração obrigatória estão com status verde.

---

## Categoria 2 — Dados de Produção

- [ ] **CRÍTICO** — Produtos e modelos reais cadastrados (não apenas seeds de demonstração)

  Os 156 modelos do seed são exemplos. Verifique se os modelos reais da Croma Print estão cadastrados com nomes, categorias e especificações corretas.

  Verificar em `/admin/produtos` — aba "Modelos".

- [ ] **CRÍTICO** — Materiais com preços atualizados e sem "Sem Preço"

  A migration 008 atualiza 464 materiais com preços Mubisys. Verifique se todos os materiais usados nos modelos têm preço:

  ```sql
  SELECT COUNT(*) FROM materiais WHERE preco_medio IS NULL OR preco_medio = 0;
  -- Deve ser 0 (ou número aceitavelmente baixo de materiais fora de uso)
  ```

  Interface: `/admin/produtos` > aba "Sem Preço" — deve estar vazia.

- [ ] Modelos vinculados a materiais reais

  ```sql
  SELECT
    COUNT(DISTINCT modelo_id) AS modelos_com_materiais
  FROM modelo_materiais;
  ```

  Deve ser igual ou próximo ao número total de modelos ativos. Se um modelo não tiver materiais vinculados, qualquer orçamento com esse modelo retornará preço R$ 0,00.

  Interface: `/admin/produtos` > aba "Modelos" > abrir cada modelo > verificar lista de materiais.

- [ ] Clientes reais cadastrados (307 registros de teste devem ser substituídos ou complementados)

  Os 307 clientes do seed são dados de demonstração (Beira Rio, Renner, etc.). Antes do go-live:
  - Confirmar se os clientes reais da Croma Print foram importados
  - Ou manter os dados de demo como base e adicionar clientes reais gradualmente

- [ ] Acabamentos cadastrados com preços

  ```sql
  SELECT COUNT(*) FROM acabamentos;
  -- Deve ser > 0 após migration 006 + seed de acabamentos
  ```

  Acabamentos comuns a cadastrar: ilhós, velcro, laminação fosca, laminação brilho, moldura, reforço de borda.

---

## Categoria 3 — Segurança

- [ ] **CRÍTICO** — Autenticação habilitada (DemoRoute substituído por ProtectedRoute)

  Status atual: O ERP usa `DemoRoute` que não exige login — qualquer pessoa com a URL acessa dados de 307 clientes, propostas e informações financeiras.

  Verificar em `src/App.tsx`: todas as rotas protegidas devem usar `<ProtectedRoute>` em vez de `<DemoRoute>`.

  > Este item é obrigatório antes de qualquer acesso com dados reais de clientes.

- [ ] Usuários reais criados no Supabase Auth com roles corretos

  1. Acesse Supabase > Authentication > Users
  2. Crie contas para cada membro da equipe
  3. No sistema, acesse Admin > Usuários e atribua o role correto a cada usuário
  4. Roles disponíveis: admin, diretor, comercial, comercial_senior, financeiro, producao, compras, logistica, instalador

- [ ] RLS habilitado e testado nas tabelas principais

  ```sql
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('clientes','pedidos','propostas','perfis','contas_receber','contas_pagar')
  ORDER BY tablename;
  ```

  Coluna `rowsecurity` deve ser `true` para todas.

  Teste funcional: faça login como um usuário com role `comercial` e confirme que ele NÃO consegue acessar páginas de Admin ou Financeiro.

- [ ] Chaves de API não expostas em código público

  O arquivo `src/integrations/supabase/client.ts` contém a `anonKey`. Esta chave é pública por design (anon key do Supabase é segura de expor no front-end), mas confirme que a **service_role key** nunca está no código front-end.

  ```bash
  # No terminal, na raiz do projeto
  grep -r "service_role" src/
  # Não deve retornar nenhum resultado
  ```

---

## Categoria 4 — Funcionalidades

- [ ] **CRÍTICO** — Criar orçamento completo e verificar preço maior que R$ 0,00

  Fluxo de teste:
  1. Acesse `/orcamentos` > "Novo Orçamento"
  2. Selecione um cliente
  3. Adicione um item: selecione produto, modelo, quantidade
  4. No Passo 2, confirme que materiais aparecem pré-preenchidos
  5. No Passo 3, confirme que o preço é maior que R$ 0,00
  6. Salve e verifique o total do orçamento

  Se o preço for R$ 0,00, consulte `docs/PRICING_AUDIT.md` seção "Verificação Rápida".

- [ ] Converter orçamento aprovado em pedido

  Teste:
  1. Abra um orçamento salvo
  2. Mude o status para "Aprovado"
  3. Clique em "Converter em Pedido"
  4. Confirme que o pedido aparece em **Pedidos** com status correto

- [ ] App de Campo — técnicos conseguem fazer login e ver jobs

  1. Acesse `campo-croma.vercel.app`
  2. Faça login com credenciais de um técnico (role: instalador)
  3. Confirme que a lista de jobs aparece
  4. Abra um job e teste: adicionar foto, registrar observação

  Se não houver jobs, crie um pedido no ERP com status "Em instalação" e verifique se aparece no App de Campo.

- [ ] PDF de orçamento gera corretamente

  1. Abra um orçamento com itens e preços
  2. Clique em "Visualizar Proposta" (ou acesse `/orcamentos/:id`)
  3. Pressione `Ctrl+P` ou clique no botão "Imprimir"
  4. Confirme que o layout está correto (logo, dados do cliente, tabela de itens, total)

- [ ] Duplicar orçamento funciona

  1. Na lista de orçamentos, clique nos três pontos (...) de um orçamento
  2. Selecione "Duplicar"
  3. Confirme que um novo orçamento é criado com status "Rascunho"
  4. Confirme que todos os itens foram copiados

- [ ] Dashboard carrega com dados reais

  1. Acesse o sistema como usuário com role `diretor`
  2. Confirme que os KPIs mostram dados (não zeros ou esqueleto de loading infinito)
  3. Repita para roles: `comercial`, `financeiro`, `producao`

---

## Assinaturas de Aprovação

| Responsável | Área | Data de verificação | Assinado |
|---|---|---|---|
| | Infraestrutura / TI | | [ ] |
| | Comercial / Vendas | | [ ] |
| | Financeiro | | [ ] |
| | Operações / Produção | | [ ] |
| | Diretoria | | [ ] |

---

## Notas de Go-Live

_Use este espaço para registrar observações, exceções aprovadas ou itens postergados com justificativa:_

```
Data: ___________
Responsável: ___________
Observações:


```

---

## Status Consolidado (preencher ao final)

| Categoria | Total de itens | Aprovados | Pendentes | Go-live liberado? |
|---|---|---|---|---|
| Infraestrutura | 7 | | | |
| Dados de Produção | 5 | | | |
| Segurança | 4 | | | |
| Funcionalidades | 6 | | | |
| **TOTAL** | **22** | | | |

**Regra**: Go-live liberado somente com todos os itens CRÍTICOS aprovados e 100% dos itens de Segurança aprovados. Itens não-críticos podem ser postergados com justificativa registrada acima.

# Prompt CLI — Commit + Deploy + Últimos ajustes
> Data: 2026-04-01 | Autor: Cowork (Claude Opus)
> Colar no Claude Code após restart

---

## Contexto

E2E Fase 2 concluída. 9/10 bugs corrigidos + 1 novo (BUG-FIN-01b) encontrado e corrigido.
Preço do material e077e20d revertido para R$10,00.

**BUG-E2E-06 (CR automática)**: NÃO é bug. Decisão do Junior: CR deve ser gerada apenas quando o pedido é aprovado manualmente (não no INSERT automático da proposta). O trigger `trg_pedido_aprovado_conta_receber` em AFTER UPDATE está correto. Marcar como PASS — comportamento esperado.

Há muitos arquivos não commitados (todo o trabalho do dia). Precisa de commit + push + verificar deploy Vercel.

---

## Tarefas (executar em ordem)

### 1. Inserir regras de precificação faltantes (fachada + letreiro)

Executar via `croma_executar_sql` (é INSERT de dados, não tem ferramenta MCP específica):

```sql
INSERT INTO regras_precificacao (categoria, markup_minimo, markup_padrao, markup_maximo, margem_minima, desconto_maximo, prazo_padrao_dias, observacoes)
VALUES
  ('fachada', 2.5, 3.0, 4.0, 0.35, 0.10, 30, 'Fachadas em ACM — markup alto por complexidade de instalação e material'),
  ('letreiro', 2.2, 2.8, 3.5, 0.30, 0.10, 21, 'Letreiros e letras caixa — inclui estrutura metálica e iluminação')
ON CONFLICT (categoria) DO NOTHING;
```

Verificar com `croma_listar_regras_precificacao` que agora retorna 11/11.

### 2. Limpeza de dados de teste E2E

Remover os dados criados durante os testes (são dados fictícios que não devem ir pra produção).
Executar via `croma_executar_sql`:

```sql
-- Remover CR de teste
DELETE FROM contas_receber WHERE id = '2e3fce99-349d-4759-b41f-1a039bf548eb';

-- Remover CP de teste
DELETE FROM contas_pagar WHERE id = 'c1ab0c03-9ded-4ed7-b90a-0893e786342f';

-- Remover movimento estoque de teste
DELETE FROM estoque_movimentacoes WHERE id = '611f5184-c29f-4b2b-be6a-4fc6b222ac9c';

-- Remover saldo estoque do teste (Lona Flatbanner que recebeu +10)
DELETE FROM estoque_saldos WHERE material_id = 'e077e20d-5f44-4d06-b302-48ccce3e42a2' AND quantidade_disponivel = 10;

-- Remover pedido de teste
DELETE FROM pedidos WHERE id = '38793718-b0ed-4183-88df-b6012ef85d56';

-- Remover propostas de teste
DELETE FROM propostas WHERE id IN (
  '4370c9bf-b8c7-45bd-916e-88edc8081b74',
  '541f6d95-7213-4579-9df4-ae5e7641d428'
);

-- Remover OPs de teste
DELETE FROM ordens_producao WHERE id = '186f45ff-e1a9-4cae-991b-6ce1e954cadb';
```

**NOTA**: Executar cada DELETE separadamente. Se algum falhar por FK, ajustar a ordem (deletar dependentes primeiro).

### 3. Rebuild do MCP Server

```bash
cd mcp-server && npm run build
```

Verificar que compila sem erros (o fix do BUG-FIN-01b em financeiro.ts:387 precisa estar no build).

### 4. Commit tudo

Há muitos arquivos não commitados. Fazer UM commit consolidado:

```bash
git add -A
git status
```

Verificar que NÃO inclui arquivos sensíveis (.env, credentials, etc).

Mensagem do commit:
```
fix(e2e): corrigir 10 bugs E2E Fase 2 + expandir MCP Server para 48 ferramentas

- BUG-FIN-01: z.coerce.number() em 5 ferramentas financeiras
- BUG-FIN-03: trigger fn_payment_received usa NEW.valor_pago
- BUG-FIN-04: status "a_pagar" em criar_conta_pagar
- BUG-FIN-01b: status "a_vencer" em criar_conta_receber
- BUG-E2E-05: trigger fn_producao_estoque usa quantidade_por_unidade
- BUG-E2E-06: trigger CR em AFTER UPDATE (comportamento correto)
- BUG-E2E-07: getAdminClient + fix coluna contato_nome em enviar_proposta
- BUG-C4-01: FK hint em listar_nfe
- BUG-PRODUTO-01: remover preco_fixo do SELECT
- BUG-ESTOQUE-01: trigger trg_atualiza_saldo_estoque
- BUG-PROD-01: schema criar_ordem_producao alinhado com banco
- 5 ferramentas App Campo (listar_jobs, detalhe_job, listar_fotos, criar_job, atualizar_job)
- Ponte Cowork→MCP (croma.cmd + call-tool.cjs)
- Regras precificação: fachada + letreiro (11/11)
- Limpeza dados de teste E2E
- Relatórios QA E2E Fase 2

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 5. Push para main

```bash
git push origin main
```

### 6. Verificar deploy Vercel

Após o push, verificar:
- `crm-croma.vercel.app` — deploy automático deve iniciar
- Aguardar build concluir
- Testar acesso ao frontend

Se o deploy falhar, verificar logs da Vercel e corrigir.

### 7. Atualizar STATE.md

Atualizar `.planning/STATE.md`:
- Status: `E2E Fase 2 CONCLUÍDA — 10/10 bugs corrigidos + deploy em produção`
- Last activity: `2026-04-01 — E2E completo, 48 ferramentas MCP, commit + deploy produção`
- Mover bugs de Pending Todos para decisões/histórico
- Adicionar decisão: "BUG-E2E-06 — CR gera apenas na aprovação manual do pedido (não no INSERT automático)"

---

## Resultado esperado

Após executar tudo:
- ✅ 11/11 regras de precificação
- ✅ Dados de teste limpos do banco
- ✅ MCP Server rebuild com BUG-FIN-01b fix
- ✅ Commit consolidado com todas as correções do dia
- ✅ Push para main
- ✅ Deploy Vercel em produção
- ✅ STATE.md atualizado

# Plano de Correção — E2E MCP Server (2026-04-01)

> **Para**: Claude CLI (Claude Code)
> **Contexto**: Resultado do teste E2E via MCP Server Croma — 8/12 PASS, 4 GAP
> **Prioridade**: Desbloquear o fluxo completo Lead→Faturamento via MCP

---

## Diagnóstico

O teste E2E revelou que o fluxo **Lead → Proposta → Pedido** funciona perfeitamente, mas o trecho **Pedido → Produção → Financeiro** está travado por 3 problemas distintos:

1. **`croma_atualizar_status_pedido` existe no código mas não funcionou no teste** — o pedido ficou preso em `aguardando_aprovacao`. Possível causa: a ferramenta existia no código (`pedidos.ts` linha 405-509) mas o MCP Server pode não ter sido recompilado/redeployado após adição, ou o teste não tentou usá-la.
2. **Não existe `croma_criar_ordem_producao`** — o trigger `trg_pedido_aprovado_cria_op` (migration 099) cria OPs automaticamente quando pedido muda para `aprovado`, mas sem a ferramenta de status do pedido, esse trigger nunca dispara.
3. **Conta a receber não gerada** — existem DOIS triggers no banco: `trg_pedido_gera_conta_receber` (migration 040, dispara ao aprovar pedido) e `trg_instalacao_concluida_financeiro` (migration 099, dispara ao concluir instalação). Ambos dependem de transições de status que não puderam ser executadas.

**Conclusão**: O bloqueio principal é a cadeia de automação. Se o pedido puder ser aprovado via MCP, os triggers do banco cuidam do resto (criar OPs, criar conta a receber).

---

## Tarefas (ordenadas por dependência)

### TASK-1: Verificar e rebuildar o MCP Server (CRÍTICO)

**Arquivo**: `mcp-server/`

O `croma_atualizar_status_pedido` JÁ EXISTE em `mcp-server/src/tools/pedidos.ts` (linhas 403-509), com mapa de transições completo e validação. Mas o E2E reportou como GAP.

**Ações:**
1. Rodar `cd mcp-server && npm run build` para recompilar o TypeScript
2. Verificar se `dist/tools/pedidos.js` contém a função `croma_atualizar_status_pedido`
3. Se não contiver: investigar erro de compilação
4. Se contiver: o problema foi que o teste E2E não usou essa ferramenta (falso GAP)

**Validação**: Executar `grep -c "croma_atualizar_status_pedido" mcp-server/dist/tools/pedidos.js` — deve retornar >= 1.

---

### TASK-2: Adicionar `croma_criar_ordem_producao` ao MCP Server (ALTA)

**Arquivo**: `mcp-server/src/tools/pedidos.ts`

Embora o trigger `trg_pedido_aprovado_cria_op` crie OPs automaticamente ao aprovar o pedido, é útil ter uma ferramenta para criação manual (casos onde o trigger falha, ou OPs avulsas para retrabalho).

**Implementação**: Adicionar nova ferramenta no `registerPedidosTools()`, seguindo o padrão existente.

```typescript
server.registerTool(
  "croma_criar_ordem_producao",
  {
    title: "Criar Ordem de Produção",
    description: `Cria uma OP manualmente vinculada a um pedido.

NOTA: Ao aprovar um pedido via croma_atualizar_status_pedido, OPs são criadas
AUTOMATICAMENTE pelo trigger do banco (1 OP por item do pedido). Use esta
ferramenta apenas para OPs avulsas ou retrabalho.

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - pedido_id (string, obrigatório): UUID do pedido
  - pedido_item_id (string, opcional): UUID do item específico
  - prioridade (0-3, opcional): 0=normal, 1=alta, 2=urgente, 3=crítica (padrão: 0)
  - prazo_interno (string, opcional): Data ISO do prazo
  - observacoes (string, opcional): Observações`,
    inputSchema: z.object({
      pedido_id: z.string().uuid(),
      pedido_item_id: z.string().uuid().optional(),
      prioridade: z.number().int().min(0).max(3).default(0),
      prazo_interno: z.string().optional(),
      observacoes: z.string().max(500).optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (params) => {
    try {
      const sb = getUserClient();

      // Verificar se pedido existe e está em status válido
      const { data: pedido, error: pedidoErr } = await sb
        .from("pedidos")
        .select("id, numero, status")
        .eq("id", params.pedido_id)
        .single();

      if (pedidoErr) return errorResult(pedidoErr);
      if (!pedido) return { content: [{ type: "text" as const, text: `Pedido não encontrado: ${params.pedido_id}` }] };

      const statusValidos = ["aprovado", "em_producao"];
      if (!statusValidos.includes(pedido.status)) {
        return {
          content: [{
            type: "text" as const,
            text: `Pedido ${pedido.numero} está em "${pedido.status}". OPs só podem ser criadas para pedidos aprovados ou em produção.`,
          }],
        };
      }

      const { data: op, error: opErr } = await sb
        .from("ordens_producao")
        .insert({
          pedido_id: params.pedido_id,
          pedido_item_id: params.pedido_item_id || null,
          status: "aguardando_programacao",
          prioridade: params.prioridade,
          prazo_interno: params.prazo_interno || null,
          observacoes: params.observacoes || null,
        })
        .select()
        .single();

      if (opErr) return errorResult(opErr);

      return {
        content: [{
          type: "text" as const,
          text: `✅ OP criada com sucesso!\n\n- **Número**: ${op.numero}\n- **ID**: \`${op.id}\`\n- **Pedido**: ${pedido.numero}\n- **Status**: Aguardando programação\n- **Prioridade**: ${params.prioridade}`,
        }],
        structuredContent: op,
      };
    } catch (error) {
      return errorResult(error);
    }
  }
);
```

**Validação**: Criar OP para um pedido aprovado existente e verificar que aparece na listagem.

---

### TASK-3: Adicionar `croma_criar_conta_receber` ao MCP Server (MÉDIA)

**Arquivo**: `mcp-server/src/tools/financeiro.ts`

Embora existam triggers automáticos (migration 040 e 099), ter criação manual é essencial para testes e para o caso de triggers falharem.

**Implementação**: Adicionar no `registerFinanceiroTools()`.

```typescript
server.registerTool(
  "croma_criar_conta_receber",
  {
    title: "Criar Conta a Receber",
    description: `Cria um título a receber vinculado a um pedido/cliente.

NOTA: Contas a receber são geradas AUTOMATICAMENTE em dois cenários:
1. Quando pedido é aprovado (trigger trg_pedido_gera_conta_receber)
2. Quando instalação é concluída (trigger trg_instalacao_concluida_financeiro)
Use esta ferramenta para criação manual ou quando os triggers não dispararem.

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - pedido_id (string, obrigatório): UUID do pedido
  - cliente_id (string, obrigatório): UUID do cliente
  - valor_original (number, obrigatório): Valor do título em R$
  - data_vencimento (string, obrigatório): Data ISO do vencimento
  - forma_pagamento (string, opcional): boleto|pix|cartao|transferencia|dinheiro
  - observacoes (string, opcional): Observações`,
    inputSchema: z.object({
      pedido_id: z.string().uuid(),
      cliente_id: z.string().uuid(),
      valor_original: z.number().positive(),
      data_vencimento: z.string(),
      forma_pagamento: z.enum(["boleto", "pix", "cartao", "transferencia", "dinheiro"]).optional(),
      observacoes: z.string().max(500).optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (params) => {
    try {
      const sb = getUserClient();

      // Idempotência: verificar se já existe CR para este pedido
      const { data: existente } = await sb
        .from("contas_receber")
        .select("id, numero_titulo")
        .eq("pedido_id", params.pedido_id)
        .limit(1);

      if (existente && existente.length > 0) {
        return {
          content: [{
            type: "text" as const,
            text: `⚠️ Já existe conta a receber para este pedido: ${existente[0].numero_titulo ?? existente[0].id.slice(0, 8)}. Use croma_listar_contas_receber para consultar.`,
          }],
        };
      }

      const { data: cr, error } = await sb
        .from("contas_receber")
        .insert({
          pedido_id: params.pedido_id,
          cliente_id: params.cliente_id,
          valor_original: params.valor_original,
          saldo: params.valor_original,
          data_emissao: new Date().toISOString().split("T")[0],
          data_vencimento: params.data_vencimento,
          status: "aberto",
          forma_pagamento: params.forma_pagamento || null,
          observacoes: params.observacoes || null,
        })
        .select()
        .single();

      if (error) return errorResult(error);

      return {
        content: [{
          type: "text" as const,
          text: `✅ Conta a receber criada!\n\n- **ID**: \`${cr.id}\`\n- **Valor**: R$ ${params.valor_original.toFixed(2)}\n- **Vencimento**: ${params.data_vencimento}\n- **Status**: Aberto`,
        }],
        structuredContent: cr,
      };
    } catch (error) {
      return errorResult(error);
    }
  }
);
```

**Validação**: Criar CR para pedido de teste e verificar que aparece em `croma_listar_contas_receber`.

---

### TASK-4: Adicionar `lead_id` em `croma_cadastrar_cliente` (MÉDIA)

**Arquivo**: `mcp-server/src/tools/crm.ts`

**Problema**: BUG-E2E-03 — Cliente criado via MCP não tem vínculo com o lead de origem.

**Ação**: Adicionar parâmetro `lead_id` opcional no inputSchema de `croma_cadastrar_cliente`.

No inputSchema, adicionar:
```typescript
lead_id: z.string().uuid().optional().describe("UUID do lead de origem (para rastreamento de conversão)"),
```

Isso já basta porque o `{ ...params, ativo: true }` no insert vai passar o `lead_id` para o banco. A tabela `clientes` já tem a coluna `lead_id`.

**Validação**: Criar cliente com `lead_id` e verificar que o campo é populado.

---

### TASK-5: Registrar `aprovado_por` na aprovação de proposta (BAIXA)

**Arquivo**: `mcp-server/src/tools/propostas.ts`

**Problema**: BUG-E2E-02 — `aprovado_por` = null ao aprovar proposta via MCP.

**Ação**: Na função `croma_atualizar_status_proposta`, quando `params.status === "aprovada"`, setar `aprovado_por`:

```typescript
// Localizar o trecho (linha ~399 em propostas.ts):
if (params.status === "aprovada") updateData.aprovado_em = new Date().toISOString();

// Substituir por:
if (params.status === "aprovada") {
  updateData.aprovado_em = new Date().toISOString();
  updateData.aprovado_por = getJuniorUserId() ?? "MCP Agent";
}
```

**Importar**: Adicionar `getJuniorUserId` no import de `supabase-client.js`.

**Validação**: Aprovar proposta e verificar que `aprovado_por` não é null.

---

### TASK-6: Atualizar contagem de ferramentas no index.ts (BAIXA)

**Arquivo**: `mcp-server/src/index.ts`

Após adicionar as 2 novas ferramentas (TASK-2 e TASK-3), atualizar os comentários:
- `registerPedidosTools`: de 5 para 6
- `registerFinanceiroTools`: de 2 para 3
- Total: de 28 para 30

---

### TASK-7: Build + teste de integração (OBRIGATÓRIO)

Após todas as alterações:

```bash
cd mcp-server
npm run build
# Verificar que compila sem erros

# Teste rápido de sanidade (verificar que as ferramentas estão registradas):
grep -c "registerTool" dist/tools/pedidos.js    # deve ser 6
grep -c "registerTool" dist/tools/financeiro.js  # deve ser 3
grep -c "registerTool" dist/tools/crm.js         # deve ser 7 (inalterado)
```

---

### TASK-8: Re-executar teste E2E do fluxo completo (VALIDAÇÃO FINAL)

Repetir o teste E2E das etapas 7-11 com as ferramentas novas:

```
1. Usar pedido PED-2026-0006 (do teste anterior) ou criar novo
2. croma_atualizar_status_pedido → aprovado (deve disparar trigger que cria OPs)
3. croma_listar_ordens_producao (verificar OPs criadas automaticamente)
4. croma_atualizar_status_producao → em_fila → em_producao → ... → finalizado
5. Verificar trigger: OP finalizada → cria instalação ou pronto_entrega
6. croma_listar_contas_receber (verificar CR gerada automaticamente pelo trigger 040)
7. Se CR não gerada: usar croma_criar_conta_receber como fallback
```

**Critério de sucesso**: 12/12 PASS no fluxo E2E.

---

## Resumo das Alterações

| Task | Arquivo | Tipo | Prioridade |
|------|---------|------|-----------|
| TASK-1 | `mcp-server/` | Build/verificação | Crítica |
| TASK-2 | `mcp-server/src/tools/pedidos.ts` | Nova ferramenta | Alta |
| TASK-3 | `mcp-server/src/tools/financeiro.ts` | Nova ferramenta | Média |
| TASK-4 | `mcp-server/src/tools/crm.ts` | Fix parâmetro | Média |
| TASK-5 | `mcp-server/src/tools/propostas.ts` | Fix campo | Baixa |
| TASK-6 | `mcp-server/src/index.ts` | Comentários | Baixa |
| TASK-7 | `mcp-server/` | Build | Obrigatória |
| TASK-8 | — | Teste E2E | Validação |

**Estimativa**: ~30-45 minutos para o Claude CLI executar tudo.

---

## Observação Importante

O trigger `trg_pedido_aprovado_cria_op` (migration 099) já cria OPs automaticamente ao aprovar pedido, e `trg_pedido_gera_conta_receber` (migration 040) já cria CR ao aprovar pedido. Isso significa que **TASK-1 é a mais crítica** — se o rebuild do MCP confirmar que `croma_atualizar_status_pedido` está funcional, o fluxo inteiro pode desbloquear com apenas essa correção. As TASK-2 e TASK-3 são safety nets para quando os triggers falharem.

---

## Alerta Operacional (não relacionado ao E2E)

Duas OPs reais com prazo vencido há ~19 dias:
- **OP-2026-9625** (PED-2026-0003) — status `em_fila`, prazo 13/03
- **OP-2026-0012** (PED-2026-0001) — status `em_producao`, prazo 14/03

Verificar com Junior se são pedidos reais ou dados de teste para limpar.

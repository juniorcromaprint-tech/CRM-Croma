/**
 * Ferramentas Financeiras
 * Consultar contas a receber e contas a pagar
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSupabaseClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatBRL, formatDate, formatStatus, isVencido, diasAtraso } from "../utils/formatting.js";

export function registerFinanceiroTools(server: McpServer): void {
  // ─── croma_listar_contas_receber ───────────────────────────────────────────

  server.registerTool(
    "croma_listar_contas_receber",
    {
      title: "Listar Contas a Receber",
      description: `Lista títulos a receber com filtros. Inclui boletos, notas, Pix, etc.

Use para "contas vencendo hoje", "boletos em aberto", "recebimentos da semana",
"contas vencidas do cliente X", "faturamento do mês".

Args:
  - status (string, opcional): aberto|parcial|pago|vencido|renegociado|baixado
  - cliente_id (string, opcional): UUID do cliente
  - cliente_busca (string, opcional): Busca por nome do cliente
  - vencendo_ate (string, opcional): ISO date — títulos vencendo até esta data (ex: 2026-03-31)
  - vencendo_de (string, opcional): ISO date — títulos vencendo a partir desta data
  - apenas_vencidos (boolean, opcional): Apenas títulos vencidos e não pagos
  - forma_pagamento (string, opcional): boleto|pix|cartao|transferencia|dinheiro
  - limit (number): Padrão 30
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        status: z.enum(["aberto", "parcial", "pago", "vencido", "renegociado", "baixado"]).optional(),
        cliente_id: z.string().uuid().optional(),
        cliente_busca: z.string().optional(),
        vencendo_ate: z.string().optional().describe("ISO date ex: 2026-03-31"),
        vencendo_de: z.string().optional().describe("ISO date ex: 2026-03-01"),
        apenas_vencidos: z.boolean().optional(),
        forma_pagamento: z.enum(["boleto", "pix", "cartao", "transferencia", "dinheiro"]).optional(),
        limit: z.number().int().min(1).max(100).default(30),
        offset: z.number().int().min(0).default(0),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getSupabaseClient();

        let query = sb
          .from("contas_receber")
          .select(
            `id, numero_titulo, valor_original, valor_pago, saldo, data_vencimento,
             data_pagamento, status, forma_pagamento, observacoes, created_at,
             clientes!inner(id, razao_social, nome_fantasia),
             pedidos(numero)`,
            { count: "exact" }
          );

        if (params.status) query = query.eq("status", params.status);
        if (params.cliente_id) query = query.eq("cliente_id", params.cliente_id);
        if (params.forma_pagamento) query = query.eq("forma_pagamento", params.forma_pagamento);
        if (params.vencendo_de) query = query.gte("data_vencimento", params.vencendo_de);
        if (params.vencendo_ate) query = query.lte("data_vencimento", params.vencendo_ate);
        if (params.apenas_vencidos) {
          query = query
            .lt("data_vencimento", new Date().toISOString().split("T")[0])
            .in("status", ["aberto", "parcial"]);
        }
        if (params.cliente_busca) {
          query = query.or(
            `clientes.razao_social.ilike.%${params.cliente_busca}%,clientes.nome_fantasia.ilike.%${params.cliente_busca}%`
          );
        }

        query = query
          .order("data_vencimento", { ascending: true })
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        // Totalizadores
        const totalAberto = items
          .filter(i => ["aberto", "parcial", "vencido"].includes(i.status))
          .reduce((sum, i) => sum + (i.saldo ?? i.valor_original), 0);
        const totalPago = items
          .filter(i => i.status === "pago")
          .reduce((sum, i) => sum + (i.valor_pago ?? i.valor_original), 0);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `## Contas a Receber (${total} títulos)`,
            `**Total em aberto**: ${formatBRL(totalAberto)} | **Total pago**: ${formatBRL(totalPago)}`,
            "",
          ];
          if (items.length === 0) {
            lines.push("_Nenhum título encontrado._");
          } else {
            for (const cr of items) {
              const cliente = (cr.clientes as unknown as { razao_social: string; nome_fantasia?: string }) ?? {};
              const pedido = (cr.pedidos as { numero?: string }) ?? {};
              const nomeCliente = cliente.nome_fantasia ?? cliente.razao_social ?? "—";
              const vencido = isVencido(cr.data_vencimento) && ["aberto", "parcial"].includes(cr.status);
              const atraso = vencido ? diasAtraso(cr.data_vencimento) : 0;

              lines.push(`### ${cr.numero_titulo ?? cr.id.slice(0, 8)} — ${nomeCliente}${vencido ? ` ⚠️ ${atraso}d atraso` : ""}`);
              if (pedido.numero) lines.push(`- **Pedido**: ${pedido.numero}`);
              lines.push(`- **Status**: ${formatStatus(cr.status)}`);
              lines.push(`- **Valor original**: ${formatBRL(cr.valor_original)}`);
              if (cr.valor_pago && cr.valor_pago > 0) lines.push(`- **Pago**: ${formatBRL(cr.valor_pago)}`);
              if (cr.saldo && cr.saldo > 0) lines.push(`- **Saldo**: ${formatBRL(cr.saldo)}`);
              lines.push(`- **Vencimento**: ${formatDate(cr.data_vencimento)}${vencido ? " ⚠️" : ""}`);
              if (cr.data_pagamento) lines.push(`- **Pago em**: ${formatDate(cr.data_pagamento)}`);
              if (cr.forma_pagamento) lines.push(`- **Forma**: ${cr.forma_pagamento}`);
              lines.push("");
            }
            if (response.has_more) lines.push(`_Mais resultados. Use offset: ${response.next_offset}._`);
          }
          text = lines.join("\n");
        } else {
          text = JSON.stringify({ ...response, totalizadores: { total_aberto: totalAberto, total_pago: totalPago } }, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, items.length) }],
          structuredContent: { ...response, totalizadores: { total_aberto: totalAberto, total_pago: totalPago } },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_contas_pagar ─────────────────────────────────────────────

  server.registerTool(
    "croma_listar_contas_pagar",
    {
      title: "Listar Contas a Pagar",
      description: `Lista contas a pagar (fornecedores, despesas, salários, etc.).

Use para "contas vencendo essa semana", "despesas do mês", "o que pagar hoje".

Args:
  - status (string, opcional): aberto|pago|vencido|cancelado
  - categoria (string, opcional): Categoria da despesa (ex: fornecedor, aluguel, salario)
  - vencendo_ate (string, opcional): ISO date — pagar até esta data
  - vencendo_de (string, opcional): ISO date — pagar a partir desta data
  - apenas_vencidos (boolean, opcional): Apenas contas vencidas
  - limit (number): Padrão 30
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        status: z.enum(["aberto", "pago", "vencido", "cancelado"]).optional(),
        categoria: z.string().optional(),
        vencendo_ate: z.string().optional(),
        vencendo_de: z.string().optional(),
        apenas_vencidos: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(30),
        offset: z.number().int().min(0).default(0),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getSupabaseClient();

        let query = sb
          .from("contas_pagar")
          .select(
            `id, numero_titulo, valor_original, valor_pago, saldo,
             data_vencimento, data_pagamento, status, categoria, fornecedor_id, created_at,
             fornecedores(razao_social, nome_fantasia)`,
            { count: "exact" }
          );

        if (params.status) query = query.eq("status", params.status);
        if (params.categoria) query = query.ilike("categoria", `%${params.categoria}%`);
        if (params.vencendo_de) query = query.gte("data_vencimento", params.vencendo_de);
        if (params.vencendo_ate) query = query.lte("data_vencimento", params.vencendo_ate);
        if (params.apenas_vencidos) {
          query = query
            .lt("data_vencimento", new Date().toISOString().split("T")[0])
            .in("status", ["aberto", "vencido"]);
        }

        query = query
          .order("data_vencimento", { ascending: true })
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        const totalAberto = items
          .filter(i => ["aberto", "vencido"].includes(i.status))
          .reduce((sum, i) => sum + (i.saldo ?? i.valor_original), 0);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `## Contas a Pagar (${total} títulos)`,
            `**Total em aberto**: ${formatBRL(totalAberto)}`,
            "",
          ];
          if (items.length === 0) {
            lines.push("_Nenhuma conta encontrada._");
          } else {
            for (const cp of items) {
              const fornecedor = (cp.fornecedores as { razao_social?: string; nome_fantasia?: string }) ?? {};
              const nomeFornecedor = fornecedor.nome_fantasia ?? fornecedor.razao_social ?? "—";
              const vencido = isVencido(cp.data_vencimento) && ["aberto", "vencido"].includes(cp.status);
              const atraso = vencido ? diasAtraso(cp.data_vencimento) : 0;

              const titulo = cp.numero_titulo ?? cp.categoria ?? cp.id.slice(0, 8);
              lines.push(`### ${titulo}${vencido ? ` ⚠️ ${atraso}d atraso` : ""}`);
              if (cp.fornecedor_id) lines.push(`- **Fornecedor**: ${nomeFornecedor}`);
              if (cp.categoria) lines.push(`- **Categoria**: ${cp.categoria}`);
              lines.push(`- **Status**: ${formatStatus(cp.status)}`);
              lines.push(`- **Valor**: ${formatBRL(cp.valor_original)}`);
              if (cp.saldo && cp.saldo > 0) lines.push(`- **Saldo**: ${formatBRL(cp.saldo)}`);
              lines.push(`- **Vencimento**: ${formatDate(cp.data_vencimento)}${vencido ? " ⚠️" : ""}`);
              if (cp.data_pagamento) lines.push(`- **Pago em**: ${formatDate(cp.data_pagamento)}`);
              lines.push("");
            }
            if (response.has_more) lines.push(`_Mais resultados. Use offset: ${response.next_offset}._`);
          }
          text = lines.join("\n");
        } else {
          text = JSON.stringify({ ...response, total_aberto: totalAberto }, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, items.length) }],
          structuredContent: { ...response, total_aberto: totalAberto },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_criar_conta_receber ─────────────────────────────────────────────

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
}

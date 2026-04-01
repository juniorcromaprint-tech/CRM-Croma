/**
 * Ferramentas de Pedidos e Produção
 * Consultar pedidos, detalhar, listar ordens de produção e atualizar status
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatBRL, formatDate, formatDateTime, formatStatus, isVencido } from "../utils/formatting.js";

export function registerPedidosTools(server: McpServer): void {
  // ─── croma_listar_pedidos ──────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_pedidos",
    {
      title: "Listar Pedidos",
      description: `Lista pedidos de venda com filtros opcionais.

Use para "pedidos em produção", "pedidos atrasados", "pedidos do cliente Renner", etc.

Args:
  - status (string, opcional): aguardando_aprovacao|aprovado|em_producao|producao_concluida|em_instalacao|entregue|faturado|cancelado
  - cliente_id (string, opcional): UUID do cliente
  - cliente_busca (string, opcional): Busca por nome do cliente
  - prioridade (string, opcional): normal|alta|urgente
  - atrasados (boolean, opcional): Apenas pedidos com data_prometida vencida
  - data_inicio (string, opcional): Filtro de data de criação (ISO)
  - data_fim (string, opcional): Filtro de data de criação (ISO)
  - limit (number): Padrão 20, máx 100
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        status: z.enum(["aguardando_aprovacao", "aprovado", "em_producao", "producao_concluida", "em_instalacao", "entregue", "faturado", "cancelado"]).optional(),
        cliente_id: z.string().uuid().optional(),
        cliente_busca: z.string().optional(),
        prioridade: z.enum(["normal", "alta", "urgente"]).optional(),
        atrasados: z.boolean().optional().describe("Apenas pedidos com data_prometida vencida"),
        data_inicio: z.string().optional(),
        data_fim: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        let query = sb
          .from("pedidos")
          .select(
            `id, numero, status, prioridade, valor_total, data_prometida, created_at,
             clientes!inner(id, razao_social, nome_fantasia)`,
            { count: "exact" }
          );

        if (params.status) query = query.eq("status", params.status);
        if (params.cliente_id) query = query.eq("cliente_id", params.cliente_id);
        if (params.prioridade) query = query.eq("prioridade", params.prioridade);
        if (params.atrasados) query = query.lt("data_prometida", new Date().toISOString()).not("status", "in", '("entregue","faturado","cancelado")');
        if (params.data_inicio) query = query.gte("created_at", params.data_inicio);
        if (params.data_fim) query = query.lte("created_at", params.data_fim + "T23:59:59");
        if (params.cliente_busca) {
          query = query.or(
            `clientes.razao_social.ilike.%${params.cliente_busca}%,clientes.nome_fantasia.ilike.%${params.cliente_busca}%`
          );
        }

        query = query
          .order("created_at", { ascending: false })
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Pedidos (${total} encontrados)`, ""];
          if (items.length === 0) {
            lines.push("_Nenhum pedido encontrado com os filtros informados._");
          } else {
            for (const p of items) {
              const cliente = (p.clientes as unknown as { razao_social: string; nome_fantasia?: string }) ?? {};
              const nomeCliente = cliente.nome_fantasia ?? cliente.razao_social ?? "—";
              const atrasado = p.data_prometida && isVencido(p.data_prometida) &&
                !["entregue", "faturado", "cancelado"].includes(p.status);
              lines.push(`### ${p.numero} — ${nomeCliente}${atrasado ? " ⚠️ ATRASADO" : ""}`);
              lines.push(`- **ID**: \`${p.id}\``);
              lines.push(`- **Status**: ${formatStatus(p.status)}`);
              if (p.prioridade && p.prioridade !== "normal") lines.push(`- **Prioridade**: ${p.prioridade === "urgente" ? "🔴 Urgente" : "🟡 Alta"}`);
              lines.push(`- **Valor**: ${formatBRL(p.valor_total)}`);
              if (p.data_prometida) lines.push(`- **Prazo**: ${formatDate(p.data_prometida)}${atrasado ? " ⚠️" : ""}`);
              lines.push(`- **Criado em**: ${formatDate(p.created_at)}`);
              lines.push("");
            }
            if (response.has_more) lines.push(`_Mais resultados. Use offset: ${response.next_offset}._`);
          }
          text = lines.join("\n");
        } else {
          text = JSON.stringify(response, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, items.length) }],
          structuredContent: response,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_detalhe_pedido ──────────────────────────────────────────────────

  server.registerTool(
    "croma_detalhe_pedido",
    {
      title: "Detalhes do Pedido",
      description: `Retorna pedido completo com itens, ordens de produção e histórico de status.

Use para "status do pedido PED-2026-0042", "ver itens do pedido X", "progresso de produção do pedido Y".

Args:
  - id (string): UUID do pedido
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        id: z.string().uuid("ID deve ser um UUID válido"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        const [pedidoResult, itensResult, opsResult] = await Promise.all([
          sb.from("pedidos").select(`*, clientes(id, razao_social, nome_fantasia, telefone)`).eq("id", params.id).single(),
          sb.from("pedido_itens").select("*").eq("pedido_id", params.id).order("created_at"),
          sb.from("ordens_producao").select("id, numero, status, prioridade, prazo_interno, tempo_estimado_min, created_at").eq("pedido_id", params.id),
        ]);

        if (pedidoResult.error) return errorResult(pedidoResult.error);
        if (!pedidoResult.data) return { content: [{ type: "text" as const, text: `Pedido não encontrado: ${params.id}` }] };

        const p = pedidoResult.data;
        const itens = itensResult.data ?? [];
        const ops = opsResult.data ?? [];
        const cliente = (p.clientes as { razao_social: string; nome_fantasia?: string; telefone?: string }) ?? {};

        const fullData = { pedido: p, itens, ordens_producao: ops };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const nomeCliente = cliente.nome_fantasia ?? cliente.razao_social ?? "—";
          const atrasado = p.data_prometida && isVencido(p.data_prometida) &&
            !["entregue", "faturado", "cancelado"].includes(p.status);

          const lines = [
            `# Pedido ${p.numero}${atrasado ? " ⚠️ ATRASADO" : ""}`,
            `**Cliente**: ${nomeCliente}`,
            `**Status**: ${formatStatus(p.status)}`,
            `**Valor Total**: ${formatBRL(p.valor_total)}`,
            p.data_prometida ? `**Prazo**: ${formatDate(p.data_prometida)}${atrasado ? " ⚠️ VENCIDO" : ""}` : "",
            p.prioridade && p.prioridade !== "normal" ? `**Prioridade**: ${p.prioridade}` : "",
            `**Criado em**: ${formatDateTime(p.created_at)}`,
            "",
          ].filter(Boolean);

          if (p.observacoes) lines.push(`**Observações**: ${p.observacoes}\n`);

          if (itens.length > 0) {
            lines.push(`## Itens (${itens.length})`);
            for (const item of itens) {
              lines.push(`- **${item.descricao}** — Qtd: ${item.quantidade} — ${formatBRL(item.valor_total)}`);
              if (item.largura_cm && item.altura_cm) {
                lines.push(`  Dimensões: ${item.largura_cm} × ${item.altura_cm} cm`);
              }
            }
            lines.push("");
          }

          if (ops.length > 0) {
            lines.push(`## Ordens de Produção (${ops.length})`);
            for (const op of ops) {
              lines.push(`### ${op.numero}`);
              lines.push(`- **Status**: ${formatStatus(op.status)}`);
              if (op.prazo_interno) lines.push(`- **Prazo interno**: ${formatDate(op.prazo_interno)}`);
              if (op.tempo_estimado_min) lines.push(`- **Tempo estimado**: ${op.tempo_estimado_min} min`);
              lines.push("");
            }
          }

          text = lines.join("\n");
        } else {
          text = JSON.stringify(fullData, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, itens.length + ops.length + 1) }],
          structuredContent: fullData,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_ordens_producao ──────────────────────────────────────────

  server.registerTool(
    "croma_listar_ordens_producao",
    {
      title: "Listar Ordens de Produção",
      description: `Lista ordens de produção (OPs) com filtros.

Use para "OPs em andamento hoje", "o que está no corte", "produção atrasada", "OPs pendentes".

Args:
  - status (string, opcional): pendente|em_andamento|concluido|pausado|retrabalho
  - setor (string, opcional): Filtrar por setor (corte, impressao, acabamento, etc.)
  - responsavel_id (string, opcional): UUID do responsável
  - atrasadas (boolean, opcional): Apenas OPs com prazo_interno vencido
  - limit (number): Padrão 20
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        status: z.enum(["pendente", "em_andamento", "concluido", "pausado", "retrabalho"]).optional(),
        setor: z.string().optional(),
        responsavel_id: z.string().uuid().optional(),
        atrasadas: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        let query = sb
          .from("ordens_producao")
          .select(
            `id, numero, status, prioridade, prazo_interno, tempo_estimado_min,
             setor_atual_id, responsavel_id, created_at,
             pedidos!inner(numero, clientes(razao_social, nome_fantasia))`,
            { count: "exact" }
          );

        if (params.status) query = query.eq("status", params.status);
        if (params.setor) query = query.eq("setor_atual_id", params.setor);
        if (params.responsavel_id) query = query.eq("responsavel_id", params.responsavel_id);
        if (params.atrasadas) query = query.lt("prazo_interno", new Date().toISOString()).not("status", "in", '("concluido")');

        query = query
          .order("prioridade", { ascending: false })
          .order("prazo_interno", { ascending: true, nullsFirst: false })
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Ordens de Produção (${total} encontradas)`, ""];
          if (items.length === 0) {
            lines.push("_Nenhuma OP encontrada._");
          } else {
            for (const op of items) {
              const pedido = (op.pedidos as unknown as { numero: string; clientes: { razao_social: string; nome_fantasia?: string } }) ?? {};
              const cliente = pedido.clientes ?? {};
              const nomeCliente = cliente.nome_fantasia ?? cliente.razao_social ?? "—";
              const atrasada = op.prazo_interno && isVencido(op.prazo_interno) && op.status !== "concluido";

              lines.push(`### ${op.numero}${atrasada ? " ⚠️" : ""} — Pedido ${pedido.numero ?? "?"}`);
              lines.push(`- **Cliente**: ${nomeCliente}`);
              lines.push(`- **Status**: ${formatStatus(op.status)}`);
              if (op.setor_atual_id) lines.push(`- **Setor ID**: ${op.setor_atual_id}`);
              if (op.prazo_interno) lines.push(`- **Prazo**: ${formatDate(op.prazo_interno)}${atrasada ? " ⚠️ VENCIDO" : ""}`);
              if (op.tempo_estimado_min) lines.push(`- **Tempo est.**: ${op.tempo_estimado_min} min`);
              lines.push("");
            }
            if (response.has_more) lines.push(`_Mais resultados. Use offset: ${response.next_offset}._`);
          }
          text = lines.join("\n");
        } else {
          text = JSON.stringify(response, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, items.length) }],
          structuredContent: response,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_atualizar_status_producao ──────────────────────────────────────

  server.registerTool(
    "croma_atualizar_status_producao",
    {
      title: "Atualizar Status de Produção",
      description: `Atualiza o status de uma Ordem de Produção (OP).

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Transições válidas:
- pendente → em_andamento
- em_andamento → concluido, pausado, retrabalho
- pausado → em_andamento
- retrabalho → em_andamento

Args:
  - id (string, obrigatório): UUID da OP
  - status (string, obrigatório): Novo status
  - observacao (string, opcional): Observação sobre a mudança
  - responsavel_id (string, opcional): UUID do responsável`,
      inputSchema: z.object({
        id: z.string().uuid(),
        status: z.enum(["em_andamento", "concluido", "pausado", "retrabalho"]),
        observacao: z.string().max(500).optional(),
        responsavel_id: z.string().uuid().optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        const { data: atual, error: fetchError } = await sb
          .from("ordens_producao")
          .select("id, numero, status")
          .eq("id", params.id)
          .single();

        if (fetchError) return errorResult(fetchError);
        if (!atual) return { content: [{ type: "text" as const, text: `OP não encontrada: ${params.id}` }] };

        const transicoes: Record<string, string[]> = {
          pendente: ["em_andamento"],
          em_andamento: ["concluido", "pausado", "retrabalho"],
          pausado: ["em_andamento"],
          retrabalho: ["em_andamento"],
          concluido: [],
        };

        const permitidas = transicoes[atual.status] ?? [];
        if (!permitidas.includes(params.status)) {
          return {
            content: [{
              type: "text" as const,
              text: `Transição inválida: ${formatStatus(atual.status)} → ${formatStatus(params.status)}.\n` +
                    `Permitidas de "${atual.status}": ${permitidas.length > 0 ? permitidas.join(", ") : "nenhuma"}`,
            }],
          };
        }

        const updateData: Record<string, unknown> = { status: params.status };
        if (params.observacao) updateData.observacoes = params.observacao;
        if (params.responsavel_id) updateData.responsavel_id = params.responsavel_id;
        if (params.status === "concluido") updateData.concluido_em = new Date().toISOString();
        if (params.status === "em_andamento" && atual.status === "pendente") {
          updateData.iniciado_em = new Date().toISOString();
        }

        const { error } = await sb.from("ordens_producao").update(updateData).eq("id", params.id);
        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ OP **${atual.numero}** atualizada: ${formatStatus(atual.status)} → **${formatStatus(params.status)}**`,
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

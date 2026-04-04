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
  - status (string, opcional): rascunho|aguardando_aprovacao|aprovado|em_producao|produzido|pronto_entrega|aguardando_instalacao|em_instalacao|parcialmente_concluido|concluido|faturar|faturado|entregue|cancelado
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
        status: z.enum(["rascunho", "aguardando_aprovacao", "aprovado", "em_producao", "produzido", "pronto_entrega", "aguardando_instalacao", "em_instalacao", "parcialmente_concluido", "concluido", "faturar", "faturado", "entregue", "cancelado"]).optional(),
        cliente_id: z.string().uuid().optional(),
        cliente_busca: z.string().optional(),
        prioridade: z.enum(["normal", "alta", "urgente"]).optional(),
        atrasados: z.boolean().optional().describe("Apenas pedidos com data_prometida vencida"),
        data_inicio: z.string().optional(),
        data_fim: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
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
  - status (string, opcional): aguardando_programacao|em_fila|em_producao|em_acabamento|em_conferencia|liberado|retrabalho|finalizado
  - pedido_id (string, opcional): UUID do pedido para filtrar OPs vinculadas
  - setor (string, opcional): Filtrar por setor (UUID do setor_atual_id)
  - responsavel_id (string, opcional): UUID do responsável
  - atrasadas (boolean, opcional): Apenas OPs com prazo_interno vencido
  - limit (number): Padrão 20
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        status: z.enum(["aguardando_programacao", "em_fila", "em_producao", "em_acabamento", "em_conferencia", "liberado", "retrabalho", "finalizado"]).optional(),
        pedido_id: z.string().uuid().optional().describe("UUID do pedido para filtrar OPs vinculadas"),
        setor: z.string().uuid().optional().describe("UUID do setor_atual_id"),
        responsavel_id: z.string().uuid().optional(),
        atrasadas: z.boolean().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
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
        if (params.pedido_id) query = query.eq("pedido_id", params.pedido_id);
        if (params.setor) query = query.eq("setor_atual_id", params.setor);
        if (params.responsavel_id) query = query.eq("responsavel_id", params.responsavel_id);
        if (params.atrasadas) query = query.lt("prazo_interno", new Date().toISOString()).not("status", "in", '("finalizado","liberado")');

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
- aguardando_programacao → em_fila
- em_fila → em_producao
- em_producao → em_acabamento, retrabalho
- em_acabamento → em_conferencia, retrabalho
- em_conferencia → liberado, retrabalho
- retrabalho → em_producao
- liberado → finalizado

Args:
  - id (string, obrigatório): UUID da OP
  - status (string, obrigatório): Novo status
  - observacao (string, opcional): Observação sobre a mudança
  - responsavel_id (string, opcional): UUID do responsável`,
      inputSchema: z.object({
        id: z.string().uuid(),
        status: z.enum(["em_fila", "em_producao", "em_acabamento", "em_conferencia", "liberado", "retrabalho", "finalizado"]),
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
          aguardando_programacao: ["em_fila"],
          em_fila: ["em_producao"],
          em_producao: ["em_acabamento", "retrabalho"],
          em_acabamento: ["em_conferencia", "retrabalho"],
          em_conferencia: ["liberado", "retrabalho"],
          retrabalho: ["em_producao"],
          liberado: ["finalizado"],
          finalizado: [],
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
        if (params.status === "finalizado") updateData.data_conclusao = new Date().toISOString();
        if (params.status === "em_producao" && (atual.status === "em_fila" || atual.status === "aguardando_programacao")) {
          updateData.data_inicio = new Date().toISOString();
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

  // ─── croma_atualizar_status_pedido ──────────────────────────────────────────

  server.registerTool(
    "croma_atualizar_status_pedido",
    {
      title: "Atualizar Status do Pedido",
      description: `Atualiza o status de um pedido de venda.

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Transições válidas:
- rascunho → aguardando_aprovacao
- aguardando_aprovacao → aprovado, cancelado
- aprovado → em_producao, cancelado
- em_producao → produzido, cancelado
- produzido → pronto_entrega
- pronto_entrega → aguardando_instalacao, entregue
- aguardando_instalacao → em_instalacao
- em_instalacao → parcialmente_concluido, concluido
- parcialmente_concluido → em_instalacao, concluido
- concluido → faturar
- faturar → faturado

Args:
  - id (string, obrigatório): UUID do pedido
  - status (string, obrigatório): Novo status
  - observacao (string, opcional): Observação sobre a mudança`,
      inputSchema: z.object({
        id: z.string().uuid(),
        status: z.enum([
          "aguardando_aprovacao", "aprovado", "em_producao", "produzido",
          "pronto_entrega", "aguardando_instalacao", "em_instalacao",
          "parcialmente_concluido", "concluido", "faturar", "faturado",
          "entregue", "cancelado"
        ]),
        observacao: z.string().max(500).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        const { data: atual, error: fetchError } = await sb
          .from("pedidos")
          .select("id, numero, status")
          .eq("id", params.id)
          .single();

        if (fetchError) return errorResult(fetchError);
        if (!atual) return { content: [{ type: "text" as const, text: `Pedido não encontrado: ${params.id}` }] };

        const transicoes: Record<string, string[]> = {
          rascunho: ["aguardando_aprovacao"],
          aguardando_aprovacao: ["aprovado", "cancelado"],
          aprovado: ["em_producao", "cancelado"],
          em_producao: ["produzido", "cancelado"],
          produzido: ["pronto_entrega"],
          pronto_entrega: ["aguardando_instalacao", "entregue"],
          aguardando_instalacao: ["em_instalacao"],
          em_instalacao: ["parcialmente_concluido", "concluido"],
          parcialmente_concluido: ["em_instalacao", "concluido"],
          concluido: ["faturar"],
          faturar: ["faturado"],
          faturado: [],
          entregue: [],
          cancelado: [],
        };

        const permitidas = transicoes[atual.status] ?? [];
        if (!permitidas.includes(params.status)) {
          return {
            content: [{
              type: "text" as const,
              text: `Transição inválida: ${formatStatus(atual.status)} → ${formatStatus(params.status)}.\n` +
                    `Permitidas de "${atual.status}": ${permitidas.length > 0 ? permitidas.join(", ") : "nenhuma (status final)"}`,
            }],
          };
        }

        const updateData: Record<string, unknown> = { status: params.status };
        if (params.observacao) updateData.observacoes = params.observacao;
        if (params.status === "cancelado") {
          updateData.cancelado_em = new Date().toISOString();
          if (params.observacao) updateData.motivo_cancelamento = params.observacao;
        }

        const { error } = await sb
          .from("pedidos")
          .update(updateData)
          .eq("id", params.id)
          .select()
          .single();

        if (error) return errorResult(error);

        // OPs são criadas automaticamente pelo trigger fn_pedido_aprovado_cria_op (migration 099).
        // NÃO criar OPs aqui — causava duplicação (BUG-OP-01).
        let opsMsg = "";
        if (params.status === "aprovado") {
          try {
            const { data: ops } = await sb
              .from("ordens_producao")
              .select("id, numero")
              .eq("pedido_id", params.id);

            if (ops && ops.length > 0) {
              opsMsg = `\n📋 ${ops.length} OP(s) criada(s) pelo trigger: ${ops.map(op => op.numero).join(", ")}`;
            }
          } catch {
            // silêncio — info apenas
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Pedido **${atual.numero}** atualizado: ${formatStatus(atual.status)} → **${formatStatus(params.status)}**${params.observacao ? `\nObs: ${params.observacao}` : ""}${opsMsg}`,
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_criar_ordem_producao ─────────────────────────────────────────────

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
        prioridade: z.coerce.number().int().min(0).max(3).default(0),
        prazo_interno: z.string().optional(),
        observacoes: z.string().max(500).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

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

  // ─── croma_registrar_apontamento_producao ──────────────────────────────────

  server.registerTool(
    "croma_registrar_apontamento_producao",
    {
      title: "Registrar Apontamento de Produção",
      description: `Registra um apontamento de tempo em uma etapa de produção.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - ordem_producao_id (string, obrigatório): UUID da ordem de produção
  - etapa_nome (string, obrigatório): Nome da etapa (impressao, corte, acabamento, conferencia)
  - tempo_minutos (number, obrigatório): Tempo gasto em minutos
  - operador_id (string, opcional): UUID do operador (perfil) — padrão: usuário logado
  - observacoes (string, opcional): Observações`,
      inputSchema: z.object({
        ordem_producao_id: z.string().uuid().describe("UUID da ordem de produção"),
        etapa_nome: z.string().max(100).describe("Nome da etapa: impressao, corte, acabamento, conferencia"),
        tempo_minutos: z.coerce.number().int().positive().describe("Tempo em minutos"),
        operador_id: z.string().uuid().optional().describe("UUID do operador — padrão: usuário logado"),
        observacoes: z.string().max(300).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        // Buscar ou criar etapa na OP
        let etapaId: string;
        const { data: etapasExist } = await sb
          .from("producao_etapas")
          .select("id, nome")
          .eq("ordem_producao_id", params.ordem_producao_id)
          .ilike("nome", `%${params.etapa_nome}%`)
          .limit(1);

        if (etapasExist && etapasExist.length > 0) {
          etapaId = etapasExist[0].id;
        } else {
          // Criar etapa se não existir
          const { data: novaEtapa, error: etapaErr } = await sb
            .from("producao_etapas")
            .insert({ ordem_producao_id: params.ordem_producao_id, nome: params.etapa_nome, status: "em_andamento" })
            .select()
            .single();
          if (etapaErr) return errorResult(etapaErr);
          etapaId = novaEtapa.id;
        }

        // Resolver operador_id
        let operadorId = params.operador_id;
        if (!operadorId) {
          const { data: { user } } = await sb.auth.getUser();
          if (user) {
            operadorId = user.id;
          } else {
            const { data: profiles } = await getAdminClient().from("profiles").select("id").limit(1);
            operadorId = profiles?.[0]?.id ?? "00000000-0000-0000-0000-000000000000";
          }
        }

        const inicio = new Date();
        const fim = new Date(inicio.getTime() + params.tempo_minutos * 60000);

        const { data, error } = await sb
          .from("producao_apontamentos")
          .insert({
            producao_etapa_id: etapaId,
            ordem_producao_id: params.ordem_producao_id,
            operador_id: operadorId,
            inicio: inicio.toISOString(),
            fim: fim.toISOString(),
            tempo_minutos: params.tempo_minutos,
            tipo: "producao",
            observacoes: params.observacoes ?? null,
          })
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Apontamento registrado!\n\n- **ID**: \`${data.id}\`\n- **OP**: \`${data.ordem_producao_id}\`\n- **Etapa**: ${params.etapa_nome}\n- **Tempo**: ${params.tempo_minutos} min\n- **Início**: ${formatDateTime(inicio.toISOString())}`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_apontamentos_producao ────────────────────────────────────

  server.registerTool(
    "croma_listar_apontamentos_producao",
    {
      title: "Listar Apontamentos de Produção",
      description: `Lista apontamentos de tempo de produção.

Use para "tempo gasto na OP X", "apontamentos da semana", "produtividade de hoje".

Args:
  - ordem_producao_id (string, opcional): Filtrar por OP específica
  - data_inicio / data_fim (string, opcional): Período YYYY-MM-DD
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        ordem_producao_id: z.string().uuid().optional(),
        data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();
        let query = sb
          .from("producao_apontamentos")
          .select("id, ordem_producao_id, tempo_minutos, tipo, observacoes, inicio, fim, created_at, producao_etapas(nome), profiles(full_name)", { count: "exact" });

        if (params.ordem_producao_id) query = query.eq("ordem_producao_id", params.ordem_producao_id);
        if (params.data_inicio) query = query.gte("inicio", params.data_inicio);
        if (params.data_fim) query = query.lte("inicio", params.data_fim + "T23:59:59");

        query = query.order("inicio", { ascending: false }).limit(100);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const totalMinutos = items.reduce((s, a) => s + (Number(a.tempo_minutos) || 0), 0);
        const totalHoras = (totalMinutos / 60).toFixed(1);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Apontamentos de Produção (${total}) — Total: ${totalHoras}h`, ""];
          if (items.length === 0) {
            lines.push("_Nenhum apontamento encontrado._");
          } else {
            for (const a of items) {
              const etapaNome = (a.producao_etapas as { nome?: string } | null)?.nome ?? "—";
              const operador = (a.profiles as { full_name?: string } | null)?.full_name ?? "—";
              lines.push(`- **${etapaNome}** — ${a.tempo_minutos} min — ${operador} — ${formatDate(a.inicio)}`);
              if (a.observacoes) lines.push(`  _${a.observacoes}_`);
            }
          }
          text = lines.join("\n");
        } else {
          text = JSON.stringify({ count: total, total_minutos: totalMinutos, items }, null, 2);
        }

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { count: total, total_minutos: totalMinutos, items },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
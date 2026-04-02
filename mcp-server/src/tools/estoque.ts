/**
 * Ferramentas de Estoque
 * Consultar saldos de materiais e listar catálogo
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSupabaseClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatBRL } from "../utils/formatting.js";

export function registerEstoqueTools(server: McpServer): void {
  // ─── croma_consultar_estoque ───────────────────────────────────────────────

  server.registerTool(
    "croma_consultar_estoque",
    {
      title: "Consultar Estoque",
      description: `Consulta saldo atual de materiais no estoque.

Use para "estoque de banner", "saldo do vinil", "materiais abaixo do mínimo", "o que está acabando".

Args:
  - busca (string, opcional): Busca por nome ou código do material
  - categoria (string, opcional): Filtrar por categoria (banner, adesivo, acm, etc.)
  - abaixo_minimo (boolean, opcional): Apenas materiais com saldo < estoque_minimo
  - com_saldo (boolean, opcional): Apenas materiais com saldo > 0
  - limit (number): Padrão 30
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        busca: z.string().optional().describe("Busca por nome ou código"),
        categoria: z.string().optional(),
        abaixo_minimo: z.boolean().optional().describe("Apenas materiais com saldo abaixo do mínimo"),
        com_saldo: z.boolean().optional().describe("Apenas materiais com saldo positivo"),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        offset: z.coerce.number().int().min(0).default(0),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getSupabaseClient();

        // Busca materiais com seus saldos via view ou join
        let query = sb
          .from("materiais")
          .select(
            `id, codigo, nome, categoria, unidade, preco_medio, estoque_minimo, ativo,
             estoque_saldos(quantidade_disponivel, quantidade_reservada)`,
            { count: "exact" }
          )
          .eq("ativo", true);

        if (params.busca) {
          query = query.or(`nome.ilike.%${params.busca}%,codigo.ilike.%${params.busca}%`);
        }
        if (params.categoria) query = query.ilike("categoria", `%${params.categoria}%`);

        query = query
          .order("nome")
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        let items = data ?? [];

        // Filtra em memória (Supabase não suporta filtro em relação facilmente)
        if (params.com_saldo) {
          items = items.filter(m => {
            const saldo = (m.estoque_saldos as { quantidade_disponivel?: number }[])?.[0];
            return (saldo?.quantidade_disponivel ?? 0) > 0;
          });
        }
        if (params.abaixo_minimo) {
          items = items.filter(m => {
            const saldo = (m.estoque_saldos as { quantidade_disponivel?: number }[])?.[0];
            const disponivel = saldo?.quantidade_disponivel ?? 0;
            return m.estoque_minimo && disponivel < m.estoque_minimo;
          });
        }

        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Estoque de Materiais (${items.length} materiais)`, ""];
          if (items.length === 0) {
            lines.push("_Nenhum material encontrado._");
          } else {
            for (const m of items) {
              const saldoObj = (m.estoque_saldos as { quantidade_disponivel?: number; quantidade_reservada?: number }[])?.[0] ?? {};
              const disponivel = saldoObj.quantidade_disponivel ?? 0;
              const reservado = saldoObj.quantidade_reservada ?? 0;
              const alertaMinimo = m.estoque_minimo && disponivel < m.estoque_minimo;

              lines.push(`### ${m.nome}${alertaMinimo ? " ⚠️ ABAIXO DO MÍNIMO" : ""}`);
              if (m.codigo) lines.push(`- **Código**: ${m.codigo}`);
              if (m.categoria) lines.push(`- **Categoria**: ${m.categoria}`);
              lines.push(`- **Disponível**: ${disponivel} ${m.unidade ?? ""}`);
              if (reservado > 0) lines.push(`- **Reservado**: ${reservado} ${m.unidade ?? ""}`);
              if (m.estoque_minimo) lines.push(`- **Mínimo**: ${m.estoque_minimo} ${m.unidade ?? ""}${alertaMinimo ? " ⚠️" : ""}`);
              if (m.preco_medio) lines.push(`- **Preço médio**: ${formatBRL(m.preco_medio)}/${m.unidade ?? "un"}`);
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

  // ─── croma_listar_materiais ────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_materiais",
    {
      title: "Listar Materiais",
      description: `Lista o catálogo de materiais cadastrados com preços.

Use para "listar materiais de banner", "preço do vinil adesivo", "catálogo de ACM".

Args:
  - busca (string, opcional): Busca por nome ou código
  - categoria (string, opcional): Filtrar por categoria
  - ativo (boolean, opcional): Padrão: true
  - limit (number): Padrão 30
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        busca: z.string().optional(),
        categoria: z.string().optional(),
        ativo: z.boolean().optional().default(true),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        offset: z.coerce.number().int().min(0).default(0),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getSupabaseClient();

        let query = sb
          .from("materiais")
          .select("id, codigo, nome, categoria, unidade, preco_medio, estoque_minimo, ativo", { count: "exact" });

        if (params.ativo !== undefined) query = query.eq("ativo", params.ativo);
        if (params.busca) query = query.or(`nome.ilike.%${params.busca}%,codigo.ilike.%${params.busca}%`);
        if (params.categoria) query = query.ilike("categoria", `%${params.categoria}%`);

        query = query
          .order("categoria")
          .order("nome")
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Materiais (${total} cadastrados)`, ""];
          let ultimaCategoria = "";
          for (const m of items) {
            if (m.categoria !== ultimaCategoria) {
              lines.push(`### ${m.categoria ?? "Sem categoria"}`);
              ultimaCategoria = m.categoria ?? "";
            }
            lines.push(`- **${m.nome}**${m.codigo ? ` (${m.codigo})` : ""}`);
            if (m.preco_medio) lines.push(`  - Preço: ${formatBRL(m.preco_medio)}/${m.unidade ?? "un"}`);
          }
          if (response.has_more) lines.push(`\n_Mais resultados. Use offset: ${response.next_offset}._`);
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

  // ─── croma_registrar_movimento ─────────────────────────────────────────────

  server.registerTool(
    "croma_registrar_movimento",
    {
      title: "Registrar Movimento de Estoque",
      description: `Registra uma movimentação de estoque (entrada, saída ou ajuste).

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - material_id (string, obrigatório): UUID do material
  - tipo (string, obrigatório): entrada|saida|ajuste
  - quantidade (number, obrigatório): Quantidade movimentada (positivo)
  - referencia_tipo (string, opcional): pedido|compra|ajuste|devolucao
  - referencia_id (string, opcional): UUID da referência (pedido, OP, etc.)
  - motivo (string, opcional): Motivo da movimentação`,
      inputSchema: z.object({
        material_id: z.string().uuid(),
        tipo: z.enum(["entrada", "saida", "ajuste"]),
        quantidade: z.coerce.number().positive(),
        referencia_tipo: z.enum(["pedido", "compra", "ajuste", "devolucao"]).optional(),
        referencia_id: z.string().uuid().optional(),
        motivo: z.string().max(300).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        // Verificar material existe
        const { data: mat, error: matErr } = await sb
          .from("materiais")
          .select("id, nome, unidade")
          .eq("id", params.material_id)
          .single();

        if (matErr) return errorResult(matErr);
        if (!mat) return { content: [{ type: "text" as const, text: `Material não encontrado: ${params.material_id}` }] };

        const { data: mov, error } = await sb
          .from("estoque_movimentacoes")
          .insert({
            material_id: params.material_id,
            tipo: params.tipo,
            quantidade: params.quantidade,
            referencia_tipo: params.referencia_tipo || null,
            referencia_id: params.referencia_id || null,
            motivo: params.motivo || null,
          })
          .select()
          .single();

        if (error) return errorResult(error);

        const tipoLabel = params.tipo === "entrada" ? "Entrada" : params.tipo === "saida" ? "Saída" : "Ajuste";

        return {
          content: [{
            type: "text" as const,
            text: `✅ Movimento registrado!\n\n- **Material**: ${mat.nome}\n- **Tipo**: ${tipoLabel}\n- **Quantidade**: ${params.quantidade} ${mat.unidade ?? "un"}\n- **ID**: \`${mov.id}\``,
          }],
          structuredContent: mov,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

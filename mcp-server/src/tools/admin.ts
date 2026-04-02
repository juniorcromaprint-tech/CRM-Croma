/**
 * Ferramentas Admin / Catálogo
 * Consultar e atualizar produtos, materiais e regras de precificação
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatBRL } from "../utils/formatting.js";

export function registerAdminTools(server: McpServer): void {
  // ─── croma_listar_produtos ─────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_produtos",
    {
      title: "Listar Produtos",
      description: `Lista o catálogo de produtos com modelos e markup.

Use para "produtos disponíveis", "modelos de banner", "markup do ACM".

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
        const sb = getAdminClient();

        let query = sb
          .from("produtos")
          .select(
            `id, codigo, nome, categoria, descricao, unidade_padrao, ativo,
             produto_modelos(id, nome, markup_padrao, margem_minima, area_m2, ativo)`,
            { count: "exact" }
          );

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
          const lines = [`## Produtos (${total})`, ""];
          let ultimaCategoria = "";
          for (const p of items) {
            if (p.categoria !== ultimaCategoria) {
              lines.push(`### ${p.categoria ?? "Sem categoria"}`);
              ultimaCategoria = p.categoria ?? "";
            }
            const modelos = (p.produto_modelos as { nome: string; markup_padrao?: number; ativo?: boolean }[]) ?? [];
            const modelosAtivos = modelos.filter(m => m.ativo !== false);
            lines.push(`- **${p.nome}**${p.codigo ? ` (${p.codigo})` : ""} — ${modelosAtivos.length} modelo(s)`);
            for (const m of modelosAtivos.slice(0, 3)) {
              const markup = m.markup_padrao ? ` markup ${m.markup_padrao}%` : "";
              lines.push(`  - ${m.nome}${markup}`);
            }
            if (modelosAtivos.length > 3) lines.push(`  - ... e mais ${modelosAtivos.length - 3} modelos`);
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

  // ─── croma_atualizar_preco_material ────────────────────────────────────────

  server.registerTool(
    "croma_atualizar_preco_material",
    {
      title: "Atualizar Preço de Material",
      description: `Atualiza o preço médio de um material no catálogo.

ATENÇÃO: Ação que modifica dados. Altera base de cálculo de orçamentos futuros.
Confirme com o usuário antes de executar.

Args:
  - id (string, obrigatório): UUID do material
  - preco_medio (number, obrigatório): Novo preço médio em R$
  - motivo (string, opcional): Motivo da atualização (ex: "reajuste fornecedor")`,
      inputSchema: z.object({
        id: z.string().uuid(),
        preco_medio: z.coerce.number().positive(),
        motivo: z.string().max(200).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        const { data: mat, error: fetchErr } = await sb
          .from("materiais")
          .select("id, nome, preco_medio")
          .eq("id", params.id)
          .single();

        if (fetchErr) return errorResult(fetchErr);
        if (!mat) return { content: [{ type: "text" as const, text: `Material não encontrado: ${params.id}` }] };

        const precoAnterior = mat.preco_medio;

        const { error } = await sb
          .from("materiais")
          .update({ preco_medio: params.preco_medio })
          .eq("id", params.id)
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Preço atualizado!\n\n- **Material**: ${mat.nome}\n- **Preço anterior**: ${precoAnterior ? formatBRL(precoAnterior) : "—"}\n- **Novo preço**: ${formatBRL(params.preco_medio)}${params.motivo ? `\n- **Motivo**: ${params.motivo}` : ""}`,
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_regras_precificacao ──────────────────────────────────────

  server.registerTool(
    "croma_listar_regras_precificacao",
    {
      title: "Listar Regras de Precificação",
      description: `Lista as regras de markup e precificação por categoria de produto.

Use para "markup do banner", "desconto máximo de adesivo", "regras de precificação".

Args:
  - categoria (string, opcional): Filtrar por categoria
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        categoria: z.string().optional(),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        let query = sb
          .from("regras_precificacao")
          .select("id, categoria, markup_minimo, markup_sugerido, desconto_maximo, preco_m2_minimo, taxa_urgencia, ativo")
          .eq("ativo", true);

        if (params.categoria) query = query.ilike("categoria", `%${params.categoria}%`);

        query = query.order("categoria");

        const { data, error } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Regras de Precificação (${items.length})`, ""];
          if (items.length === 0) {
            lines.push("_Nenhuma regra encontrada._");
          } else {
            for (const r of items) {
              lines.push(`### ${r.categoria}`);
              lines.push(`- **Markup sugerido**: ${r.markup_sugerido}%`);
              lines.push(`- **Markup mínimo**: ${r.markup_minimo}%`);
              if (r.desconto_maximo) lines.push(`- **Desconto máximo**: ${r.desconto_maximo}%`);
              if (r.preco_m2_minimo) lines.push(`- **Preço mínimo/m²**: ${formatBRL(r.preco_m2_minimo)}`);
              if (r.taxa_urgencia) lines.push(`- **Taxa urgência**: +${r.taxa_urgencia}%`);
              lines.push("");
            }
          }
          text = lines.join("\n");
        } else {
          text = JSON.stringify({ count: items.length, items }, null, 2);
        }

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { count: items.length, items },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

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

  // ─── croma_criar_produto ───────────────────────────────────────────────────

  server.registerTool(
    "croma_criar_produto",
    {
      title: "Criar Produto",
      description: `Cria um novo produto no catálogo da Croma Print.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - nome (string, obrigatório): Nome do produto
  - categoria (string, obrigatório): Categoria (banner, adesivo, fachada, placa, etc.)
  - codigo (string, opcional): Código interno
  - descricao (string, opcional): Descrição do produto
  - ativo (boolean, opcional): Ativo? (padrão: true)`,
      inputSchema: z.object({
        nome: z.string().min(3).max(200).describe("Nome do produto"),
        categoria: z.string().min(1).max(50).describe("Categoria (banner, adesivo, fachada, etc.)"),
        codigo: z.string().max(50).optional(),
        descricao: z.string().max(500).optional(),
        ativo: z.boolean().default(true),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const sb = getUserClient();
        const { data, error } = await sb
          .from("produtos")
          .insert(params)
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Produto criado!\n\n- **ID**: \`${data.id}\`\n- **Nome**: ${data.nome}\n- **Categoria**: ${data.categoria}${data.codigo ? `\n- **Código**: ${data.codigo}` : ""}`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_criar_modelo_produto ────────────────────────────────────────────

  server.registerTool(
    "croma_criar_modelo_produto",
    {
      title: "Criar Modelo de Produto",
      description: `Cria um novo modelo/variação de produto (ex: "Banner Lona 440g com Ilhós").

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - produto_id (string, obrigatório): UUID do produto pai
  - nome (string, obrigatório): Nome do modelo
  - codigo (string, opcional): Código do modelo
  - markup_padrao (number, opcional): Markup padrão em % (ex: 250 = 250%)
  - materiais (array, opcional): Materiais vinculados com quantidade_por_unidade`,
      inputSchema: z.object({
        produto_id: z.string().uuid().describe("UUID do produto pai"),
        nome: z.string().min(3).max(200).describe("Nome do modelo"),
        codigo: z.string().max(50).optional(),
        markup_padrao: z.coerce.number().positive().optional().describe("Markup em % (ex: 250)"),
        materiais: z.array(z.object({
          material_id: z.string().uuid(),
          quantidade_por_unidade: z.coerce.number().positive().describe("Consumo por unidade/m²"),
          tipo: z.enum(["material", "acabamento", "servico"]).default("material"),
        })).optional(),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const sb = getUserClient();
        const { materiais, ...modeloData } = params;

        const { data: modelo, error: modeloErr } = await sb
          .from("produto_modelos")
          .insert({ ...modeloData, ativo: true })
          .select()
          .single();

        if (modeloErr) return errorResult(modeloErr);

        let matLog = "";
        if (materiais && materiais.length > 0) {
          const matInsert = materiais.map(m => ({
            modelo_id: modelo.id,
            material_id: m.material_id,
            quantidade_por_unidade: m.quantidade_por_unidade,
            tipo: m.tipo,
          }));
          const { error: matErr } = await sb.from("modelo_materiais").insert(matInsert);
          if (matErr) {
            matLog = `\n⚠️ Modelo criado mas erro ao vincular materiais: ${matErr.message}`;
          } else {
            matLog = `\n- **Materiais vinculados**: ${materiais.length}`;
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Modelo criado!\n\n- **ID**: \`${modelo.id}\`\n- **Nome**: ${modelo.nome}\n- **Produto ID**: ${modelo.produto_id}${modelo.markup_padrao ? `\n- **Markup**: ${modelo.markup_padrao}%` : ""}${matLog}`,
          }],
          structuredContent: modelo,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_atualizar_modelo_produto ────────────────────────────────────────

  server.registerTool(
    "croma_atualizar_modelo_produto",
    {
      title: "Atualizar Modelo de Produto",
      description: `Atualiza dados de um modelo de produto. Apenas os campos informados são alterados.

ATENÇÃO: Ação que modifica dados. Altera base de cálculo de orçamentos futuros.
Confirme com o usuário antes de executar.

Args:
  - modelo_id (string, obrigatório): UUID do modelo
  - nome (string, opcional): Novo nome
  - markup_padrao (number, opcional): Novo markup em %
  - ativo (boolean, opcional): Ativar/desativar modelo`,
      inputSchema: z.object({
        modelo_id: z.string().uuid().describe("UUID do modelo"),
        nome: z.string().max(200).optional(),
        markup_padrao: z.coerce.number().positive().optional(),
        ativo: z.boolean().optional(),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const { modelo_id, ...updates } = params;
        if (Object.keys(updates).length === 0) {
          return { content: [{ type: "text" as const, text: "Nenhum campo para atualizar foi informado." }] };
        }

        const sb = getUserClient();
        const { data, error } = await sb
          .from("produto_modelos")
          .update(updates)
          .eq("id", modelo_id)
          .select()
          .single();

        if (error) return errorResult(error);
        if (!data) return { content: [{ type: "text" as const, text: `Modelo não encontrado: ${modelo_id}` }] };

        return {
          content: [{
            type: "text" as const,
            text: `✅ Modelo atualizado!\n\n- **${data.nome}** (\`${data.id}\`)\n- Campos atualizados: ${Object.keys(updates).join(", ")}`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_criar_regra_precificacao ────────────────────────────────────────

  server.registerTool(
    "croma_criar_regra_precificacao",
    {
      title: "Criar Regra de Precificação",
      description: `Cria uma nova regra de markup/precificação para uma categoria.

ATENÇÃO: Ação que modifica dados. Afeta cálculo de todos os orçamentos desta categoria.
Confirme com o usuário antes de executar.

Args:
  - categoria (string, obrigatório): Categoria (banner, adesivo, fachada, etc.)
  - markup_minimo (number, obrigatório): Markup mínimo em %
  - markup_sugerido (number, obrigatório): Markup sugerido em %
  - markup_maximo (number, opcional): Markup máximo em %
  - desconto_maximo (number, opcional): Desconto máximo em % (padrão: 15)
  - descricao (string, opcional): Descrição da regra`,
      inputSchema: z.object({
        categoria: z.string().min(1).max(50).describe("Categoria do produto"),
        markup_minimo: z.coerce.number().positive().describe("Markup mínimo em %"),
        markup_sugerido: z.coerce.number().positive().describe("Markup sugerido em %"),
        markup_maximo: z.coerce.number().positive().optional(),
        desconto_maximo: z.coerce.number().min(0).max(100).default(15),
        descricao: z.string().max(500).optional(),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const sb = getUserClient();
        const { data, error } = await sb
          .from("regras_precificacao")
          .insert({ ...params, ativo: true })
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Regra de precificação criada!\n\n- **ID**: \`${data.id}\`\n- **Categoria**: ${data.categoria}\n- **Markup sugerido**: ${data.markup_sugerido}%\n- **Markup mínimo**: ${data.markup_minimo}%${data.markup_maximo ? `\n- **Markup máximo**: ${data.markup_maximo}%` : ""}\n- **Desconto máximo**: ${data.desconto_maximo}%`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_atualizar_regra_precificacao ────────────────────────────────────

  server.registerTool(
    "croma_atualizar_regra_precificacao",
    {
      title: "Atualizar Regra de Precificação",
      description: `Atualiza uma regra de precificação existente. Apenas os campos informados são alterados.

ATENÇÃO: Ação que modifica dados. Afeta cálculo de orçamentos futuros desta categoria.
Confirme com o usuário antes de executar.

Args:
  - regra_id (string, obrigatório): UUID da regra
  - markup_minimo, markup_sugerido, markup_maximo: valores em %
  - desconto_maximo (number, opcional): Desconto máximo em %
  - ativo (boolean, opcional): Ativar/desativar regra
  - descricao (string, opcional): Nova descrição`,
      inputSchema: z.object({
        regra_id: z.string().uuid().describe("UUID da regra de precificação"),
        markup_minimo: z.coerce.number().positive().optional(),
        markup_sugerido: z.coerce.number().positive().optional(),
        markup_maximo: z.coerce.number().positive().optional(),
        desconto_maximo: z.coerce.number().min(0).max(100).optional(),
        ativo: z.boolean().optional(),
        descricao: z.string().max(500).optional(),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const { regra_id, ...updates } = params;
        if (Object.keys(updates).length === 0) {
          return { content: [{ type: "text" as const, text: "Nenhum campo para atualizar foi informado." }] };
        }

        const sb = getUserClient();
        const { data, error } = await sb
          .from("regras_precificacao")
          .update(updates)
          .eq("id", regra_id)
          .select()
          .single();

        if (error) return errorResult(error);
        if (!data) return { content: [{ type: "text" as const, text: `Regra não encontrada: ${regra_id}` }] };

        return {
          content: [{
            type: "text" as const,
            text: `✅ Regra atualizada!\n\n- **Categoria**: ${data.categoria} (\`${data.id}\`)\n- Campos atualizados: ${Object.keys(updates).join(", ")}`,
          }],
          structuredContent: data,
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

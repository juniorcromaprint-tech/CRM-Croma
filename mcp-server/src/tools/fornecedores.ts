/**
 * Ferramentas de Fornecedores
 * Consultar, cadastrar e atualizar fornecedores + histórico de compras
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import {
  formatBRL,
  formatDate,
  formatCNPJ,
  formatPhone,
} from "../utils/formatting.js";

export function registerFornecedoresTools(server: McpServer): void {
  // ─── croma_listar_fornecedores ─────────────────────────────────────────────

  server.registerTool(
    "croma_listar_fornecedores",
    {
      title: "Listar Fornecedores",
      description: `Lista fornecedores cadastrados na Croma Print com filtros opcionais.

Use para "quais fornecedores temos?", "fornecedor de vinil", "fornecedores ativos", etc.

Args:
  - busca (string, opcional): Busca por razão social, nome fantasia ou CNPJ
  - categoria (string, opcional): Filtrar por categoria (ex: Mídia, Vinil, ACM)
  - ativo_only (boolean, opcional): Apenas fornecedores ativos (padrão: true)
  - limit_rows (number): Máximo de resultados (padrão: 50, máx: 500)
  - response_format ('markdown'|'json'): Formato da resposta (padrão: markdown)`,
      inputSchema: z.object({
        busca: z.string().max(200).optional().describe("Busca por nome ou CNPJ"),
        categoria: z.string().max(50).optional().describe("Filtrar por categoria"),
        ativo_only: z.boolean().default(true).describe("Apenas ativos (padrão: true)"),
        limit_rows: z.coerce.number().int().min(1).max(500).default(50),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        let query = sb
          .from("fornecedores")
          .select(
            "id, razao_social, nome_fantasia, cnpj, telefone, email, contato_nome, categorias, lead_time_dias, condicao_pagamento, ativo",
            { count: "exact" }
          );

        if (params.ativo_only) query = query.eq("ativo", true);
        if (params.busca) {
          query = query.or(
            `razao_social.ilike.%${params.busca}%,nome_fantasia.ilike.%${params.busca}%,cnpj.ilike.%${params.busca}%`
          );
        }

        query = query.order("razao_social").limit(params.limit_rows);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, 0, params.limit_rows);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Fornecedores (${total} encontrados)`, ""];
          if (items.length === 0) {
            lines.push("_Nenhum fornecedor encontrado com os filtros informados._");
          } else {
            for (const f of items) {
              lines.push(`### ${f.razao_social}${f.nome_fantasia ? ` (${f.nome_fantasia})` : ""}`);
              lines.push(`- **ID**: \`${f.id}\``);
              if (f.cnpj) lines.push(`- **CNPJ**: ${formatCNPJ(f.cnpj)}`);
              if (f.telefone) lines.push(`- **Telefone**: ${formatPhone(f.telefone)}`);
              if (f.email) lines.push(`- **Email**: ${f.email}`);
              if (f.contato_nome) lines.push(`- **Contato**: ${f.contato_nome}`);
              if (f.categorias?.length) lines.push(`- **Categorias**: ${(f.categorias as string[]).join(", ")}`);
              if (f.lead_time_dias) lines.push(`- **Lead time**: ${f.lead_time_dias} dias`);
              if (f.condicao_pagamento) lines.push(`- **Condição pgto**: ${f.condicao_pagamento}`);
              lines.push(`- **Status**: ${f.ativo ? "✅ Ativo" : "❌ Inativo"}`);
              lines.push("");
            }
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

  // ─── croma_detalhe_fornecedor ──────────────────────────────────────────────

  server.registerTool(
    "croma_detalhe_fornecedor",
    {
      title: "Detalhes do Fornecedor",
      description: `Retorna informações completas de um fornecedor: dados cadastrais,
histórico de compras e resumo financeiro.

Use para "dados do fornecedor X", "histórico com VinilSul", "quanto compramos da Arlon".

Args:
  - fornecedor_id (string, obrigatório): UUID do fornecedor
  - response_format ('markdown'|'json'): Formato da resposta (padrão: markdown)`,
      inputSchema: z.object({
        fornecedor_id: z.string().uuid().describe("UUID do fornecedor"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        const [fornResult, contasResult, resumoResult] = await Promise.all([
          sb.from("fornecedores").select("*").eq("id", params.fornecedor_id).single(),
          sb
            .from("contas_pagar")
            .select("id, numero_titulo, valor_original, data_vencimento, status, created_at")
            .eq("fornecedor_id", params.fornecedor_id)
            .order("created_at", { ascending: false })
            .limit(20),
          sb
            .from("contas_pagar")
            .select("valor_original")
            .eq("fornecedor_id", params.fornecedor_id),
        ]);

        if (fornResult.error) return errorResult(fornResult.error);
        if (!fornResult.data) {
          return { content: [{ type: "text" as const, text: `Fornecedor não encontrado: ${params.fornecedor_id}` }] };
        }

        const f = fornResult.data;
        const contas = contasResult.data ?? [];
        const totalCompras = (resumoResult.data ?? []).reduce(
          (sum, c) => sum + (Number(c.valor_original) || 0),
          0
        );

        const fullData = { fornecedor: f, contas_recentes: contas, total_compras: totalCompras, qtd_compras: contas.length };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `# ${f.razao_social}`,
            f.nome_fantasia ? `**Nome Fantasia**: ${f.nome_fantasia}` : "",
            "",
            "## Dados Cadastrais",
            `- **ID**: \`${f.id}\``,
            f.cnpj ? `- **CNPJ**: ${formatCNPJ(f.cnpj)}` : "",
            f.telefone ? `- **Telefone**: ${formatPhone(f.telefone)}` : "",
            f.email ? `- **Email**: ${f.email}` : "",
            f.contato_nome ? `- **Contato**: ${f.contato_nome}` : "",
            f.categorias?.length ? `- **Categorias**: ${(f.categorias as string[]).join(", ")}` : "",
            f.lead_time_dias ? `- **Lead time**: ${f.lead_time_dias} dias` : "",
            f.condicao_pagamento ? `- **Condição pgto**: ${f.condicao_pagamento}` : "",
            f.observacoes ? `- **Observações**: ${f.observacoes}` : "",
            `- **Status**: ${f.ativo ? "✅ Ativo" : "❌ Inativo"}`,
            `- **Cadastrado em**: ${formatDate(f.created_at)}`,
            "",
            "## Resumo Financeiro",
            `- **Total em compras**: ${formatBRL(totalCompras)}`,
            `- **Qtd. de títulos**: ${(resumoResult.data ?? []).length}`,
            "",
          ].filter(Boolean);

          if (contas.length > 0) {
            lines.push("## Últimas Compras (contas a pagar)");
            for (const c of contas) {
              const statusLabel = c.status === "pago" ? "✅ Pago" : c.status === "pendente" ? "⏳ Pendente" : c.status ?? "—";
              lines.push(`- **${c.numero_titulo ?? "—"}** — ${formatBRL(c.valor_original)} — Venc: ${formatDate(c.data_vencimento)} — ${statusLabel}`);
            }
          }

          text = lines.join("\n");
        } else {
          text = JSON.stringify(fullData, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, 1) }],
          structuredContent: fullData,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_cadastrar_fornecedor ────────────────────────────────────────────

  server.registerTool(
    "croma_cadastrar_fornecedor",
    {
      title: "Cadastrar Fornecedor",
      description: `Cria um novo fornecedor na Croma Print.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - razao_social (string, obrigatório): Razão social da empresa
  - nome_fantasia (string, opcional): Nome fantasia
  - cnpj (string, opcional): CNPJ com 14 dígitos (apenas números)
  - telefone (string, opcional): Telefone de contato
  - email (string, opcional): Email principal
  - contato_nome (string, opcional): Nome do contato principal
  - categorias (string[], opcional): Categorias de produtos (ex: ["Mídia", "Vinil"])
  - lead_time_dias (number, opcional): Prazo de entrega em dias úteis
  - condicao_pagamento (string, opcional): Condição de pagamento (ex: "28/42 dias boleto")
  - observacoes (string, opcional): Observações gerais

Retorna: dados do fornecedor criado com ID gerado`,
      inputSchema: z.object({
        razao_social: z.string().min(3).max(200).describe("Razão social (obrigatório)"),
        nome_fantasia: z.string().max(200).optional(),
        cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos (sem pontuação)").optional(),
        telefone: z.string().max(20).optional(),
        email: z.string().email("Email inválido").optional(),
        contato_nome: z.string().max(100).optional(),
        categorias: z.preprocess(
          (val) => typeof val === 'string' ? JSON.parse(val) : val,
          z.array(z.string()).optional(),
        ).describe("Categorias de produtos fornecidos"),
        lead_time_dias: z.coerce.number().int().min(0).optional(),
        condicao_pagamento: z.string().max(100).optional(),
        observacoes: z.string().max(500).optional(),
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
          .from("fornecedores")
          .insert({ ...params, ativo: true })
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Fornecedor cadastrado com sucesso!\n\n- **ID**: \`${data.id}\`\n- **Razão Social**: ${data.razao_social}${data.nome_fantasia ? `\n- **Nome Fantasia**: ${data.nome_fantasia}` : ""}\n${data.cnpj ? `- **CNPJ**: ${formatCNPJ(data.cnpj)}\n` : ""}- **Cadastrado em**: ${formatDate(data.created_at)}`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_atualizar_fornecedor ────────────────────────────────────────────

  server.registerTool(
    "croma_atualizar_fornecedor",
    {
      title: "Atualizar Fornecedor",
      description: `Atualiza dados de um fornecedor existente. Apenas os campos informados são alterados.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - fornecedor_id (string, obrigatório): UUID do fornecedor
  - razao_social, nome_fantasia, cnpj, telefone, email, contato_nome: dados cadastrais
  - categorias (string[], opcional): Nova lista de categorias
  - lead_time_dias (number, opcional): Novo prazo de entrega
  - condicao_pagamento (string, opcional): Nova condição de pagamento
  - ativo (boolean, opcional): Ativar/desativar fornecedor
  - observacoes (string, opcional): Novas observações`,
      inputSchema: z.object({
        fornecedor_id: z.string().uuid().describe("UUID do fornecedor"),
        razao_social: z.string().min(3).max(200).optional(),
        nome_fantasia: z.string().max(200).optional(),
        cnpj: z.string().regex(/^\d{14}$/).optional(),
        telefone: z.string().max(20).optional(),
        email: z.string().email().optional(),
        contato_nome: z.string().max(100).optional(),
        categorias: z.preprocess(
          (val) => typeof val === 'string' ? JSON.parse(val) : val,
          z.array(z.string()).optional(),
        ),
        lead_time_dias: z.coerce.number().int().min(0).optional(),
        condicao_pagamento: z.string().max(100).optional(),
        ativo: z.boolean().optional(),
        observacoes: z.string().max(500).optional(),
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
        const { fornecedor_id, ...updates } = params;
        if (Object.keys(updates).length === 0) {
          return { content: [{ type: "text" as const, text: "Nenhum campo para atualizar foi informado." }] };
        }

        const sb = getUserClient();
        const { data, error } = await sb
          .from("fornecedores")
          .update(updates)
          .eq("id", fornecedor_id)
          .select()
          .single();

        if (error) return errorResult(error);
        if (!data) return { content: [{ type: "text" as const, text: `Fornecedor não encontrado: ${fornecedor_id}` }] };

        return {
          content: [{
            type: "text" as const,
            text: `✅ Fornecedor atualizado!\n\n- **${data.razao_social}** (\`${data.id}\`)\n- Campos atualizados: ${Object.keys(updates).join(", ")}`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_historico_compras_fornecedor ────────────────────────────────────

  server.registerTool(
    "croma_historico_compras_fornecedor",
    {
      title: "Histórico de Compras do Fornecedor",
      description: `Retorna o histórico de compras e preços de um fornecedor específico.

Use para "quanto compramos da VinilSul nos últimos 12 meses", "histórico de preços da Arlon",
"negociação com fornecedor X".

Args:
  - fornecedor_id (string, obrigatório): UUID do fornecedor
  - periodo_meses (number, opcional): Período em meses (padrão: 12, máx: 24)
  - response_format ('markdown'|'json'): Formato da resposta (padrão: markdown)`,
      inputSchema: z.object({
        fornecedor_id: z.string().uuid().describe("UUID do fornecedor"),
        periodo_meses: z.coerce.number().int().min(1).max(24).default(12),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const sb = getAdminClient();
        const dataInicio = new Date();
        dataInicio.setMonth(dataInicio.getMonth() - params.periodo_meses);

        const [fornResult, contasResult, precosResult] = await Promise.all([
          sb.from("fornecedores").select("id, razao_social, nome_fantasia").eq("id", params.fornecedor_id).single(),
          sb
            .from("contas_pagar")
            .select("id, numero_titulo, valor_original, data_vencimento, status, created_at")
            .eq("fornecedor_id", params.fornecedor_id)
            .gte("created_at", dataInicio.toISOString())
            .order("created_at", { ascending: false }),
          sb
            .from("historico_precos_fornecedor")
            .select("id, material_id, preco, data_cotacao, observacao, materiais(nome, unidade)")
            .eq("fornecedor_id", params.fornecedor_id)
            .gte("data_cotacao", dataInicio.toISOString().split("T")[0])
            .order("data_cotacao", { ascending: false }),
        ]);

        if (fornResult.error) return errorResult(fornResult.error);
        if (!fornResult.data) {
          return { content: [{ type: "text" as const, text: `Fornecedor não encontrado: ${params.fornecedor_id}` }] };
        }

        const forn = fornResult.data;
        const contas = contasResult.data ?? [];
        const precos = precosResult.data ?? [];
        const totalComprado = contas.reduce((sum, c) => sum + (Number(c.valor_original) || 0), 0);

        const fullData = { fornecedor: forn, contas, precos, total_comprado: totalComprado, periodo_meses: params.periodo_meses };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `## Histórico de Compras — ${forn.razao_social}`,
            `**Período**: últimos ${params.periodo_meses} meses`,
            "",
            "## Resumo",
            `- **Total comprado**: ${formatBRL(totalComprado)}`,
            `- **Nº de títulos**: ${contas.length}`,
            `- **Cotações registradas**: ${precos.length}`,
            "",
          ];

          if (contas.length > 0) {
            lines.push("## Títulos / Contas a Pagar");
            for (const c of contas) {
              const statusLabel = c.status === "pago" ? "✅ Pago" : c.status === "pendente" ? "⏳ Pendente" : c.status ?? "—";
              lines.push(`- **${c.numero_titulo ?? "—"}** — ${formatBRL(c.valor_original)} — ${formatDate(c.data_vencimento)} — ${statusLabel}`);
            }
            lines.push("");
          }

          if (precos.length > 0) {
            lines.push("## Histórico de Preços (cotações)");
            for (const p of precos) {
              const mat = p.materiais as { nome?: string; unidade?: string } | null;
              lines.push(`- **${mat?.nome ?? p.material_id}** — ${formatBRL(p.preco)}/${mat?.unidade ?? "un"} — ${formatDate(p.data_cotacao)}${p.observacao ? ` — ${p.observacao}` : ""}`);
            }
          }

          text = lines.join("\n");
        } else {
          text = JSON.stringify(fullData, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, contas.length + precos.length) }],
          structuredContent: fullData,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

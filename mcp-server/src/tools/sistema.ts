/**
 * Ferramentas de Sistema
 * Health check, execução de SQL read-only e utilitários administrativos
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSupabaseClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { truncateIfNeeded } from "../utils/pagination.js";
import { formatDateTime } from "../utils/formatting.js";

// Lista de palavras proibidas em SQL para segurança
const SQL_FORBIDDEN_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE",
  "GRANT", "REVOKE", "EXECUTE", "EXEC", "CALL", "DO", "VACUUM",
  "COPY", "IMPORT", "EXPORT", "ATTACH",
];

function validateReadOnlySQL(sql: string): void {
  const upperSQL = sql.toUpperCase();
  for (const keyword of SQL_FORBIDDEN_KEYWORDS) {
    // Verifica se o keyword aparece como palavra completa
    const regex = new RegExp(`\\b${keyword}\\b`);
    if (regex.test(upperSQL)) {
      throw new Error(
        `Query rejeitada: contém operação proibida "${keyword}". ` +
        `Apenas queries SELECT são permitidas via croma_executar_sql.`
      );
    }
  }
  if (!upperSQL.trim().startsWith("SELECT") && !upperSQL.trim().startsWith("WITH")) {
    throw new Error(
      "Query rejeitada: deve iniciar com SELECT ou WITH. " +
      "Apenas queries de leitura são permitidas."
    );
  }
}

export function registerSistemaTools(server: McpServer): void {
  // ─── croma_executar_sql ────────────────────────────────────────────────────

  server.registerTool(
    "croma_executar_sql",
    {
      title: "Executar SQL (apenas leitura)",
      description: `Executa uma query SQL SELECT read-only diretamente no banco da Croma Print.

IMPORTANTE: Apenas queries SELECT/WITH são permitidas. Qualquer tentativa de
INSERT, UPDATE, DELETE, DROP, etc. será bloqueada automaticamente.

Use para consultas ad-hoc que as outras ferramentas não cobrem:
- "quantos pedidos foram criados por mês em 2026"
- "top 10 clientes por faturamento"
- "materiais mais usados nos últimos 3 meses"
- "ticket médio por segmento de cliente"

Args:
  - sql (string, obrigatório): Query SQL SELECT/WITH a executar
  - descricao (string, obrigatório): Descrição do que a query faz (para auditoria)
  - limit_rows (number, opcional): Máximo de linhas (padrão: 100, máx: 500)
  - response_format ('markdown'|'json'): Padrão json (mais fácil de processar)

Tabelas principais: clientes, leads, propostas, proposta_itens, pedidos, pedido_itens,
ordens_producao, ordens_instalacao, contas_receber, contas_pagar, materiais,
estoque_saldos, estoque_movimentos, profiles, fornecedores`,
      inputSchema: z.object({
        sql: z.string().min(10, "Query muito curta").max(5000, "Query muito longa").describe("Query SQL SELECT"),
        descricao: z.string().min(5).max(200).describe("Descrição do que a query faz"),
        limit_rows: z.number().int().min(1).max(500).default(100),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.JSON),
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
        // Valida segurança antes de executar
        validateReadOnlySQL(params.sql);

        // Injeta LIMIT automaticamente se não houver
        let sql = params.sql.trim();
        const upperSQL = sql.toUpperCase();
        if (!upperSQL.includes("LIMIT")) {
          sql = `${sql} LIMIT ${params.limit_rows}`;
        }

        const sb = getSupabaseClient();
        const { data, error } = await sb.rpc("execute_sql_readonly" as never, { query: sql } as never).single();

        // Fallback: RPC não existe no banco
        if (error && error.code === "PGRST202") {
          return {
            content: [{
              type: "text" as const,
              text: `❌ A função execute_sql_readonly não existe no banco.\n\nPara habilitar SQL ad-hoc, execute no Supabase SQL editor:\n\n\`\`\`sql\nCREATE OR REPLACE FUNCTION execute_sql_readonly(query text)\nRETURNS json\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $$\nDECLARE\n  result json;\nBEGIN\n  EXECUTE 'SELECT json_agg(t) FROM (' || query || ') t' INTO result;\n  RETURN result;\nEND;\n$$;\n\`\`\``,
            }],
          };
        }

        if (error) return errorResult(error);

        const rows = Array.isArray(data) ? data : (data ? [data] : []);
        const response = {
          descricao: params.descricao,
          sql_executado: sql,
          total_linhas: rows.length,
          rows,
        };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN && rows.length > 0) {
          const cols = Object.keys(rows[0] as object);
          const header = `| ${cols.join(" | ")} |`;
          const sep = `| ${cols.map(() => "---").join(" | ")} |`;
          const rowLines = rows.slice(0, 50).map(row => {
            const r = row as Record<string, unknown>;
            return `| ${cols.map(c => String(r[c] ?? "—")).join(" | ")} |`;
          });
          text = [
            `## Resultado: ${params.descricao}`,
            `_${rows.length} linhas retornadas_`,
            "",
            header, sep, ...rowLines,
            rows.length > 50 ? `\n_Mostrando 50/${rows.length} linhas. Use JSON para resultado completo._` : "",
          ].join("\n");
        } else {
          text = JSON.stringify(response, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, rows.length) }],
          structuredContent: response,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_health_check ────────────────────────────────────────────────────

  server.registerTool(
    "croma_health_check",
    {
      title: "Health Check do Sistema",
      description: `Verifica o status de saúde do sistema da Croma Print.

Checa: conectividade Supabase, contagem de registros principais,
status geral do ERP.

Use para "status do sistema", "o ERP está ok", "saúde do banco".

Args:
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const sb = getSupabaseClient();
        const inicio = Date.now();

        // Testa conectividade e conta registros das tabelas principais
        const checks = await Promise.allSettled([
          sb.from("clientes").select("id", { count: "exact", head: true }),
          sb.from("pedidos").select("id", { count: "exact", head: true }),
          sb.from("propostas").select("id", { count: "exact", head: true }),
          sb.from("ordens_producao").select("id", { count: "exact", head: true }).not("status", "in", '("concluido","cancelado")'),
          sb.from("contas_receber").select("id", { count: "exact", head: true }).in("status", ["aberto", "parcial"]),
          sb.from("materiais").select("id", { count: "exact", head: true }).eq("ativo", true),
          sb.from("profiles").select("id", { count: "exact", head: true }),
        ]);

        const latencia = Date.now() - inicio;
        const agora = new Date().toISOString();

        const [clientesR, pedidosR, propostasR, opsR, crR, materiaisR, usersR] = checks;

        const tabelas = [
          { nome: "clientes", count: clientesR.status === "fulfilled" ? clientesR.value.count : null, ok: clientesR.status === "fulfilled" },
          { nome: "pedidos (total)", count: pedidosR.status === "fulfilled" ? pedidosR.value.count : null, ok: pedidosR.status === "fulfilled" },
          { nome: "propostas (total)", count: propostasR.status === "fulfilled" ? propostasR.value.count : null, ok: propostasR.status === "fulfilled" },
          { nome: "OPs ativas", count: opsR.status === "fulfilled" ? opsR.value.count : null, ok: opsR.status === "fulfilled" },
          { nome: "C/R em aberto", count: crR.status === "fulfilled" ? crR.value.count : null, ok: crR.status === "fulfilled" },
          { nome: "materiais ativos", count: materiaisR.status === "fulfilled" ? materiaisR.value.count : null, ok: materiaisR.status === "fulfilled" },
          { nome: "usuários", count: usersR.status === "fulfilled" ? usersR.value.count : null, ok: usersR.status === "fulfilled" },
        ];

        const todasOk = tabelas.every(t => t.ok);
        const healthData = {
          status: todasOk ? "ok" : "degradado",
          timestamp: agora,
          latencia_ms: latencia,
          supabase_url: "djwjmfgplnqyffdcgdaw.supabase.co",
          tabelas,
        };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          text = [
            `# Health Check — Croma Print ERP`,
            `**Status**: ${todasOk ? "✅ Operacional" : "⚠️ Degradado"}`,
            `**Verificado em**: ${formatDateTime(agora)}`,
            `**Latência**: ${latencia}ms`,
            "",
            "## Tabelas Principais",
            ...tabelas.map(t =>
              `- ${t.ok ? "✅" : "❌"} **${t.nome}**: ${t.count !== null ? t.count?.toLocaleString("pt-BR") : "erro"}`
            ),
          ].join("\n");
        } else {
          text = JSON.stringify(healthData, null, 2);
        }

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: healthData,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

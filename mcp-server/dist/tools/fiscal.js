/**
 * Ferramentas Fiscais — NF-e
 * Listar, emitir e consultar documentos fiscais via Edge Functions Supabase
 */
import { z } from "zod";
import { getAdminClient, SUPABASE_URL } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatBRL, formatDate, formatStatus } from "../utils/formatting.js";
export function registerFiscalTools(server) {
    // ─── croma_listar_nfe ──────────────────────────────────────────────────────
    server.registerTool("croma_listar_nfe", {
        title: "Listar NF-e",
        description: `Lista documentos fiscais (NF-e) emitidos ou em processo de emissão.

Use para "NF-e do pedido X", "notas autorizadas do mês", "NFs com erro de transmissão".

Args:
  - pedido_id (string, opcional): UUID do pedido
  - status (string, opcional): rascunho|validando|apto|emitindo|autorizado|rejeitado|cancelado|erro_transmissao
  - tipo_documento (string, opcional): nfe|nfse
  - limit (number): Padrão 20
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
        inputSchema: z.object({
            pedido_id: z.string().uuid().optional(),
            status: z.enum(["rascunho", "validando", "apto", "emitindo", "autorizado", "rejeitado", "cancelado", "denegado", "inutilizado", "erro_transmissao"]).optional(),
            tipo_documento: z.enum(["nfe", "nfse"]).optional(),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            offset: z.coerce.number().int().min(0).default(0),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getAdminClient();
            let query = sb
                .from("fiscal_documentos")
                .select(`id, tipo_documento, status, numero, chave_acesso, valor_total,
             data_emissao, data_autorizacao, mensagem_erro, natureza_operacao,
             pedidos!fiscal_documentos_pedido_id_fkey(numero), clientes(razao_social, nome_fantasia)`, { count: "exact" });
            if (params.pedido_id)
                query = query.eq("pedido_id", params.pedido_id);
            if (params.status)
                query = query.eq("status", params.status);
            if (params.tipo_documento)
                query = query.eq("tipo_documento", params.tipo_documento);
            query = query
                .order("created_at", { ascending: false })
                .range(params.offset, params.offset + params.limit - 1);
            const { data, error, count } = await query;
            if (error)
                return errorResult(error);
            const items = data ?? [];
            const total = count ?? items.length;
            const response = buildPaginatedResponse(items, total, params.offset, params.limit);
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const lines = [`## Documentos Fiscais (${total})`, ""];
                if (items.length === 0) {
                    lines.push("_Nenhum documento fiscal encontrado._");
                }
                else {
                    for (const doc of items) {
                        const pedido = doc.pedidos ?? {};
                        const cliente = doc.clientes ?? {};
                        const nomeCliente = cliente.nome_fantasia ?? cliente.razao_social ?? "—";
                        lines.push(`### ${doc.tipo_documento?.toUpperCase() ?? "NF-e"} ${doc.numero ? `Nº ${doc.numero}` : "(sem número)"} — ${nomeCliente}`);
                        if (pedido.numero)
                            lines.push(`- **Pedido**: ${pedido.numero}`);
                        lines.push(`- **Status**: ${formatStatus(doc.status)}`);
                        lines.push(`- **Valor**: ${formatBRL(doc.valor_total ?? 0)}`);
                        if (doc.data_emissao)
                            lines.push(`- **Emissão**: ${formatDate(doc.data_emissao)}`);
                        if (doc.data_autorizacao)
                            lines.push(`- **Autorização**: ${formatDate(doc.data_autorizacao)}`);
                        if (doc.chave_acesso)
                            lines.push(`- **Chave**: \`${doc.chave_acesso.slice(0, 20)}...\``);
                        if (doc.mensagem_erro)
                            lines.push(`- **Erro**: ${doc.mensagem_erro}`);
                        lines.push("");
                    }
                    if (response.has_more)
                        lines.push(`_Mais resultados. Use offset: ${response.next_offset}._`);
                }
                text = lines.join("\n");
            }
            else {
                text = JSON.stringify(response, null, 2);
            }
            return {
                content: [{ type: "text", text: truncateIfNeeded(text, items.length) }],
                structuredContent: response,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_emitir_nfe ──────────────────────────────────────────────────────
    server.registerTool("croma_emitir_nfe", {
        title: "Emitir NF-e",
        description: `Solicita emissão de NF-e para um pedido via Edge Function.

NOTA: O sistema opera em homologação SEFAZ. NF-es emitidas são de teste.
ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - pedido_id (string, obrigatório): UUID do pedido para emitir NF-e`,
        inputSchema: z.object({
            pedido_id: z.string().uuid(),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!serviceRoleKey)
                return { content: [{ type: "text", text: "❌ SUPABASE_SERVICE_ROLE_KEY não configurada." }] };
            const response = await fetch(`${SUPABASE_URL}/functions/v1/fiscal-emitir-nfe`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${serviceRoleKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ pedido_id: params.pedido_id }),
            });
            const result = await response.json();
            if (!response.ok) {
                return {
                    content: [{
                            type: "text",
                            text: `❌ Erro ao emitir NF-e (${response.status}): ${JSON.stringify(result)}`,
                        }],
                };
            }
            return {
                content: [{
                        type: "text",
                        text: `✅ NF-e enviada para processamento!\n\n${JSON.stringify(result, null, 2)}`,
                    }],
                structuredContent: result,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_consultar_status_nfe ────────────────────────────────────────────
    server.registerTool("croma_consultar_status_nfe", {
        title: "Consultar Status NF-e",
        description: `Consulta status de uma NF-e na SEFAZ via Edge Function.

Args:
  - documento_id (string, obrigatório): UUID do documento fiscal (fiscal_documentos.id)`,
        inputSchema: z.object({
            documento_id: z.string().uuid(),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!serviceRoleKey)
                return { content: [{ type: "text", text: "❌ SUPABASE_SERVICE_ROLE_KEY não configurada." }] };
            const response = await fetch(`${SUPABASE_URL}/functions/v1/fiscal-consultar-nfe`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${serviceRoleKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ documento_id: params.documento_id }),
            });
            const result = await response.json();
            if (!response.ok) {
                return {
                    content: [{
                            type: "text",
                            text: `❌ Erro ao consultar NF-e (${response.status}): ${JSON.stringify(result)}`,
                        }],
                };
            }
            return {
                content: [{
                        type: "text",
                        text: `✅ Status consultado:\n\n${JSON.stringify(result, null, 2)}`,
                    }],
                structuredContent: result,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
}
//# sourceMappingURL=fiscal.js.map
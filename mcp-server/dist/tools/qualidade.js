/**
 * Ferramentas de Qualidade
 * Gerenciar ocorrências de qualidade (retrabalho, devoluções, erros)
 */
import { z } from "zod";
import { getAdminClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatDate, formatStatus, formatBRL } from "../utils/formatting.js";
export function registerQualidadeTools(server) {
    // ─── croma_listar_ocorrencias ──────────────────────────────────────────────
    server.registerTool("croma_listar_ocorrencias", {
        title: "Listar Ocorrências de Qualidade",
        description: `Lista ocorrências de qualidade (retrabalho, devoluções, erros de produção/instalação).

Use para "ocorrências abertas", "retrabalhos do mês", "erros de produção".

Args:
  - status (string, opcional): aberta|em_analise|em_tratativa|resolvida|encerrada
  - tipo (string, opcional): retrabalho|devolucao|erro_producao|erro_instalacao|divergencia_cliente
  - pedido_id (string, opcional): UUID do pedido
  - limit (number): Padrão 20
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
        inputSchema: z.object({
            status: z.enum(["aberta", "em_analise", "em_tratativa", "resolvida", "encerrada"]).optional(),
            tipo: z.enum(["retrabalho", "devolucao", "erro_producao", "erro_instalacao", "divergencia_cliente"]).optional(),
            pedido_id: z.string().uuid().optional(),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            offset: z.coerce.number().int().min(0).default(0),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getAdminClient();
            let query = sb
                .from("ocorrencias")
                .select(`id, tipo, status, descricao, causa, custo_total, impacto_prazo_dias, created_at,
             pedidos(numero)`, { count: "exact" });
            if (params.status)
                query = query.eq("status", params.status);
            if (params.tipo)
                query = query.eq("tipo", params.tipo);
            if (params.pedido_id)
                query = query.eq("pedido_id", params.pedido_id);
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
                const lines = [`## Ocorrências de Qualidade (${total})`, ""];
                if (items.length === 0) {
                    lines.push("_Nenhuma ocorrência encontrada._");
                }
                else {
                    for (const oc of items) {
                        const pedido = oc.pedidos ?? {};
                        lines.push(`### ${oc.tipo?.replace(/_/g, " ")} — ${formatStatus(oc.status)}`);
                        if (pedido.numero)
                            lines.push(`- **Pedido**: ${pedido.numero}`);
                        lines.push(`- **Descrição**: ${oc.descricao}`);
                        if (oc.causa)
                            lines.push(`- **Causa**: ${oc.causa?.replace(/_/g, " ")}`);
                        if (oc.custo_total && oc.custo_total > 0)
                            lines.push(`- **Custo**: ${formatBRL(oc.custo_total)}`);
                        if (oc.impacto_prazo_dias)
                            lines.push(`- **Impacto prazo**: ${oc.impacto_prazo_dias} dias`);
                        lines.push(`- **Criada**: ${formatDate(oc.created_at)}`);
                        lines.push(`- **ID**: \`${oc.id}\``);
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
    // ─── croma_criar_ocorrencia ────────────────────────────────────────────────
    server.registerTool("croma_criar_ocorrencia", {
        title: "Criar Ocorrência de Qualidade",
        description: `Registra uma ocorrência de qualidade (retrabalho, devolução, erro).

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - tipo (string, obrigatório): retrabalho|devolucao|erro_producao|erro_instalacao|divergencia_cliente
  - descricao (string, obrigatório): Descrição detalhada do problema
  - pedido_id (string, opcional): UUID do pedido relacionado
  - ordem_producao_id (string, opcional): UUID da OP relacionada
  - causa (string, opcional): material_defeituoso|erro_operacional|erro_projeto|instrucao_incorreta|outro
  - custo_mp (number, opcional): Custo de material perdido
  - custo_mo (number, opcional): Custo de mão de obra extra
  - impacto_prazo_dias (number, opcional): Dias de atraso gerados`,
        inputSchema: z.object({
            tipo: z.enum(["retrabalho", "devolucao", "erro_producao", "erro_instalacao", "divergencia_cliente"]),
            descricao: z.string().min(1).max(1000),
            pedido_id: z.string().uuid().optional(),
            ordem_producao_id: z.string().uuid().optional(),
            causa: z.enum(["material_defeituoso", "erro_operacional", "erro_projeto", "instrucao_incorreta", "outro"]).optional(),
            custo_mp: z.coerce.number().min(0).optional(),
            custo_mo: z.coerce.number().min(0).optional(),
            impacto_prazo_dias: z.coerce.number().int().min(0).optional(),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getUserClient();
            const custoTotal = (params.custo_mp ?? 0) + (params.custo_mo ?? 0);
            const { data: oc, error } = await sb
                .from("ocorrencias")
                .insert({
                tipo: params.tipo,
                descricao: params.descricao,
                pedido_id: params.pedido_id || null,
                ordem_producao_id: params.ordem_producao_id || null,
                causa: params.causa || null,
                status: "aberta",
                custo_mp: params.custo_mp ?? 0,
                custo_mo: params.custo_mo ?? 0,
                custo_total: custoTotal,
                impacto_prazo_dias: params.impacto_prazo_dias ?? 0,
            })
                .select()
                .single();
            if (error)
                return errorResult(error);
            return {
                content: [{
                        type: "text",
                        text: `✅ Ocorrência registrada!\n\n- **ID**: \`${oc.id}\`\n- **Tipo**: ${params.tipo.replace(/_/g, " ")}\n- **Status**: Aberta\n- **Custo total**: ${formatBRL(custoTotal)}`,
                    }],
                structuredContent: oc,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_atualizar_ocorrencia ────────────────────────────────────────────
    server.registerTool("croma_atualizar_ocorrencia", {
        title: "Atualizar Ocorrência de Qualidade",
        description: `Atualiza status e/ou resolução de uma ocorrência.

Transições válidas:
- aberta → em_analise, em_tratativa
- em_analise → em_tratativa, resolvida
- em_tratativa → resolvida
- resolvida → encerrada

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - id (string, obrigatório): UUID da ocorrência
  - status (string, obrigatório): Novo status
  - observacoes (string, opcional): Observações sobre a resolução`,
        inputSchema: z.object({
            id: z.string().uuid(),
            status: z.enum(["em_analise", "em_tratativa", "resolvida", "encerrada"]),
            observacoes: z.string().max(500).optional(),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getUserClient();
            const { data: atual, error: fetchErr } = await sb
                .from("ocorrencias")
                .select("id, tipo, status")
                .eq("id", params.id)
                .single();
            if (fetchErr)
                return errorResult(fetchErr);
            if (!atual)
                return { content: [{ type: "text", text: `Ocorrência não encontrada: ${params.id}` }] };
            const updateData = {
                status: params.status,
                updated_at: new Date().toISOString(),
            };
            const { error } = await sb
                .from("ocorrencias")
                .update(updateData)
                .eq("id", params.id)
                .select()
                .single();
            if (error)
                return errorResult(error);
            return {
                content: [{
                        type: "text",
                        text: `✅ Ocorrência atualizada: ${formatStatus(atual.status)} → **${formatStatus(params.status)}**${params.observacoes ? `\nObs: ${params.observacoes}` : ""}`,
                    }],
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
}
//# sourceMappingURL=qualidade.js.map
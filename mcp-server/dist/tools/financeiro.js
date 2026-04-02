/**
 * Ferramentas Financeiras
 * Consultar contas a receber e contas a pagar
 */
import { z } from "zod";
import { getSupabaseClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatBRL, formatDate, formatStatus, isVencido, diasAtraso } from "../utils/formatting.js";
export function registerFinanceiroTools(server) {
    // ─── croma_listar_contas_receber ───────────────────────────────────────────
    server.registerTool("croma_listar_contas_receber", {
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
            limit: z.coerce.number().int().min(1).max(100).default(30),
            offset: z.coerce.number().int().min(0).default(0),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getSupabaseClient();
            let query = sb
                .from("contas_receber")
                .select(`id, numero_titulo, valor_original, valor_pago, saldo, data_vencimento,
             data_pagamento, status, forma_pagamento, observacoes, created_at,
             clientes!inner(id, razao_social, nome_fantasia),
             pedidos(numero)`, { count: "exact" });
            if (params.status)
                query = query.eq("status", params.status);
            if (params.cliente_id)
                query = query.eq("cliente_id", params.cliente_id);
            if (params.forma_pagamento)
                query = query.eq("forma_pagamento", params.forma_pagamento);
            if (params.vencendo_de)
                query = query.gte("data_vencimento", params.vencendo_de);
            if (params.vencendo_ate)
                query = query.lte("data_vencimento", params.vencendo_ate);
            if (params.apenas_vencidos) {
                query = query
                    .lt("data_vencimento", new Date().toISOString().split("T")[0])
                    .in("status", ["aberto", "parcial"]);
            }
            if (params.cliente_busca) {
                query = query.or(`clientes.razao_social.ilike.%${params.cliente_busca}%,clientes.nome_fantasia.ilike.%${params.cliente_busca}%`);
            }
            query = query
                .order("data_vencimento", { ascending: true })
                .range(params.offset, params.offset + params.limit - 1);
            const { data, error, count } = await query;
            if (error)
                return errorResult(error);
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
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const lines = [
                    `## Contas a Receber (${total} títulos)`,
                    `**Total em aberto**: ${formatBRL(totalAberto)} | **Total pago**: ${formatBRL(totalPago)}`,
                    "",
                ];
                if (items.length === 0) {
                    lines.push("_Nenhum título encontrado._");
                }
                else {
                    for (const cr of items) {
                        const cliente = cr.clientes ?? {};
                        const pedido = cr.pedidos ?? {};
                        const nomeCliente = cliente.nome_fantasia ?? cliente.razao_social ?? "—";
                        const vencido = isVencido(cr.data_vencimento) && ["aberto", "parcial"].includes(cr.status);
                        const atraso = vencido ? diasAtraso(cr.data_vencimento) : 0;
                        lines.push(`### ${cr.numero_titulo ?? cr.id.slice(0, 8)} — ${nomeCliente}${vencido ? ` ⚠️ ${atraso}d atraso` : ""}`);
                        if (pedido.numero)
                            lines.push(`- **Pedido**: ${pedido.numero}`);
                        lines.push(`- **Status**: ${formatStatus(cr.status)}`);
                        lines.push(`- **Valor original**: ${formatBRL(cr.valor_original)}`);
                        if (cr.valor_pago && cr.valor_pago > 0)
                            lines.push(`- **Pago**: ${formatBRL(cr.valor_pago)}`);
                        if (cr.saldo && cr.saldo > 0)
                            lines.push(`- **Saldo**: ${formatBRL(cr.saldo)}`);
                        lines.push(`- **Vencimento**: ${formatDate(cr.data_vencimento)}${vencido ? " ⚠️" : ""}`);
                        if (cr.data_pagamento)
                            lines.push(`- **Pago em**: ${formatDate(cr.data_pagamento)}`);
                        if (cr.forma_pagamento)
                            lines.push(`- **Forma**: ${cr.forma_pagamento}`);
                        lines.push("");
                    }
                    if (response.has_more)
                        lines.push(`_Mais resultados. Use offset: ${response.next_offset}._`);
                }
                text = lines.join("\n");
            }
            else {
                text = JSON.stringify({ ...response, totalizadores: { total_aberto: totalAberto, total_pago: totalPago } }, null, 2);
            }
            return {
                content: [{ type: "text", text: truncateIfNeeded(text, items.length) }],
                structuredContent: { ...response, totalizadores: { total_aberto: totalAberto, total_pago: totalPago } },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_listar_contas_pagar ─────────────────────────────────────────────
    server.registerTool("croma_listar_contas_pagar", {
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
            limit: z.coerce.number().int().min(1).max(100).default(30),
            offset: z.coerce.number().int().min(0).default(0),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getSupabaseClient();
            let query = sb
                .from("contas_pagar")
                .select(`id, numero_titulo, valor_original, valor_pago, saldo,
             data_vencimento, data_pagamento, status, categoria, fornecedor_id, created_at,
             fornecedores(razao_social, nome_fantasia)`, { count: "exact" });
            if (params.status)
                query = query.eq("status", params.status);
            if (params.categoria)
                query = query.ilike("categoria", `%${params.categoria}%`);
            if (params.vencendo_de)
                query = query.gte("data_vencimento", params.vencendo_de);
            if (params.vencendo_ate)
                query = query.lte("data_vencimento", params.vencendo_ate);
            if (params.apenas_vencidos) {
                query = query
                    .lt("data_vencimento", new Date().toISOString().split("T")[0])
                    .in("status", ["aberto", "vencido"]);
            }
            query = query
                .order("data_vencimento", { ascending: true })
                .range(params.offset, params.offset + params.limit - 1);
            const { data, error, count } = await query;
            if (error)
                return errorResult(error);
            const items = data ?? [];
            const total = count ?? items.length;
            const response = buildPaginatedResponse(items, total, params.offset, params.limit);
            const totalAberto = items
                .filter(i => ["aberto", "vencido"].includes(i.status))
                .reduce((sum, i) => sum + (i.saldo ?? i.valor_original), 0);
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const lines = [
                    `## Contas a Pagar (${total} títulos)`,
                    `**Total em aberto**: ${formatBRL(totalAberto)}`,
                    "",
                ];
                if (items.length === 0) {
                    lines.push("_Nenhuma conta encontrada._");
                }
                else {
                    for (const cp of items) {
                        const fornecedor = cp.fornecedores ?? {};
                        const nomeFornecedor = fornecedor.nome_fantasia ?? fornecedor.razao_social ?? "—";
                        const vencido = isVencido(cp.data_vencimento) && ["aberto", "vencido"].includes(cp.status);
                        const atraso = vencido ? diasAtraso(cp.data_vencimento) : 0;
                        const titulo = cp.numero_titulo ?? cp.categoria ?? cp.id.slice(0, 8);
                        lines.push(`### ${titulo}${vencido ? ` ⚠️ ${atraso}d atraso` : ""}`);
                        if (cp.fornecedor_id)
                            lines.push(`- **Fornecedor**: ${nomeFornecedor}`);
                        if (cp.categoria)
                            lines.push(`- **Categoria**: ${cp.categoria}`);
                        lines.push(`- **Status**: ${formatStatus(cp.status)}`);
                        lines.push(`- **Valor**: ${formatBRL(cp.valor_original)}`);
                        if (cp.saldo && cp.saldo > 0)
                            lines.push(`- **Saldo**: ${formatBRL(cp.saldo)}`);
                        lines.push(`- **Vencimento**: ${formatDate(cp.data_vencimento)}${vencido ? " ⚠️" : ""}`);
                        if (cp.data_pagamento)
                            lines.push(`- **Pago em**: ${formatDate(cp.data_pagamento)}`);
                        lines.push("");
                    }
                    if (response.has_more)
                        lines.push(`_Mais resultados. Use offset: ${response.next_offset}._`);
                }
                text = lines.join("\n");
            }
            else {
                text = JSON.stringify({ ...response, total_aberto: totalAberto }, null, 2);
            }
            return {
                content: [{ type: "text", text: truncateIfNeeded(text, items.length) }],
                structuredContent: { ...response, total_aberto: totalAberto },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_registrar_pagamento_cp ──────────────────────────────────────────
    server.registerTool("croma_registrar_pagamento_cp", {
        title: "Registrar Pagamento de Conta a Pagar",
        description: `Registra pagamento (total ou parcial) de uma conta a pagar.

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - id (string, obrigatório): UUID da conta a pagar
  - valor_pago (number, obrigatório): Valor pago nesta operação
  - data_pagamento (string, obrigatório): Data do pagamento (ISO: YYYY-MM-DD)
  - forma_pagamento (string, opcional): boleto|pix|cartao|transferencia|dinheiro`,
        inputSchema: z.object({
            id: z.string().uuid(),
            valor_pago: z.coerce.number().positive(),
            data_pagamento: z.string(),
            forma_pagamento: z.enum(["boleto", "pix", "cartao", "transferencia", "dinheiro"]).optional(),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getUserClient();
            const { data: cp, error: fetchErr } = await sb
                .from("contas_pagar")
                .select("id, numero_titulo, valor_original, valor_pago, saldo, status")
                .eq("id", params.id)
                .single();
            if (fetchErr)
                return errorResult(fetchErr);
            if (!cp)
                return { content: [{ type: "text", text: `Conta a pagar não encontrada: ${params.id}` }] };
            const valorPagoAnterior = cp.valor_pago ?? 0;
            const totalPago = valorPagoAnterior + params.valor_pago;
            const novoSaldo = (cp.valor_original ?? 0) - totalPago;
            const novoStatus = novoSaldo <= 0 ? "pago" : "aberto";
            const { error } = await sb
                .from("contas_pagar")
                .update({
                valor_pago: totalPago,
                saldo: Math.max(0, novoSaldo),
                data_pagamento: params.data_pagamento,
                status: novoStatus,
                ...(params.forma_pagamento ? { forma_pagamento: params.forma_pagamento } : {}),
            })
                .eq("id", params.id)
                .select()
                .single();
            if (error)
                return errorResult(error);
            return {
                content: [{
                        type: "text",
                        text: `✅ Pagamento registrado!\n\n- **Título**: ${cp.numero_titulo ?? params.id.slice(0, 8)}\n- **Valor pago agora**: R$ ${params.valor_pago.toFixed(2)}\n- **Total pago**: R$ ${totalPago.toFixed(2)}\n- **Saldo**: R$ ${Math.max(0, novoSaldo).toFixed(2)}\n- **Status**: ${novoStatus}`,
                    }],
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_criar_conta_receber ─────────────────────────────────────────────
    server.registerTool("croma_criar_conta_receber", {
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
            pedido_id: z.string().uuid().optional(),
            cliente_id: z.string().uuid(),
            valor_original: z.coerce.number().positive(),
            data_vencimento: z.string(),
            forma_pagamento: z.enum(["boleto", "pix", "cartao", "transferencia", "dinheiro"]).optional(),
            observacoes: z.string().max(500).optional(),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
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
                            type: "text",
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
                status: "a_vencer",
                forma_pagamento: params.forma_pagamento || null,
                observacoes: params.observacoes || null,
            })
                .select()
                .single();
            if (error)
                return errorResult(error);
            return {
                content: [{
                        type: "text",
                        text: `✅ Conta a receber criada!\n\n- **ID**: \`${cr.id}\`\n- **Valor**: R$ ${params.valor_original.toFixed(2)}\n- **Vencimento**: ${params.data_vencimento}\n- **Status**: Aberto`,
                    }],
                structuredContent: cr,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_registrar_pagamento ─────────────────────────────────────────────
    server.registerTool("croma_registrar_pagamento", {
        title: "Registrar Pagamento de Conta a Receber",
        description: `Registra pagamento (total ou parcial) de uma conta a receber.

Lógica automática:
- Se valor_pago >= saldo → status = "pago", saldo = 0
- Se valor_pago < saldo → status = "parcial", saldo reduzido

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - id (string, obrigatório): UUID da conta a receber
  - valor_pago (number, obrigatório): Valor recebido nesta operação
  - data_pagamento (string, obrigatório): Data do pagamento (ISO: YYYY-MM-DD)
  - forma_pagamento (string, opcional): boleto|pix|cartao|transferencia|dinheiro`,
        inputSchema: z.object({
            id: z.string().uuid(),
            valor_pago: z.coerce.number().positive(),
            data_pagamento: z.string(),
            forma_pagamento: z.enum(["boleto", "pix", "cartao", "transferencia", "dinheiro"]).optional(),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getUserClient();
            const { data: cr, error: fetchErr } = await sb
                .from("contas_receber")
                .select("id, numero_titulo, valor_original, valor_pago, saldo, status")
                .eq("id", params.id)
                .single();
            if (fetchErr)
                return errorResult(fetchErr);
            if (!cr)
                return { content: [{ type: "text", text: `Conta a receber não encontrada: ${params.id}` }] };
            const valorPagoAnterior = cr.valor_pago ?? 0;
            const totalPago = valorPagoAnterior + params.valor_pago;
            const saldoAtual = cr.saldo ?? cr.valor_original ?? 0;
            const novoSaldo = Math.max(0, saldoAtual - params.valor_pago);
            const novoStatus = novoSaldo <= 0 ? "pago" : "parcial";
            const { error } = await sb
                .from("contas_receber")
                .update({
                valor_pago: totalPago,
                saldo: novoSaldo,
                data_pagamento: params.data_pagamento,
                status: novoStatus,
                ...(params.forma_pagamento ? { forma_pagamento: params.forma_pagamento } : {}),
            })
                .eq("id", params.id)
                .select()
                .single();
            if (error)
                return errorResult(error);
            return {
                content: [{
                        type: "text",
                        text: `✅ Pagamento registrado!\n\n- **Título**: ${cr.numero_titulo ?? params.id.slice(0, 8)}\n- **Valor recebido agora**: R$ ${params.valor_pago.toFixed(2)}\n- **Total recebido**: R$ ${totalPago.toFixed(2)}\n- **Saldo restante**: R$ ${novoSaldo.toFixed(2)}\n- **Status**: ${novoStatus}`,
                    }],
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_criar_conta_pagar ───────────────────────────────────────────────
    server.registerTool("croma_criar_conta_pagar", {
        title: "Criar Conta a Pagar",
        description: `Cria um título a pagar (despesa, fornecedor, salário, etc.).

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - valor_original (number, obrigatório): Valor do título em R$
  - data_vencimento (string, obrigatório): Data ISO do vencimento (YYYY-MM-DD)
  - categoria (string, obrigatório): Ex: fornecedor, aluguel, salario, insumo
  - fornecedor_id (string, opcional): UUID do fornecedor
  - numero_titulo (string, opcional): Número do documento/NF
  - forma_pagamento (string, opcional): boleto|pix|cartao|transferencia|dinheiro
  - observacoes (string, opcional): Observações`,
        inputSchema: z.object({
            valor_original: z.coerce.number().positive(),
            data_vencimento: z.string(),
            categoria: z.string().max(100),
            fornecedor_id: z.string().uuid().optional(),
            numero_titulo: z.string().max(50).optional(),
            forma_pagamento: z.enum(["boleto", "pix", "cartao", "transferencia", "dinheiro"]).optional(),
            observacoes: z.string().max(500).optional(),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getUserClient();
            const { data: cp, error } = await sb
                .from("contas_pagar")
                .insert({
                valor_original: params.valor_original,
                saldo: params.valor_original,
                data_emissao: new Date().toISOString().split("T")[0],
                data_vencimento: params.data_vencimento,
                categoria: params.categoria,
                status: "a_pagar",
                fornecedor_id: params.fornecedor_id || null,
                numero_titulo: params.numero_titulo || null,
                forma_pagamento: params.forma_pagamento || null,
                observacoes: params.observacoes || null,
            })
                .select()
                .single();
            if (error)
                return errorResult(error);
            return {
                content: [{
                        type: "text",
                        text: `✅ Conta a pagar criada!\n\n- **ID**: \`${cp.id}\`\n- **Categoria**: ${params.categoria}\n- **Valor**: R$ ${params.valor_original.toFixed(2)}\n- **Vencimento**: ${params.data_vencimento}\n- **Status**: Aberto`,
                    }],
                structuredContent: cp,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_registrar_lancamento_caixa ──────────────────────────────────────
    server.registerTool("croma_registrar_lancamento_caixa", {
        title: "Registrar Lançamento de Caixa",
        description: `Registra uma entrada ou saída manual no fluxo de caixa.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - tipo (string, obrigatório): 'entrada' ou 'saida'
  - valor (number, obrigatório): Valor em R$
  - categoria (string, obrigatório): Categoria do lançamento (ex: Venda, Despesa Operacional, Salário)
  - descricao (string, obrigatório): Descrição do lançamento
  - data_lancamento (string, opcional): Data YYYY-MM-DD — padrão: hoje
  - conta_receber_id (string, opcional): UUID da CR vinculada
  - conta_pagar_id (string, opcional): UUID da CP vinculada
  - centro_custo_id (string, opcional): UUID do centro de custo
  - observacoes (string, opcional): Observações`,
        inputSchema: z.object({
            tipo: z.enum(["entrada", "saida"]),
            valor: z.coerce.number().positive(),
            categoria: z.string().min(1).max(100),
            descricao: z.string().min(3).max(300),
            data_lancamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD — padrão: hoje"),
            conta_receber_id: z.string().uuid().optional(),
            conta_pagar_id: z.string().uuid().optional(),
            centro_custo_id: z.string().uuid().optional(),
            observacoes: z.string().max(500).optional(),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getUserClient();
            const { data, error } = await sb
                .from("lancamentos_caixa")
                .insert({
                tipo: params.tipo,
                valor: params.valor,
                categoria: params.categoria,
                descricao: params.descricao,
                data_lancamento: params.data_lancamento ?? new Date().toISOString().split("T")[0],
                conta_receber_id: params.conta_receber_id ?? null,
                conta_pagar_id: params.conta_pagar_id ?? null,
                centro_custo_id: params.centro_custo_id ?? null,
                observacoes: params.observacoes ?? null,
            })
                .select()
                .single();
            if (error)
                return errorResult(error);
            const tipoIcon = params.tipo === "entrada" ? "🟢 Entrada" : "🔴 Saída";
            return {
                content: [{
                        type: "text",
                        text: `✅ Lançamento registrado!\n\n- **ID**: \`${data.id}\`\n- **Tipo**: ${tipoIcon}\n- **Valor**: **${formatBRL(data.valor)}**\n- **Categoria**: ${data.categoria}\n- **Descrição**: ${data.descricao}\n- **Data**: ${formatDate(data.data_lancamento)}`,
                    }],
                structuredContent: data,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_listar_lancamentos_caixa ───────────────────────────────────────
    server.registerTool("croma_listar_lancamentos_caixa", {
        title: "Listar Lançamentos de Caixa",
        description: `Lista lançamentos do fluxo de caixa com saldo calculado.

Use para "fluxo de caixa do mês", "entradas e saídas", "lançamentos de despesa".

Args:
  - filtro_tipo (string, opcional): 'entrada' ou 'saida'
  - filtro_categoria (string, opcional): Filtrar por categoria
  - data_inicio / data_fim (string, opcional): Período YYYY-MM-DD
  - limit_rows (number): Padrão 50
  - response_format ('markdown'|'json'): Padrão markdown`,
        inputSchema: z.object({
            filtro_tipo: z.enum(["entrada", "saida"]).optional(),
            filtro_categoria: z.string().optional(),
            data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            limit_rows: z.coerce.number().int().min(1).max(500).default(50),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getSupabaseClient();
            let query = sb
                .from("lancamentos_caixa")
                .select("id, tipo, categoria, descricao, valor, data_lancamento, observacoes, created_at", { count: "exact" });
            if (params.filtro_tipo)
                query = query.eq("tipo", params.filtro_tipo);
            if (params.filtro_categoria)
                query = query.ilike("categoria", `%${params.filtro_categoria}%`);
            if (params.data_inicio)
                query = query.gte("data_lancamento", params.data_inicio);
            if (params.data_fim)
                query = query.lte("data_lancamento", params.data_fim);
            query = query.order("data_lancamento", { ascending: false }).limit(params.limit_rows);
            const { data, error, count } = await query;
            if (error)
                return errorResult(error);
            const items = data ?? [];
            const total = count ?? items.length;
            const totalEntradas = items.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
            const totalSaidas = items.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
            const saldo = totalEntradas - totalSaidas;
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const lines = [
                    `## Lançamentos de Caixa (${total})`,
                    `🟢 Entradas: ${formatBRL(totalEntradas)} | 🔴 Saídas: ${formatBRL(totalSaidas)} | **Saldo: ${formatBRL(saldo)}**`,
                    "",
                ];
                if (items.length === 0) {
                    lines.push("_Nenhum lançamento encontrado._");
                }
                else {
                    for (const l of items) {
                        const icon = l.tipo === "entrada" ? "🟢" : "🔴";
                        lines.push(`- ${icon} **${formatBRL(l.valor)}** — ${l.categoria} — ${l.descricao} — ${formatDate(l.data_lancamento)}`);
                    }
                }
                text = lines.join("\n");
            }
            else {
                text = JSON.stringify({ count: total, total_entradas: totalEntradas, total_saidas: totalSaidas, saldo, items }, null, 2);
            }
            return {
                content: [{ type: "text", text: truncateIfNeeded(text, items.length) }],
                structuredContent: { count: total, total_entradas: totalEntradas, total_saidas: totalSaidas, saldo, items },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_listar_contas_bancarias ─────────────────────────────────────────
    server.registerTool("croma_listar_contas_bancarias", {
        title: "Listar Contas Bancárias",
        description: `Lista contas bancárias cadastradas para emissão de boletos.

Use para "contas bancárias", "qual banco está configurado", "dados bancários".

Args:
  - ativo_only (boolean): Apenas ativas (padrão: true)
  - response_format ('markdown'|'json'): Padrão markdown`,
        inputSchema: z.object({
            ativo_only: z.boolean().default(true),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getSupabaseClient();
            let query = sb
                .from("bank_accounts")
                .select("id, nome, banco_codigo, banco_nome, agencia, conta, conta_digito, carteira, cedente_nome, cedente_cnpj, ativo");
            if (params.ativo_only)
                query = query.eq("ativo", true);
            query = query.order("nome");
            const { data, error } = await query;
            if (error)
                return errorResult(error);
            const items = data ?? [];
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const lines = [`## Contas Bancárias (${items.length})`, ""];
                if (items.length === 0) {
                    lines.push("_Nenhuma conta bancária cadastrada._");
                }
                else {
                    for (const b of items) {
                        lines.push(`### ${b.nome} — ${b.banco_nome} (${b.banco_codigo})`);
                        lines.push(`- **ID**: \`${b.id}\``);
                        lines.push(`- **Agência**: ${b.agencia} | **Conta**: ${b.conta}-${b.conta_digito}`);
                        lines.push(`- **Carteira**: ${b.carteira}`);
                        lines.push(`- **Cedente**: ${b.cedente_nome}`);
                        lines.push(`- **Status**: ${b.ativo ? "✅ Ativa" : "❌ Inativa"}`);
                        lines.push("");
                    }
                }
                text = lines.join("\n");
            }
            else {
                text = JSON.stringify({ count: items.length, items }, null, 2);
            }
            return {
                content: [{ type: "text", text }],
                structuredContent: { count: items.length, items },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_gerar_boleto ────────────────────────────────────────────────────
    server.registerTool("croma_gerar_boleto", {
        title: "Gerar Boleto Bancário",
        description: `Gera um boleto bancário vinculado a uma conta a receber.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

O boleto é criado com status "rascunho" — precisa ser transmitido ao banco via sistema.

Args:
  - conta_receber_id (string, obrigatório): UUID da conta a receber
  - banco_id (string, opcional): UUID da conta bancária — usa a primeira ativa se omitido
  - observacoes (string, opcional): Instruções adicionais no boleto`,
        inputSchema: z.object({
            conta_receber_id: z.string().uuid().describe("UUID da conta a receber"),
            banco_id: z.string().uuid().optional().describe("UUID da conta bancária"),
            observacoes: z.string().max(200).optional(),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const sbAdmin = getSupabaseClient();
            const sb = getUserClient();
            // Buscar conta a receber + cliente
            const { data: cr, error: crErr } = await sbAdmin
                .from("contas_receber")
                .select("id, valor_original, data_vencimento, cliente_id, clientes(razao_social, cnpj, endereco, cidade, estado, cep)")
                .eq("id", params.conta_receber_id)
                .single();
            if (crErr)
                return errorResult(crErr);
            if (!cr)
                return { content: [{ type: "text", text: `Conta a receber não encontrada: ${params.conta_receber_id}` }] };
            // Buscar conta bancária
            let bancoId = params.banco_id;
            if (!bancoId) {
                const { data: bancos } = await sbAdmin.from("bank_accounts").select("id").eq("ativo", true).limit(1);
                if (!bancos || bancos.length === 0) {
                    return { content: [{ type: "text", text: "Nenhuma conta bancária ativa cadastrada. Cadastre uma conta bancária primeiro." }] };
                }
                bancoId = bancos[0].id;
            }
            const cliente = cr.clientes;
            // Gerar nosso_numero baseado em timestamp
            const nossoNumero = Date.now().toString().slice(-10);
            const { data: boleto, error: boletoErr } = await sb
                .from("bank_slips")
                .insert({
                bank_account_id: bancoId,
                conta_receber_id: params.conta_receber_id,
                cliente_id: cr.cliente_id,
                nosso_numero: nossoNumero,
                valor_nominal: cr.valor_original,
                data_vencimento: cr.data_vencimento,
                sacado_nome: cliente?.razao_social ?? "Cliente",
                sacado_cpf_cnpj: cliente?.cnpj ?? "00000000000000",
                sacado_endereco: cliente?.endereco ?? null,
                sacado_cidade: cliente?.cidade ?? null,
                sacado_estado: cliente?.estado ?? null,
                sacado_cep: cliente?.cep ?? null,
                instrucoes: params.observacoes ?? null,
                status: "rascunho",
            })
                .select()
                .single();
            if (boletoErr)
                return errorResult(boletoErr);
            return {
                content: [{
                        type: "text",
                        text: `✅ Boleto gerado!\n\n- **ID**: \`${boleto.id}\`\n- **Sacado**: ${boleto.sacado_nome}\n- **Valor**: ${formatBRL(boleto.valor_nominal)}\n- **Vencimento**: ${formatDate(boleto.data_vencimento)}\n- **Nosso número**: ${boleto.nosso_numero}\n- **Status**: Rascunho — aguardando transmissão ao banco`,
                    }],
                structuredContent: boleto,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_consultar_das ──────────────────────────────────────────────────
    server.registerTool("croma_consultar_das", {
        title: "Consultar DAS — Simples Nacional",
        description: `Consulta apurações do DAS (Documento de Arrecadação do Simples Nacional).

Use para "DAS do mês", "quanto de Simples Nacional?", "imposto apurado", "alíquota efetiva".

Args:
  - competencia (string, opcional): Mês YYYY-MM — retorna último mês se omitido
  - response_format ('markdown'|'json'): Padrão markdown`,
        inputSchema: z.object({
            competencia: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Mês YYYY-MM"),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getSupabaseClient();
            let query = sb
                .from("das_apuracoes")
                .select("*");
            if (params.competencia) {
                query = query.gte("competencia", params.competencia + "-01").lte("competencia", params.competencia + "-31");
            }
            else {
                query = query.order("competencia", { ascending: false }).limit(3);
            }
            const { data, error } = await query;
            if (error)
                return errorResult(error);
            const items = data ?? [];
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const lines = [`## DAS — Simples Nacional (${items.length} apuração${items.length !== 1 ? "ões" : ""})`, ""];
                if (items.length === 0) {
                    lines.push("_Nenhuma apuração DAS encontrada._");
                }
                else {
                    for (const d of items) {
                        const mesComp = formatDate(d.competencia).substring(3); // MM/YYYY
                        const statusIcon = d.status === "pago" ? "✅" : d.status === "calculado" ? "⏳" : "📋";
                        lines.push(`### ${statusIcon} Competência: ${mesComp}`);
                        lines.push(`- **Receita bruta no mês**: ${formatBRL(d.receita_bruta_mes)}`);
                        lines.push(`- **RBT12**: ${formatBRL(d.rbt12)}`);
                        lines.push(`- **Anexo**: ${d.anexo} | **Faixa**: ${d.faixa}`);
                        lines.push(`- **Alíquota nominal**: ${d.aliquota_nominal}%`);
                        lines.push(`- **Alíquota efetiva**: **${Number(d.aliquota_efetiva).toFixed(2)}%**`);
                        lines.push(`- **Valor DAS**: **${formatBRL(d.valor_das)}**`);
                        lines.push(`- **Vencimento**: ${formatDate(d.data_vencimento)}`);
                        lines.push(`- **Status**: ${formatStatus(d.status)}`);
                        if (d.data_pagamento)
                            lines.push(`- **Pago em**: ${formatDate(d.data_pagamento)}`);
                        lines.push("");
                    }
                }
                text = lines.join("\n");
            }
            else {
                text = JSON.stringify({ count: items.length, items }, null, 2);
            }
            return {
                content: [{ type: "text", text }],
                structuredContent: { count: items.length, items },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
}
//# sourceMappingURL=financeiro.js.map
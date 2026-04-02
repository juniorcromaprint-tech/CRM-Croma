/**
 * Ferramentas de BI / Relatórios
 * Dashboard executivo, pipeline comercial e alertas do sistema
 */
import { z } from "zod";
import { getSupabaseClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { formatBRL, formatDate } from "../utils/formatting.js";
import { truncateIfNeeded } from "../utils/pagination.js";
export function registerBiTools(server) {
    // ─── croma_dashboard_executivo ─────────────────────────────────────────────
    server.registerTool("croma_dashboard_executivo", {
        title: "Dashboard Executivo",
        description: `Retorna KPIs consolidados da Croma Print: faturamento, produção, comercial, financeiro.

Use para "resumo do mês", "como está a empresa hoje", "KPIs", "faturamento mensal",
"dashboard executivo", "relatório gerencial".

Args:
  - periodo ('hoje'|'semana'|'mes'|'trimestre'): Período de referência (padrão: mes)
  - response_format ('markdown'|'json'): Padrão markdown`,
        inputSchema: z.object({
            periodo: z.enum(["hoje", "semana", "mes", "trimestre"]).default("mes"),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getSupabaseClient();
            const agora = new Date();
            // Calcula datas do período
            let dataInicio;
            if (params.periodo === "hoje") {
                dataInicio = agora.toISOString().split("T")[0];
            }
            else if (params.periodo === "semana") {
                const d = new Date(agora);
                d.setDate(d.getDate() - d.getDay());
                dataInicio = d.toISOString().split("T")[0];
            }
            else if (params.periodo === "mes") {
                dataInicio = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-01`;
            }
            else {
                // trimestre
                const mes = agora.getMonth();
                const inicioTrimestre = Math.floor(mes / 3) * 3;
                dataInicio = `${agora.getFullYear()}-${String(inicioTrimestre + 1).padStart(2, "0")}-01`;
            }
            const dataFim = agora.toISOString();
            // Executa todas as queries em paralelo
            const [propostasResult, pedidosResult, producaoResult, financeiroResult, leadsResult, vencidosResult,] = await Promise.all([
                // Propostas do período
                sb.from("propostas")
                    .select("status, total")
                    .gte("created_at", dataInicio),
                // Pedidos do período
                sb.from("pedidos")
                    .select("status, valor_total, created_at")
                    .gte("created_at", dataInicio),
                // OPs ativas agora
                sb.from("ordens_producao")
                    .select("status")
                    .in("status", ["pendente", "em_andamento", "pausado"]),
                // Recebimentos do período
                sb.from("contas_receber")
                    .select("status, valor_original, valor_pago, saldo, data_vencimento")
                    .gte("created_at", dataInicio),
                // Leads do período
                sb.from("leads")
                    .select("status, created_at")
                    .gte("created_at", dataInicio),
                // Contas vencidas (todas, não só do período)
                sb.from("contas_receber")
                    .select("valor_original, saldo")
                    .lt("data_vencimento", agora.toISOString().split("T")[0])
                    .in("status", ["aberto", "parcial"]),
            ]);
            // ── Processa dados ──────────────────────────────────────────────────
            const propostas = propostasResult.data ?? [];
            const pedidos = pedidosResult.data ?? [];
            const ops = producaoResult.data ?? [];
            const financeiro = financeiroResult.data ?? [];
            const leads = leadsResult.data ?? [];
            const vencidos = vencidosResult.data ?? [];
            // Propostas
            const propostasAprovadas = propostas.filter(p => p.status === "aprovada");
            const propostasEnviadas = propostas.filter(p => ["enviada", "em_revisao"].includes(p.status));
            const totalPropostasAprovadas = propostasAprovadas.reduce((s, p) => s + (p.total ?? 0), 0);
            const totalPropostasAbertas = propostasEnviadas.reduce((s, p) => s + (p.total ?? 0), 0);
            const taxaConversao = propostas.length > 0
                ? Math.round((propostasAprovadas.length / propostas.length) * 100)
                : 0;
            // Pedidos
            const pedidosFaturados = pedidos.filter(p => p.status === "faturado");
            const pedidosEmProducao = pedidos.filter(p => ["em_producao", "producao_concluida"].includes(p.status));
            const faturamento = pedidosFaturados.reduce((s, p) => s + (p.valor_total ?? 0), 0);
            const ticketMedio = pedidosFaturados.length > 0 ? faturamento / pedidosFaturados.length : 0;
            // Produção
            const opsAndamento = ops.filter(o => o.status === "em_andamento").length;
            const opsPendentes = ops.filter(o => o.status === "pendente").length;
            const opsPausadas = ops.filter(o => o.status === "pausado").length;
            // Financeiro
            const recebido = financeiro.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor_pago ?? c.valor_original), 0);
            const aReceber = financeiro.filter(c => ["aberto", "parcial"].includes(c.status)).reduce((s, c) => s + (c.saldo ?? c.valor_original), 0);
            const totalVencido = vencidos.reduce((s, c) => s + (c.saldo ?? c.valor_original), 0);
            // Leads
            const leadsNovos = leads.filter(l => l.status === "novo").length;
            const leadsQualificados = leads.filter(l => l.status === "qualificado").length;
            const kpis = {
                periodo: params.periodo,
                data_inicio: dataInicio,
                comercial: {
                    propostas_criadas: propostas.length,
                    propostas_aprovadas: propostasAprovadas.length,
                    taxa_conversao_pct: taxaConversao,
                    valor_aprovado: totalPropostasAprovadas,
                    valor_pipeline: totalPropostasAbertas,
                    leads_novos: leadsNovos,
                    leads_qualificados: leadsQualificados,
                },
                operacional: {
                    pedidos_criados: pedidos.length,
                    pedidos_faturados: pedidosFaturados.length,
                    pedidos_em_producao: pedidosEmProducao.length,
                    ops_em_andamento: opsAndamento,
                    ops_pendentes: opsPendentes,
                    ops_pausadas: opsPausadas,
                },
                financeiro: {
                    faturamento: faturamento,
                    ticket_medio: ticketMedio,
                    recebido_periodo: recebido,
                    a_receber_periodo: aReceber,
                    total_vencido: totalVencido,
                },
            };
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const periodoLabel = { hoje: "Hoje", semana: "Esta Semana", mes: "Este Mês", trimestre: "Este Trimestre" }[params.periodo];
                text = [
                    `# Dashboard Executivo — ${periodoLabel}`,
                    `_Período: ${formatDate(dataInicio)} até hoje_`,
                    "",
                    "## 💰 Financeiro",
                    `| KPI | Valor |`,
                    `|-----|-------|`,
                    `| Faturamento | ${formatBRL(faturamento)} |`,
                    `| Ticket Médio | ${formatBRL(ticketMedio)} |`,
                    `| Recebido | ${formatBRL(recebido)} |`,
                    `| A receber | ${formatBRL(aReceber)} |`,
                    `| Vencido (total) | ${totalVencido > 0 ? `⚠️ ${formatBRL(totalVencido)}` : formatBRL(0)} |`,
                    "",
                    "## 📊 Comercial",
                    `| KPI | Valor |`,
                    `|-----|-------|`,
                    `| Propostas criadas | ${propostas.length} |`,
                    `| Propostas aprovadas | ${propostasAprovadas.length} |`,
                    `| Taxa de conversão | ${taxaConversao}% |`,
                    `| Valor aprovado | ${formatBRL(totalPropostasAprovadas)} |`,
                    `| Pipeline aberto | ${formatBRL(totalPropostasAbertas)} |`,
                    `| Leads novos | ${leadsNovos} |`,
                    `| Leads qualificados | ${leadsQualificados} |`,
                    "",
                    "## ⚙️ Operacional",
                    `| KPI | Valor |`,
                    `|-----|-------|`,
                    `| Pedidos criados | ${pedidos.length} |`,
                    `| Pedidos faturados | ${pedidosFaturados.length} |`,
                    `| Em produção | ${pedidosEmProducao.length} |`,
                    `| OPs em andamento | ${opsAndamento} |`,
                    `| OPs pendentes | ${opsPendentes} |`,
                    `| OPs pausadas | ${opsPausadas > 0 ? `⚠️ ${opsPausadas}` : "0"} |`,
                ].join("\n");
            }
            else {
                text = JSON.stringify(kpis, null, 2);
            }
            return {
                content: [{ type: "text", text }],
                structuredContent: kpis,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_alertas_ativos ──────────────────────────────────────────────────
    server.registerTool("croma_alertas_ativos", {
        title: "Alertas Ativos",
        description: `Lista alertas críticos e avisos ativos no sistema.

Verifica: pedidos atrasados, OPs vencidas, contas vencidas, propostas expiradas, estoque mínimo.

Use para "o que está em alerta", "problemas urgentes", "o que precisa de atenção agora".

Args:
  - response_format ('markdown'|'json'): Padrão markdown`,
        inputSchema: z.object({
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getSupabaseClient();
            const hoje = new Date().toISOString().split("T")[0];
            const [pedidosAtrasados, opsAtrasadas, contasVencidas, propostasExpirando, materiaisMinimo] = await Promise.all([
                sb.from("pedidos")
                    .select("numero, status, data_prometida, clientes(razao_social)")
                    .lt("data_prometida", hoje)
                    .not("status", "in", '("entregue","faturado","cancelado")')
                    .order("data_prometida")
                    .limit(10),
                sb.from("ordens_producao")
                    .select("numero, status, prazo_interno, pedidos(numero)")
                    .lt("prazo_interno", hoje)
                    .not("status", "in", '("concluido")')
                    .order("prazo_interno")
                    .limit(10),
                sb.from("contas_receber")
                    .select("numero_titulo, valor_original, saldo, data_vencimento, clientes(razao_social)")
                    .lt("data_vencimento", hoje)
                    .in("status", ["aberto", "parcial"])
                    .order("data_vencimento")
                    .limit(10),
                sb.from("propostas")
                    .select("numero, total, validade_dias, created_at, clientes(razao_social)")
                    .eq("status", "enviada")
                    .limit(10),
                sb.from("materiais")
                    .select("nome, categoria, estoque_minimo, estoque_saldos(quantidade_disponivel)")
                    .eq("ativo", true)
                    .not("estoque_minimo", "is", null)
                    .limit(20),
            ]);
            const alertas = [];
            // Pedidos atrasados
            for (const p of pedidosAtrasados.data ?? []) {
                const cliente = p.clientes ?? {};
                alertas.push({
                    tipo: "pedido_atrasado",
                    nivel: "critico",
                    mensagem: `Pedido ${p.numero} atrasado (${cliente.razao_social ?? "?"}) — prazo: ${formatDate(p.data_prometida)}`,
                    detalhe: p,
                });
            }
            // OPs atrasadas
            for (const op of opsAtrasadas.data ?? []) {
                alertas.push({
                    tipo: "op_atrasada",
                    nivel: "critico",
                    mensagem: `OP ${op.numero} com prazo vencido — prazo interno: ${formatDate(op.prazo_interno)}`,
                    detalhe: op,
                });
            }
            // Contas vencidas
            const totalVencido = (contasVencidas.data ?? []).reduce((s, c) => s + (c.saldo ?? c.valor_original), 0);
            if (contasVencidas.data && contasVencidas.data.length > 0) {
                alertas.push({
                    tipo: "contas_vencidas",
                    nivel: "alto",
                    mensagem: `${contasVencidas.data.length} contas a receber vencidas — total: ${formatBRL(totalVencido)}`,
                    detalhe: contasVencidas.data.slice(0, 3).map(c => ({
                        numero: c.numero_titulo,
                        cliente: c.clientes?.razao_social,
                        valor: c.saldo ?? c.valor_original,
                        vencimento: c.data_vencimento,
                    })),
                });
            }
            // Materiais abaixo do mínimo
            for (const m of materiaisMinimo.data ?? []) {
                const saldo = m.estoque_saldos?.[0];
                const disponivel = saldo?.quantidade_disponivel ?? 0;
                if (m.estoque_minimo && disponivel < m.estoque_minimo) {
                    alertas.push({
                        tipo: "estoque_minimo",
                        nivel: "medio",
                        mensagem: `Material "${m.nome}" abaixo do mínimo: ${disponivel}/${m.estoque_minimo}`,
                        detalhe: m,
                    });
                }
            }
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                if (alertas.length === 0) {
                    text = "## ✅ Sem Alertas\nNenhum alerta crítico no momento. Sistema operando normalmente.";
                }
                else {
                    const criticos = alertas.filter(a => a.nivel === "critico");
                    const altos = alertas.filter(a => a.nivel === "alto");
                    const medios = alertas.filter(a => a.nivel === "medio");
                    const lines = [`## ⚠️ Alertas Ativos (${alertas.length})`, ""];
                    if (criticos.length > 0) {
                        lines.push(`### 🔴 Críticos (${criticos.length})`);
                        for (const a of criticos)
                            lines.push(`- ${a.mensagem}`);
                        lines.push("");
                    }
                    if (altos.length > 0) {
                        lines.push(`### 🟠 Altos (${altos.length})`);
                        for (const a of altos)
                            lines.push(`- ${a.mensagem}`);
                        lines.push("");
                    }
                    if (medios.length > 0) {
                        lines.push(`### 🟡 Médios (${medios.length})`);
                        for (const a of medios)
                            lines.push(`- ${a.mensagem}`);
                    }
                    text = lines.join("\n");
                }
            }
            else {
                text = JSON.stringify({ total: alertas.length, alertas }, null, 2);
            }
            return {
                content: [{ type: "text", text: truncateIfNeeded(text, alertas.length) }],
                structuredContent: { total: alertas.length, alertas },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ─── croma_pipeline_comercial ──────────────────────────────────────────────
    server.registerTool("croma_pipeline_comercial", {
        title: "Pipeline Comercial",
        description: `Retorna o funil de vendas completo: leads → propostas → pedidos.

Use para "funil de vendas", "pipeline comercial", "quantas oportunidades temos",
"conversão de leads", "valor potencial no pipeline".

Args:
  - response_format ('markdown'|'json'): Padrão markdown`,
        inputSchema: z.object({
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getSupabaseClient();
            const [leadsResult, propostasResult, pedidosResult] = await Promise.all([
                sb.from("leads").select("status"),
                sb.from("propostas").select("status, total"),
                sb.from("pedidos").select("status, valor_total"),
            ]);
            const leads = leadsResult.data ?? [];
            const propostas = propostasResult.data ?? [];
            const pedidos = pedidosResult.data ?? [];
            // Agrupa leads por status
            const leadsPorStatus = leads.reduce((acc, l) => {
                acc[l.status] = (acc[l.status] ?? 0) + 1;
                return acc;
            }, {});
            // Agrupa propostas por status
            const propostasPorStatus = propostas.reduce((acc, p) => {
                if (!acc[p.status])
                    acc[p.status] = { count: 0, total: 0 };
                acc[p.status].count++;
                acc[p.status].total += p.total ?? 0;
                return acc;
            }, {});
            // Agrupa pedidos por status
            const pedidosPorStatus = pedidos.reduce((acc, p) => {
                if (!acc[p.status])
                    acc[p.status] = { count: 0, total: 0 };
                acc[p.status].count++;
                acc[p.status].total += p.valor_total ?? 0;
                return acc;
            }, {});
            // Métricas do pipeline
            const valorPipelineAberto = (propostasPorStatus["enviada"]?.total ?? 0) +
                (propostasPorStatus["em_revisao"]?.total ?? 0);
            const valorAprovado = propostasPorStatus["aprovada"]?.total ?? 0;
            const faturamentoTotal = (pedidosPorStatus["faturado"]?.total ?? 0) +
                (pedidosPorStatus["entregue"]?.total ?? 0);
            const pipeline = {
                leads: {
                    total: leads.length,
                    por_status: leadsPorStatus,
                },
                propostas: {
                    total: propostas.length,
                    por_status: propostasPorStatus,
                    valor_pipeline: valorPipelineAberto,
                    valor_aprovado: valorAprovado,
                },
                pedidos: {
                    total: pedidos.length,
                    por_status: pedidosPorStatus,
                    faturamento_acumulado: faturamentoTotal,
                },
                conversao: {
                    leads_para_propostas_pct: leads.length > 0
                        ? Math.round((propostas.length / leads.length) * 100)
                        : 0,
                    propostas_para_pedidos_pct: propostas.length > 0
                        ? Math.round(((propostasPorStatus["aprovada"]?.count ?? 0) / propostas.length) * 100)
                        : 0,
                },
            };
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                text = [
                    "# Pipeline Comercial",
                    "",
                    "## 🎯 Leads",
                    `**Total**: ${leads.length}`,
                    Object.entries(leadsPorStatus).map(([s, c]) => `- ${s}: ${c}`).join("\n"),
                    "",
                    "## 📋 Propostas",
                    `**Total**: ${propostas.length}`,
                    `**Pipeline aberto**: ${formatBRL(valorPipelineAberto)}`,
                    `**Valor aprovado**: ${formatBRL(valorAprovado)}`,
                    Object.entries(propostasPorStatus).map(([s, v]) => `- ${s}: ${v.count} (${formatBRL(v.total)})`).join("\n"),
                    "",
                    "## 📦 Pedidos",
                    `**Total**: ${pedidos.length}`,
                    `**Faturamento acumulado**: ${formatBRL(faturamentoTotal)}`,
                    Object.entries(pedidosPorStatus).map(([s, v]) => `- ${s}: ${v.count} (${formatBRL(v.total)})`).join("\n"),
                    "",
                    "## 📈 Conversão",
                    `- Leads → Propostas: **${pipeline.conversao.leads_para_propostas_pct}%**`,
                    `- Propostas → Pedidos: **${pipeline.conversao.propostas_para_pedidos_pct}%**`,
                ].join("\n");
            }
            else {
                text = JSON.stringify(pipeline, null, 2);
            }
            return {
                content: [{ type: "text", text }],
                structuredContent: pipeline,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
}
//# sourceMappingURL=bi.js.map
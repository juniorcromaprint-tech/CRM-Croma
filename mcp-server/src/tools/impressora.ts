/**
 * Ferramentas de Impressora — HP Latex 365
 * Consultar jobs de impressão, produção, custos e vincular ao CRM
 *
 * MODELO DE CUSTEIO: "LM Âncora"
 * Tinta paralela: bag 3L a R$1.560 → R$0,52/ml
 * Cartucho LM original = âncora de medição real
 * total_ml = lm_ml_real × 21,5316 (proporções históricas)
 * Fallback: 9,86 ml/m² (média histórica)
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSupabaseClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatBRL, formatDate, formatDateTime } from "../utils/formatting.js";

export function registerImpressoraTools(server: McpServer): void {
  // ─── croma_listar_jobs_impressora ─────────────────────────────────────────

  server.registerTool(
    "croma_listar_jobs_impressora",
    {
      title: "Listar Jobs da Impressora HP Latex 365",
      description: `Lista jobs de impressão coletados da HP Latex 365 com custos calculados.

Use para:
- "o que foi impresso hoje"
- "produção da semana"
- "jobs do Clovis"
- "cancelamentos do mês"
- "quanto custou imprimir o painel do Eugênio"
- "jobs sem vínculo com pedido"

Custos calculados com tinta paralela (R$0,52/ml) e modelo LM Âncora.

Args:
  - data_inicio (string, opcional): Data inicial (YYYY-MM-DD)
  - data_fim (string, opcional): Data final (YYYY-MM-DD)
  - estado (string, opcional): 'impresso', 'cancelado', 'cancelado_usuario'
  - cliente (string, opcional): Busca no nome do cliente extraído
  - pedido_id (string, opcional): Filtrar por pedido vinculado
  - apenas_sem_vinculo (boolean, opcional): Apenas jobs sem pedido vinculado
  - limit (number): Padrão 30
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        data_inicio: z.string().optional().describe("Data inicial YYYY-MM-DD"),
        data_fim: z.string().optional().describe("Data final YYYY-MM-DD"),
        estado: z.string().optional().describe("impresso, cancelado, cancelado_usuario"),
        cliente: z.string().optional().describe("Busca no cliente extraído"),
        pedido_id: z.string().uuid().optional(),
        apenas_sem_vinculo: z.boolean().optional().describe("Apenas jobs sem pedido vinculado"),
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
          .from("impressora_jobs")
          .select(
            `id, documento, estado, area_m2, substrato, modo_impressao, data_impressao,
             tinta_status, lm_ml_real, tinta_total_estimada_ml, metodo_custeio,
             custo_tinta_brl, custo_substrato_brl, custo_maquina_brl, custo_total_brl, custo_por_m2_tinta,
             cliente_extraido, alertas,
             cliente_id, pedido_id, ordem_producao_id,
             clientes(razao_social, nome_fantasia),
             pedidos(numero, status)`,
            { count: "exact" }
          )
          .order("data_impressao", { ascending: false });

        if (params.data_inicio) query = query.gte("data_impressao", `${params.data_inicio}T00:00:00`);
        if (params.data_fim) query = query.lte("data_impressao", `${params.data_fim}T23:59:59`);
        if (params.estado) query = query.eq("estado", params.estado);
        if (params.cliente) query = query.ilike("cliente_extraido", `%${params.cliente}%`);
        if (params.pedido_id) query = query.eq("pedido_id", params.pedido_id);
        if (params.apenas_sem_vinculo) query = query.is("pedido_id", null);

        query = query.range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const impressos = items.filter(j => j.estado === "impresso");
          const totalM2 = impressos.reduce((s, j) => s + Number(j.area_m2 ?? 0), 0);
          const totalCusto = impressos.reduce((s, j) => s + Number(j.custo_total_brl ?? 0), 0);
          const totalTinta = impressos.reduce((s, j) => s + Number(j.custo_tinta_brl ?? 0), 0);
          const totalSub = impressos.reduce((s, j) => s + Number(j.custo_substrato_brl ?? 0), 0);
          const totalMaq = impressos.reduce((s, j) => s + Number(j.custo_maquina_brl ?? 0), 0);

          const lines = [
            `## Jobs da Impressora HP Latex 365 (${total} encontrados)`,
            `**Impressos**: ${impressos.length} | **Área**: ${totalM2.toFixed(2)} m²`,
            `**Tinta**: ${formatBRL(totalTinta)} | **Substrato**: ${formatBRL(totalSub)} | **Máquina**: ${formatBRL(totalMaq)} | **Total**: ${formatBRL(totalCusto)}`,
            "",
          ];

          if (items.length === 0) {
            lines.push("_Nenhum job encontrado para os filtros informados._");
          } else {
            for (const j of items) {
              const statusIcon = j.estado === "impresso" ? "✅" : "❌";
              const clienteNome = (j.clientes as { nome_fantasia?: string })?.nome_fantasia
                ?? (j.clientes as { razao_social?: string })?.razao_social
                ?? j.cliente_extraido
                ?? "—";
              const pedidoNum = (j.pedidos as { numero?: string })?.numero;
              const vinculo = pedidoNum ? `📋 Pedido ${pedidoNum}` : "⚠️ Sem vínculo";
              const metodo = j.metodo_custeio === "LM_ancora" ? "LM âncora" : "média histórica";
              const alertasArr = (j.alertas as string[]) ?? [];

              lines.push(`### ${statusIcon} ${j.documento}`);
              lines.push(`- **Data**: ${formatDateTime(j.data_impressao)} | **Cliente**: ${clienteNome}`);
              lines.push(`- **Área**: ${Number(j.area_m2).toFixed(4)} m² | **Modo**: ${j.modo_impressao ?? "—"}`);
              lines.push(`- **Tinta**: ${Number(j.tinta_total_estimada_ml ?? 0).toFixed(1)} ml (${metodo}) | **LM real**: ${j.lm_ml_real ?? "—"} ml`);
              lines.push(`- **Custo**: tinta ${formatBRL(Number(j.custo_tinta_brl))} + substrato ${formatBRL(Number(j.custo_substrato_brl))} + máquina ${formatBRL(Number(j.custo_maquina_brl ?? 0))} = **${formatBRL(Number(j.custo_total_brl))}**`);
              lines.push(`- **Custo/m² tinta**: ${formatBRL(Number(j.custo_por_m2_tinta))}/m² | ${vinculo}`);
              if (alertasArr.length > 0) {
                for (const a of alertasArr) lines.push(`- ⚠️ ${a}`);
              }
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

  // ─── croma_resumo_impressora ──────────────────────────────────────────────

  server.registerTool(
    "croma_resumo_impressora",
    {
      title: "Resumo de Produção da Impressora",
      description: `Resumo de produção da HP Latex 365 por período com KPIs.

Use para:
- "produção do mês"
- "quanto imprimimos essa semana"
- "custo de impressão em março"
- "resumo da impressora"
- "quantos m² imprimimos hoje"
- "quanto gastamos com impressão esta semana"

Retorna: totais (m², ml, custos), breakdown por cliente e por dia, KPIs operacionais.

Args:
  - data_inicio (string): Data inicial (YYYY-MM-DD). Padrão: 30 dias atrás
  - data_fim (string): Data final (YYYY-MM-DD). Padrão: hoje
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        data_inicio: z.string().optional().describe("Data inicial YYYY-MM-DD"),
        data_fim: z.string().optional().describe("Data final YYYY-MM-DD"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getSupabaseClient();

        const hoje = new Date();
        const trintaDias = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
        const inicio = params.data_inicio ?? trintaDias.toISOString().split("T")[0];
        const fim = params.data_fim ?? hoje.toISOString().split("T")[0];

        const { data, error } = await sb
          .from("impressora_jobs")
          .select(`estado, area_m2, lm_ml_real, tinta_total_estimada_ml, metodo_custeio,
                   custo_tinta_brl, custo_substrato_brl, custo_maquina_brl, custo_total_brl, custo_por_m2_tinta,
                   cliente_extraido, pedido_id, data_impressao, modo_impressao, alertas`)
          .gte("data_impressao", `${inicio}T00:00:00`)
          .lte("data_impressao", `${fim}T23:59:59`);

        if (error) return errorResult(error);

        const jobs = data ?? [];
        const impressos = jobs.filter(j => j.estado === "impresso");
        const cancelados = jobs.filter(j => j.estado !== "impresso");

        const totalM2 = impressos.reduce((s, j) => s + Number(j.area_m2 ?? 0), 0);
        const totalTintaMl = impressos.reduce((s, j) => s + Number(j.tinta_total_estimada_ml ?? 0), 0);
        const totalLmMl = impressos.reduce((s, j) => s + Number(j.lm_ml_real ?? 0), 0);
        const totalCustoTinta = impressos.reduce((s, j) => s + Number(j.custo_tinta_brl ?? 0), 0);
        const totalCustoSub = impressos.reduce((s, j) => s + Number(j.custo_substrato_brl ?? 0), 0);
        const totalCustoMaq = impressos.reduce((s, j) => s + Number(j.custo_maquina_brl ?? 0), 0);
        const totalCusto = impressos.reduce((s, j) => s + Number(j.custo_total_brl ?? 0), 0);
        const m2Cancelado = cancelados.reduce((s, j) => s + Number(j.area_m2 ?? 0), 0);
        const custoCancelado = cancelados.reduce((s, j) => s + Number(j.custo_total_brl ?? 0), 0);
        const jobsVinculados = impressos.filter(j => j.pedido_id).length;
        const jobsLmAncora = impressos.filter(j => j.metodo_custeio === "LM_ancora").length;

        // KPIs
        const custoMedioM2 = totalM2 > 0 ? totalCusto / totalM2 : 0;
        const custoMedioTintaM2 = totalM2 > 0 ? totalCustoTinta / totalM2 : 0;
        const taxaCancelamento = jobs.length > 0 ? (cancelados.length / jobs.length) * 100 : 0;
        const taxaVinculacao = impressos.length > 0 ? (jobsVinculados / impressos.length) * 100 : 0;

        // Por cliente
        const porCliente: Record<string, { m2: number; custo: number; jobs: number; custoTinta: number; custoSub: number; custoMaq: number }> = {};
        for (const j of impressos) {
          const c = j.cliente_extraido ?? "DESCONHECIDO";
          if (!porCliente[c]) porCliente[c] = { m2: 0, custo: 0, jobs: 0, custoTinta: 0, custoSub: 0, custoMaq: 0 };
          porCliente[c].m2 += Number(j.area_m2 ?? 0);
          porCliente[c].custo += Number(j.custo_total_brl ?? 0);
          porCliente[c].custoTinta += Number(j.custo_tinta_brl ?? 0);
          porCliente[c].custoSub += Number(j.custo_substrato_brl ?? 0);
          porCliente[c].custoMaq += Number(j.custo_maquina_brl ?? 0);
          porCliente[c].jobs += 1;
        }

        // Por dia
        const porDia: Record<string, { m2: number; jobs: number; custo: number }> = {};
        for (const j of impressos) {
          const dia = j.data_impressao ? new Date(j.data_impressao).toISOString().split("T")[0] : "sem_data";
          if (!porDia[dia]) porDia[dia] = { m2: 0, jobs: 0, custo: 0 };
          porDia[dia].m2 += Number(j.area_m2 ?? 0);
          porDia[dia].jobs += 1;
          porDia[dia].custo += Number(j.custo_total_brl ?? 0);
        }

        // Alertas consolidados
        const todosAlertas: string[] = [];
        for (const j of jobs) {
          const al = (j.alertas as string[]) ?? [];
          for (const a of al) todosAlertas.push(`[${j.cliente_extraido}] ${a}`);
        }

        const resumo = {
          periodo: { inicio, fim },
          totais: {
            jobs_total: jobs.length,
            jobs_impressos: impressos.length,
            jobs_cancelados: cancelados.length,
            m2_impressos: Number(totalM2.toFixed(2)),
            m2_cancelados: Number(m2Cancelado.toFixed(2)),
            lm_ml_real: Number(totalLmMl.toFixed(3)),
            tinta_total_ml: Number(totalTintaMl.toFixed(1)),
            custo_tinta: Number(totalCustoTinta.toFixed(2)),
            custo_substrato: Number(totalCustoSub.toFixed(2)),
            custo_maquina: Number(totalCustoMaq.toFixed(2)),
            custo_total: Number(totalCusto.toFixed(2)),
            custo_cancelado: Number(custoCancelado.toFixed(2)),
          },
          kpis: {
            custo_medio_m2: Number(custoMedioM2.toFixed(2)),
            custo_medio_tinta_m2: Number(custoMedioTintaM2.toFixed(2)),
            taxa_cancelamento_pct: Number(taxaCancelamento.toFixed(1)),
            taxa_vinculacao_pct: Number(taxaVinculacao.toFixed(1)),
            jobs_lm_ancora: jobsLmAncora,
            jobs_media_historica: impressos.length - jobsLmAncora,
          },
          por_cliente: porCliente,
          por_dia: porDia,
          alertas: todosAlertas,
        };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `# Resumo de Produção — HP Latex 365`,
            `**Período**: ${formatDate(inicio)} a ${formatDate(fim)}`,
            "",
            `## Totais`,
            `| Indicador | Valor |`,
            `|---|---|`,
            `| Jobs impressos | ${impressos.length} |`,
            `| Jobs cancelados | ${cancelados.length} (custo desperdiçado: ${formatBRL(custoCancelado)}) |`,
            `| Área impressa | ${totalM2.toFixed(2)} m² |`,
            `| LM medido (real) | ${totalLmMl.toFixed(3)} ml |`,
            `| Tinta total estimada | ${totalTintaMl.toFixed(0)} ml |`,
            `| Custo tinta | ${formatBRL(totalCustoTinta)} |`,
            `| Custo substrato | ${formatBRL(totalCustoSub)} |`,
            `| Custo máquina (consumíveis) | ${formatBRL(totalCustoMaq)} |`,
            `| **Custo total** | **${formatBRL(totalCusto)}** |`,
            "",
            `## KPIs`,
            `| KPI | Valor |`,
            `|---|---|`,
            `| Custo médio por m² | ${formatBRL(custoMedioM2)}/m² |`,
            `| Custo tinta por m² | ${formatBRL(custoMedioTintaM2)}/m² (normal: R$1-2) |`,
            `| Taxa de cancelamento | ${taxaCancelamento.toFixed(1)}% |`,
            `| Vinculação com CRM | ${taxaVinculacao.toFixed(0)}% (${jobsVinculados}/${impressos.length}) |`,
            `| Método LM Âncora | ${jobsLmAncora}/${impressos.length} jobs |`,
            "",
            `## Por Cliente`,
          ];

          const clientesSorted = Object.entries(porCliente).sort((a, b) => b[1].m2 - a[1].m2);
          for (const [nome, d] of clientesSorted) {
            const pct = totalM2 > 0 ? ((d.m2 / totalM2) * 100).toFixed(0) : "0";
            lines.push(`- **${nome}**: ${d.jobs} jobs, ${d.m2.toFixed(2)} m² (${pct}%), ${formatBRL(d.custo)}`);
          }

          lines.push("", `## Por Dia`);
          const diasSorted = Object.entries(porDia).sort((a, b) => a[0].localeCompare(b[0]));
          for (const [dia, d] of diasSorted) {
            lines.push(`- **${formatDate(dia)}**: ${d.jobs} jobs, ${d.m2.toFixed(2)} m², ${formatBRL(d.custo)}`);
          }

          if (todosAlertas.length > 0) {
            lines.push("", `## Alertas (${todosAlertas.length})`);
            for (const a of todosAlertas.slice(0, 10)) lines.push(`- ⚠️ ${a}`);
            if (todosAlertas.length > 10) lines.push(`_...e mais ${todosAlertas.length - 10} alertas._`);
          }

          text = lines.join("\n");
        } else {
          text = JSON.stringify(resumo, null, 2);
        }

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: resumo,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_vincular_job_impressora ────────────────────────────────────────

  server.registerTool(
    "croma_vincular_job_impressora",
    {
      title: "Vincular Job da Impressora ao Pedido/Cliente",
      description: `Vincula um job de impressão a um pedido, cliente ou ordem de produção do CRM.

Use para:
- "vincular impressão X ao pedido Y"
- "associar job ao cliente Clovis"
- "marcar que essa impressão é do pedido 45"

Args:
  - job_id (string): ID do job na tabela impressora_jobs
  - pedido_id (string, opcional): ID do pedido
  - cliente_id (string, opcional): ID do cliente
  - ordem_producao_id (string, opcional): ID da OP`,
      inputSchema: z.object({
        job_id: z.string().uuid().describe("ID do job na tabela impressora_jobs"),
        pedido_id: z.string().uuid().optional(),
        cliente_id: z.string().uuid().optional(),
        ordem_producao_id: z.string().uuid().optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        const updateData: Record<string, string | null> = {};
        if (params.pedido_id) updateData.pedido_id = params.pedido_id;
        if (params.cliente_id) updateData.cliente_id = params.cliente_id;
        if (params.ordem_producao_id) updateData.ordem_producao_id = params.ordem_producao_id;

        if (Object.keys(updateData).length === 0) {
          return {
            content: [{ type: "text" as const, text: "Erro: Informe pelo menos um vínculo (pedido_id, cliente_id ou ordem_producao_id)." }],
          };
        }

        const { data, error } = await sb
          .from("impressora_jobs")
          .update(updateData)
          .eq("id", params.job_id)
          .select("id, documento, pedido_id, cliente_id, ordem_producao_id")
          .single();

        if (error) return errorResult(error);

        const text = [
          `✅ Job vinculado com sucesso!`,
          `- **Documento**: ${data.documento}`,
          data.pedido_id ? `- **Pedido**: ${data.pedido_id}` : null,
          data.cliente_id ? `- **Cliente**: ${data.cliente_id}` : null,
          data.ordem_producao_id ? `- **OP**: ${data.ordem_producao_id}` : null,
        ].filter(Boolean).join("\n");

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_registrar_jobs_impressora ──────────────────────────────────────

  server.registerTool(
    "croma_registrar_jobs_impressora",
    {
      title: "Registrar Jobs da Impressora no CRM",
      description: `Registra jobs de impressão coletados do EWS da HP Latex 365.
Usado pelo script croma_plotter_sync.py para enviar dados automaticamente.
Deduplicação automática via hash_job (upsert).

Args:
  - jobs (array): Lista de jobs com campos obrigatórios e opcionais`,
      inputSchema: z.object({
        jobs: z.array(z.object({
          documento: z.string(),
          estado: z.string().default("impresso"),
          area_m2: z.number(),
          substrato: z.string().optional(),
          modo_impressao: z.string().optional(),
          data_impressao: z.string(),
          tinta_status: z.string().default("alterada"),
          lm_ml_real: z.number().nullable().optional(),
          tinta_total_estimada_ml: z.number().default(0),
          metodo_custeio: z.string().default("LM_ancora"),
          custo_tinta_brl: z.number().default(0),
          custo_substrato_brl: z.number().default(0),
          custo_maquina_brl: z.number().default(0),
          custo_total_brl: z.number().default(0),
          custo_por_m2_tinta: z.number().default(0),
          cliente_extraido: z.string().optional(),
          tintas_detalhe: z.record(z.unknown()).optional(),
          alertas: z.array(z.string()).optional(),
          hash_job: z.string(),
        })).min(1).max(500),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        let inseridos = 0;
        const erros: string[] = [];

        for (const job of params.jobs) {
          const { error } = await sb
            .from("impressora_jobs")
            .upsert(
              {
                ...job,
                tintas_detalhe: job.tintas_detalhe ?? {},
                alertas: job.alertas ?? [],
                printer_ip: "192.168.0.136",
              },
              { onConflict: "hash_job" }
            )
            .select("id")
            .single();

          if (error) {
            erros.push(`${job.documento}: ${error.message}`);
          } else {
            inseridos++;
          }
        }

        const text = [
          `## Importação de Jobs — HP Latex 365`,
          `- **Recebidos**: ${params.jobs.length}`,
          `- **Inseridos/atualizados**: ${inseridos}`,
          erros.length > 0 ? `- **Erros**: ${erros.length}` : `- **Erros**: 0 ✅`,
          erros.length > 0 ? `\n### Erros:\n${erros.map(e => `- ${e}`).join("\n")}` : null,
        ].filter(Boolean).join("\n");

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { recebidos: params.jobs.length, inseridos, erros },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_custo_real_pedido ──────────────────────────────────────────────

  server.registerTool(
    "croma_custo_real_pedido",
    {
      title: "Custo Real de Impressão por Pedido",
      description: `Consulta o custo real de impressão (tinta + substrato) de um pedido ou de todos os pedidos com jobs vinculados.

Use para:
- "quanto custou imprimir o pedido 45"
- "margem real do pedido do Clovis"
- "custo de impressão dos pedidos do mês"
- "quais pedidos têm maior custo de impressão"

Cruza dados reais da HP Latex 365 com pedidos do CRM.

Args:
  - pedido_id (string, opcional): ID do pedido específico
  - pedido_numero (string, opcional): Número do pedido (ex: "PED-0045")
  - limit (number): Padrão 20
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        pedido_id: z.string().uuid().optional(),
        pedido_numero: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getSupabaseClient();

        let query = sb
          .from("vw_custo_real_por_pedido")
          .select("*")
          .gt("jobs_impressora", 0)
          .order("custo_impressao_total", { ascending: false })
          .limit(params.limit);

        if (params.pedido_id) query = query.eq("pedido_id", params.pedido_id);
        if (params.pedido_numero) query = query.ilike("pedido_numero", `%${params.pedido_numero}%`);

        const { data, error } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          if (items.length === 0) {
            text = "Nenhum pedido encontrado com jobs de impressão vinculados.";
          } else {
            const lines = [`## Custo Real de Impressão por Pedido`, ""];
            for (const p of items) {
              lines.push(`### Pedido ${p.pedido_numero} — ${p.cliente ?? "—"}`);
              lines.push(`- **Valor do pedido**: ${formatBRL(Number(p.pedido_valor))}`);
              lines.push(`- **Jobs impressora**: ${p.jobs_impressora} | **Área**: ${Number(p.m2_impresso).toFixed(2)} m²`);
              lines.push(`- **Custo tinta**: ${formatBRL(Number(p.custo_tinta_real))} | **Substrato**: ${formatBRL(Number(p.custo_substrato_real))} | **Máquina**: ${formatBRL(Number(p.custo_maquina_real ?? 0))}`);
              lines.push(`- **Custo total impressão**: ${formatBRL(Number(p.custo_impressao_total))}`);
              lines.push(`- **Margem (só impressão)**: ${p.margem_impressao_pct}%`);
              lines.push("");
            }
            text = lines.join("\n");
          }
        } else {
          text = JSON.stringify(items, null, 2);
        }

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { items },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_mapear_substrato ───────────────────────────────────────────────

  server.registerTool(
    "croma_mapear_substrato",
    {
      title: "Mapear Substrato da Impressora ao Catálogo",
      description: `Vincula um substrato do EWS da impressora a um material do catálogo de estoque.
Isso permite que o sistema saiba qual material do estoque foi consumido em cada job.

Use para:
- "vincular Avery Fosco ao material do catálogo"
- "mapear substrato da impressora"
- "listar substratos mapeados"

Args:
  - acao ('listar'|'mapear'): Listar mapeamentos ou criar/atualizar um
  - nome_ews (string, para mapear): Nome do substrato como aparece no EWS
  - material_id (string, para mapear): ID do material no catálogo`,
      inputSchema: z.object({
        acao: z.enum(["listar", "mapear"]).default("listar"),
        nome_ews: z.string().optional(),
        material_id: z.string().uuid().optional(),
        custo_m2_override: z.number().optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        if (params.acao === "listar") {
          const sb = getSupabaseClient();
          const { data, error } = await sb
            .from("impressora_substrato_map")
            .select("nome_ews, material_id, custo_m2_override, largura_mm, ativo, materiais(nome, preco_medio, unidade)")
            .order("nome_ews");

          if (error) return errorResult(error);

          const items = data ?? [];
          const lines = [`## Mapeamento de Substratos (EWS → Catálogo)`, ""];
          const mapeados = items.filter(i => i.material_id);
          const pendentes = items.filter(i => !i.material_id);

          lines.push(`**Mapeados**: ${mapeados.length} | **Pendentes**: ${pendentes.length}`, "");

          if (mapeados.length > 0) {
            lines.push("### ✅ Mapeados");
            for (const i of mapeados) {
              const mat = i.materiais as { nome?: string; preco_medio?: number; unidade?: string } | null;
              lines.push(`- **${i.nome_ews}** → ${mat?.nome ?? "?"} (${formatBRL(Number(mat?.preco_medio ?? 0))}/${mat?.unidade ?? "m²"})`);
            }
          }

          if (pendentes.length > 0) {
            lines.push("", "### ⚠️ Pendentes (sem material vinculado)");
            for (const i of pendentes) {
              lines.push(`- **${i.nome_ews}** (largura: ${i.largura_mm ?? "?"}mm)`);
            }
          }

          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
            structuredContent: { items },
          };
        }

        // Ação: mapear
        if (!params.nome_ews || !params.material_id) {
          return {
            content: [{ type: "text" as const, text: "Erro: Para mapear, informe nome_ews e material_id." }],
          };
        }

        const sb = getUserClient();
        const updateData: Record<string, unknown> = { material_id: params.material_id };
        if (params.custo_m2_override) updateData.custo_m2_override = params.custo_m2_override;

        const { data, error } = await sb
          .from("impressora_substrato_map")
          .update(updateData)
          .eq("nome_ews", params.nome_ews)
          .select("nome_ews, material_id")
          .single();

        if (error) return errorResult(error);

        return {
          content: [{ type: "text" as const, text: `✅ Substrato **${data.nome_ews}** mapeado para material ${data.material_id}` }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

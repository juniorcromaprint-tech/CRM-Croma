/**
 * Ferramentas de Instalação / App de Campo
 * Consultar ordens de instalação e agendar novas
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatDate, formatDateTime, formatStatus } from "../utils/formatting.js";

export function registerCampoTools(server: McpServer): void {
  // ─── croma_listar_instalacoes ──────────────────────────────────────────────

  server.registerTool(
    "croma_listar_instalacoes",
    {
      title: "Listar Instalações",
      description: `Lista ordens de instalação com filtros.

Use para "instalações de amanhã", "instalações pendentes", "expedição da semana", "instalações do técnico X".

Args:
  - status (string, opcional): pendente|agendada|em_execucao|concluida|reagendada|cancelada
  - equipe_id (string, opcional): UUID da equipe
  - data_inicio (string, opcional): Data de agendamento inicial (ISO)
  - data_fim (string, opcional): Data de agendamento final (ISO)
  - cidade (string, opcional): Filtrar por cidade
  - limit (number): Padrão 20
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        status: z.enum(["pendente", "agendada", "em_execucao", "concluida", "reagendada", "cancelada"]).optional(),
        equipe_id: z.string().uuid().optional(),
        data_inicio: z.string().optional().describe("ISO date, filtro em data_agendada"),
        data_fim: z.string().optional(),
        cidade: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        let query = sb
          .from("ordens_instalacao")
          .select(
            `id, numero, status, data_agendada, hora_prevista, endereco_completo,
             instrucoes, observacoes, created_at,
             pedidos(numero, clientes(razao_social, nome_fantasia)),
             equipes(nome)`,
            { count: "exact" }
          );

        if (params.status) query = query.eq("status", params.status);
        if (params.equipe_id) query = query.eq("equipe_id", params.equipe_id);
        if (params.cidade) query = query.ilike("endereco_completo", `%${params.cidade}%`);
        if (params.data_inicio) query = query.gte("data_agendada", params.data_inicio);
        if (params.data_fim) query = query.lte("data_agendada", params.data_fim + "T23:59:59");

        query = query
          .order("data_agendada", { ascending: true, nullsFirst: false })
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Instalações (${total} encontradas)`, ""];
          if (items.length === 0) {
            lines.push("_Nenhuma instalação encontrada._");
          } else {
            for (const inst of items) {
              const pedido = (inst.pedidos as unknown as { numero: string; clientes: { razao_social: string; nome_fantasia?: string } }) ?? {};
              const cliente = pedido.clientes ?? {};
              const equipe = (inst.equipes as { nome?: string }) ?? {};
              const nomeCliente = cliente.nome_fantasia ?? cliente.razao_social ?? "—";

              lines.push(`### ${inst.numero} — ${nomeCliente}`);
              lines.push(`- **Pedido**: ${pedido.numero ?? "—"}`);
              lines.push(`- **Status**: ${formatStatus(inst.status)}`);
              if (inst.data_agendada) lines.push(`- **Data agendada**: ${formatDate(inst.data_agendada)}`);
              if (inst.endereco_completo) lines.push(`- **Endereço**: ${inst.endereco_completo}`);
              if (inst.hora_prevista) lines.push(`- **Hora**: ${inst.hora_prevista}`);
              if (equipe.nome) lines.push(`- **Equipe**: ${equipe.nome}`);
              if (inst.instrucoes) lines.push(`- **Instruções**: ${inst.instrucoes}`);
              if (inst.observacoes) lines.push(`- **Obs**: ${inst.observacoes}`);
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

  // ─── croma_listar_jobs_campo ──────────────────────────────────────────────

  server.registerTool(
    "croma_listar_jobs_campo",
    {
      title: "Listar Jobs do App Campo",
      description: `Lista jobs do App Campo (instalações e merchandising) com filtros.

Use para "jobs de hoje", "jobs pendentes", "jobs do técnico X", "merchandising da Beira Rio".

Tipo de job:
- instalacao: tem vínculo com ordem_instalacao_id ou pedido_id no CRM
- merchandising: sem vínculo (maioria dos casos atuais — serviços avulsos como Beira Rio)

Args:
  - status (string, opcional): Pendente|Em Andamento|Concluído|Cancelado
  - tecnico_id (string UUID, opcional): filtrar por técnico
  - loja_nome (string, opcional): busca parcial no nome da loja
  - data_inicio (string ISO, opcional): filtro em data_agendada
  - data_fim (string ISO, opcional): filtro em data_agendada
  - tipo (string, opcional): instalacao|merchandising
  - limit (number): padrão 20
  - offset (number): paginação
  - response_format ('markdown'|'json'): padrão markdown`,
      inputSchema: z.object({
        status: z.enum(["Pendente", "Em Andamento", "Concluído", "Cancelado"]).optional(),
        tecnico_id: z.string().uuid().optional(),
        loja_nome: z.string().optional(),
        data_inicio: z.string().optional().describe("ISO date filtro em data_agendada"),
        data_fim: z.string().optional(),
        tipo: z.enum(["instalacao", "merchandising"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        let query = sb
          .from("vw_campo_instalacoes")
          .select(
            `job_id, os_number, tipo_servico, status_campo, data_agendada,
             loja_nome, loja_marca, loja_endereco, loja_estado,
             tecnico_nome, fotos_antes, fotos_depois, duracao_minutos,
             ordem_instalacao_id, pedido_id, created_at`,
            { count: "exact" }
          );

        if (params.status) query = query.eq("status_campo", params.status);
        if (params.tecnico_id) query = query.eq("tecnico_id", params.tecnico_id);
        if (params.loja_nome) query = query.ilike("loja_nome", `%${params.loja_nome}%`);
        if (params.data_inicio) query = query.gte("data_agendada", params.data_inicio);
        if (params.data_fim) query = query.lte("data_agendada", params.data_fim);
        if (params.tipo === "instalacao") {
          query = query.or("ordem_instalacao_id.not.is.null,pedido_id.not.is.null");
        } else if (params.tipo === "merchandising") {
          query = query.is("ordem_instalacao_id", null).is("pedido_id", null);
        }

        query = query
          .order("data_agendada", { ascending: false, nullsFirst: false })
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Jobs do Campo (${total} encontrados)`, ""];
          if (items.length === 0) {
            lines.push("_Nenhum job encontrado._");
          } else {
            for (const job of items) {
              const tipoLabel = (job.ordem_instalacao_id || job.pedido_id) ? "Instalação" : "Merchandising";
              lines.push(`### OS ${job.os_number} — ${job.loja_nome ?? "—"}`);
              lines.push(`- **Tipo**: ${tipoLabel} (${job.tipo_servico})`);
              lines.push(`- **Status**: ${job.status_campo}`);
              if (job.data_agendada) lines.push(`- **Data**: ${formatDate(job.data_agendada)}`);
              if (job.loja_estado) lines.push(`- **Estado**: ${job.loja_estado}`);
              if (job.loja_endereco) lines.push(`- **Endereço**: ${job.loja_endereco}`);
              if (job.tecnico_nome?.trim()) lines.push(`- **Técnico**: ${job.tecnico_nome}`);
              lines.push(`- **Fotos**: ${job.fotos_antes ?? 0} antes / ${job.fotos_depois ?? 0} depois`);
              if (job.duracao_minutos != null) lines.push(`- **Duração**: ${Math.round(Number(job.duracao_minutos))} min`);
              lines.push(`- **job_id**: \`${job.job_id}\``);
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

  // ─── croma_detalhe_job_campo ──────────────────────────────────────────────

  server.registerTool(
    "croma_detalhe_job_campo",
    {
      title: "Detalhe do Job do Campo",
      description: `Retorna detalhe completo de um job do App Campo, incluindo fotos e assinatura.

Args:
  - job_id (string UUID, obrigatório): ID do job
  - response_format ('markdown'|'json'): padrão markdown`,
      inputSchema: z.object({
        job_id: z.string().uuid(),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        const { data: job, error: jobError } = await sb
          .from("vw_campo_instalacoes")
          .select("*")
          .eq("job_id", params.job_id)
          .single();

        if (jobError) return errorResult(jobError);
        if (!job) return { content: [{ type: "text" as const, text: `Job não encontrado: ${params.job_id}` }] };

        const { data: fotos, error: fotosError } = await sb
          .from("job_photos")
          .select("id, photo_type, photo_url, description, note, created_at")
          .eq("job_id", params.job_id)
          .order("created_at", { ascending: true });

        if (fotosError) return errorResult(fotosError);

        const tipoLabel = (job.ordem_instalacao_id || job.pedido_id) ? "Instalação" : "Merchandising";
        const resultado = { ...job, fotos: fotos ?? [] };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `## Job ${job.os_number} — ${job.loja_nome ?? "—"}`,
            "",
            `- **Tipo**: ${tipoLabel} (${job.tipo_servico})`,
            `- **Status**: ${job.status_campo}`,
            `- **Loja**: ${job.loja_nome ?? "—"} ${job.loja_marca ? `(${job.loja_marca})` : ""}`,
            `- **Endereço**: ${job.loja_endereco ?? "—"}`,
            `- **Estado**: ${job.loja_estado ?? "—"}`,
          ];
          if (job.data_agendada) lines.push(`- **Data agendada**: ${formatDate(job.data_agendada)}`);
          if (job.tecnico_nome?.trim()) lines.push(`- **Técnico**: ${job.tecnico_nome}`);
          if (job.started_at) lines.push(`- **Início**: ${formatDateTime(job.started_at)}`);
          if (job.finished_at) lines.push(`- **Conclusão**: ${formatDateTime(job.finished_at)}`);
          if (job.duracao_minutos != null) lines.push(`- **Duração**: ${Math.round(Number(job.duracao_minutos))} min`);
          if (job.notes) lines.push(`- **Notas**: ${job.notes}`);
          if (job.issues) lines.push(`- **Problemas**: ${job.issues}`);
          if (job.lat && job.lng) lines.push(`- **GPS**: ${job.lat}, ${job.lng}`);
          if (job.signature_url) lines.push(`- **Assinatura**: ${job.signature_url}`);
          if (job.ordem_instalacao_id) lines.push(`- **Ordem instalação**: ${job.ordem_instalacao_id}`);
          if (job.pedido_id) lines.push(`- **Pedido ERP**: ${job.pedido_id}`);
          lines.push(`- **job_id**: \`${job.job_id}\``);
          lines.push("");

          const fotosList = fotos ?? [];
          lines.push(`### Fotos (${fotosList.length} total)`);
          if (fotosList.length === 0) {
            lines.push("_Nenhuma foto registrada._");
          } else {
            const antes = fotosList.filter((f) => f.photo_type === "before");
            const depois = fotosList.filter((f) => f.photo_type === "after");
            lines.push(`- **Antes**: ${antes.length} foto(s)`);
            lines.push(`- **Depois**: ${depois.length} foto(s)`);
            for (const foto of fotosList) {
              lines.push(`  - [${foto.photo_type}] ${foto.photo_url}${foto.description ? ` — ${foto.description}` : ""}`);
            }
          }

          text = lines.join("\n");
        } else {
          text = JSON.stringify(resultado, null, 2);
        }

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: resultado,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_fotos_job ──────────────────────────────────────────────

  server.registerTool(
    "croma_listar_fotos_job",
    {
      title: "Listar Fotos de um Job",
      description: `Lista fotos (antes/depois) de um job específico do App Campo.

Args:
  - job_id (string UUID, obrigatório): ID do job
  - tipo (string, opcional): before|after — filtra por tipo de foto
  - response_format ('markdown'|'json'): padrão markdown`,
      inputSchema: z.object({
        job_id: z.string().uuid(),
        tipo: z.enum(["before", "after"]).optional(),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        let query = sb
          .from("job_photos")
          .select("id, photo_type, photo_url, description, note, created_at", { count: "exact" })
          .eq("job_id", params.job_id);

        if (params.tipo) query = query.eq("photo_type", params.tipo);

        query = query.order("created_at", { ascending: true });

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const fotos = data ?? [];
        const total = count ?? fotos.length;

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const tipoLabel = params.tipo ? ` (${params.tipo})` : "";
          const lines = [`## Fotos do Job — ${params.job_id}${tipoLabel} (${total} total)`, ""];
          if (fotos.length === 0) {
            lines.push("_Nenhuma foto encontrada._");
          } else {
            for (const foto of fotos) {
              const tipoIcon = foto.photo_type === "before" ? "🔴 Antes" : "🟢 Depois";
              lines.push(`- **${tipoIcon}** — ${foto.photo_url}`);
              if (foto.description) lines.push(`  ${foto.description}`);
              if (foto.note) lines.push(`  _Nota: ${foto.note}_`);
              lines.push(`  _${formatDateTime(foto.created_at)}_`);
            }
          }
          text = lines.join("\n");
        } else {
          text = JSON.stringify({ job_id: params.job_id, total, fotos }, null, 2);
        }

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { job_id: params.job_id, total, fotos },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_criar_job_campo ──────────────────────────────────────────────

  server.registerTool(
    "croma_criar_job_campo",
    {
      title: "Criar Job no App Campo",
      description: `Cria um novo job no App Campo (instalação ou merchandising).

ATENÇÃO: Ação que modifica dados. Confirme com Junior antes de executar.

Para merchandising (caso mais comum): informar os_number gerado sequencialmente, tipo_servico = "Merchandising", store_id da loja, sem ordem_instalacao_id e pedido_id.
Para instalação vinculada ao ERP: informar ordem_instalacao_id e/ou pedido_id.

Args:
  - os_number (string, obrigatório): número da OS
  - tipo_servico (string, obrigatório): ex: "Merchandising", "Instalação de Adesivo", "Adesivagem Vitrine", "Placas/Adesivos"
  - store_id (string UUID, obrigatório): ID da loja (tabela stores)
  - data_agendada (string ISO, obrigatório): data agendada ex: 2026-04-01
  - assigned_to (string UUID, opcional): técnico responsável (UUID do usuário)
  - ordem_instalacao_id (string UUID, opcional): vínculo com ordem de instalação do ERP
  - pedido_id (string UUID, opcional): vínculo com pedido do ERP
  - notes (string, opcional): instruções e observações`,
      inputSchema: z.object({
        os_number: z.string().min(1).max(100),
        tipo_servico: z.string().min(1).max(200),
        store_id: z.string().uuid(),
        data_agendada: z.string().describe("ISO date ex: 2026-04-01"),
        assigned_to: z.string().uuid().optional(),
        ordem_instalacao_id: z.string().uuid().optional(),
        pedido_id: z.string().uuid().optional(),
        notes: z.string().max(2000).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        const { data, error } = await sb
          .from("jobs")
          .insert({
            os_number: params.os_number,
            type: params.tipo_servico,
            store_id: params.store_id,
            scheduled_date: params.data_agendada,
            assigned_to: params.assigned_to ?? null,
            ordem_instalacao_id: params.ordem_instalacao_id ?? null,
            pedido_id: params.pedido_id ?? null,
            notes: params.notes ?? null,
            status: "Pendente",
          })
          .select()
          .single();

        if (error) return errorResult(error);

        const tipoLabel = (params.ordem_instalacao_id || params.pedido_id) ? "Instalação vinculada ao ERP" : "Merchandising";

        return {
          content: [{
            type: "text" as const,
            text: [
              `✅ Job criado com sucesso!`,
              ``,
              `- **OS**: ${data.os_number}`,
              `- **Tipo**: ${tipoLabel} (${data.type})`,
              `- **Status**: ${data.status}`,
              `- **Data agendada**: ${formatDate(data.scheduled_date)}`,
              `- **job_id**: \`${data.id}\``,
            ].join("\n"),
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_atualizar_job_campo ──────────────────────────────────────────────

  server.registerTool(
    "croma_atualizar_job_campo",
    {
      title: "Atualizar Job do Campo",
      description: `Atualiza status, notas ou dados de execução de um job do App Campo.

ATENÇÃO: Ação que modifica dados. Confirme com Junior antes de executar.

Se status = "Concluído" e finished_at não informado, a hora de conclusão é setada automaticamente.

Args:
  - job_id (string UUID, obrigatório): ID do job
  - status (string, opcional): Pendente|Em Andamento|Concluído|Cancelado
  - notes (string, opcional): notas adicionais
  - issues (string, opcional): problemas encontrados
  - started_at (string ISO, opcional): hora de início (ex: 2026-04-01T09:00:00)
  - finished_at (string ISO, opcional): hora de conclusão`,
      inputSchema: z.object({
        job_id: z.string().uuid(),
        status: z.enum(["Pendente", "Em Andamento", "Concluído", "Cancelado"]).optional(),
        notes: z.string().max(2000).optional(),
        issues: z.string().max(2000).optional(),
        started_at: z.string().optional().describe("ISO datetime ex: 2026-04-01T09:00:00"),
        finished_at: z.string().optional().describe("ISO datetime ex: 2026-04-01T14:30:00"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        const updates: Record<string, unknown> = {};
        if (params.status !== undefined) updates.status = params.status;
        if (params.notes !== undefined) updates.notes = params.notes;
        if (params.issues !== undefined) updates.issues = params.issues;
        if (params.started_at !== undefined) updates.started_at = params.started_at;
        if (params.finished_at !== undefined) {
          updates.finished_at = params.finished_at;
        } else if (params.status === "Concluído") {
          updates.finished_at = new Date().toISOString();
        }

        if (Object.keys(updates).length === 0) {
          return { content: [{ type: "text" as const, text: "Nenhum campo para atualizar informado." }] };
        }

        const { data, error } = await sb
          .from("jobs")
          .update(updates)
          .eq("id", params.job_id)
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: [
              `✅ Job atualizado com sucesso!`,
              ``,
              `- **OS**: ${data.os_number}`,
              `- **Status**: ${data.status}`,
              ...(data.started_at ? [`- **Início**: ${formatDateTime(data.started_at)}`] : []),
              ...(data.finished_at ? [`- **Conclusão**: ${formatDateTime(data.finished_at)}`] : []),
              ...(data.issues ? [`- **Problemas**: ${data.issues}`] : []),
              `- **job_id**: \`${data.id}\``,
            ].join("\n"),
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_agendar_instalacao ──────────────────────────────────────────────

  server.registerTool(
    "croma_agendar_instalacao",
    {
      title: "Agendar Instalação",
      description: `Cria ou agenda uma ordem de instalação para um pedido.

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - pedido_id (string, obrigatório): UUID do pedido que será instalado
  - data_agendada (string, obrigatório): Data da instalação ISO (ex: 2026-04-01)
  - hora_prevista (string, opcional): Hora prevista (ex: 09:00)
  - endereco_completo (string, obrigatório): Endereço completo do local (incluir cidade/estado)
  - equipe_id (string, opcional): UUID da equipe responsável
  - instrucoes (string, opcional): Instruções para a equipe
  - materiais_necessarios (string, opcional): Lista de materiais necessários
  - observacoes (string, opcional): Observações gerais`,
      inputSchema: z.object({
        pedido_id: z.string().uuid(),
        data_agendada: z.string().describe("ISO date ex: 2026-04-01"),
        hora_prevista: z.string().optional().describe("Hora prevista ex: 09:00"),
        endereco_completo: z.string().min(5).max(400),
        equipe_id: z.string().uuid().optional(),
        instrucoes: z.string().max(1000).optional(),
        materiais_necessarios: z.string().max(1000).optional(),
        observacoes: z.string().max(1000).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        // Verifica se pedido existe e pega cliente_id
        const { data: pedido, error: pedidoError } = await sb
          .from("pedidos")
          .select("id, numero, status, cliente_id")
          .eq("id", params.pedido_id)
          .single();

        if (pedidoError) return errorResult(pedidoError);
        if (!pedido) return { content: [{ type: "text" as const, text: `Pedido não encontrado: ${params.pedido_id}` }] };

        const { data, error } = await sb
          .from("ordens_instalacao")
          .insert({
            pedido_id: params.pedido_id,
            cliente_id: pedido.cliente_id,
            status: "agendada",
            data_agendada: params.data_agendada,
            hora_prevista: params.hora_prevista,
            endereco_completo: params.endereco_completo,
            instrucoes: params.instrucoes,
            materiais_necessarios: params.materiais_necessarios,
            equipe_id: params.equipe_id,
            observacoes: params.observacoes,
          })
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: [
              `✅ Instalação agendada com sucesso!`,
              ``,
              `- **Número**: ${data.numero}`,
              `- **Pedido**: ${pedido.numero}`,
              `- **Data**: ${formatDateTime(data.data_agendada)}`,
              `- **Local**: ${data.endereco_completo}`,
            ].join("\n"),
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_equipes ──────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_equipes",
    {
      title: "Listar Equipes de Campo",
      description: `Lista equipes de instalação/campo com seus membros.

Use para "equipes disponíveis", "quem está na equipe X", "equipes por região".

Args:
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        const { data, error } = await sb
          .from("equipes")
          .select("id, nome, regiao, ativo, equipe_membros(id, funcao, ativo, profiles(full_name))")
          .eq("ativo", true)
          .order("nome");

        if (error) return errorResult(error);

        const items = data ?? [];

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Equipes de Campo (${items.length})`, ""];
          if (items.length === 0) {
            lines.push("_Nenhuma equipe cadastrada._");
          } else {
            for (const e of items) {
              const membros = (e.equipe_membros as { funcao?: string; ativo?: boolean; profiles?: { full_name?: string } | null }[]) ?? [];
              const membrosAtivos = membros.filter(m => m.ativo !== false);
              lines.push(`### ${e.nome}${e.regiao ? ` — ${e.regiao}` : ""}`);
              lines.push(`- **ID**: \`${e.id}\``);
              lines.push(`- **Membros**: ${membrosAtivos.length}`);
              for (const m of membrosAtivos) {
                const nome = m.profiles?.full_name ?? "—";
                lines.push(`  - ${nome}${m.funcao ? ` (${m.funcao})` : ""}`);
              }
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

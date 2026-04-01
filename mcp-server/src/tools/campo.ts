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
import { formatDate, formatDateTime, formatStatus, formatPhone } from "../utils/formatting.js";

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
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
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
            `id, numero, status, data_agendada, endereco_completo,
             contato_local, telefone_local, observacoes, created_at,
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
              if (inst.contato_local) lines.push(`- **Contato local**: ${inst.contato_local}`);
              if (inst.telefone_local) lines.push(`- **Telefone**: ${formatPhone(inst.telefone_local)}`);
              if (equipe.nome) lines.push(`- **Equipe**: ${equipe.nome}`);
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

  // ─── croma_agendar_instalacao ──────────────────────────────────────────────

  server.registerTool(
    "croma_agendar_instalacao",
    {
      title: "Agendar Instalação",
      description: `Cria ou agenda uma ordem de instalação para um pedido.

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - pedido_id (string, obrigatório): UUID do pedido que será instalado
  - data_agendada (string, obrigatório): Data/hora da instalação ISO (ex: 2026-04-01T09:00:00)
  - endereco_completo (string, obrigatório): Endereço completo do local
  - cidade (string, obrigatório): Cidade
  - estado (string, opcional): UF
  - contato_local (string, opcional): Nome do contato no local
  - telefone_local (string, opcional): Telefone do contato local
  - equipe_id (string, opcional): UUID da equipe responsável
  - observacoes (string, opcional): Observações para a equipe`,
      inputSchema: z.object({
        pedido_id: z.string().uuid(),
        data_agendada: z.string().describe("ISO datetime ex: 2026-04-01T09:00:00"),
        endereco_completo: z.string().min(5).max(400),
        cidade: z.string().min(2).max(100),
        estado: z.string().max(2).optional(),
        contato_local: z.string().max(100).optional(),
        telefone_local: z.string().max(20).optional(),
        equipe_id: z.string().uuid().optional(),
        observacoes: z.string().max(1000).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        // Verifica se pedido existe
        const { data: pedido, error: pedidoError } = await sb
          .from("pedidos")
          .select("id, numero, status")
          .eq("id", params.pedido_id)
          .single();

        if (pedidoError) return errorResult(pedidoError);
        if (!pedido) return { content: [{ type: "text" as const, text: `Pedido não encontrado: ${params.pedido_id}` }] };

        const enderecoFull = [
          params.endereco_completo,
          params.cidade,
          params.estado,
        ].filter(Boolean).join(", ");

        const { data, error } = await sb
          .from("ordens_instalacao")
          .insert({
            pedido_id: params.pedido_id,
            status: "agendada",
            data_agendada: params.data_agendada,
            endereco_completo: enderecoFull,
            contato_local: params.contato_local,
            telefone_local: params.telefone_local,
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
}

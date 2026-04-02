/**
 * Ferramentas de Propostas / Orçamentos
 * Consultar, criar e atualizar propostas comerciais da Croma Print
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient, getUserClient, getJuniorUserId, SUPABASE_URL } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatBRL, formatDate, formatStatus } from "../utils/formatting.js";

export function registerPropostasTools(server: McpServer): void {
  // ─── croma_listar_propostas ──────────────────────────────────────────────

  server.registerTool(
    "croma_listar_propostas",
    {
      title: "Listar Propostas",
      description: `Lista propostas/orçamentos com filtros opcionais.

Use para "orçamentos pendentes", "propostas aprovadas da semana", "propostas do cliente X".

Args:
  - status (string, opcional): rascunho|enviada|em_revisao|aprovada|recusada|expirada
  - cliente_id (string, opcional): UUID do cliente
  - cliente_busca (string, opcional): Busca por nome do cliente (alternativa ao cliente_id)
  - data_inicio (string, opcional): Data de criação inicial ISO (ex: 2026-01-01)
  - data_fim (string, opcional): Data de criação final ISO (ex: 2026-03-31)
  - valor_min (number, opcional): Valor mínimo do total em R$
  - valor_max (number, opcional): Valor máximo do total em R$
  - limit (number): Máximo de resultados (padrão: 20, máx: 100)
  - offset (number): Offset para paginação (padrão: 0)
  - response_format ('markdown'|'json'): Formato (padrão: markdown)`,
      inputSchema: z.object({
        status: z.enum(["rascunho", "enviada", "em_revisao", "aprovada", "recusada", "expirada"]).optional(),
        cliente_id: z.string().uuid().optional(),
        cliente_busca: z.string().optional().describe("Busca textual por nome do cliente"),
        data_inicio: z.string().optional().describe("ISO date ex: 2026-01-01"),
        data_fim: z.string().optional().describe("ISO date ex: 2026-03-31"),
        valor_min: z.coerce.number().min(0).optional(),
        valor_max: z.coerce.number().min(0).optional(),
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
          .from("propostas")
          .select(
            `id, numero, status, titulo, total, subtotal, desconto_percentual,
             validade_dias, created_at,
             clientes!inner(id, razao_social, nome_fantasia)`,
            { count: "exact" }
          );

        if (params.status) query = query.eq("status", params.status);
        if (params.cliente_id) query = query.eq("cliente_id", params.cliente_id);
        if (params.cliente_busca) {
          query = query.or(
            `clientes.razao_social.ilike.%${params.cliente_busca}%,clientes.nome_fantasia.ilike.%${params.cliente_busca}%`
          );
        }
        if (params.data_inicio) query = query.gte("created_at", params.data_inicio);
        if (params.data_fim) query = query.lte("created_at", params.data_fim + "T23:59:59");
        if (params.valor_min !== undefined) query = query.gte("total", params.valor_min);
        if (params.valor_max !== undefined) query = query.lte("total", params.valor_max);

        query = query
          .order("created_at", { ascending: false })
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Propostas (${total} encontradas)`, ""];
          if (items.length === 0) {
            lines.push("_Nenhuma proposta encontrada com os filtros informados._");
          } else {
            for (const p of items) {
              const cliente = (p.clientes as unknown as { razao_social: string; nome_fantasia?: string }) ?? {};
              const nomeCliente = cliente.nome_fantasia ?? cliente.razao_social ?? "—";
              lines.push(`### ${p.numero} — ${nomeCliente}`);
              lines.push(`- **ID**: \`${p.id}\``);
              if (p.titulo) lines.push(`- **Título**: ${p.titulo}`);
              lines.push(`- **Status**: ${formatStatus(p.status)}`);
              lines.push(`- **Total**: ${formatBRL(p.total)}`);
              if (p.desconto_percentual) lines.push(`- **Desconto**: ${p.desconto_percentual}%`);
              if (p.validade_dias) lines.push(`- **Validade**: ${p.validade_dias} dias`);
              lines.push(`- **Criada em**: ${formatDate(p.created_at)}`);
              lines.push("");
            }
            if (response.has_more) {
              lines.push(`_Mais resultados. Use offset: ${response.next_offset}._`);
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

  // ─── croma_detalhe_proposta ────────────────────────────────────────────────

  server.registerTool(
    "croma_detalhe_proposta",
    {
      title: "Detalhes da Proposta",
      description: `Retorna proposta completa com todos os itens, materiais e serviços.

Use para "abrir orçamento PROP-2026-0001", "ver itens do orçamento X", "detalhes da proposta Y".

Args:
  - id (string): UUID da proposta (use croma_listar_propostas para encontrar)
  - response_format ('markdown'|'json'): Formato (padrão: markdown)`,
      inputSchema: z.object({
        id: z.string().uuid("ID deve ser um UUID válido"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();

        const [propostaResult, itensResult] = await Promise.all([
          sb
            .from("propostas")
            .select(`*, clientes(id, razao_social, nome_fantasia, telefone, email)`)
            .eq("id", params.id)
            .single(),
          sb
            .from("proposta_itens")
            .select(`*`)
            .eq("proposta_id", params.id)
            .order("ordem"),
        ]);

        if (propostaResult.error) return errorResult(propostaResult.error);
        if (!propostaResult.data) {
          return { content: [{ type: "text" as const, text: `Proposta não encontrada: ${params.id}` }] };
        }

        const p = propostaResult.data;
        const itens = itensResult.data ?? [];
        const cliente = (p.clientes as { razao_social: string; nome_fantasia?: string; telefone?: string; email?: string }) ?? {};

        const fullData = { proposta: p, itens };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const nomeCliente = cliente.nome_fantasia ?? cliente.razao_social ?? "—";
          const lines = [
            `# Proposta ${p.numero}`,
            `**Cliente**: ${nomeCliente}`,
            `**Status**: ${formatStatus(p.status)}`,
            `**Data**: ${formatDate(p.created_at)}`,
            p.validade_dias ? `**Validade**: ${p.validade_dias} dias` : "",
            "",
            "## Valores",
            `- **Subtotal**: ${formatBRL(p.subtotal)}`,
            p.desconto_percentual ? `- **Desconto**: ${p.desconto_percentual}%` : "",
            `- **Total**: ${formatBRL(p.total)}`,
            "",
          ].filter(Boolean);

          if (p.condicoes_pagamento) {
            lines.push(`## Condições de Pagamento\n${p.condicoes_pagamento}\n`);
          }

          if (p.observacoes) {
            lines.push(`## Observações\n${p.observacoes}\n`);
          }

          if (itens.length > 0) {
            lines.push(`## Itens (${itens.length})`);
            for (const item of itens) {
              lines.push(`\n### ${item.descricao}`);
              lines.push(`- **Quantidade**: ${item.quantidade}`);
              if (item.largura_cm && item.altura_cm) {
                lines.push(`- **Dimensões**: ${item.largura_cm} × ${item.altura_cm} cm`);
              }
              lines.push(`- **Valor unitário**: ${formatBRL(item.valor_unitario)}`);
              lines.push(`- **Total**: ${formatBRL(item.valor_total)}`);
              if (item.material_descricao) lines.push(`- **Material**: ${item.material_descricao}`);
            }
          }

          text = lines.join("\n");
        } else {
          text = JSON.stringify(fullData, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, itens.length + 1) }],
          structuredContent: fullData,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_criar_proposta ──────────────────────────────────────────────────

  server.registerTool(
    "croma_criar_proposta",
    {
      title: "Criar Proposta",
      description: `Cria uma nova proposta/orçamento com itens.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - cliente_id (string, obrigatório): UUID do cliente
  - titulo (string, opcional): Título descritivo da proposta
  - validade_dias (number, opcional): Prazo de validade em dias (padrão: 30)
  - condicoes_pagamento (string, opcional): Texto das condições de pagamento
  - observacoes (string, opcional): Observações gerais
  - desconto_percentual (number, opcional): Desconto global em % (0-100)
  - itens (array, obrigatório): Lista de itens da proposta
    - descricao (string): Descrição do item
    - quantidade (number): Quantidade
    - valor_unitario (number): Preço unitário em R$
    - largura_cm (number, opcional): Largura em cm
    - altura_cm (number, opcional): Altura em cm
    - material_descricao (string, opcional): Descrição do material`,
      inputSchema: z.object({
        cliente_id: z.string().uuid(),
        titulo: z.string().max(200).optional(),
        validade_dias: z.coerce.number().int().min(1).max(365).default(30),
        condicoes_pagamento: z.string().max(500).optional(),
        observacoes: z.string().max(2000).optional(),
        desconto_percentual: z.number().min(0).max(100).optional(),
        itens: z.array(z.object({
          descricao: z.string().min(1).max(300),
          quantidade: z.number().positive(),
          valor_unitario: z.number().min(0),
          largura_cm: z.number().positive().optional(),
          altura_cm: z.number().positive().optional(),
          material_descricao: z.string().max(200).optional(),
        })).min(1, "Informe pelo menos 1 item na proposta"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        // Calcula totais
        const subtotal = params.itens.reduce(
          (sum, item) => sum + item.quantidade * item.valor_unitario, 0
        );
        const desconto = params.desconto_percentual ? subtotal * (params.desconto_percentual / 100) : 0;
        const total = subtotal - desconto;

        // Cria a proposta
        const { data: proposta, error: propostaError } = await sb
          .from("propostas")
          .insert({
            cliente_id: params.cliente_id,
            titulo: params.titulo,
            status: "rascunho",
            validade_dias: params.validade_dias,
            condicoes_pagamento: params.condicoes_pagamento,
            observacoes: params.observacoes,
            desconto_percentual: params.desconto_percentual,
            subtotal,
            total,
          })
          .select()
          .single();

        if (propostaError) return errorResult(propostaError);

        // Cria os itens
        const itensData = params.itens.map((item, idx) => ({
          proposta_id: proposta.id,
          ordem: idx + 1,
          descricao: item.descricao,
          especificacao: item.material_descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.quantidade * item.valor_unitario,
          largura_cm: item.largura_cm,
          altura_cm: item.altura_cm,
        }));

        const { error: itensError } = await sb.from("proposta_itens").insert(itensData);
        if (itensError) return errorResult(itensError);

        return {
          content: [{
            type: "text" as const,
            text: [
              `✅ Proposta criada com sucesso!`,
              ``,
              `- **Número**: ${proposta.numero}`,
              `- **ID**: \`${proposta.id}\``,
              `- **Status**: Rascunho`,
              `- **Itens**: ${params.itens.length}`,
              `- **Subtotal**: ${formatBRL(subtotal)}`,
              params.desconto_percentual ? `- **Desconto**: ${params.desconto_percentual}%` : "",
              `- **Total**: ${formatBRL(total)}`,
              ``,
              `Use croma_atualizar_status_proposta para marcar como "enviada" quando estiver pronta.`,
            ].filter(Boolean).join("\n"),
          }],
          structuredContent: { proposta, itens_criados: itensData.length },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_atualizar_status_proposta ──────────────────────────────────────

  server.registerTool(
    "croma_atualizar_status_proposta",
    {
      title: "Atualizar Status da Proposta",
      description: `Muda o status de uma proposta. Respeita as transições válidas.

Transições permitidas:
- rascunho → enviada
- enviada → em_revisao, aprovada, recusada, expirada
- em_revisao → enviada, aprovada, recusada

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - id (string, obrigatório): UUID da proposta
  - status (string, obrigatório): Novo status
  - motivo (string, opcional): Motivo da mudança (obrigatório ao recusar)`,
      inputSchema: z.object({
        id: z.string().uuid(),
        status: z.enum(["enviada", "em_revisao", "aprovada", "recusada", "expirada"]),
        motivo: z.string().max(500).optional().describe("Motivo (obrigatório ao recusar)"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();
        const adminSb = getAdminClient();

        // Verifica estado atual (admin para evitar filtro RLS)
        const { data: atual, error: fetchError } = await adminSb
          .from("propostas")
          .select("id, numero, status")
          .eq("id", params.id)
          .single();

        if (fetchError) return errorResult(fetchError);
        if (!atual) return { content: [{ type: "text" as const, text: `Proposta não encontrada: ${params.id}` }] };

        // Mapa de transições válidas
        const transicoes: Record<string, string[]> = {
          rascunho: ["enviada"],
          enviada: ["em_revisao", "aprovada", "recusada", "expirada"],
          em_revisao: ["enviada", "aprovada", "recusada"],
          aprovada: [],
          recusada: [],
          expirada: [],
        };

        const permitidas = transicoes[atual.status] ?? [];
        if (!permitidas.includes(params.status)) {
          return {
            content: [{
              type: "text" as const,
              text: `Transição inválida: ${formatStatus(atual.status)} → ${formatStatus(params.status)}.\n` +
                    `Transições permitidas de "${atual.status}": ${permitidas.length > 0 ? permitidas.join(", ") : "nenhuma (status final)"}`,
            }],
          };
        }

        const updateData: Record<string, unknown> = { status: params.status };
        if (params.motivo) updateData.observacoes = params.motivo;
        if (params.status === "aprovada") {
          updateData.aprovado_em = new Date().toISOString();
          updateData.aprovado_por = getJuniorUserId() ?? "MCP Agent";
        }

        const { error } = await sb.from("propostas").update(updateData).eq("id", params.id);
        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Proposta **${atual.numero}** atualizada: ${formatStatus(atual.status)} → **${formatStatus(params.status)}**${params.motivo ? `\nMotivo: ${params.motivo}` : ""}`,
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_enviar_proposta ────────────────────────────────────────────────

  server.registerTool(
    "croma_enviar_proposta",
    {
      title: "Enviar Proposta por Email",
      description: `Envia proposta/orçamento por email para o cliente via sistema Croma.

Use para "envia o orçamento da Ótica Gyan por email", "manda a proposta PROP-2026-0007 para o junior@cromaprint.com.br".

Args:
  - proposta_id (string, opcional): UUID da proposta
  - proposta_numero (string, opcional): Número da proposta (ex: PROP-2026-0007) — alternativa ao ID
  - destinatario_email (string, opcional): Email do destinatário. Se omitido, usa o email cadastrado no cliente
  - destinatario_nome (string, opcional): Nome para personalizar o email

Obs: Informe proposta_id OU proposta_numero. A proposta é marcada como "enviada" automaticamente.`,
      inputSchema: z.object({
        proposta_id: z.string().uuid().optional().describe("UUID da proposta (alternativa ao numero)"),
        proposta_numero: z.string().optional().describe("Número da proposta ex: PROP-2026-0007"),
        destinatario_email: z.string().email().optional().describe("Email do destinatário (usa email do cliente se omitido)"),
        destinatario_nome: z.string().optional().describe("Nome para personalizar o email"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        if (!params.proposta_id && !params.proposta_numero) {
          return {
            content: [{ type: "text" as const, text: "❌ Informe proposta_id (UUID) ou proposta_numero (ex: PROP-2026-0007)." }],
          };
        }

        const sb = getAdminClient();

        // Buscar proposta com dados do cliente
        let query = sb
          .from("propostas")
          .select("id, numero, status, share_token, clientes(nome_fantasia, razao_social, email)");

        if (params.proposta_id) {
          query = query.eq("id", params.proposta_id);
        } else {
          query = query.eq("numero", params.proposta_numero!);
        }

        const { data: proposta, error } = await query.single();
        if (error || !proposta) {
          const ref = params.proposta_numero ?? params.proposta_id;
          return { content: [{ type: "text" as const, text: `❌ Proposta não encontrada: ${ref}` }] };
        }

        // Resolver email do destinatário
        const cliente = (proposta.clientes as unknown as {
          nome_fantasia?: string;
          razao_social: string;
          email?: string;
        } | null);

        const emailDestino = params.destinatario_email ?? cliente?.email;
        if (!emailDestino) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Cliente sem email cadastrado. Informe destinatario_email explicitamente.\n` +
                    `Cliente: ${cliente?.nome_fantasia ?? cliente?.razao_social ?? "desconhecido"}`,
            }],
          };
        }

        // Obter JWT do usuário autenticado (necessário para a Edge Function)
        const userSb = getUserClient();
        const { data: { session } } = await userSb.auth.getSession();
        const jwt = session?.access_token;

        if (!jwt) {
          return {
            content: [{
              type: "text" as const,
              text: "❌ MCP sem sessão de usuário autenticado.\n" +
                    "Configure SUPABASE_USER_PASSWORD no ambiente do MCP server e reinicie.",
            }],
          };
        }

        // Chamar Edge Function enviar-email-proposta
        const edgeFnUrl = `${SUPABASE_URL}/functions/v1/enviar-email-proposta`;
        const res = await fetch(edgeFnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            proposta_id: proposta.id,
            destinatario_email: emailDestino,
            destinatario_nome: params.destinatario_nome ?? cliente?.nome_fantasia ?? cliente?.razao_social,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as Record<string, string>;
          return {
            content: [{
              type: "text" as const,
              text: `❌ Erro ao enviar email: ${errData["error"] ?? errData["message"] ?? `HTTP ${res.status}`}`,
            }],
          };
        }

        const nomeCliente = cliente?.nome_fantasia ?? cliente?.razao_social ?? "Cliente";
        const portalUrl = `https://crm-croma.vercel.app/p/${proposta.share_token}`;

        return {
          content: [{
            type: "text" as const,
            text: [
              `✅ Email enviado com sucesso!`,
              ``,
              `- **Proposta**: ${proposta.numero}`,
              `- **Cliente**: ${nomeCliente}`,
              `- **Destinatário**: ${emailDestino}`,
              `- **Link do portal**: ${portalUrl}`,
            ].join("\n"),
          }],
          structuredContent: {
            proposta_id: proposta.id,
            numero: proposta.numero,
            destinatario_email: emailDestino,
            portal_url: portalUrl,
          },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

/**
 * Ferramentas CRM — Clientes e Leads
 * Permite ao Claude consultar, cadastrar e atualizar clientes e leads da Croma Print
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSupabaseClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import {
  formatBRL,
  formatDate,
  formatCNPJ,
  formatPhone,
  formatStatus,
} from "../utils/formatting.js";

// ─── croma_listar_clientes ───────────────────────────────────────────────────

export function registerCrmTools(server: McpServer): void {
  server.registerTool(
    "croma_listar_clientes",
    {
      title: "Listar Clientes",
      description: `Lista clientes cadastrados na Croma Print com filtros opcionais.

Retorna empresas clientes (não leads). Use para responder "quais clientes temos?",
"buscar cliente Renner", "clientes classificação A", etc.

Args:
  - busca (string, opcional): Busca por razão social, nome fantasia ou CNPJ
  - classificacao ('A'|'B'|'C'|'D', opcional): Filtrar por classificação de importância
  - cidade (string, opcional): Filtrar por cidade
  - estado (string, opcional): UF, ex: 'RS', 'SP'
  - ativo (boolean, opcional): Filtrar por status ativo/inativo (padrão: true)
  - limit (number): Máximo de resultados (padrão: 20, máx: 100)
  - offset (number): Paginação (padrão: 0)
  - response_format ('markdown'|'json'): Formato da resposta (padrão: markdown)

Retorna lista com: id, razao_social, nome_fantasia, cnpj, telefone, email,
cidade, estado, classificacao, segmento, vendedor_id, limite_credito, ativo`,
      inputSchema: z.object({
        busca: z.string().optional().describe("Busca por nome ou CNPJ"),
        classificacao: z.enum(["A", "B", "C", "D"]).optional().describe("Classificação A/B/C/D"),
        cidade: z.string().optional().describe("Filtrar por cidade"),
        estado: z.string().max(2).optional().describe("UF ex: RS, SP"),
        ativo: z.boolean().optional().default(true).describe("Apenas ativos (padrão: true)"),
        limit: z.number().int().min(1).max(100).default(20).describe("Máximo de resultados"),
        offset: z.number().int().min(0).default(0).describe("Offset para paginação"),
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
        const sb = getSupabaseClient();

        let query = sb
          .from("clientes")
          .select(
            "id, razao_social, nome_fantasia, cnpj, telefone, email, cidade, estado, classificacao, segmento, ativo, limite_credito, created_at",
            { count: "exact" }
          );

        if (params.ativo !== undefined) query = query.eq("ativo", params.ativo);
        if (params.classificacao) query = query.eq("classificacao", params.classificacao);
        if (params.cidade) query = query.ilike("cidade", `%${params.cidade}%`);
        if (params.estado) query = query.eq("estado", params.estado.toUpperCase());
        if (params.busca) {
          query = query.or(
            `razao_social.ilike.%${params.busca}%,nome_fantasia.ilike.%${params.busca}%,cnpj.ilike.%${params.busca}%`
          );
        }

        query = query
          .order("razao_social")
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `## Clientes (${total} encontrados)`,
            "",
          ];
          if (items.length === 0) {
            lines.push("_Nenhum cliente encontrado com os filtros informados._");
          } else {
            for (const c of items) {
              lines.push(`### ${c.razao_social}${c.nome_fantasia ? ` (${c.nome_fantasia})` : ""}`);
              lines.push(`- **ID**: \`${c.id}\``);
              if (c.cnpj) lines.push(`- **CNPJ**: ${formatCNPJ(c.cnpj)}`);
              if (c.telefone) lines.push(`- **Telefone**: ${formatPhone(c.telefone)}`);
              if (c.email) lines.push(`- **Email**: ${c.email}`);
              if (c.cidade) lines.push(`- **Cidade**: ${c.cidade}${c.estado ? `/${c.estado}` : ""}`);
              if (c.classificacao) lines.push(`- **Classificação**: ${c.classificacao}`);
              if (c.segmento) lines.push(`- **Segmento**: ${c.segmento}`);
              if (c.limite_credito) lines.push(`- **Limite de Crédito**: ${formatBRL(c.limite_credito)}`);
              lines.push(`- **Status**: ${c.ativo ? "✅ Ativo" : "❌ Inativo"}`);
              lines.push("");
            }
            if (response.has_more) {
              lines.push(`_Há mais resultados. Use offset: ${response.next_offset} para continuar._`);
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

  // ─── croma_detalhe_cliente ─────────────────────────────────────────────────

  server.registerTool(
    "croma_detalhe_cliente",
    {
      title: "Detalhes do Cliente",
      description: `Retorna informações completas de um cliente: dados cadastrais, contatos,
unidades/filiais e resumo financeiro.

Use para responder "dados do cliente X", "contatos da Renner", "filiais do cliente Y".

Args:
  - id (string): UUID do cliente (use croma_listar_clientes para encontrar o ID)
  - response_format ('markdown'|'json'): Formato da resposta (padrão: markdown)`,
      inputSchema: z.object({
        id: z.string().uuid("ID deve ser um UUID válido").describe("UUID do cliente"),
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
        const sb = getSupabaseClient();

        const [clienteResult, contatosResult, unidadesResult, propostasResult, pedidosResult] =
          await Promise.all([
            sb.from("clientes").select("*").eq("id", params.id).single(),
            sb.from("cliente_contatos").select("*").eq("cliente_id", params.id).eq("ativo", true),
            sb.from("cliente_unidades").select("*").eq("cliente_id", params.id).eq("ativo", true),
            sb
              .from("propostas")
              .select("id, numero, status, total, created_at")
              .eq("cliente_id", params.id)
              .order("created_at", { ascending: false })
              .limit(5),
            sb
              .from("pedidos")
              .select("id, numero, status, valor_total, created_at")
              .eq("cliente_id", params.id)
              .order("created_at", { ascending: false })
              .limit(5),
          ]);

        if (clienteResult.error) return errorResult(clienteResult.error);
        if (!clienteResult.data) {
          return { content: [{ type: "text" as const, text: `Cliente não encontrado: ${params.id}` }] };
        }

        const c = clienteResult.data;
        const contatos = contatosResult.data ?? [];
        const unidades = unidadesResult.data ?? [];
        const propostas = propostasResult.data ?? [];
        const pedidos = pedidosResult.data ?? [];

        const fullData = { cliente: c, contatos, unidades, propostas_recentes: propostas, pedidos_recentes: pedidos };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `# ${c.razao_social}`,
            c.nome_fantasia ? `**Nome Fantasia**: ${c.nome_fantasia}` : "",
            "",
            "## Dados Cadastrais",
            `- **ID**: \`${c.id}\``,
            c.cnpj ? `- **CNPJ**: ${formatCNPJ(c.cnpj)}` : "",
            c.inscricao_estadual ? `- **IE**: ${c.inscricao_estadual}` : "",
            c.telefone ? `- **Telefone**: ${formatPhone(c.telefone)}` : "",
            c.email ? `- **Email**: ${c.email}` : "",
            c.site ? `- **Site**: ${c.site}` : "",
            c.segmento ? `- **Segmento**: ${c.segmento}` : "",
            c.classificacao ? `- **Classificação**: ${c.classificacao}` : "",
            c.tipo_cliente ? `- **Tipo**: ${c.tipo_cliente}` : "",
            c.sla_dias ? `- **SLA**: ${c.sla_dias} dias` : "",
            c.limite_credito ? `- **Limite de Crédito**: ${formatBRL(c.limite_credito)}` : "",
            `- **Status**: ${c.ativo ? "✅ Ativo" : "❌ Inativo"}`,
            `- **Cadastrado em**: ${formatDate(c.created_at)}`,
            "",
            "## Endereço",
            c.endereco ? `- **Endereço**: ${c.endereco}` : "",
            c.cidade ? `- **Cidade**: ${c.cidade}/${c.estado ?? ""}` : "",
            c.cep ? `- **CEP**: ${c.cep}` : "",
            "",
          ].filter(Boolean);

          if (contatos.length > 0) {
            lines.push("## Contatos");
            for (const ct of contatos) {
              lines.push(`### ${ct.nome}${ct.principal ? " ⭐" : ""}`);
              if (ct.cargo) lines.push(`- **Cargo**: ${ct.cargo}`);
              if (ct.telefone) lines.push(`- **Telefone**: ${formatPhone(ct.telefone)}`);
              if (ct.whatsapp) lines.push(`- **WhatsApp**: ${formatPhone(ct.whatsapp)}`);
              if (ct.email) lines.push(`- **Email**: ${ct.email}`);
              if (ct.e_decisor) lines.push("- **É decisor**: ✅");
              lines.push("");
            }
          }

          if (unidades.length > 0) {
            lines.push("## Unidades / Filiais");
            for (const u of unidades) {
              lines.push(`### ${u.nome}`);
              if (u.cidade) lines.push(`- **Cidade**: ${u.cidade}/${u.estado ?? ""}`);
              if (u.endereco) lines.push(`- **Endereço**: ${u.endereco}`);
              if (u.contato_local) lines.push(`- **Contato local**: ${u.contato_local}`);
              lines.push("");
            }
          }

          if (propostas.length > 0) {
            lines.push("## Propostas Recentes");
            for (const p of propostas) {
              lines.push(`- **${p.numero}** — ${formatStatus(p.status)} — ${formatBRL(p.total)} — ${formatDate(p.created_at)}`);
            }
            lines.push("");
          }

          if (pedidos.length > 0) {
            lines.push("## Pedidos Recentes");
            for (const p of pedidos) {
              lines.push(`- **${p.numero}** — ${formatStatus(p.status)} — ${formatBRL(p.valor_total)} — ${formatDate(p.created_at)}`);
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

  // ─── croma_cadastrar_cliente ───────────────────────────────────────────────

  server.registerTool(
    "croma_cadastrar_cliente",
    {
      title: "Cadastrar Cliente",
      description: `Cria um novo cliente na Croma Print.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - razao_social (string, obrigatório): Razão social da empresa
  - nome_fantasia (string, opcional): Nome fantasia
  - cnpj (string, opcional): CNPJ com 14 dígitos (apenas números)
  - telefone (string, opcional): Telefone de contato
  - email (string, opcional): Email principal
  - segmento (string, opcional): Segmento de atuação
  - classificacao ('A'|'B'|'C'|'D', opcional): Classificação de importância
  - tipo_cliente (string, opcional): agencia/cliente_final/revenda
  - cidade (string, opcional): Cidade
  - estado (string, opcional): UF ex: RS
  - cep (string, opcional): CEP
  - endereco (string, opcional): Endereço completo

Retorna: dados do cliente criado com ID gerado`,
      inputSchema: z.object({
        razao_social: z.string().min(1).max(200).describe("Razão social (obrigatório)"),
        nome_fantasia: z.string().max(200).optional().describe("Nome fantasia"),
        cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos (sem pontuação)").optional(),
        telefone: z.string().max(20).optional(),
        email: z.string().email("Email inválido").optional(),
        segmento: z.string().max(100).optional(),
        classificacao: z.enum(["A", "B", "C", "D"]).optional(),
        tipo_cliente: z.enum(["agencia", "cliente_final", "revenda"]).optional(),
        cidade: z.string().max(100).optional(),
        estado: z.string().max(2).optional(),
        cep: z.string().max(9).optional(),
        endereco: z.string().max(300).optional(),
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
        const sb = getSupabaseClient();
        const { data, error } = await sb
          .from("clientes")
          .insert({ ...params, ativo: true })
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Cliente cadastrado com sucesso!\n\n- **ID**: \`${data.id}\`\n- **Razão Social**: ${data.razao_social}\n- **CNPJ**: ${formatCNPJ(data.cnpj)}\n- **Cadastrado em**: ${formatDate(data.created_at)}`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_atualizar_cliente ───────────────────────────────────────────────

  server.registerTool(
    "croma_atualizar_cliente",
    {
      title: "Atualizar Cliente",
      description: `Atualiza dados de um cliente existente. Apenas os campos informados são alterados.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - id (string, obrigatório): UUID do cliente
  - razao_social (string, opcional): Nova razão social
  - nome_fantasia (string, opcional): Novo nome fantasia
  - telefone (string, opcional): Novo telefone
  - email (string, opcional): Novo email
  - classificacao ('A'|'B'|'C'|'D', opcional): Nova classificação
  - segmento (string, opcional): Novo segmento
  - cidade (string, opcional): Nova cidade
  - estado (string, opcional): Nova UF
  - ativo (boolean, opcional): Ativar/desativar cliente
  - limite_credito (number, opcional): Novo limite de crédito em R$`,
      inputSchema: z.object({
        id: z.string().uuid("ID deve ser um UUID válido").describe("UUID do cliente"),
        razao_social: z.string().min(1).max(200).optional(),
        nome_fantasia: z.string().max(200).optional(),
        telefone: z.string().max(20).optional(),
        email: z.string().email().optional(),
        classificacao: z.enum(["A", "B", "C", "D"]).optional(),
        segmento: z.string().max(100).optional(),
        cidade: z.string().max(100).optional(),
        estado: z.string().max(2).optional(),
        ativo: z.boolean().optional(),
        limite_credito: z.number().min(0).optional(),
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
        const { id, ...updates } = params;
        if (Object.keys(updates).length === 0) {
          return { content: [{ type: "text" as const, text: "Nenhum campo para atualizar foi informado." }] };
        }

        const sb = getSupabaseClient();
        const { data, error } = await sb
          .from("clientes")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) return errorResult(error);
        if (!data) return { content: [{ type: "text" as const, text: `Cliente não encontrado: ${id}` }] };

        return {
          content: [{
            type: "text" as const,
            text: `✅ Cliente atualizado com sucesso!\n\n- **${data.razao_social}** (${data.id})\n- Campos atualizados: ${Object.keys(updates).join(", ")}`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_leads ────────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_leads",
    {
      title: "Listar Leads",
      description: `Lista leads (prospects) com filtros opcionais.

Use para "leads de hoje", "leads novos", "leads do vendedor X", etc.

Args:
  - status (string, opcional): novo|em_contato|qualificando|qualificado|descartado
  - busca (string, opcional): Busca por empresa ou nome do contato
  - vendedor_id (string, opcional): UUID do vendedor responsável
  - segmento (string, opcional): Segmento de atuação
  - score_min (number, opcional): Score mínimo (0-100)
  - limit (number): Máximo de resultados (padrão: 20)
  - offset (number): Paginação (padrão: 0)
  - response_format ('markdown'|'json'): Formato (padrão: markdown)`,
      inputSchema: z.object({
        status: z.enum(["novo", "em_contato", "qualificando", "qualificado", "descartado"]).optional(),
        busca: z.string().optional().describe("Busca por empresa ou nome do contato"),
        vendedor_id: z.string().uuid().optional(),
        segmento: z.string().optional(),
        score_min: z.number().int().min(0).max(100).optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
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
        const sb = getSupabaseClient();
        let query = sb
          .from("leads")
          .select("id, empresa, contato_nome, telefone, email, status, score, segmento, origem_id, vendedor_id, created_at", { count: "exact" });

        if (params.status) query = query.eq("status", params.status);
        if (params.vendedor_id) query = query.eq("vendedor_id", params.vendedor_id);
        if (params.segmento) query = query.ilike("segmento", `%${params.segmento}%`);
        if (params.score_min !== undefined) query = query.gte("score", params.score_min);
        if (params.busca) {
          query = query.or(`empresa.ilike.%${params.busca}%,contato_nome.ilike.%${params.busca}%`);
        }

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
          const lines = [`## Leads (${total} encontrados)`, ""];
          if (items.length === 0) {
            lines.push("_Nenhum lead encontrado com os filtros informados._");
          } else {
            for (const l of items) {
              lines.push(`### ${l.empresa}`);
              lines.push(`- **ID**: \`${l.id}\``);
              if (l.contato_nome) lines.push(`- **Contato**: ${l.contato_nome}`);
              if (l.telefone) lines.push(`- **Telefone**: ${formatPhone(l.telefone)}`);
              if (l.email) lines.push(`- **Email**: ${l.email}`);
              lines.push(`- **Status**: ${formatStatus(l.status)}`);
              if (l.score) lines.push(`- **Score**: ${l.score}/100`);
              if (l.segmento) lines.push(`- **Segmento**: ${l.segmento}`);
              lines.push(`- **Criado em**: ${formatDate(l.created_at)}`);
              lines.push("");
            }
            if (response.has_more) {
              lines.push(`_Mais resultados disponíveis. Use offset: ${response.next_offset}._`);
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

  // ─── croma_cadastrar_lead ──────────────────────────────────────────────────

  server.registerTool(
    "croma_cadastrar_lead",
    {
      title: "Cadastrar Lead",
      description: `Cria um novo lead (prospect de venda) na Croma Print.

ATENÇÃO: Ação que modifica dados. Use quando o usuário dizer "cadastrar lead", "adicionar prospect", etc.

Args:
  - empresa (string, obrigatório): Nome da empresa
  - contato_nome (string, opcional): Nome da pessoa de contato
  - telefone (string, opcional): Telefone
  - email (string, opcional): Email
  - cargo (string, opcional): Cargo do contato
  - segmento (string, opcional): Segmento de mercado
  - observacoes (string, opcional): Observações livres
  - score (number, opcional): Score inicial 0-100 (padrão: 50)`,
      inputSchema: z.object({
        empresa: z.string().min(1).max(200).describe("Nome da empresa (obrigatório)"),
        contato_nome: z.string().max(100).optional(),
        telefone: z.string().max(20).optional(),
        email: z.string().email().optional(),
        cargo: z.string().max(100).optional(),
        segmento: z.string().max(100).optional(),
        observacoes: z.string().max(1000).optional(),
        score: z.number().int().min(0).max(100).default(50),
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
        const sb = getSupabaseClient();
        const { data, error } = await sb
          .from("leads")
          .insert({ ...params, status: "novo" })
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Lead cadastrado com sucesso!\n\n- **ID**: \`${data.id}\`\n- **Empresa**: ${data.empresa}\n- **Status**: Novo\n- **Score**: ${data.score}/100\n- **Criado em**: ${formatDate(data.created_at)}`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

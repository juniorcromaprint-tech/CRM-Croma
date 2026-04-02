/**
 * Ferramentas CRM — Clientes e Leads
 * Permite ao Claude consultar, cadastrar e atualizar clientes e leads da Croma Print
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient, getUserClient } from "../supabase-client.js";
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
        limit: z.coerce.number().int().min(1).max(100).default(20).describe("Máximo de resultados"),
        offset: z.coerce.number().int().min(0).default(0).describe("Offset para paginação"),
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
        const sb = getAdminClient();

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
        const sb = getAdminClient();

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
        lead_id: z.string().uuid().optional().describe("UUID do lead de origem (para rastreamento de conversão)"),
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
        const sb = getUserClient();
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

        const sb = getUserClient();
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
  - status (string, opcional): novo|em_contato|contatado|qualificando|qualificado|proposta_enviada|negociando|convertido|perdido|descartado
  - busca (string, opcional): Busca por empresa ou nome do contato
  - vendedor_id (string, opcional): UUID do vendedor responsável
  - segmento (string, opcional): Segmento de atuação
  - score_min (number, opcional): Score mínimo (0-100)
  - limit (number): Máximo de resultados (padrão: 20)
  - offset (number): Paginação (padrão: 0)
  - response_format ('markdown'|'json'): Formato (padrão: markdown)`,
      inputSchema: z.object({
        status: z.enum(["novo", "em_contato", "contatado", "qualificando", "qualificado", "proposta_enviada", "negociando", "convertido", "perdido", "descartado"]).optional(),
        busca: z.string().optional().describe("Busca por empresa ou nome do contato"),
        vendedor_id: z.string().uuid().optional(),
        segmento: z.string().optional(),
        score_min: z.coerce.number().int().min(0).max(100).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
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
        const sb = getAdminClient();
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
        score: z.coerce.number().int().min(0).max(100).default(50),
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
        const sb = getUserClient();
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

  // ─── croma_atualizar_status_lead ──────────────────────────────────────────

  server.registerTool(
    "croma_atualizar_status_lead",
    {
      title: "Atualizar Status do Lead",
      description: `Atualiza o status de um lead no pipeline de vendas.

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Transições válidas:
- novo → em_contato, contatado, descartado
- em_contato → contatado, qualificando, descartado
- contatado → qualificando, descartado
- qualificando → qualificado, descartado
- qualificado → proposta_enviada, negociando, descartado
- proposta_enviada → negociando, convertido, perdido
- negociando → convertido, perdido
- convertido → (final)
- perdido → novo (reabrir)
- descartado → novo (reabrir)

Args:
  - id (string, obrigatório): UUID do lead
  - status (string, obrigatório): Novo status
  - observacao (string, opcional): Motivo da mudança`,
      inputSchema: z.object({
        id: z.string().uuid(),
        status: z.enum([
          "novo", "em_contato", "contatado", "qualificando", "qualificado",
          "proposta_enviada", "negociando", "convertido", "perdido", "descartado"
        ]),
        observacao: z.string().max(500).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        const { data: atual, error: fetchError } = await sb
          .from("leads")
          .select("id, empresa, status")
          .eq("id", params.id)
          .single();

        if (fetchError) return errorResult(fetchError);
        if (!atual) return { content: [{ type: "text" as const, text: `Lead não encontrado: ${params.id}` }] };

        const transicoes: Record<string, string[]> = {
          novo: ["em_contato", "contatado", "descartado"],
          em_contato: ["contatado", "qualificando", "descartado"],
          contatado: ["qualificando", "descartado"],
          qualificando: ["qualificado", "descartado"],
          qualificado: ["proposta_enviada", "negociando", "descartado"],
          proposta_enviada: ["negociando", "convertido", "perdido"],
          negociando: ["convertido", "perdido"],
          convertido: [],
          perdido: ["novo"],
          descartado: ["novo"],
        };

        const permitidas = transicoes[atual.status] ?? [];
        if (!permitidas.includes(params.status)) {
          return {
            content: [{
              type: "text" as const,
              text: `Transição inválida: ${formatStatus(atual.status)} → ${formatStatus(params.status)}.\n` +
                    `Permitidas de "${atual.status}": ${permitidas.length > 0 ? permitidas.join(", ") : "nenhuma (status final)"}`,
            }],
          };
        }

        const updateData: Record<string, unknown> = { status: params.status };
        if (params.observacao) updateData.observacoes = params.observacao;

        const { error } = await sb
          .from("leads")
          .update(updateData)
          .eq("id", params.id)
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Lead **${atual.empresa}** atualizado: ${formatStatus(atual.status)} → **${formatStatus(params.status)}**${params.observacao ? `\nObs: ${params.observacao}` : ""}`,
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_atividades_comerciais ────────────────────────────────────

  server.registerTool(
    "croma_listar_atividades_comerciais",
    {
      title: "Listar Atividades Comerciais",
      description: `Lista atividades comerciais (visitas, ligações, reuniões, emails) registradas no CRM.

Use para "atividades do cliente X", "ligações da semana", "histórico de visitas".

Args:
  - filtro_entidade_id (string, opcional): UUID do cliente ou lead
  - filtro_entidade_tipo (string, opcional): 'cliente' ou 'lead'
  - filtro_tipo (string, opcional): visita|ligacao|email|reuniao|whatsapp|outro
  - data_inicio / data_fim (string, opcional): Período YYYY-MM-DD
  - limit_rows (number): Padrão 50
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        filtro_entidade_id: z.string().uuid().optional().describe("UUID do cliente ou lead"),
        filtro_entidade_tipo: z.enum(["cliente", "lead"]).optional(),
        filtro_tipo: z.enum(["visita", "ligacao", "email", "reuniao", "whatsapp", "outro"]).optional(),
        data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit_rows: z.coerce.number().int().min(1).max(500).default(50),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();
        let query = sb
          .from("atividades_comerciais")
          .select("id, tipo, entidade_tipo, entidade_id, descricao, data_atividade, duracao_minutos, resultado, proximo_passo, created_at", { count: "exact" });

        if (params.filtro_entidade_id) query = query.eq("entidade_id", params.filtro_entidade_id);
        if (params.filtro_entidade_tipo) query = query.eq("entidade_tipo", params.filtro_entidade_tipo);
        if (params.filtro_tipo) query = query.eq("tipo", params.filtro_tipo);
        if (params.data_inicio) query = query.gte("data_atividade", params.data_inicio);
        if (params.data_fim) query = query.lte("data_atividade", params.data_fim + "T23:59:59");

        query = query.order("data_atividade", { ascending: false }).limit(params.limit_rows);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, 0, params.limit_rows);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const tipoLabel: Record<string, string> = {
            visita: "🚗 Visita", ligacao: "📞 Ligação", email: "📧 Email",
            reuniao: "🤝 Reunião", whatsapp: "💬 WhatsApp", outro: "📋 Outro",
          };
          const lines = [`## Atividades Comerciais (${total})`, ""];
          if (items.length === 0) {
            lines.push("_Nenhuma atividade registrada._");
          } else {
            for (const a of items) {
              lines.push(`### ${tipoLabel[a.tipo] ?? a.tipo} — ${formatDate(a.data_atividade)}`);
              lines.push(`- **ID**: \`${a.id}\``);
              lines.push(`- **Tipo entidade**: ${a.entidade_tipo} \`${a.entidade_id}\``);
              if (a.descricao) lines.push(`- **Descrição**: ${a.descricao}`);
              if (a.duracao_minutos) lines.push(`- **Duração**: ${a.duracao_minutos} min`);
              if (a.resultado) lines.push(`- **Resultado**: ${a.resultado}`);
              if (a.proximo_passo) lines.push(`- **Próximo passo**: ${a.proximo_passo}`);
              lines.push("");
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

  // ─── croma_registrar_atividade_comercial ───────────────────────────────────

  server.registerTool(
    "croma_registrar_atividade_comercial",
    {
      title: "Registrar Atividade Comercial",
      description: `Registra uma atividade comercial (visita, ligação, reunião, email, WhatsApp).

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - entidade_tipo (string, obrigatório): 'cliente' ou 'lead'
  - entidade_id (string, obrigatório): UUID do cliente ou lead
  - tipo (string, obrigatório): visita|ligacao|email|reuniao|whatsapp|outro
  - descricao (string, obrigatório): Descrição do que foi feito/discutido
  - duracao_minutos (number, opcional): Duração em minutos
  - data_atividade (string, opcional): Data/hora ISO — padrão: agora
  - resultado (string, opcional): Resultado da atividade
  - proximo_passo (string, opcional): Próxima ação prevista`,
      inputSchema: z.object({
        entidade_tipo: z.enum(["cliente", "lead"]).describe("Tipo: 'cliente' ou 'lead'"),
        entidade_id: z.string().uuid().describe("UUID do cliente ou lead"),
        tipo: z.enum(["visita", "ligacao", "email", "reuniao", "whatsapp", "outro"]),
        descricao: z.string().min(3).max(500),
        duracao_minutos: z.coerce.number().int().positive().optional(),
        data_atividade: z.string().optional().describe("ISO datetime, padrão: agora"),
        resultado: z.string().max(200).optional(),
        proximo_passo: z.string().max(200).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();
        const { data, error } = await sb
          .from("atividades_comerciais")
          .insert({
            tipo: params.tipo,
            entidade_tipo: params.entidade_tipo,
            entidade_id: params.entidade_id,
            descricao: params.descricao,
            duracao_minutos: params.duracao_minutos ?? null,
            data_atividade: params.data_atividade ?? new Date().toISOString(),
            resultado: params.resultado ?? null,
            proximo_passo: params.proximo_passo ?? null,
          })
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Atividade registrada!\n\n- **ID**: \`${data.id}\`\n- **Tipo**: ${data.tipo}\n- **${data.entidade_tipo}**: \`${data.entidade_id}\`\n- **Descrição**: ${data.descricao}\n- **Data**: ${formatDate(data.data_atividade)}`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_comissoes ────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_comissoes",
    {
      title: "Listar Comissões",
      description: `Lista comissões de vendedores com filtros opcionais.

Use para "comissões do mês", "comissões pendentes", "comissões do vendedor X".

Args:
  - filtro_vendedor (string, opcional): UUID do vendedor
  - filtro_status (string, opcional): gerada|paga|cancelada
  - data_inicio / data_fim (string, opcional): Período YYYY-MM-DD
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        filtro_vendedor: z.string().uuid().optional(),
        filtro_status: z.enum(["gerada", "paga", "cancelada"]).optional(),
        data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();
        let query = sb
          .from("comissoes")
          .select("id, vendedor_id, pedido_id, percentual, valor_base, valor_comissao, status, data_pagamento, created_at, profiles(full_name)", { count: "exact" })
          .is("excluido_em", null);

        if (params.filtro_vendedor) query = query.eq("vendedor_id", params.filtro_vendedor);
        if (params.filtro_status) query = query.eq("status", params.filtro_status);
        if (params.data_inicio) query = query.gte("created_at", params.data_inicio);
        if (params.data_fim) query = query.lte("created_at", params.data_fim + "T23:59:59");

        query = query.order("created_at", { ascending: false });

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const totalValor = items.reduce((s, c) => s + Number(c.valor_comissao), 0);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Comissões (${total}) — Total: ${formatBRL(totalValor)}`, ""];
          if (items.length === 0) {
            lines.push("_Nenhuma comissão encontrada._");
          } else {
            for (const c of items) {
              const vendedor = (c.profiles as { full_name?: string } | null)?.full_name ?? c.vendedor_id;
              const statusIcon = c.status === "paga" ? "✅" : c.status === "cancelada" ? "❌" : "⏳";
              lines.push(`- ${statusIcon} **${vendedor}** — Pedido \`${c.pedido_id?.substring(0, 8)}\` — ${c.percentual}% — **${formatBRL(c.valor_comissao)}** — ${formatDate(c.created_at)}`);
            }
          }
          text = lines.join("\n");
        } else {
          text = JSON.stringify({ count: total, total_valor: totalValor, items }, null, 2);
        }

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { count: total, total_valor: totalValor, items },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_registrar_comissao ──────────────────────────────────────────────

  server.registerTool(
    "croma_registrar_comissao",
    {
      title: "Registrar Comissão",
      description: `Registra uma comissão de venda para um vendedor.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - pedido_id (string, obrigatório): UUID do pedido gerador da comissão
  - vendedor_id (string, obrigatório): UUID do vendedor (profile)
  - percentual (number, obrigatório): Percentual de comissão (0-100)
  - valor_base (number, obrigatório): Valor base de cálculo (normalmente valor do pedido)
  - observacoes (string, opcional): Observações`,
      inputSchema: z.object({
        pedido_id: z.string().uuid().describe("UUID do pedido"),
        vendedor_id: z.string().uuid().describe("UUID do vendedor (profile)"),
        percentual: z.coerce.number().min(0).max(100),
        valor_base: z.coerce.number().positive().describe("Valor base de cálculo"),
        observacoes: z.string().max(200).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();
        const valorComissao = (params.valor_base * params.percentual) / 100;

        const { data, error } = await sb
          .from("comissoes")
          .insert({
            pedido_id: params.pedido_id,
            vendedor_id: params.vendedor_id,
            percentual: params.percentual,
            valor_base: params.valor_base,
            valor_comissao: valorComissao,
            status: "gerada",
          })
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Comissão registrada!\n\n- **ID**: \`${data.id}\`\n- **Pedido**: \`${data.pedido_id}\`\n- **Percentual**: ${data.percentual}%\n- **Valor base**: ${formatBRL(data.valor_base)}\n- **Comissão**: **${formatBRL(data.valor_comissao)}**\n- **Status**: Gerada`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_contratos ────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_contratos",
    {
      title: "Listar Contratos de Serviço",
      description: `Lista contratos de serviço recorrente com clientes.

Use para "contratos ativos", "contratos do cliente X", "renovações do mês".

Args:
  - filtro_cliente (string, opcional): UUID do cliente
  - filtro_status (string, opcional): ativo|encerrado|suspenso
  - limit_rows (number): Padrão 50
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        filtro_cliente: z.string().uuid().optional(),
        filtro_status: z.string().max(20).optional(),
        limit_rows: z.coerce.number().int().min(1).max(500).default(50),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();
        let query = sb
          .from("contratos_servico")
          .select("id, cliente_id, descricao, valor_mensal, periodicidade, data_inicio, data_fim, status, proximo_faturamento, clientes(razao_social, nome_fantasia)", { count: "exact" })
          .is("excluido_em", null);

        if (params.filtro_cliente) query = query.eq("cliente_id", params.filtro_cliente);
        if (params.filtro_status) query = query.eq("status", params.filtro_status);

        query = query.order("created_at", { ascending: false }).limit(params.limit_rows);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Contratos de Serviço (${total})`, ""];
          if (items.length === 0) {
            lines.push("_Nenhum contrato encontrado._");
          } else {
            for (const c of items) {
              const cliente = (c.clientes as { razao_social?: string; nome_fantasia?: string } | null);
              const nomeCliente = cliente?.nome_fantasia ?? cliente?.razao_social ?? c.cliente_id;
              const statusIcon = c.status === "ativo" ? "✅" : c.status === "encerrado" ? "🔴" : "⏸️";
              lines.push(`### ${statusIcon} ${nomeCliente}`);
              lines.push(`- **ID**: \`${c.id}\``);
              lines.push(`- **Descrição**: ${c.descricao}`);
              lines.push(`- **Valor mensal**: ${formatBRL(c.valor_mensal)}`);
              if (c.periodicidade) lines.push(`- **Periodicidade**: ${c.periodicidade}`);
              lines.push(`- **Início**: ${formatDate(c.data_inicio)}`);
              if (c.data_fim) lines.push(`- **Fim**: ${formatDate(c.data_fim)}`);
              if (c.proximo_faturamento) lines.push(`- **Próximo faturamento**: ${formatDate(c.proximo_faturamento)}`);
              lines.push("");
            }
          }
          text = lines.join("\n");
        } else {
          text = JSON.stringify(buildPaginatedResponse(items, total, 0, params.limit_rows), null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, items.length) }],
          structuredContent: buildPaginatedResponse(items, total, 0, params.limit_rows),
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_criar_contrato ──────────────────────────────────────────────────

  server.registerTool(
    "croma_criar_contrato",
    {
      title: "Criar Contrato de Serviço",
      description: `Cria um novo contrato de serviço recorrente para um cliente.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - cliente_id (string, obrigatório): UUID do cliente
  - descricao (string, obrigatório): Descrição do serviço contratado
  - valor_mensal (number, obrigatório): Valor mensal do contrato
  - data_inicio (string, obrigatório): Data de início YYYY-MM-DD
  - data_fim (string, opcional): Data de encerramento YYYY-MM-DD
  - periodicidade (string, opcional): mensal|trimestral|anual (padrão: mensal)
  - observacoes (string, opcional): Observações`,
      inputSchema: z.object({
        cliente_id: z.string().uuid().describe("UUID do cliente"),
        descricao: z.string().min(3).max(500),
        valor_mensal: z.coerce.number().positive(),
        data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD"),
        data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        periodicidade: z.enum(["mensal", "trimestral", "semestral", "anual"]).default("mensal"),
        observacoes: z.string().max(500).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();
        const { data, error } = await sb
          .from("contratos_servico")
          .insert({ ...params, status: "ativo" })
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Contrato criado!\n\n- **ID**: \`${data.id}\`\n- **Cliente**: \`${data.cliente_id}\`\n- **Descrição**: ${data.descricao}\n- **Valor mensal**: ${formatBRL(data.valor_mensal)}\n- **Início**: ${formatDate(data.data_inicio)}\n- **Status**: Ativo`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_campanhas ────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_campanhas",
    {
      title: "Listar Campanhas Comerciais",
      description: `Lista campanhas de marketing/comerciais com métricas de envio.

Use para "campanhas ativas", "resultado das campanhas", "emails enviados".

Args:
  - filtro_status (string, opcional): ativa|rascunho|encerrada|pausada
  - limit_rows (number): Padrão 50
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        filtro_status: z.string().max(20).optional(),
        limit_rows: z.coerce.number().int().min(1).max(500).default(50),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();
        let query = sb
          .from("campanhas")
          .select("id, nome, descricao, origem, status, data_inicio, data_fim, orcamento, total_enviados, total_abertos, created_at", { count: "exact" });

        if (params.filtro_status) query = query.eq("status", params.filtro_status);
        query = query.order("created_at", { ascending: false }).limit(params.limit_rows);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Campanhas (${total})`, ""];
          if (items.length === 0) {
            lines.push("_Nenhuma campanha encontrada._");
          } else {
            for (const c of items) {
              const taxaAbertura = c.total_enviados > 0
                ? ((c.total_abertos / c.total_enviados) * 100).toFixed(1)
                : "0";
              lines.push(`### ${c.nome} — ${formatStatus(c.status)}`);
              lines.push(`- **ID**: \`${c.id}\``);
              if (c.descricao) lines.push(`- **Descrição**: ${c.descricao}`);
              lines.push(`- **Canal**: ${c.origem}`);
              if (c.data_inicio) lines.push(`- **Período**: ${formatDate(c.data_inicio)}${c.data_fim ? ` a ${formatDate(c.data_fim)}` : ""}`);
              if (c.orcamento) lines.push(`- **Orçamento**: ${formatBRL(c.orcamento)}`);
              lines.push(`- **Enviados**: ${c.total_enviados} | **Abertos**: ${c.total_abertos} (${taxaAbertura}%)`);
              lines.push("");
            }
          }
          text = lines.join("\n");
        } else {
          text = JSON.stringify({ count: total, items }, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, items.length) }],
          structuredContent: { count: total, items },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_listar_nps ─────────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_nps",
    {
      title: "Listar Respostas NPS",
      description: `Lista respostas do NPS (Net Promoter Score) com score calculado.

Use para "NPS do mês", "clientes detratores", "comentários NPS", "satisfação dos clientes".

Args:
  - filtro_nota (number, opcional): Filtrar por nota exata (0-10)
  - data_inicio / data_fim (string, opcional): Período YYYY-MM-DD
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        filtro_nota: z.coerce.number().int().min(0).max(10).optional(),
        data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getAdminClient();
        let query = sb
          .from("nps_respostas")
          .select("id, pedido_id, cliente_id, nota, comentario, respondido_em, created_at, clientes(razao_social)")
          .not("nota", "is", null);

        if (params.filtro_nota !== undefined) query = query.eq("nota", params.filtro_nota);
        if (params.data_inicio) query = query.gte("respondido_em", params.data_inicio);
        if (params.data_fim) query = query.lte("respondido_em", params.data_fim + "T23:59:59");

        query = query.order("respondido_em", { ascending: false });

        const { data, error } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];

        // Calcular NPS
        const promotores = items.filter(r => Number(r.nota) >= 9).length;
        const detratores = items.filter(r => Number(r.nota) <= 6).length;
        const nps = items.length > 0
          ? Math.round(((promotores - detratores) / items.length) * 100)
          : 0;
        const mediaNota = items.length > 0
          ? (items.reduce((s, r) => s + Number(r.nota), 0) / items.length).toFixed(1)
          : "—";

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `## NPS — ${items.length} respostas`,
            `**Score NPS**: **${nps}** | **Média**: ${mediaNota}/10`,
            `- 🟢 Promotores (9-10): ${promotores}`,
            `- 🟡 Neutros (7-8): ${items.filter(r => Number(r.nota) >= 7 && Number(r.nota) <= 8).length}`,
            `- 🔴 Detratores (0-6): ${detratores}`,
            "",
          ];
          if (items.length === 0) {
            lines.push("_Nenhuma resposta NPS encontrada._");
          } else {
            lines.push("## Respostas Recentes");
            for (const r of items.slice(0, 20)) {
              const cliente = (r.clientes as { razao_social?: string } | null)?.razao_social ?? r.cliente_id ?? "—";
              const emoji = Number(r.nota) >= 9 ? "🟢" : Number(r.nota) >= 7 ? "🟡" : "🔴";
              lines.push(`- ${emoji} **Nota ${r.nota}** — ${cliente}${r.comentario ? ` — "${r.comentario}"` : ""} — ${formatDate(r.respondido_em)}`);
            }
            if (items.length > 20) lines.push(`\n_...e mais ${items.length - 20} respostas_`);
          }
          text = lines.join("\n");
        } else {
          text = JSON.stringify({ count: items.length, nps, media_nota: mediaNota, promotores, detratores, items }, null, 2);
        }

        return {
          content: [{ type: "text" as const, text }],
          structuredContent: { count: items.length, nps, media_nota: mediaNota, promotores, detratores, items },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

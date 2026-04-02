/**
 * Ferramentas de Estoque
 * Consultar saldos de materiais e listar catálogo
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSupabaseClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatBRL, formatDate } from "../utils/formatting.js";

export function registerEstoqueTools(server: McpServer): void {
  // ─── croma_consultar_estoque ───────────────────────────────────────────────

  server.registerTool(
    "croma_consultar_estoque",
    {
      title: "Consultar Estoque",
      description: `Consulta saldo atual de materiais no estoque.

Use para "estoque de banner", "saldo do vinil", "materiais abaixo do mínimo", "o que está acabando".

Args:
  - busca (string, opcional): Busca por nome ou código do material
  - categoria (string, opcional): Filtrar por categoria (banner, adesivo, acm, etc.)
  - abaixo_minimo (boolean, opcional): Apenas materiais com saldo < estoque_minimo
  - com_saldo (boolean, opcional): Apenas materiais com saldo > 0
  - limit (number): Padrão 30
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        busca: z.string().optional().describe("Busca por nome ou código"),
        categoria: z.string().optional(),
        abaixo_minimo: z.boolean().optional().describe("Apenas materiais com saldo abaixo do mínimo"),
        com_saldo: z.boolean().optional().describe("Apenas materiais com saldo positivo"),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        offset: z.coerce.number().int().min(0).default(0),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getSupabaseClient();

        // Busca materiais com seus saldos via view ou join
        let query = sb
          .from("materiais")
          .select(
            `id, codigo, nome, categoria, unidade, preco_medio, estoque_minimo, ativo,
             estoque_saldos(quantidade_disponivel, quantidade_reservada)`,
            { count: "exact" }
          )
          .eq("ativo", true);

        if (params.busca) {
          query = query.or(`nome.ilike.%${params.busca}%,codigo.ilike.%${params.busca}%`);
        }
        if (params.categoria) query = query.ilike("categoria", `%${params.categoria}%`);

        query = query
          .order("nome")
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        let items = data ?? [];

        // Filtra em memória (Supabase não suporta filtro em relação facilmente)
        if (params.com_saldo) {
          items = items.filter(m => {
            const saldo = (m.estoque_saldos as { quantidade_disponivel?: number }[])?.[0];
            return (saldo?.quantidade_disponivel ?? 0) > 0;
          });
        }
        if (params.abaixo_minimo) {
          items = items.filter(m => {
            const saldo = (m.estoque_saldos as { quantidade_disponivel?: number }[])?.[0];
            const disponivel = saldo?.quantidade_disponivel ?? 0;
            return m.estoque_minimo && disponivel < m.estoque_minimo;
          });
        }

        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Estoque de Materiais (${items.length} materiais)`, ""];
          if (items.length === 0) {
            lines.push("_Nenhum material encontrado._");
          } else {
            for (const m of items) {
              const saldoObj = (m.estoque_saldos as { quantidade_disponivel?: number; quantidade_reservada?: number }[])?.[0] ?? {};
              const disponivel = saldoObj.quantidade_disponivel ?? 0;
              const reservado = saldoObj.quantidade_reservada ?? 0;
              const alertaMinimo = m.estoque_minimo && disponivel < m.estoque_minimo;

              lines.push(`### ${m.nome}${alertaMinimo ? " ⚠️ ABAIXO DO MÍNIMO" : ""}`);
              if (m.codigo) lines.push(`- **Código**: ${m.codigo}`);
              if (m.categoria) lines.push(`- **Categoria**: ${m.categoria}`);
              lines.push(`- **Disponível**: ${disponivel} ${m.unidade ?? ""}`);
              if (reservado > 0) lines.push(`- **Reservado**: ${reservado} ${m.unidade ?? ""}`);
              if (m.estoque_minimo) lines.push(`- **Mínimo**: ${m.estoque_minimo} ${m.unidade ?? ""}${alertaMinimo ? " ⚠️" : ""}`);
              if (m.preco_medio) lines.push(`- **Preço médio**: ${formatBRL(m.preco_medio)}/${m.unidade ?? "un"}`);
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

  // ─── croma_listar_materiais ────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_materiais",
    {
      title: "Listar Materiais",
      description: `Lista o catálogo de materiais cadastrados com preços.

Use para "listar materiais de banner", "preço do vinil adesivo", "catálogo de ACM".

Args:
  - busca (string, opcional): Busca por nome ou código
  - categoria (string, opcional): Filtrar por categoria
  - ativo (boolean, opcional): Padrão: true
  - limit (number): Padrão 30
  - offset (number): Paginação
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        busca: z.string().optional(),
        categoria: z.string().optional(),
        ativo: z.boolean().optional().default(true),
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
          .from("materiais")
          .select("id, codigo, nome, categoria, unidade, preco_medio, estoque_minimo, ativo", { count: "exact" });

        if (params.ativo !== undefined) query = query.eq("ativo", params.ativo);
        if (params.busca) query = query.or(`nome.ilike.%${params.busca}%,codigo.ilike.%${params.busca}%`);
        if (params.categoria) query = query.ilike("categoria", `%${params.categoria}%`);

        query = query
          .order("categoria")
          .order("nome")
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Materiais (${total} cadastrados)`, ""];
          let ultimaCategoria = "";
          for (const m of items) {
            if (m.categoria !== ultimaCategoria) {
              lines.push(`### ${m.categoria ?? "Sem categoria"}`);
              ultimaCategoria = m.categoria ?? "";
            }
            lines.push(`- **${m.nome}**${m.codigo ? ` (${m.codigo})` : ""}`);
            if (m.preco_medio) lines.push(`  - Preço: ${formatBRL(m.preco_medio)}/${m.unidade ?? "un"}`);
          }
          if (response.has_more) lines.push(`\n_Mais resultados. Use offset: ${response.next_offset}._`);
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

  // ─── croma_cadastrar_material ──────────────────────────────────────────────

  server.registerTool(
    "croma_cadastrar_material",
    {
      title: "Cadastrar Material",
      description: `Cria um novo material no catálogo da Croma Print.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - codigo (string, obrigatório): Código interno (ex: "MPI3822137")
  - nome (string, obrigatório): Nome completo do material
  - categoria (string, opcional): Categoria (Mídia, Acabamento, Estrutura, etc.)
  - unidade (string, obrigatório): Unidade de medida (m², m, un, kg, L, ml, rolo, chapa, pç)
  - preco_medio (number, obrigatório): Preço médio por unidade em R$
  - ncm (string, opcional): NCM fiscal
  - estoque_minimo (number, opcional): Quantidade mínima (padrão: 0)
  - estoque_ideal (number, opcional): Quantidade ideal de reposição
  - estoque_controlado (boolean, opcional): Controlar estoque? (padrão: false)
  - localizacao (string, opcional): Local no galpão
  - venda_direta (boolean, opcional): Vendido diretamente? (padrão: false)
  - aproveitamento (number, opcional): % de aproveitamento (padrão: 100)

Retorna: dados do material criado com ID gerado`,
      inputSchema: z.object({
        codigo: z.string().min(1).max(50).describe("Código interno do material"),
        nome: z.string().min(3).max(300).describe("Nome completo do material"),
        categoria: z.string().min(1).max(50).optional(),
        unidade: z.enum(["m²", "m", "un", "kg", "L", "ml", "rolo", "chapa", "pç"]),
        preco_medio: z.coerce.number().positive().describe("Preço por unidade em R$"),
        ncm: z.string().max(10).optional(),
        estoque_minimo: z.coerce.number().min(0).default(0),
        estoque_ideal: z.coerce.number().min(0).optional(),
        estoque_controlado: z.boolean().default(false),
        localizacao: z.string().max(100).optional(),
        venda_direta: z.boolean().default(false),
        aproveitamento: z.coerce.number().min(0).max(100).optional(),
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
          .from("materiais")
          .insert({ ...params, ativo: true })
          .select()
          .single();

        if (error) return errorResult(error);

        // Criar saldo inicial zerado
        await sb
          .from("estoque_saldos")
          .insert({ material_id: data.id, quantidade_disponivel: 0, quantidade_reservada: 0 });

        return {
          content: [{
            type: "text" as const,
            text: `✅ Material cadastrado com sucesso!\n\n- **ID**: \`${data.id}\`\n- **Código**: ${data.codigo}\n- **Nome**: ${data.nome}\n- **Unidade**: ${data.unidade}\n- **Preço médio**: ${formatBRL(data.preco_medio)}/${data.unidade}`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_atualizar_material ──────────────────────────────────────────────

  server.registerTool(
    "croma_atualizar_material",
    {
      title: "Atualizar Material",
      description: `Atualiza dados de um material existente no catálogo. Apenas os campos informados são alterados.

ATENÇÃO: Ação que modifica dados. Alterações no preço afetam orçamentos futuros.
Confirme com o usuário antes de executar.

Args:
  - material_id (string, obrigatório): UUID do material
  - codigo, nome, categoria, unidade, ncm: dados cadastrais
  - estoque_minimo, estoque_ideal, estoque_controlado: configuração de estoque
  - localizacao (string, opcional): Local no galpão
  - ativo (boolean, opcional): Ativar/desativar material
  - aproveitamento (number, opcional): % de aproveitamento`,
      inputSchema: z.object({
        material_id: z.string().uuid().describe("UUID do material"),
        codigo: z.string().max(50).optional(),
        nome: z.string().max(300).optional(),
        categoria: z.string().max(50).optional(),
        unidade: z.enum(["m²", "m", "un", "kg", "L", "ml", "rolo", "chapa", "pç"]).optional(),
        ncm: z.string().max(10).optional(),
        estoque_minimo: z.coerce.number().min(0).optional(),
        estoque_ideal: z.coerce.number().min(0).optional(),
        estoque_controlado: z.boolean().optional(),
        localizacao: z.string().max(100).optional(),
        ativo: z.boolean().optional(),
        aproveitamento: z.coerce.number().min(0).max(100).optional(),
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
        const { material_id, ...updates } = params;
        if (Object.keys(updates).length === 0) {
          return { content: [{ type: "text" as const, text: "Nenhum campo para atualizar foi informado." }] };
        }

        const sb = getUserClient();
        const { data, error } = await sb
          .from("materiais")
          .update(updates)
          .eq("id", material_id)
          .select()
          .single();

        if (error) return errorResult(error);
        if (!data) return { content: [{ type: "text" as const, text: `Material não encontrado: ${material_id}` }] };

        return {
          content: [{
            type: "text" as const,
            text: `✅ Material atualizado!\n\n- **${data.nome}** (\`${data.id}\`)\n- Campos atualizados: ${Object.keys(updates).join(", ")}`,
          }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_sugerir_compra ──────────────────────────────────────────────────

  server.registerTool(
    "croma_sugerir_compra",
    {
      title: "Sugerir Lista de Compras",
      description: `Gera uma lista de materiais que precisam ser repostos com base nos saldos vs estoque mínimo/ideal.

Use para "o que preciso comprar?", "materiais abaixo do mínimo", "lista de compras semanal".

Args:
  - apenas_criticos (boolean, opcional): Apenas abaixo do mínimo (padrão: false = todos que precisam de reposição)
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        apenas_criticos: z.boolean().default(false).describe("Apenas materiais abaixo do mínimo"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getSupabaseClient();

        const { data, error } = await sb
          .from("materiais")
          .select(
            `id, codigo, nome, categoria, unidade, preco_medio, estoque_minimo, estoque_ideal, estoque_controlado,
             estoque_saldos(quantidade_disponivel)`
          )
          .eq("ativo", true)
          .eq("estoque_controlado", true);

        if (error) return errorResult(error);

        const materiais = (data ?? []).map(m => {
          const saldoObj = (m.estoque_saldos as { quantidade_disponivel?: number }[])?.[0] ?? {};
          const saldo = saldoObj.quantidade_disponivel ?? 0;
          const minimo = Number(m.estoque_minimo) || 0;
          const ideal = Number(m.estoque_ideal) || minimo;
          const qtdSugerida = Math.max(ideal - saldo, 0);
          const valorEstimado = qtdSugerida * (Number(m.preco_medio) || 0);
          const critico = saldo < minimo;

          return { ...m, saldo, minimo, ideal, qtdSugerida, valorEstimado, critico };
        });

        let lista = materiais.filter(m => m.qtdSugerida > 0);
        if (params.apenas_criticos) {
          lista = lista.filter(m => m.critico);
        }

        // Ordenar: críticos primeiro, depois por prioridade (menor proporção saldo/mínimo)
        lista.sort((a, b) => {
          if (a.critico && !b.critico) return -1;
          if (!a.critico && b.critico) return 1;
          const propA = a.minimo > 0 ? a.saldo / a.minimo : 1;
          const propB = b.minimo > 0 ? b.saldo / b.minimo : 1;
          return propA - propB;
        });

        const valorTotalEstimado = lista.reduce((sum, m) => sum + m.valorEstimado, 0);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `## Lista de Compras Sugerida (${lista.length} itens)`,
            `**Valor estimado total**: ${formatBRL(valorTotalEstimado)}`,
            "",
          ];

          if (lista.length === 0) {
            lines.push("_Nenhum material precisa de reposição no momento._ ✅");
          } else {
            for (const m of lista) {
              const alerta = m.critico ? " 🔴 CRÍTICO" : " 🟡";
              lines.push(`### ${m.nome}${alerta}`);
              if (m.codigo) lines.push(`- **Código**: ${m.codigo}`);
              if (m.categoria) lines.push(`- **Categoria**: ${m.categoria}`);
              lines.push(`- **Saldo atual**: ${m.saldo} ${m.unidade ?? "un"}`);
              lines.push(`- **Mínimo**: ${m.minimo} ${m.unidade ?? "un"}`);
              lines.push(`- **Ideal**: ${m.ideal} ${m.unidade ?? "un"}`);
              lines.push(`- **Qtd sugerida**: **${m.qtdSugerida} ${m.unidade ?? "un"}**`);
              if (m.preco_medio) lines.push(`- **Valor estimado**: ${formatBRL(m.valorEstimado)}`);
              lines.push("");
            }
          }

          text = lines.join("\n");
        } else {
          text = JSON.stringify({ count: lista.length, valor_total_estimado: valorTotalEstimado, items: lista }, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, lista.length) }],
          structuredContent: { count: lista.length, valor_total_estimado: valorTotalEstimado, items: lista },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_historico_precos_material ───────────────────────────────────────

  server.registerTool(
    "croma_historico_precos_material",
    {
      title: "Histórico de Preços do Material",
      description: `Retorna o histórico de variações de preço de um material ao longo do tempo.

Use para "como o preço do vinil mudou?", "reajustes do banner lona", "histórico de custo do ACM".

Args:
  - material_id (string, obrigatório): UUID do material
  - periodo_meses (number, opcional): Período em meses (padrão: 12, máx: 24)
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        material_id: z.string().uuid().describe("UUID do material"),
        periodo_meses: z.coerce.number().int().min(1).max(24).default(12),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getSupabaseClient();
        const dataInicio = new Date();
        dataInicio.setMonth(dataInicio.getMonth() - params.periodo_meses);

        const [matResult, histResult] = await Promise.all([
          sb.from("materiais").select("id, nome, codigo, unidade, preco_medio").eq("id", params.material_id).single(),
          sb
            .from("materiais_historico_preco")
            .select("id, preco_anterior, preco_novo, motivo, created_at")
            .eq("material_id", params.material_id)
            .gte("created_at", dataInicio.toISOString())
            .order("created_at", { ascending: false }),
        ]);

        if (matResult.error) return errorResult(matResult.error);
        if (!matResult.data) {
          return { content: [{ type: "text" as const, text: `Material não encontrado: ${params.material_id}` }] };
        }

        const mat = matResult.data;
        const historico = histResult.data ?? [];
        const fullData = { material: mat, historico, periodo_meses: params.periodo_meses };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `## Histórico de Preços — ${mat.nome}`,
            mat.codigo ? `**Código**: ${mat.codigo}` : "",
            `**Preço atual**: ${formatBRL(mat.preco_medio)}/${mat.unidade ?? "un"}`,
            `**Período**: últimos ${params.periodo_meses} meses`,
            `**Atualizações**: ${historico.length}`,
            "",
          ].filter(Boolean);

          if (historico.length === 0) {
            lines.push("_Nenhuma alteração de preço registrada no período._");
          } else {
            lines.push("## Histórico");
            for (const h of historico) {
              const variacao = h.preco_anterior
                ? ((Number(h.preco_novo) - Number(h.preco_anterior)) / Number(h.preco_anterior) * 100).toFixed(1)
                : null;
              const seta = variacao ? (Number(variacao) > 0 ? "📈" : "📉") : "→";
              lines.push(`### ${formatDate(h.created_at)}`);
              if (h.preco_anterior) lines.push(`- **Preço anterior**: ${formatBRL(h.preco_anterior)}`);
              lines.push(`- **Novo preço**: ${formatBRL(h.preco_novo)} ${seta}${variacao ? ` (${Number(variacao) > 0 ? "+" : ""}${variacao}%)` : ""}`);
              if (h.motivo) lines.push(`- **Motivo**: ${h.motivo}`);
              lines.push("");
            }
          }

          text = lines.join("\n");
        } else {
          text = JSON.stringify(fullData, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, historico.length) }],
          structuredContent: fullData,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_registrar_movimento ─────────────────────────────────────────────

  server.registerTool(
    "croma_registrar_movimento",
    {
      title: "Registrar Movimento de Estoque",
      description: `Registra uma movimentação de estoque (entrada, saída ou ajuste).

ATENÇÃO: Ação que modifica dados. Confirme antes de executar.

Args:
  - material_id (string, obrigatório): UUID do material
  - tipo (string, obrigatório): entrada|saida|ajuste
  - quantidade (number, obrigatório): Quantidade movimentada (positivo)
  - referencia_tipo (string, opcional): pedido|compra|ajuste|devolucao
  - referencia_id (string, opcional): UUID da referência (pedido, OP, etc.)
  - motivo (string, opcional): Motivo da movimentação`,
      inputSchema: z.object({
        material_id: z.string().uuid(),
        tipo: z.enum(["entrada", "saida", "ajuste"]),
        quantidade: z.coerce.number().positive(),
        referencia_tipo: z.enum(["pedido", "compra", "ajuste", "devolucao"]).optional(),
        referencia_id: z.string().uuid().optional(),
        motivo: z.string().max(300).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const sb = getUserClient();

        // Verificar material existe
        const { data: mat, error: matErr } = await sb
          .from("materiais")
          .select("id, nome, unidade")
          .eq("id", params.material_id)
          .single();

        if (matErr) return errorResult(matErr);
        if (!mat) return { content: [{ type: "text" as const, text: `Material não encontrado: ${params.material_id}` }] };

        const { data: mov, error } = await sb
          .from("estoque_movimentacoes")
          .insert({
            material_id: params.material_id,
            tipo: params.tipo,
            quantidade: params.quantidade,
            referencia_tipo: params.referencia_tipo || null,
            referencia_id: params.referencia_id || null,
            motivo: params.motivo || null,
          })
          .select()
          .single();

        if (error) return errorResult(error);

        const tipoLabel = params.tipo === "entrada" ? "Entrada" : params.tipo === "saida" ? "Saída" : "Ajuste";

        return {
          content: [{
            type: "text" as const,
            text: `✅ Movimento registrado!\n\n- **Material**: ${mat.nome}\n- **Tipo**: ${tipoLabel}\n- **Quantidade**: ${params.quantidade} ${mat.unidade ?? "un"}\n- **ID**: \`${mov.id}\``,
          }],
          structuredContent: mov,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

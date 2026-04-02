/**
 * Ferramentas de Compras / Pedidos de Compra
 * Gerir todo o fluxo de compra: criação, acompanhamento e recebimento de insumos
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
  formatStatus,
} from "../utils/formatting.js";

export function registerComprasTools(server: McpServer): void {
  // ─── croma_listar_compras ──────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_compras",
    {
      title: "Listar Pedidos de Compra",
      description: `Lista pedidos de compra (PC) com filtros opcionais.

Use para "pedidos de compra pendentes", "compras do mês", "PCs da VinilSul", etc.

Args:
  - busca (string, opcional): Busca por número do PC ou observações
  - filtro_status (string, opcional): rascunho|enviado|confirmado|parcial|recebido|cancelado
  - filtro_fornecedor (string, opcional): UUID do fornecedor
  - data_inicio / data_fim (string, opcional): Período YYYY-MM-DD
  - limit_rows (number): Padrão 50
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        busca: z.string().max(200).optional(),
        filtro_status: z.enum(["rascunho", "enviado", "confirmado", "parcial", "recebido", "cancelado"]).optional(),
        filtro_fornecedor: z.string().uuid().optional(),
        data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
        data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
        limit_rows: z.coerce.number().int().min(1).max(500).default(50),
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
          .from("pedidos_compra")
          .select(
            "id, numero, status, valor_total, previsao_entrega, observacoes, created_at, fornecedores(razao_social, nome_fantasia)",
            { count: "exact" }
          )
          .is("excluido_em", null);

        if (params.filtro_status) query = query.eq("status", params.filtro_status);
        if (params.filtro_fornecedor) query = query.eq("fornecedor_id", params.filtro_fornecedor);
        if (params.data_inicio) query = query.gte("created_at", params.data_inicio);
        if (params.data_fim) query = query.lte("created_at", params.data_fim + "T23:59:59");
        if (params.busca) {
          query = query.or(`numero.ilike.%${params.busca}%,observacoes.ilike.%${params.busca}%`);
        }

        query = query.order("created_at", { ascending: false }).limit(params.limit_rows);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, 0, params.limit_rows);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Pedidos de Compra (${total} encontrados)`, ""];
          if (items.length === 0) {
            lines.push("_Nenhum pedido de compra encontrado._");
          } else {
            for (const pc of items) {
              const forn = pc.fornecedores as { razao_social?: string; nome_fantasia?: string } | null;
              const fornNome = forn?.nome_fantasia ?? forn?.razao_social ?? "—";
              lines.push(`### PC ${pc.numero ?? pc.id.substring(0, 8)} — ${fornNome}`);
              lines.push(`- **ID**: \`${pc.id}\``);
              lines.push(`- **Fornecedor**: ${fornNome}`);
              lines.push(`- **Status**: ${formatStatus(pc.status)}`);
              lines.push(`- **Valor total**: ${formatBRL(pc.valor_total)}`);
              if (pc.previsao_entrega) lines.push(`- **Previsão entrega**: ${formatDate(pc.previsao_entrega)}`);
              lines.push(`- **Criado em**: ${formatDate(pc.created_at)}`);
              if (pc.observacoes) lines.push(`- **Obs**: ${pc.observacoes}`);
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

  // ─── croma_detalhe_compra ──────────────────────────────────────────────────

  server.registerTool(
    "croma_detalhe_compra",
    {
      title: "Detalhes do Pedido de Compra",
      description: `Retorna dados completos de um pedido de compra: cabeçalho, itens, fornecedor e totais.

Args:
  - pedido_compra_id (string, obrigatório): UUID do pedido de compra
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        pedido_compra_id: z.string().uuid().describe("UUID do pedido de compra"),
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

        const [pcResult, itensResult] = await Promise.all([
          sb
            .from("pedidos_compra")
            .select("*, fornecedores(razao_social, nome_fantasia, cnpj, telefone, email, contato_nome)")
            .eq("id", params.pedido_compra_id)
            .single(),
          sb
            .from("pedido_compra_itens")
            .select("*, materiais(nome, codigo, unidade)")
            .eq("pedido_compra_id", params.pedido_compra_id)
            .is("excluido_em", null),
        ]);

        if (pcResult.error) return errorResult(pcResult.error);
        if (!pcResult.data) {
          return { content: [{ type: "text" as const, text: `Pedido de compra não encontrado: ${params.pedido_compra_id}` }] };
        }

        const pc = pcResult.data;
        const itens = itensResult.data ?? [];
        const forn = pc.fornecedores as { razao_social?: string; nome_fantasia?: string; cnpj?: string; telefone?: string; email?: string; contato_nome?: string } | null;

        const fullData = { pedido_compra: pc, itens };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [
            `# PC ${pc.numero ?? pc.id.substring(0, 8)}`,
            "",
            "## Fornecedor",
            `- **${forn?.nome_fantasia ?? forn?.razao_social ?? "—"}**`,
            forn?.telefone ? `- **Telefone**: ${forn.telefone}` : "",
            forn?.email ? `- **Email**: ${forn.email}` : "",
            forn?.contato_nome ? `- **Contato**: ${forn.contato_nome}` : "",
            "",
            "## Pedido",
            `- **Status**: ${formatStatus(pc.status)}`,
            `- **Valor total**: ${formatBRL(pc.valor_total)}`,
            pc.previsao_entrega ? `- **Previsão entrega**: ${formatDate(pc.previsao_entrega)}` : "",
            pc.observacoes ? `- **Observações**: ${pc.observacoes}` : "",
            `- **Criado em**: ${formatDate(pc.created_at)}`,
            "",
            `## Itens (${itens.length})`,
          ].filter(Boolean);

          for (const item of itens) {
            const mat = item.materiais as { nome?: string; codigo?: string; unidade?: string } | null;
            const nome = mat?.nome ?? item.material_id;
            const unidade = mat?.unidade ?? "un";
            lines.push(`### ${nome}`);
            if (mat?.codigo) lines.push(`- **Código**: ${mat.codigo}`);
            lines.push(`- **Quantidade**: ${item.quantidade} ${unidade}`);
            lines.push(`- **Preço unitário**: ${formatBRL(item.valor_unitario)}/${unidade}`);
            lines.push(`- **Subtotal**: ${formatBRL(item.valor_total)}`);
            if (Number(item.quantidade_recebida) > 0) {
              lines.push(`- **Recebido**: ${item.quantidade_recebida} ${unidade}`);
            }
            lines.push("");
          }

          lines.push(`---`);
          lines.push(`**Total do Pedido: ${formatBRL(pc.valor_total)}**`);

          text = lines.join("\n");
        } else {
          text = JSON.stringify(fullData, null, 2);
        }

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(text, itens.length) }],
          structuredContent: fullData,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_criar_compra ────────────────────────────────────────────────────

  server.registerTool(
    "croma_criar_compra",
    {
      title: "Criar Pedido de Compra",
      description: `Cria um novo pedido de compra com itens.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - fornecedor_id (string, obrigatório): UUID do fornecedor
  - itens (array, obrigatório): Lista de itens com material_id, quantidade, preco_unitario
  - condicao_pagamento (string, opcional): Condição de pagamento
  - previsao_entrega (string, opcional): Data prevista YYYY-MM-DD
  - observacoes (string, opcional): Observações

Retorna: ID do pedido + resumo dos itens`,
      inputSchema: z.object({
        fornecedor_id: z.string().uuid().describe("UUID do fornecedor"),
        itens: z.array(z.object({
          material_id: z.string().uuid(),
          quantidade: z.coerce.number().positive(),
          preco_unitario: z.coerce.number().positive(),
          observacao: z.string().max(200).optional(),
        })).min(1).describe("Itens do pedido"),
        condicao_pagamento: z.string().max(100).optional(),
        previsao_entrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
        observacoes: z.string().max(500).optional(),
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

        // Calcular valor total
        const valorTotal = params.itens.reduce(
          (sum, item) => sum + item.quantidade * item.preco_unitario,
          0
        );

        // Criar cabeçalho
        const { data: pc, error: pcErr } = await sb
          .from("pedidos_compra")
          .insert({
            fornecedor_id: params.fornecedor_id,
            status: "rascunho",
            valor_total: valorTotal,
            previsao_entrega: params.previsao_entrega ?? null,
            observacoes: params.observacoes ?? null,
          })
          .select()
          .single();

        if (pcErr) return errorResult(pcErr);

        // Criar itens
        const itensInsert = params.itens.map(item => ({
          pedido_compra_id: pc.id,
          material_id: item.material_id,
          quantidade: item.quantidade,
          valor_unitario: item.preco_unitario,
          valor_total: item.quantidade * item.preco_unitario,
        }));

        const { error: itensErr } = await sb
          .from("pedido_compra_itens")
          .insert(itensInsert);

        if (itensErr) return errorResult(itensErr);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Pedido de compra criado!\n\n- **ID**: \`${pc.id}\`\n- **Número**: ${pc.numero ?? "Automático"}\n- **Fornecedor ID**: ${params.fornecedor_id}\n- **Itens**: ${params.itens.length}\n- **Valor total**: ${formatBRL(valorTotal)}\n- **Status**: Rascunho\n\nPróximo passo: use \`croma_atualizar_status_compra\` para enviar ao fornecedor.`,
          }],
          structuredContent: { pedido_compra: pc, itens_criados: itensInsert.length, valor_total: valorTotal },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_atualizar_status_compra ─────────────────────────────────────────

  server.registerTool(
    "croma_atualizar_status_compra",
    {
      title: "Atualizar Status do Pedido de Compra",
      description: `Atualiza o status de um pedido de compra.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Transições válidas:
- rascunho → enviado, cancelado
- enviado → confirmado, cancelado
- confirmado → parcial, recebido, cancelado
- parcial → recebido, cancelado

Args:
  - pedido_compra_id (string, obrigatório): UUID do pedido de compra
  - novo_status (string, obrigatório): Novo status
  - observacoes (string, opcional): Motivo ou observação`,
      inputSchema: z.object({
        pedido_compra_id: z.string().uuid().describe("UUID do pedido de compra"),
        novo_status: z.enum(["rascunho", "enviado", "confirmado", "parcial", "recebido", "cancelado"]),
        observacoes: z.string().max(500).optional(),
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

        const { data: atual, error: fetchErr } = await sb
          .from("pedidos_compra")
          .select("id, numero, status, fornecedor_id")
          .eq("id", params.pedido_compra_id)
          .single();

        if (fetchErr) return errorResult(fetchErr);
        if (!atual) {
          return { content: [{ type: "text" as const, text: `Pedido de compra não encontrado: ${params.pedido_compra_id}` }] };
        }

        const transicoes: Record<string, string[]> = {
          rascunho: ["enviado", "cancelado"],
          enviado: ["confirmado", "cancelado"],
          confirmado: ["parcial", "recebido", "cancelado"],
          parcial: ["recebido", "cancelado"],
          recebido: [],
          cancelado: [],
        };

        const permitidas = transicoes[atual.status] ?? [];
        if (!permitidas.includes(params.novo_status)) {
          return {
            content: [{
              type: "text" as const,
              text: `Transição inválida: ${formatStatus(atual.status)} → ${formatStatus(params.novo_status)}.\nPermitidas de "${atual.status}": ${permitidas.length > 0 ? permitidas.join(", ") : "nenhuma (status final)"}`,
            }],
          };
        }

        const updateData: Record<string, unknown> = { status: params.novo_status, updated_at: new Date().toISOString() };
        if (params.observacoes) updateData.observacoes = params.observacoes;

        const { error } = await sb
          .from("pedidos_compra")
          .update(updateData)
          .eq("id", params.pedido_compra_id)
          .select()
          .single();

        if (error) return errorResult(error);

        return {
          content: [{
            type: "text" as const,
            text: `✅ PC ${atual.numero ?? atual.id.substring(0, 8)} atualizado: **${formatStatus(atual.status)}** → **${formatStatus(params.novo_status)}**${params.observacoes ? `\nObs: ${params.observacoes}` : ""}`,
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_registrar_recebimento ───────────────────────────────────────────

  server.registerTool(
    "croma_registrar_recebimento",
    {
      title: "Registrar Recebimento de Compra",
      description: `Registra o recebimento de itens de um pedido de compra.
Fluxo completo: entrada no estoque + atualiza status do PC + opcionalmente gera contas a pagar.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Args:
  - pedido_compra_id (string, obrigatório): UUID do pedido de compra
  - itens_recebidos (array, obrigatório): Itens recebidos com item_id e quantidade_recebida
  - numero_nf (string, opcional): Número da NF do fornecedor
  - valor_nf (number, opcional): Valor da NF (para conferência)
  - gerar_contas_pagar (boolean): Auto-gerar CP? (padrão: true)
  - parcelas (array, opcional): Parcelas com valor, vencimento e forma de pagamento

Retorna: confirmação das entradas de estoque e contas a pagar geradas`,
      inputSchema: z.object({
        pedido_compra_id: z.string().uuid().describe("UUID do pedido de compra"),
        itens_recebidos: z.array(z.object({
          item_id: z.string().uuid().describe("UUID do item do pedido de compra"),
          quantidade_recebida: z.coerce.number().positive(),
          observacao: z.string().max(200).optional(),
        })).min(1),
        numero_nf: z.string().max(50).optional().describe("Número da NF do fornecedor"),
        valor_nf: z.coerce.number().positive().optional().describe("Valor total da NF"),
        gerar_contas_pagar: z.boolean().default(true),
        parcelas: z.array(z.object({
          valor: z.coerce.number().positive(),
          vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD"),
          forma_pagamento: z.enum(["boleto", "pix", "transferencia"]),
        })).optional(),
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

        // Buscar itens do pedido
        const { data: itensPc, error: itensErr } = await sb
          .from("pedido_compra_itens")
          .select("id, material_id, quantidade, valor_unitario, materiais(nome, unidade)")
          .eq("pedido_compra_id", params.pedido_compra_id)
          .is("excluido_em", null);

        if (itensErr) return errorResult(itensErr);

        // Buscar dados do pedido
        const { data: pc, error: pcErr } = await sb
          .from("pedidos_compra")
          .select("id, numero, fornecedor_id, valor_total, status")
          .eq("id", params.pedido_compra_id)
          .single();

        if (pcErr) return errorResult(pcErr);
        if (!pc) return { content: [{ type: "text" as const, text: `Pedido de compra não encontrado: ${params.pedido_compra_id}` }] };

        const itensMap = new Map((itensPc ?? []).map(i => [i.id, i]));
        const movimentosLog: string[] = [];
        let totalRecebido = 0;

        // 1. Registrar entrada no estoque para cada item recebido
        for (const itemRec of params.itens_recebidos) {
          const itemPc = itensMap.get(itemRec.item_id);
          if (!itemPc) {
            movimentosLog.push(`⚠️ Item \`${itemRec.item_id}\` não encontrado no pedido — ignorado`);
            continue;
          }

          const mat = itemPc.materiais as { nome?: string; unidade?: string } | null;

          // Atualizar quantidade_recebida no item
          await sb
            .from("pedido_compra_itens")
            .update({ quantidade_recebida: itemRec.quantidade_recebida })
            .eq("id", itemRec.item_id);

          // Registrar movimento de estoque
          const { error: movErr } = await sb
            .from("estoque_movimentacoes")
            .insert({
              material_id: itemPc.material_id,
              tipo: "entrada",
              quantidade: itemRec.quantidade_recebida,
              referencia_tipo: "compra",
              referencia_id: params.pedido_compra_id,
              motivo: `Recebimento PC ${pc.numero ?? pc.id.substring(0, 8)}${params.numero_nf ? ` — NF ${params.numero_nf}` : ""}`,
            });

          if (movErr) {
            movimentosLog.push(`⚠️ Erro ao registrar entrada de ${mat?.nome ?? itemPc.material_id}: ${movErr.message}`);
          } else {
            const valorEntrada = itemRec.quantidade_recebida * Number(itemPc.valor_unitario);
            totalRecebido += valorEntrada;
            movimentosLog.push(`✅ ${mat?.nome ?? itemPc.material_id}: +${itemRec.quantidade_recebida} ${mat?.unidade ?? "un"} (${formatBRL(valorEntrada)})`);
          }
        }

        // 2. Verificar se todo PC foi recebido ou parcial
        const todosRecebidos = params.itens_recebidos.length >= (itensPc?.length ?? 0);
        const novoStatus = todosRecebidos ? "recebido" : "parcial";

        await sb
          .from("pedidos_compra")
          .update({ status: novoStatus, updated_at: new Date().toISOString() })
          .eq("id", params.pedido_compra_id);

        // 3. Gerar contas a pagar (opcional)
        const contasLog: string[] = [];
        if (params.gerar_contas_pagar && params.parcelas && params.parcelas.length > 0) {
          for (const parcela of params.parcelas) {
            const { data: cp, error: cpErr } = await sb
              .from("contas_pagar")
              .insert({
                fornecedor_id: pc.fornecedor_id,
                valor_original: parcela.valor,
                data_vencimento: parcela.vencimento,
                forma_pagamento: parcela.forma_pagamento,
                numero_titulo: params.numero_nf ?? null,
                status: "pendente",
                descricao: `PC ${pc.numero ?? pc.id.substring(0, 8)}${params.numero_nf ? ` — NF ${params.numero_nf}` : ""}`,
              })
              .select()
              .single();

            if (cpErr) {
              contasLog.push(`⚠️ Erro ao criar CP ${formatBRL(parcela.valor)}: ${cpErr.message}`);
            } else {
              contasLog.push(`✅ CP criada: ${formatBRL(parcela.valor)} — venc. ${formatDate(parcela.vencimento)} — ${parcela.forma_pagamento}`);
            }
          }
        } else if (params.gerar_contas_pagar && (!params.parcelas || params.parcelas.length === 0)) {
          // Gera uma única CP com o valor do PC
          const valorCp = params.valor_nf ?? pc.valor_total;
          const vencimento = new Date();
          vencimento.setDate(vencimento.getDate() + 30);
          const vencStr = vencimento.toISOString().split("T")[0];

          const { error: cpErr } = await sb
            .from("contas_pagar")
            .insert({
              fornecedor_id: pc.fornecedor_id,
              valor_original: valorCp,
              data_vencimento: vencStr,
              forma_pagamento: "boleto",
              numero_titulo: params.numero_nf ?? null,
              status: "pendente",
              descricao: `PC ${pc.numero ?? pc.id.substring(0, 8)}${params.numero_nf ? ` — NF ${params.numero_nf}` : ""}`,
            })
            .select()
            .single();

          if (cpErr) {
            contasLog.push(`⚠️ Erro ao criar CP automática: ${cpErr.message}`);
          } else {
            contasLog.push(`✅ CP automática criada: ${formatBRL(valorCp)} — venc. ${formatDate(vencStr)} — boleto`);
          }
        }

        const linhas = [
          `## Recebimento Registrado — PC ${pc.numero ?? pc.id.substring(0, 8)}`,
          "",
          `**Status do PC**: ${formatStatus(novoStatus)}`,
          params.numero_nf ? `**NF**: ${params.numero_nf}` : "",
          params.valor_nf ? `**Valor NF**: ${formatBRL(params.valor_nf)}` : "",
          "",
          "### Entradas de Estoque",
          ...movimentosLog,
        ].filter(Boolean);

        if (contasLog.length > 0) {
          linhas.push("", "### Contas a Pagar Geradas", ...contasLog);
        }

        return {
          content: [{ type: "text" as const, text: linhas.join("\n") }],
          structuredContent: {
            pedido_compra_id: params.pedido_compra_id,
            novo_status: novoStatus,
            movimentos: movimentosLog,
            contas_pagar: contasLog,
          },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

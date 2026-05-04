/**
 * Tool: croma_espelhar_os_mubisys
 *
 * Recebe o payload estruturado de uma OS Mubisys (saída do parse_os_mubisys.py)
 * e espelha tudo no CRM Croma em uma sequência transacional:
 *
 *   1. Confirma cliente por CNPJ
 *   2. Cria/confirma store (ponto de instalação) por ref + cliente_id
 *   3. Cria pedido  (origem_externa='mubisys', status='aprovado')
 *   4. Cria pedido_itens
 *   5. Cria ordem_instalacao (store_id, data_agendada, custo_logístico)
 *   6. Cria job de campo (type='instalacao', os_number=numero_os)
 *
 * Suporte a dry_run: valida sem criar nenhum registro.
 *
 * Adicionado em 2026-04-27 para migração Mubisys → CRM (caso-zero OS 1070).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient, getUserClient } from "../supabase-client.js";
import { errorResult } from "../utils/errors.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normaliza CNPJ para comparação: remove tudo que não for dígito */
function normalizeCnpj(cnpj: string): string {
  return (cnpj ?? "").replace(/\D/g, "");
}

/** Converte DD/MM/YYYY → YYYY-MM-DD (ISO date), ou null se inválido */
function parseDateBR(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Constrói endereço completo a partir das partes do parser */
function buildEnderecoCompleto(e: {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}): string {
  return [
    e.logradouro,
    e.numero,
    e.complemento,
    e.bairro,
    e.cidade && e.uf ? `${e.cidade} - ${e.uf}` : (e.cidade ?? e.uf),
    e.cep ? `CEP: ${e.cep}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Constrói endereço de rua para a store (sem cidade/UF/CEP repetidos) */
function buildStoreAddress(e: {
  logradouro?: string;
  numero?: string;
  complemento?: string;
}): string {
  return [e.logradouro, e.numero, e.complemento].filter(Boolean).join(", ");
}

// ─── Schemas de input ────────────────────────────────────────────────────────

const ClienteSchema = z.object({
  nome: z.string(),
  cnpj: z.string().describe("CNPJ formatado ou só dígitos"),
  contato: z.string().optional(),
  telefone: z.string().optional(),
});

const EnderecoSchema = z.object({
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
  cep: z.string().optional(),
});

const ItemSchema = z.object({
  numero: z.number().int(),
  descricao_cliente: z.string().optional(),
  produto: z.string(),
  modelo: z.string().optional(),
  largura_m: z.number().nullable().optional(),
  altura_m: z.number().nullable().optional(),
  area_m2: z.number().nullable().optional(),
  quantidade: z.number().int().default(1),
  acabamentos: z.array(z.string()).optional(),
  valor_unitario: z.number().nullable().optional(),
  valor_total_item: z.number().nullable().optional(),
});

const FreteSchema = z.object({
  descricao: z.string().optional(),
  valor: z.number(),
});

// ─── Registro da tool ─────────────────────────────────────────────────────────

export function registerEspelhamentoTools(server: McpServer): void {
  server.registerTool(
    "croma_espelhar_os_mubisys",
    {
      title: "Espelhar OS Mubisys no CRM",
      description: `Importa uma Ordem de Serviço do Mubisys para o CRM Croma.

Recebe o payload JSON gerado por parse_os_mubisys.py e executa a sequência completa:
  1. Confirma cliente por CNPJ (busca fuzzy para aceitar CNPJ formatado ou só dígitos)
  2. Cria ou reutiliza store (ponto de instalação) — busca por ref + cliente_id
  3. Cria pedido com origem_externa='mubisys', status='aprovado'
  4. Cria pedido_itens (um por item da OS)
  5. Cria ordem_instalacao vinculada ao pedido e à store
  6. Cria job de campo (type='instalacao', os_number=numero_os, status='Pendente')

Args:
  - numero_os (int, obrigatório): Número da OS no Mubisys
  - ref (string, opcional): Referência interna, ex: 'PONTAL LOJA 42'
  - status (string, opcional): Status da OS no Mubisys (Instalado, Aprovado…)
  - data_entrega (string, opcional): DD/MM/YYYY — vira data_agendada + data_prometida
  - data_aprovacao (string, opcional): DD/MM/YYYY HH:MM
  - vendedor (string, opcional): Nome do vendedor (só para log/observações)
  - cliente (objeto, obrigatório): nome, cnpj, contato?, telefone?
  - endereco_instalacao (objeto, obrigatório): logradouro, numero, complemento, bairro, cidade, uf, cep
  - itens (array, obrigatório): produto, modelo, largura_m, altura_m, quantidade, valor_unitario, valor_total_item
  - valor_total (number, obrigatório): Valor total da OS
  - frete (objeto, opcional): descricao, valor
  - comissao_pct (number, opcional): Percentual de comissão
  - forma_pagamento (string, opcional): Ex: 'Boleto'
  - condicoes_pagamento (string, opcional): Ex: '1x15 dias'
  - skip_auto_op (boolean, opcional): Se true, não cria Ordem de Produção automática (padrão: true — produção feita no Mubisys)
  - skip_auto_cr (boolean, opcional): Se true, não cria Conta a Receber automática (padrão: false)
  - dry_run (boolean, opcional): Se true, valida sem criar registros (padrão: false)

Retorna: pedido_id, oi_id, job_id, store_id, cliente_id, smoke_status`,

      inputSchema: z.object({
        numero_os: z.number().int().describe("Número da OS Mubisys"),
        ref: z.string().optional().describe("Referência interna (ex: 'PONTAL LOJA 42')"),
        status: z.string().optional().describe("Status da OS no Mubisys"),
        data_entrega: z.string().optional().describe("DD/MM/YYYY"),
        data_aprovacao: z.string().optional(),
        vendedor: z.string().optional(),
        cliente: ClienteSchema,
        endereco_instalacao: EnderecoSchema,
        itens: z.array(ItemSchema).min(1),
        valor_total: z.number(),
        frete: FreteSchema.nullable().optional(),
        comissao_pct: z.number().nullable().optional(),
        forma_pagamento: z.string().optional(),
        condicoes_pagamento: z.string().optional(),
        skip_auto_op: z.boolean().optional().default(true).describe("Não criar OP automática — produção feita no Mubisys"),
        skip_auto_cr: z.boolean().optional().default(false).describe("Não criar CR automática"),
        dry_run: z.boolean().optional().default(false).describe("Valida sem criar registros"),
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
        const sb = getAdminClient();
        const sbW = getUserClient();
        const log: string[] = [];
        const isDry = params.dry_run === true;

        if (isDry) log.push("⚠️ **DRY RUN — nenhum registro será criado**\n");

        // ── 1. Confirma cliente por CNPJ ─────────────────────────────────────

        const cnpjNorm = normalizeCnpj(params.cliente.cnpj);
        if (!cnpjNorm || cnpjNorm.length < 11) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ CNPJ inválido: "${params.cliente.cnpj}"`,
            }],
          };
        }

        // Busca por CNPJ — aceita formatado OU só dígitos
        const { data: clientes, error: errCli } = await sb
          .from("clientes")
          .select("id, razao_social, cnpj")
          .or(`cnpj.eq.${params.cliente.cnpj},cnpj.ilike.%${cnpjNorm.slice(0, 8)}%`)
          .eq("ativo", true)
          .limit(5);

        if (errCli) return errorResult(errCli);

        // Filtra pelo CNPJ normalizado
        const clienteMatch = (clientes ?? []).find(
          (c) => normalizeCnpj(c.cnpj) === cnpjNorm
        );

        if (!clienteMatch) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Cliente não encontrado no CRM.\n` +
                `CNPJ buscado: ${params.cliente.cnpj} (norm: ${cnpjNorm})\n` +
                `Nome na OS: ${params.cliente.nome}\n\n` +
                `Use croma_cadastrar_cliente antes de espelhar a OS.`,
            }],
          };
        }

        const clienteId = clienteMatch.id;
        log.push(`✅ Cliente encontrado: ${clienteMatch.razao_social} (\`${clienteId}\`)`);

        // ── 2. Cria ou reutiliza store ────────────────────────────────────────

        // Tenta achar store existente: mesmo ref + cliente_id
        // 'ref' é o nome da loja (ex: "PONTAL LOJA 42")
        const storeName = params.ref || `OS ${params.numero_os}`;
        let storeId: string | null = null;

        const { data: storesExist } = await sb
          .from("stores")
          .select("id, name, address, city")
          .eq("cliente_id", clienteId)
          .or(`name.ilike.%${storeName}%,address.ilike.%${params.endereco_instalacao.logradouro ?? ""}%`)
          .is("deleted_at", null)
          .limit(3);

        const endCidade = params.endereco_instalacao.cidade?.toLowerCase() ?? "";
        const storeExist = (storesExist ?? []).find(
          (s) =>
            s.name?.toLowerCase().includes(storeName.toLowerCase()) ||
            (s.city?.toLowerCase() === endCidade &&
              s.address?.toLowerCase().includes(
                (params.endereco_instalacao.logradouro ?? "").toLowerCase().slice(0, 10)
              ))
        );

        if (storeExist) {
          storeId = storeExist.id;
          log.push(`✅ Store existente reutilizada: ${storeExist.name} (\`${storeId}\`)`);
        } else {
          log.push(`🔄 Store não encontrada — será criada: "${storeName}"`);

          if (!isDry) {
            const storePayload = {
              name: storeName,
              cliente_id: clienteId,
              address: buildStoreAddress(params.endereco_instalacao),
              neighborhood: params.endereco_instalacao.bairro ?? null,
              city: params.endereco_instalacao.cidade ?? null,
              state: params.endereco_instalacao.uf?.toUpperCase() ?? null,
              zip_code: params.endereco_instalacao.cep ?? null,
              phone: params.cliente.telefone ?? null,
              brand: storeName.split(" ").slice(0, -2).join(" ") || null, // "PONTAL LOJA 42" → "PONTAL"
              code: params.ref ?? null,
              corporate_name: params.cliente.nome,
              cnpj: null,  // CNPJ da store é geralmente diferente do cliente master
              origem: "mubisys",
            };

            const { data: storeNew, error: errStore } = await sbW
              .from("stores")
              .insert(storePayload)
              .select()
              .single();

            if (errStore) return errorResult(errStore);
            storeId = storeNew.id;
            log.push(`  → Store criada: \`${storeId}\` (geocoding assíncrono disparado)`);
          } else {
            storeId = "(dry-run)";
          }
        }

        // ── 3. Cria pedido ────────────────────────────────────────────────────

        const dataPrometida = parseDateBR(params.data_entrega);
        const obsLinhas = [
          `OS Mubisys #${params.numero_os}`,
          params.ref ? `Ref: ${params.ref}` : null,
          params.vendedor ? `Vendedor: ${params.vendedor}` : null,
          params.forma_pagamento && params.condicoes_pagamento
            ? `Pagamento: ${params.forma_pagamento} ${params.condicoes_pagamento}`
            : null,
          params.frete?.valor
            ? `Frete: ${params.frete.descricao ?? "Frete"} R$ ${params.frete.valor.toFixed(2)}`
            : null,
          params.comissao_pct ? `Comissão: ${params.comissao_pct}%` : null,
        ].filter(Boolean).join(" | ");

        let pedidoId: string | null = null;

        if (!isDry) {
          const { data: pedido, error: errPed } = await sbW
            .from("pedidos")
            .insert({
              cliente_id: clienteId,
              status: "aprovado",
              valor_total: params.valor_total,
              data_prometida: dataPrometida,
              observacoes: obsLinhas,
              origem_externa: "mubisys",
              skip_auto_op: params.skip_auto_op !== false,  // default true
              skip_auto_cr: params.skip_auto_cr === true,   // default false
              skip_auto_comissao: false,
            })
            .select()
            .single();

          if (errPed) return errorResult(errPed);
          pedidoId = pedido.id;
          log.push(`✅ Pedido criado: \`${pedidoId}\` | Status: aprovado | Total: R$ ${params.valor_total.toFixed(2)}`);
        } else {
          pedidoId = "(dry-run)";
          log.push(`🔄 [dry] Pedido seria criado: valor_total=${params.valor_total}, status=aprovado, origem_externa=mubisys`);
        }

        // ── 4. Cria pedido_itens ──────────────────────────────────────────────

        const pedidoItemIds: string[] = [];

        for (const item of params.itens) {
          const descricao = [item.produto, item.modelo].filter(Boolean).join(" ");
          const especificacao = item.descricao_cliente
            ? item.descricao_cliente.slice(0, 500)
            : null;
          const instrucoes = item.acabamentos?.length
            ? item.acabamentos.join(", ")
            : null;

          // Dimensões: parser retorna metros, banco espera centímetros
          const larguraCm = item.largura_m != null ? Math.round(item.largura_m * 100) : null;
          const alturaCm = item.altura_m != null ? Math.round(item.altura_m * 100) : null;

          if (!isDry) {
            const { data: pi, error: errPi } = await sbW
              .from("pedido_itens")
              .insert({
                pedido_id: pedidoId,
                descricao,
                especificacao,
                instrucoes,
                quantidade: item.quantidade,
                valor_unitario: item.valor_unitario ?? 0,
                valor_total: item.valor_total_item ?? 0,
                largura_cm: larguraCm,
                altura_cm: alturaCm,
                area_m2: item.area_m2 ?? null,
                status: "pendente",
              })
              .select()
              .single();

            if (errPi) return errorResult(errPi);
            pedidoItemIds.push(pi.id);
            log.push(`  ↳ Item ${item.numero}: ${descricao} ${item.largura_m ?? "?"}x${item.altura_m ?? "?"}m | Qtd ${item.quantidade} | R$ ${(item.valor_total_item ?? 0).toFixed(2)}`);
          } else {
            pedidoItemIds.push("(dry-run)");
            log.push(`  ↳ [dry] Item ${item.numero}: ${descricao} ${item.largura_m}x${item.altura_m}m`);
          }
        }

        // ── 5. Cria ordem_instalacao ──────────────────────────────────────────

        const enderecoCompleto = buildEnderecoCompleto(params.endereco_instalacao);
        const dataAgendada = parseDateBR(params.data_entrega);
        let oiId: string | null = null;
        const primeiroItemId = pedidoItemIds[0] ?? null;

        if (!isDry) {
          const { data: oi, error: errOi } = await sbW
            .from("ordens_instalacao")
            .insert({
              pedido_id: pedidoId,
              pedido_item_id: primeiroItemId !== "(dry-run)" ? primeiroItemId : null,
              cliente_id: clienteId,
              store_id: storeId !== "(dry-run)" ? storeId : null,
              status: "aguardando_agendamento",
              data_agendada: dataAgendada,
              endereco_completo: enderecoCompleto,
              custo_logistico: params.frete?.valor ?? 0,
              instrucoes: `OS Mubisys #${params.numero_os}${params.ref ? ` — ${params.ref}` : ""}`,
              observacoes: obsLinhas,
            })
            .select()
            .single();

          if (errOi) return errorResult(errOi);
          oiId = oi.id;
          log.push(`✅ Ordem de instalação criada: \`${oiId}\` | Data: ${dataAgendada ?? "(a agendar)"}`);
        } else {
          oiId = "(dry-run)";
          log.push(`🔄 [dry] OI seria criada: data_agendada=${dataAgendada}, custo_logistico=${params.frete?.valor ?? 0}`);
        }

        // ── 6. Cria job de campo ──────────────────────────────────────────────

        let jobId: string | null = null;

        if (!isDry) {
          const { data: job, error: errJob } = await sbW
            .from("jobs")
            .insert({
              store_id: storeId !== "(dry-run)" ? storeId : null,
              os_number: String(params.numero_os),
              type: "instalacao",
              status: "Pendente",
              scheduled_date: dataAgendada,
              notes: obsLinhas,
              ordem_instalacao_id: oiId !== "(dry-run)" ? oiId : null,
              pedido_id: pedidoId !== "(dry-run)" ? pedidoId : null,
              pedido_item_id: primeiroItemId !== "(dry-run)" ? primeiroItemId : null,
            })
            .select()
            .single();

          if (errJob) return errorResult(errJob);
          jobId = job.id;
          log.push(`✅ Job de campo criado: \`${jobId}\` | OS #${params.numero_os} | Data: ${dataAgendada ?? "a agendar"}`);
        } else {
          jobId = "(dry-run)";
          log.push(`🔄 [dry] Job seria criado: os_number=${params.numero_os}, type=instalacao`);
        }

        // ── Resumo final ──────────────────────────────────────────────────────

        const result = {
          smoke_status: isDry ? "dry_run_ok" : "ok",
          cliente_id: clienteId,
          store_id: storeId,
          pedido_id: pedidoId,
          pedido_item_ids: pedidoItemIds,
          oi_id: oiId,
          job_id: jobId,
          numero_os: params.numero_os,
          ref: params.ref ?? null,
          dry_run: isDry,
        };

        const summary = isDry
          ? `## ✅ Dry Run OK — OS Mubisys #${params.numero_os}\n\n${log.join("\n")}\n\n**Nenhum registro criado.** Remova dry_run=true para executar.`
          : `## ✅ OS Mubisys #${params.numero_os} espelhada no CRM!\n\n${log.join("\n")}\n\n` +
            `**IDs criados:**\n` +
            `- Cliente: \`${clienteId}\`\n` +
            `- Store: \`${storeId}\`\n` +
            `- Pedido: \`${pedidoId}\`\n` +
            `- OI: \`${oiId}\`\n` +
            `- Job: \`${jobId}\``;

        return {
          content: [{ type: "text" as const, text: summary }],
          structuredContent: result,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

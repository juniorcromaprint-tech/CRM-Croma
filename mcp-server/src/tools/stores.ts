/**
 * Ferramentas Stores — Lojas/Pontos de Instalação
 *
 * Stores são pontos físicos onde a Croma instala comunicação visual:
 * lojas próprias do cliente, lojas parceiras, franquias, unidades.
 *
 * Diferente de cliente_unidades (filiais administrativas), stores são
 * pontos GEOGRÁFICOS de instalação — cada store tem endereço, lat/lng
 * (auto-geocoding via Edge stores-geocode) e pode ser referenciada
 * em pedidos e ordens de instalação.
 *
 * Adicionado em 2026-04-27 pra suportar migração Mubisys → CRM,
 * onde cada OS tem cliente + ponto de instalação distintos.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdminClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatPhone } from "../utils/formatting.js";

export function registerStoresTools(server: McpServer): void {
  // ─── croma_listar_stores ─────────────────────────────────────────────────

  server.registerTool(
    "croma_listar_stores",
    {
      title: "Listar Stores (Lojas/Pontos de Instalação)",
      description: `Lista pontos de instalação cadastrados na Croma Print.

Stores são lojas/franquias/parceiros onde a Croma instala comunicação visual.
Cada store tem endereço completo, telefone e pode ter lat/lng (auto-geocoding).

Args:
  - cliente_id (string, opcional): UUID do cliente dono/responsável da store
  - busca (string, opcional): Busca por nome, code ou endereço
  - cidade (string, opcional): Filtrar por cidade
  - estado (string, opcional): UF, ex: 'SP', 'RS'
  - apenas_geocodificadas (boolean, opcional): Só retorna stores com lat/lng (padrão: false)
  - incluir_excluidas (boolean, opcional): Incluir stores soft-deleted (padrão: false)
  - limit (number): Máximo (padrão: 20, máx: 100)
  - offset (number): Paginação (padrão: 0)

Retorna: id, name, brand, code, address, neighborhood, city, state, zip_code,
phone, email, lat, lng, cliente_id, origem`,
      inputSchema: z.object({
        cliente_id: z.string().uuid().optional().describe("UUID do cliente"),
        busca: z.string().optional().describe("Busca por nome, code ou endereço"),
        cidade: z.string().optional().describe("Filtrar por cidade"),
        estado: z.string().max(2).optional().describe("UF ex: SP"),
        apenas_geocodificadas: z.boolean().optional().default(false).describe("Só com lat/lng"),
        incluir_excluidas: z.boolean().optional().default(false).describe("Incluir soft-deleted"),
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
          .from("stores")
          .select(
            "id, name, brand, code, corporate_name, cnpj, address, neighborhood, city, state, zip_code, phone, email, lat, lng, cliente_id, cliente_unidade_id, origem, created_at, deleted_at",
            { count: "exact" }
          );

        if (!params.incluir_excluidas) query = query.is("deleted_at", null);
        if (params.cliente_id) query = query.eq("cliente_id", params.cliente_id);
        if (params.cidade) query = query.ilike("city", `%${params.cidade}%`);
        if (params.estado) query = query.eq("state", params.estado.toUpperCase());
        if (params.apenas_geocodificadas) {
          query = query.not("lat", "is", null).not("lng", "is", null);
        }
        if (params.busca) {
          query = query.or(
            `name.ilike.%${params.busca}%,code.ilike.%${params.busca}%,address.ilike.%${params.busca}%,corporate_name.ilike.%${params.busca}%`
          );
        }

        query = query
          .order("name")
          .range(params.offset, params.offset + params.limit - 1);

        const { data, error, count } = await query;
        if (error) return errorResult(error);

        const items = data ?? [];
        const total = count ?? items.length;
        const response = buildPaginatedResponse(items, total, params.offset, params.limit);

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          const lines = [`## Stores (${total} encontradas)`, ""];
          if (items.length === 0) {
            lines.push("_Nenhuma store encontrada com os filtros informados._");
          } else {
            for (const s of items) {
              lines.push(`### ${s.name ?? "(sem nome)"}${s.code ? ` [${s.code}]` : ""}`);
              lines.push(`- **ID**: \`${s.id}\``);
              if (s.brand) lines.push(`- **Marca/Bandeira**: ${s.brand}`);
              if (s.corporate_name) lines.push(`- **Razão Social**: ${s.corporate_name}`);
              if (s.cnpj) lines.push(`- **CNPJ**: ${s.cnpj}`);
              if (s.address) {
                const partes = [s.address, s.neighborhood, s.city, s.state, s.zip_code].filter(Boolean).join(", ");
                lines.push(`- **Endereço**: ${partes}`);
              }
              if (s.phone) lines.push(`- **Telefone**: ${formatPhone(s.phone)}`);
              if (s.email) lines.push(`- **Email**: ${s.email}`);
              if (s.lat && s.lng) {
                lines.push(`- **Coordenadas**: ${s.lat}, ${s.lng} ✅`);
              } else {
                lines.push(`- **Coordenadas**: _não geocodificadas_ ⚠️`);
              }
              if (s.cliente_id) lines.push(`- **Cliente**: \`${s.cliente_id}\``);
              if (s.origem) lines.push(`- **Origem**: ${s.origem}`);
              if (s.deleted_at) lines.push(`- **Status**: ❌ Soft-deleted em ${s.deleted_at}`);
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

  // ─── croma_criar_store ───────────────────────────────────────────────────

  server.registerTool(
    "croma_criar_store",
    {
      title: "Criar Store (Loja/Ponto de Instalação)",
      description: `Cadastra um novo ponto de instalação no CRM Croma.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Após o INSERT, o trigger trg_store_auto_geocode dispara assíncrono pra Edge
stores-geocode (Nominatim) e preenche lat/lng em segundos. Se address vier
vazio ou nulo, o geocoding NÃO dispara.

Args:
  - name (string, obrigatório): Nome da loja (ex: "PONTAL LOJA 42", "Renner Morumbi")
  - cliente_id (string, obrigatório): UUID do cliente dono/responsável
  - address (string, opcional): Endereço (rua + número + complemento)
  - neighborhood (string, opcional): Bairro
  - city (string, opcional): Cidade
  - state (string, opcional): UF (2 letras, ex: 'SP')
  - zip_code (string, opcional): CEP (formato 99999-999 ou 99999999)
  - phone (string, opcional): Telefone do contato local
  - email (string, opcional): Email do contato local
  - brand (string, opcional): Bandeira/marca da loja (ex: "Pontal", "Renner")
  - code (string, opcional): Código interno (ex: "LOJA-42")
  - corporate_name (string, opcional): Razão social da loja se diferente do cliente
  - cnpj (string, opcional): CNPJ da loja se for empresa diferente
  - cliente_unidade_id (string, opcional): UUID da unidade administrativa do cliente
  - origem (string, opcional): Origem do cadastro (ex: 'mubisys', 'manual', 'portal')

Retorna: dados da store criada (lat/lng virão preenchidos depois pelo geocoding async)`,
      inputSchema: z.object({
        name: z.string().min(1).max(200).describe("Nome da loja"),
        cliente_id: z.string().uuid().describe("UUID do cliente"),
        address: z.string().max(300).optional(),
        neighborhood: z.string().max(100).optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(2).optional(),
        zip_code: z.string().max(10).optional(),
        phone: z.string().max(30).optional(),
        email: z.string().email().optional(),
        brand: z.string().max(100).optional(),
        code: z.string().max(50).optional(),
        corporate_name: z.string().max(200).optional(),
        cnpj: z.string().max(20).optional(),
        cliente_unidade_id: z.string().uuid().optional(),
        origem: z.string().max(50).optional(),
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

        // Normaliza state pra maiúsculas
        const payload = {
          ...params,
          state: params.state?.toUpperCase() ?? null,
        };

        const { data, error } = await sb
          .from("stores")
          .insert(payload)
          .select()
          .single();

        if (error) return errorResult(error);

        const lines = [
          `✅ Store cadastrada com sucesso!`,
          ``,
          `- **ID**: \`${data.id}\``,
          `- **Nome**: ${data.name}`,
        ];
        if (data.address) {
          const partes = [data.address, data.neighborhood, data.city, data.state, data.zip_code].filter(Boolean).join(", ");
          lines.push(`- **Endereço**: ${partes}`);
        }
        if (data.phone) lines.push(`- **Telefone**: ${formatPhone(data.phone)}`);
        if (data.cliente_id) lines.push(`- **Cliente**: \`${data.cliente_id}\``);
        lines.push(``);
        lines.push(`🔄 Auto-geocoding disparado (Edge stores-geocode → Nominatim).`);
        lines.push(`Lat/lng serão preenchidos em ~3-5 segundos. Use croma_listar_stores pra confirmar.`);

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_atualizar_store ───────────────────────────────────────────────

  server.registerTool(
    "croma_atualizar_store",
    {
      title: "Atualizar Store",
      description: `Atualiza campos de uma store existente.

ATENÇÃO: Ação que modifica dados. Confirme com o usuário antes de executar.

Mudanças em address/zip_code/city/state/neighborhood disparam re-geocoding
automático via trigger trg_store_geocode_on_update — só re-geocoda se lat/lng
estiverem nulos. Pra forçar re-geocoding com coords já setadas, zere lat/lng
antes (passar lat=null, lng=null) e depois atualize o endereço.

Args:
  - id (string, obrigatório): UUID da store
  - name, address, neighborhood, city, state, zip_code, phone, email,
    brand, code, corporate_name, cnpj, cliente_id, cliente_unidade_id, origem,
    lat, lng — todos opcionais. Apenas campos informados são alterados.
  - excluir (boolean, opcional): Se true, soft-delete (seta deleted_at=now()).
    Pra restaurar, passe excluir=false.`,
      inputSchema: z.object({
        id: z.string().uuid().describe("UUID da store"),
        name: z.string().min(1).max(200).optional(),
        address: z.string().max(300).optional(),
        neighborhood: z.string().max(100).optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(2).optional(),
        zip_code: z.string().max(10).optional(),
        phone: z.string().max(30).optional(),
        email: z.string().email().optional(),
        brand: z.string().max(100).optional(),
        code: z.string().max(50).optional(),
        corporate_name: z.string().max(200).optional(),
        cnpj: z.string().max(20).optional(),
        cliente_id: z.string().uuid().optional(),
        cliente_unidade_id: z.string().uuid().optional(),
        origem: z.string().max(50).optional(),
        lat: z.number().nullable().optional(),
        lng: z.number().nullable().optional(),
        excluir: z.boolean().optional(),
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
        const sb = getUserClient();
        const { id, excluir, ...campos } = params;

        const update: Record<string, unknown> = { ...campos };
        if (campos.state) update.state = campos.state.toUpperCase();
        if (excluir === true) update.deleted_at = new Date().toISOString();
        if (excluir === false) update.deleted_at = null;

        if (Object.keys(update).length === 0) {
          return {
            content: [{ type: "text" as const, text: "⚠️ Nenhum campo informado para atualizar." }],
          };
        }

        const { data, error } = await sb
          .from("stores")
          .update(update)
          .eq("id", id)
          .select()
          .single();

        if (error) return errorResult(error);

        const lines = [
          `✅ Store atualizada com sucesso!`,
          ``,
          `- **ID**: \`${data.id}\``,
          `- **Nome**: ${data.name}`,
        ];
        if (data.address) {
          const partes = [data.address, data.neighborhood, data.city, data.state, data.zip_code].filter(Boolean).join(", ");
          lines.push(`- **Endereço**: ${partes}`);
        }
        if (data.lat && data.lng) {
          lines.push(`- **Coordenadas**: ${data.lat}, ${data.lng}`);
        }
        if (data.deleted_at) {
          lines.push(`- **Status**: ❌ Soft-deleted em ${data.deleted_at}`);
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: data,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

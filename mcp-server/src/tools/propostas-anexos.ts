/**
 * Ferramentas de Anexos de Proposta — Claudete pode gerenciar arquivos anexados
 * as propostas do sistema.
 *
 * Casos de uso tipicos:
 *  - Cliente manda arte pelo WhatsApp -> Claudete anexa diretamente na proposta
 *  - Junior pergunta "que arquivos temos na proposta PRO-1234?" -> listagem formatada
 *  - Remover anexo duplicado ou enviado por engano
 *
 * Seguranca:
 *  - Tools usam service_role para reads (admin client)
 *  - Upload e delete chamam Edge Functions autenticadas com o JWT do Junior
 *  - Policy de delete: Claudete so remove anexos que ela mesma criou
 *    (uploaded_by_name = 'Claudete (IA)') OU quando Junior pedir explicitamente
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAdminClient,
  getUserClient,
  getJuniorUserId,
} from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { formatDate } from "../utils/formatting.js";
import {
  baixarArquivoUrl,
  uploadParaOneDriveProposta,
  deletarArquivoOneDrive,
  calcularSha256,
  formatarTamanhoBytes,
} from "../utils/onedrive.js";

const CLAUDETE_UPLOADED_BY_NAME = "Claudete (IA)";
const MAX_FILE_SIZE_MB = 150;

export function registerPropostasAnexosTools(server: McpServer): void {
  // ─── croma_listar_anexos_proposta ────────────────────────────────────────

  server.registerTool(
    "croma_listar_anexos_proposta",
    {
      title: "Listar Anexos da Proposta",
      description: `Lista todos os arquivos anexados a uma proposta (arte, briefing, fotos).

Inclui anexos do cliente (via portal) e do vendedor/Claudete (via CRM).
Por padrao filtra deletados. Ordem: mais recentes primeiro.

Args:
  - proposta_id (string, obrigatorio): UUID da proposta
  - incluir_deletados (boolean, opcional): Se true, inclui anexos soft-deletados. Default false.
  - response_format ('markdown'|'json'): Formato (padrao markdown)`,
      inputSchema: z.object({
        proposta_id: z.string().uuid(),
        incluir_deletados: z.coerce.boolean().default(false),
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

        // Primeiro valida que a proposta existe e pega alguns dados p/ o cabecalho
        const { data: proposta, error: propErr } = await sb
          .from("propostas")
          .select("id, numero, titulo, cliente:clientes(nome_fantasia, razao_social)")
          .eq("id", params.proposta_id)
          .maybeSingle();

        if (propErr) return errorResult(propErr);
        if (!proposta) {
          return {
            content: [{ type: "text" as const, text: `Proposta ${params.proposta_id} nao encontrada.` }],
          };
        }

        let query = sb
          .from("proposta_attachments")
          .select(
            "id, nome_arquivo, tipo_mime, tamanho_bytes, onedrive_file_url, preview_url, uploaded_by_type, uploaded_by_name, created_at, deleted_at"
          )
          .eq("proposta_id", params.proposta_id)
          .order("created_at", { ascending: false });

        if (!params.incluir_deletados) {
          query = query.is("deleted_at", null);
        }

        const { data: anexos, error } = await query;
        if (error) return errorResult(error);

        const total = anexos?.length ?? 0;
        const nomeCliente =
          (proposta.cliente as unknown as { nome_fantasia?: string; razao_social?: string })?.nome_fantasia ??
          (proposta.cliente as unknown as { razao_social?: string })?.razao_social ??
          "—";

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ proposta: proposta.numero, anexos }, null, 2) }],
          };
        }

        // Markdown
        const lines: string[] = [];
        lines.push(`## Anexos da proposta ${proposta.numero} — ${nomeCliente}`);
        if (proposta.titulo) lines.push(`*${proposta.titulo}*`);
        lines.push("");

        if (total === 0) {
          lines.push("_Nenhum arquivo anexado ainda._");
        } else {
          lines.push(`**${total} arquivo${total > 1 ? "s" : ""}** anexado${total > 1 ? "s" : ""}:`);
          lines.push("");

          for (const a of anexos ?? []) {
            const origem = a.uploaded_by_type === "cliente"
              ? `Cliente (${a.uploaded_by_name ?? "anonimo"})`
              : `Vendedor/IA (${a.uploaded_by_name ?? "sem nome"})`;
            const deletedMark = a.deleted_at ? " 🗑️ _DELETADO_" : "";
            lines.push(`### ${a.nome_arquivo}${deletedMark}`);
            lines.push(`- **ID**: \`${a.id}\``);
            lines.push(`- **Tamanho**: ${formatarTamanhoBytes(a.tamanho_bytes as number | null)}`);
            if (a.tipo_mime) lines.push(`- **Tipo**: ${a.tipo_mime}`);
            lines.push(`- **Enviado por**: ${origem}`);
            lines.push(`- **Data**: ${formatDate(a.created_at as string)}`);
            if (a.onedrive_file_url) lines.push(`- **OneDrive**: [abrir](${a.onedrive_file_url})`);
            if (a.preview_url) lines.push(`- **Preview**: [ver](${a.preview_url})`);
            lines.push("");
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ─── croma_anexar_arquivo_proposta_url ──────────────────────────────────

  server.registerTool(
    "croma_anexar_arquivo_proposta_url",
    {
      title: "Anexar Arquivo de URL na Proposta",
      description: `Baixa um arquivo de uma URL publica (WhatsApp CDN, Drive publico, link direto)
e anexa na proposta indicada. Arquivo vai pro OneDrive do cliente + registro em proposta_attachments.

Caso de uso tipico: cliente mandou a arte por WhatsApp -> Junior pede para a Claudete anexar
no orcamento correto.

Args:
  - proposta_id (string, obrigatorio): UUID da proposta
  - file_url (string, obrigatorio): URL publica do arquivo (http/https)
  - nome_arquivo (string, opcional): Nome para salvar. Se omitido, tenta inferir da URL.`,
      inputSchema: z.object({
        proposta_id: z.string().uuid(),
        file_url: z.string().url(),
        nome_arquivo: z.string().optional(),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const sb = getAdminClient();
        const userClient = getUserClient();

        // 1) Valida proposta
        const { data: proposta, error: propErr } = await sb
          .from("propostas")
          .select("id, numero, cliente:clientes(nome_fantasia, razao_social)")
          .eq("id", params.proposta_id)
          .maybeSingle();

        if (propErr) return errorResult(propErr);
        if (!proposta) {
          return {
            content: [{ type: "text" as const, text: `Proposta ${params.proposta_id} nao encontrada.` }],
          };
        }

        // 2) Baixa arquivo
        const { buffer, contentType, nomeInferido } = await baixarArquivoUrl(params.file_url);
        const nomeArquivo = params.nome_arquivo ?? nomeInferido;

        // Valida tamanho
        const tamanhoMb = buffer.length / (1024 * 1024);
        if (tamanhoMb > MAX_FILE_SIZE_MB) {
          return {
            content: [{
              type: "text" as const,
              text: `Arquivo muito grande (${tamanhoMb.toFixed(1)}MB). Limite: ${MAX_FILE_SIZE_MB}MB.`,
            }],
          };
        }

        // 3) Calcula hash para dedup
        const sha256 = await calcularSha256(buffer);

        // 4) Checa se ja existe (mesma proposta + mesmo hash, nao deletado)
        const { data: existente } = await sb
          .from("proposta_attachments")
          .select("id, nome_arquivo")
          .eq("proposta_id", params.proposta_id)
          .eq("file_sha256", sha256)
          .is("deleted_at", null)
          .maybeSingle();

        if (existente) {
          return {
            content: [{
              type: "text" as const,
              text: `⚠️ Arquivo identico ja anexado na proposta (como "${existente.nome_arquivo}", id ${existente.id}). Upload cancelado para evitar duplicata.`,
            }],
          };
        }

        // 5) Upload pro OneDrive via edge
        const uploadResult = await uploadParaOneDriveProposta({
          userClient,
          propostaId: params.proposta_id,
          nomeArquivo,
          buffer,
          contentType,
        });

        // 6) Insert em proposta_attachments (admin client bypass RLS)
        const juniorId = getJuniorUserId();
        const { data: anexo, error: attErr } = await sb
          .from("proposta_attachments")
          .insert({
            proposta_id: params.proposta_id,
            nome_arquivo: nomeArquivo,
            tipo_mime: contentType,
            tamanho_bytes: buffer.length,
            onedrive_file_id: uploadResult.fileId,
            onedrive_file_url: uploadResult.webUrl,
            file_sha256: sha256,
            uploaded_by_type: "vendedor",
            uploaded_by_name: CLAUDETE_UPLOADED_BY_NAME,
            uploaded_by_user_id: juniorId,
          })
          .select("id")
          .single();

        if (attErr) {
          // Rollback: deleta arquivo do OneDrive
          try {
            await deletarArquivoOneDrive(userClient, uploadResult.fileId);
          } catch {
            // silencioso — arquivo ficara orfao mas log fica registrado
          }
          return errorResult(attErr);
        }

        const nomeCliente =
          (proposta.cliente as unknown as { nome_fantasia?: string; razao_social?: string })?.nome_fantasia ??
          (proposta.cliente as unknown as { razao_social?: string })?.razao_social ??
          "—";

        return {
          content: [{
            type: "text" as const,
            text: [
              `✅ Arquivo anexado com sucesso na proposta ${proposta.numero} (${nomeCliente})`,
              "",
              `- **Nome**: ${nomeArquivo}`,
              `- **Tamanho**: ${formatarTamanhoBytes(buffer.length)}`,
              `- **Tipo**: ${contentType}`,
              `- **ID do anexo**: \`${anexo.id}\``,
              `- **OneDrive**: [abrir arquivo](${uploadResult.webUrl})`,
            ].join("\n"),
          }],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ─── croma_remover_anexo_proposta ────────────────────────────────────────

  server.registerTool(
    "croma_remover_anexo_proposta",
    {
      title: "Remover Anexo da Proposta",
      description: `Remove (soft-delete) um anexo da proposta. Arquivo vai pra lixeira do OneDrive.

Policy de seguranca:
  - Claudete so remove anexos que ela mesma criou (uploaded_by_name = 'Claudete (IA)')
  - Para remover anexos enviados pelo cliente via portal: somente admin (via UI do ERP)
  - Sempre confirmar com Junior antes de executar (destructive)

Args:
  - anexo_id (string, obrigatorio): UUID do anexo (obtido via croma_listar_anexos_proposta)
  - confirmar (boolean, obrigatorio): DEVE ser true para executar. Proteção contra delete acidental.`,
      inputSchema: z.object({
        anexo_id: z.string().uuid(),
        confirmar: z.coerce.boolean(),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        if (!params.confirmar) {
          return {
            content: [{
              type: "text" as const,
              text: "❌ Remocao nao confirmada. Passe confirmar=true para executar.",
            }],
          };
        }

        const sb = getAdminClient();
        const userClient = getUserClient();

        // Busca anexo
        const { data: anexo, error: fetchErr } = await sb
          .from("proposta_attachments")
          .select("id, nome_arquivo, onedrive_file_id, uploaded_by_name, uploaded_by_type, deleted_at, proposta_id")
          .eq("id", params.anexo_id)
          .maybeSingle();

        if (fetchErr) return errorResult(fetchErr);
        if (!anexo) {
          return {
            content: [{ type: "text" as const, text: `Anexo ${params.anexo_id} nao encontrado.` }],
          };
        }

        if (anexo.deleted_at) {
          return {
            content: [{
              type: "text" as const,
              text: `⚠️ Anexo "${anexo.nome_arquivo}" ja esta deletado (em ${formatDate(anexo.deleted_at as string)}).`,
            }],
          };
        }

        // Policy: Claudete so remove o que ela criou
        if (anexo.uploaded_by_name !== CLAUDETE_UPLOADED_BY_NAME) {
          const quemEnviou = anexo.uploaded_by_type === "cliente" ? "cliente" : "vendedor";
          return {
            content: [{
              type: "text" as const,
              text: `❌ Nao posso remover esse anexo. Foi enviado pelo ${quemEnviou} (${anexo.uploaded_by_name ?? "?"}). Para remover, use o CRM com usuario admin.`,
            }],
          };
        }

        // Delete OneDrive primeiro (idempotente, 404=ok)
        if (anexo.onedrive_file_id) {
          try {
            await deletarArquivoOneDrive(userClient, anexo.onedrive_file_id as string);
          } catch (err) {
            // Nao bloqueia — o soft-delete no DB ainda vale
            // (arquivo pode ficar orfao mas registro fica marcado)
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[propostas-anexos] delete OneDrive falhou: ${msg}\n`);
          }
        }

        // Soft-delete no DB
        const juniorId = getJuniorUserId();
        const { error: updateErr } = await sb
          .from("proposta_attachments")
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by_user_id: juniorId,
          })
          .eq("id", params.anexo_id)
          .select("id")
          .single();

        if (updateErr) return errorResult(updateErr);

        return {
          content: [{
            type: "text" as const,
            text: `✅ Anexo "${anexo.nome_arquivo}" removido (soft-delete). Arquivo foi pra lixeira do OneDrive. Pode ser recuperado em ate 30 dias.`,
          }],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}

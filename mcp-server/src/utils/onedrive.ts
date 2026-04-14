/**
 * utils/onedrive.ts
 *
 * Helpers para interagir com OneDrive via as Edge Functions Supabase
 * (onedrive-upload-interno, onedrive-delete-file) usando o JWT do Junior.
 *
 * Por que chamar as edges em vez de falar com Graph direto?
 *  - As edges já têm AZURE_CLIENT_ID_V2 + AZURE_REFRESH_TOKEN_V2 configurados
 *  - Centraliza a lógica de token refresh + chunked upload
 *  - Respeita validações de role já implementadas na edge
 *
 * Fluxo: MCP tool -> (HTTP) edge onedrive-* -> Graph API
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../supabase-client.js";

const UPLOAD_INTERNO_URL = `${SUPABASE_URL}/functions/v1/onedrive-upload-interno`;
const DELETE_FILE_URL = `${SUPABASE_URL}/functions/v1/onedrive-delete-file`;

/**
 * Pega o access_token da sessao autenticada (Junior).
 * Throws se nao houver sessao ativa — tool deve tratar e retornar erro amigavel.
 */
async function getAccessToken(userClient: SupabaseClient): Promise<string> {
  const { data, error } = await userClient.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error(
      "MCP nao tem sessao autenticada. Verifique SUPABASE_USER_PASSWORD em croma.cmd."
    );
  }
  return data.session.access_token;
}

/**
 * Baixa arquivo de uma URL publica (WhatsApp CDN, Drive publico, etc.)
 * Retorna buffer + content-type detectado.
 */
export async function baixarArquivoUrl(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
  nomeInferido: string;
}> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo (${res.status}): ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Tenta extrair nome do Content-Disposition; fallback para ultima parte da URL
  const disposition = res.headers.get("content-disposition") ?? "";
  const fnMatch = disposition.match(/filename="?([^";]+)"?/i);
  let nomeInferido = fnMatch ? fnMatch[1] : "";
  if (!nomeInferido) {
    try {
      const u = new URL(url);
      const lastSeg = u.pathname.split("/").pop() || "arquivo";
      nomeInferido = decodeURIComponent(lastSeg);
    } catch {
      nomeInferido = "arquivo";
    }
  }

  return { buffer, contentType, nomeInferido };
}

/**
 * Upload de arquivo (buffer) para OneDrive via edge onedrive-upload-interno.
 * Scope sempre 'proposta' neste helper — scope='pedido' e tratado no frontend.
 */
export async function uploadParaOneDriveProposta(params: {
  userClient: SupabaseClient;
  propostaId: string;
  nomeArquivo: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ fileId: string; webUrl: string; uploadedByName: string }> {
  const { userClient, propostaId, nomeArquivo, buffer, contentType } = params;

  const accessToken = await getAccessToken(userClient);

  // Node 18+ tem FormData e Blob nativos
  const formData = new FormData();
  const blob = new Blob([buffer], { type: contentType });
  formData.append("file", blob, nomeArquivo);
  formData.append("scope", "proposta");
  formData.append("entityId", propostaId);

  const res = await fetch(UPLOAD_INTERNO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // NAO setar Content-Type — fetch setta boundary automaticamente
    },
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = (errBody as { error?: string }).error ?? `Edge retornou ${res.status}`;
    throw new Error(`Upload OneDrive falhou: ${msg}`);
  }

  const data = await res.json() as {
    fileId?: string;
    webUrl?: string;
    uploadedByName?: string;
  };

  if (!data.fileId || !data.webUrl) {
    throw new Error("Resposta da edge de upload esta incompleta");
  }

  return {
    fileId: data.fileId,
    webUrl: data.webUrl,
    uploadedByName: data.uploadedByName ?? "Claudete (IA)",
  };
}

/**
 * Deleta arquivo do OneDrive via edge onedrive-delete-file.
 * Idempotente: 404 conta como sucesso.
 */
export async function deletarArquivoOneDrive(
  userClient: SupabaseClient,
  fileId: string
): Promise<{ success: boolean; status: number }> {
  const accessToken = await getAccessToken(userClient);

  const res = await fetch(DELETE_FILE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileId }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = (errBody as { error?: string }).error ?? `Edge retornou ${res.status}`;
    throw new Error(`Delete OneDrive falhou: ${msg}`);
  }

  const data = await res.json() as { success?: boolean; status?: number };
  return { success: data.success ?? true, status: data.status ?? 204 };
}

/**
 * Calcula SHA-256 hex de um buffer (Node crypto).
 */
export async function calcularSha256(buffer: Buffer): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Formata tamanho em bytes para human-readable (KB, MB, GB).
 */
export function formatarTamanhoBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

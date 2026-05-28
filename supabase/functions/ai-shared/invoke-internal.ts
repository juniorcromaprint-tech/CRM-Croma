// ai-shared/invoke-internal.ts — v1 (2026-05-28, ciclo autônomo #16)
//
// Helper compartilhado pra invocar Edge Functions internas (mesmo projeto)
// com Bearer legacy JWT + header X-Internal-Call. Resolve BUG-JWT em invokes
// cross-Edge (gateway exige legacy JWT HS256, nova service_role_key
// `sb_secret_*` não é JWT). Pattern extraído de `mcp-bridge-worker/index.ts`
// v7 linhas 144-177 (2026-05-27).
//
// Uso típico:
//   import { invokeEdgeFunctionInternal } from '../ai-shared/invoke-internal.ts'
//   const data = await invokeEdgeFunctionInternal(supabase, 'ai-compor-mensagem', {
//     lead_id, conversation_id, etc
//   })
//   // retorna JSON parseado; throws Error com status + body em <=200 chars se 4xx/5xx
//
// Pré-requisito: legacy-jwt.ts disponível no mesmo diretório.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getLegacyJwt } from './legacy-jwt.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

/**
 * Invoca uma Edge Function interna do mesmo projeto com Bearer legacy JWT
 * e header X-Internal-Call=true.
 *
 * Retry automático sob 401 forçando refresh do cache do JWT (cobre rotação
 * do service_role_legacy_jwt entre cold starts do isolate).
 *
 * @param supabase - Cliente Supabase (service_role) pra obter JWT via RPC
 * @param fnName - Slug da Edge Function (ex: 'ai-compor-mensagem')
 * @param body - Payload JSON pra enviar no POST
 * @returns Body JSON parseado da resposta
 * @throws Error se a Edge retornar status >= 400 (mensagem inclui status + body truncado)
 */
export async function invokeEdgeFunctionInternal<TResp = unknown>(
  supabase: SupabaseClient,
  fnName: string,
  body: Record<string, unknown>,
): Promise<TResp> {
  const url = `${SUPABASE_URL}/functions/v1/${fnName}`;

  const doFetch = async (jwt: string): Promise<Response> =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
        'X-Internal-Call': 'true',
      },
      body: JSON.stringify(body ?? {}),
    });

  let jwt = await getLegacyJwt(supabase);
  let resp = await doFetch(jwt);

  // Retry sob 401 — invalida cache e tenta de novo (cobre rotação do JWT)
  if (resp.status === 401) {
    jwt = await getLegacyJwt(supabase, true);
    resp = await doFetch(jwt);
  }

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`${fnName} retornou ${resp.status}: ${errText.substring(0, 200)}`);
  }

  return (await resp.json()) as TResp;
}

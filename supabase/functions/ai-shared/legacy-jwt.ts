// ai-shared/legacy-jwt.ts — v1 (2026-05-28, ciclo autônomo #16)
//
// Helper compartilhado pra obter o legacy JWT (HS256) do service_role via vault RPC.
// Resolve BUG-JWT clássico: gateway Supabase exige legacy JWT, e a nova
// `service_role_key` (sb_secret_*) não é JWT. Pattern extraído de
// `mcp-bridge-worker/index.ts` v7 linhas 14-22 (2026-05-27).
//
// Uso típico:
//   import { getLegacyJwt } from '../ai-shared/legacy-jwt.ts'
//   const jwt = await getLegacyJwt(supabase)
//   await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } })
//   // se 401, retry com force=true pra invalidar cache
//
// Pré-requisito: RPC `get_service_role_legacy_jwt` deve existir no Postgres
// (criada em 2026-05-27 refundação Beira Rio Parte 6, migration `vault_rpcs`).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cache no escopo do isolate da Edge (lifetime ~15min antes do isolate reciclar)
let _cachedLegacyJwt: string | null = null;

/**
 * Retorna o legacy JWT (HS256) do service_role, cacheado no isolate.
 *
 * @param supabase - Cliente Supabase já autenticado (service_role)
 * @param force - Se true, ignora cache e força refresh via RPC (use sob 401)
 * @returns JWT em formato string `eyJhbGciOiJIUzI1NiIs...`
 * @throws Error se a RPC falhar ou retornar payload inválido
 */
export async function getLegacyJwt(supabase: SupabaseClient, force = false): Promise<string> {
  if (_cachedLegacyJwt && !force) return _cachedLegacyJwt;

  const { data, error } = await supabase.rpc('get_service_role_legacy_jwt');

  if (error) {
    throw new Error(`get_service_role_legacy_jwt RPC falhou: ${error.message}`);
  }
  if (!data || typeof data !== 'string') {
    throw new Error(`get_service_role_legacy_jwt retornou payload invalido: ${typeof data}`);
  }

  _cachedLegacyJwt = data;
  return _cachedLegacyJwt;
}

/**
 * Invalida explicitamente o cache (test-only). Use em retry sob 401 ao invés.
 */
export function clearLegacyJwtCache(): void {
  _cachedLegacyJwt = null;
}

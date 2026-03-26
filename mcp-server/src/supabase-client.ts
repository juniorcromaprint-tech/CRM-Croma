/**
 * Cliente Supabase compartilhado — usa service_role_key para bypass do RLS
 * Permite acesso total ao banco, como um funcionário administrativo
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://djwjmfgplnqyffdcgdaw.supabase.co";

let _client: SupabaseClient | null = null;

/**
 * Retorna o cliente Supabase singleton com service_role_key.
 * Lança erro se SUPABASE_SERVICE_ROLE_KEY não estiver definida.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não está definida. " +
      "Configure a variável de ambiente antes de iniciar o servidor."
    );
  }

  _client = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _client;
}

export { SUPABASE_URL };

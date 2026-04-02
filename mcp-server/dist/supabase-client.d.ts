/**
 * Clientes Supabase — dual-client para operações admin e usuário autenticado
 *
 * Admin client (service_role): reads, health checks, SQL ad-hoc — bypass total de RLS
 * User client (anon key + JWT real): writes — respeita RLS, auth.uid() funciona em triggers
 *
 * Por que dual-client?
 * Quando o MCP usa service_role, auth.uid() é NULL nos triggers e RLS.
 * Isso faz com que registros criados (propostas, clientes, leads) não apareçam
 * no frontend, pois vendedor_id fica NULL e os triggers não populam campos corretamente.
 * Com o user client autenticado como Junior, auth.uid() retorna o UUID real do usuário.
 */
import { SupabaseClient } from "@supabase/supabase-js";
declare const SUPABASE_URL = "https://djwjmfgplnqyffdcgdaw.supabase.co";
/**
 * Admin client — service_role key, bypass total de RLS.
 * Use para: reads, health checks, executar_sql, operações administrativas.
 */
export declare function getAdminClient(): SupabaseClient;
/**
 * User client — anon key + JWT real do Junior Croma.
 * Respeita RLS, auth.uid() funciona em triggers e políticas.
 *
 * Falls back para admin client se SUPABASE_USER_PASSWORD não estiver configurado
 * (com aviso em stderr — registros podem não aparecer corretamente no frontend).
 *
 * Use para: writes (INSERT, UPDATE) que precisam aparecer corretamente no frontend.
 */
export declare function getUserClient(): SupabaseClient;
/**
 * Retorna o user_id do Junior no Supabase (auth.users.id / profiles.id).
 * Disponível após initUserAuth() completar com sucesso.
 */
export declare function getJuniorUserId(): string | null;
/**
 * Backward compat — alias para getAdminClient().
 * Prefer usar getAdminClient() ou getUserClient() explicitamente no código novo.
 */
export declare function getSupabaseClient(): SupabaseClient;
/**
 * Inicializa autenticação real do usuário no startup do servidor.
 *
 * Se SUPABASE_USER_PASSWORD estiver configurado, faz signInWithPassword como Junior
 * e armazena o cliente autenticado. O supabase-js gerencia auto-refresh do JWT
 * (tokens renovados automaticamente antes de expirar).
 *
 * Se não configurado, usa service_role como fallback (com aviso).
 *
 * Variáveis de ambiente:
 *   SUPABASE_USER_EMAIL    (padrão: junior.cromaprint@gmail.com)
 *   SUPABASE_USER_PASSWORD (obrigatório para user auth)
 */
export declare function initUserAuth(): Promise<void>;
export { SUPABASE_URL };
//# sourceMappingURL=supabase-client.d.ts.map
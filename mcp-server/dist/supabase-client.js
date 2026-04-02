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
import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = "https://djwjmfgplnqyffdcgdaw.supabase.co";
// Anon key (pública) — usada com o JWT do usuário autenticado para writes
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU2OTcsImV4cCI6MjA4ODY0MTY5N30" +
    ".pi2HDGyXhsoZS0sivfUDzn9z3Qao-6hMKrWBxoQ-1uE";
let _adminClient = null;
let _userClient = null;
let _juniorUserId = null;
// ─── Admin client ─────────────────────────────────────────────────────────────
/**
 * Admin client — service_role key, bypass total de RLS.
 * Use para: reads, health checks, executar_sql, operações administrativas.
 */
export function getAdminClient() {
    if (_adminClient)
        return _adminClient;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY não está definida. " +
            "Configure a variável de ambiente antes de iniciar o servidor.");
    }
    _adminClient = createClient(SUPABASE_URL, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    return _adminClient;
}
// ─── User client ──────────────────────────────────────────────────────────────
/**
 * User client — anon key + JWT real do Junior Croma.
 * Respeita RLS, auth.uid() funciona em triggers e políticas.
 *
 * Falls back para admin client se SUPABASE_USER_PASSWORD não estiver configurado
 * (com aviso em stderr — registros podem não aparecer corretamente no frontend).
 *
 * Use para: writes (INSERT, UPDATE) que precisam aparecer corretamente no frontend.
 */
export function getUserClient() {
    return _userClient ?? getAdminClient();
}
/**
 * Retorna o user_id do Junior no Supabase (auth.users.id / profiles.id).
 * Disponível após initUserAuth() completar com sucesso.
 */
export function getJuniorUserId() {
    return _juniorUserId;
}
/**
 * Backward compat — alias para getAdminClient().
 * Prefer usar getAdminClient() ou getUserClient() explicitamente no código novo.
 */
export function getSupabaseClient() {
    return getAdminClient();
}
// ─── Inicialização de autenticação ────────────────────────────────────────────
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
export async function initUserAuth() {
    const email = process.env.SUPABASE_USER_EMAIL ?? "junior.cromaprint@gmail.com";
    const password = process.env.SUPABASE_USER_PASSWORD;
    if (!password) {
        process.stderr.write("[croma-mcp] ⚠️  SUPABASE_USER_PASSWORD não configurado.\n" +
            "[croma-mcp] ⚠️  Writes usarão service_role — auth.uid() será NULL nos triggers.\n" +
            "[croma-mcp] ⚠️  Registros criados podem não aparecer corretamente no frontend.\n" +
            "[croma-mcp] ⚠️  Para corrigir: adicione SUPABASE_USER_PASSWORD ao ambiente do MCP.\n");
        return;
    }
    // Cria cliente com anon key — receberá o JWT do usuário após login
    _userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true, // Renova JWT automaticamente antes de expirar (~1h)
            persistSession: false, // Stateless — não persiste em disco
        },
    });
    const { data, error } = await _userClient.auth.signInWithPassword({
        email,
        password,
    });
    if (error || !data.user) {
        const msg = error?.message ?? "resposta vazia do Supabase Auth";
        process.stderr.write(`[croma-mcp] ❌ Falha ao autenticar como ${email}: ${msg}\n` +
            "[croma-mcp] ❌ Writes continuarão usando service_role como fallback.\n");
        _userClient = null;
        return;
    }
    _juniorUserId = data.user.id;
    process.stderr.write(`[croma-mcp] ✅ Autenticado como ${email}\n` +
        `[croma-mcp] 👤 user_id: ${_juniorUserId}\n` +
        "[croma-mcp] 🔑 JWT auto-refresh ativo — sessão renovada automaticamente.\n");
}
export { SUPABASE_URL };
//# sourceMappingURL=supabase-client.js.map
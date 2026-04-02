#!/usr/bin/env node
/**
 * Croma MCP Server — Funcionário Digital da Croma Print
 *
 * Permite ao Claude operar o ERP Croma como um funcionário digital completo:
 * consultar clientes, leads, propostas, pedidos, produção, instalações,
 * financeiro, estoque e BI.
 *
 * Transport: stdio (local, roda no computador do Junior)
 * Auth: dual-client — service_role para reads, usuário real para writes
 *
 * Para iniciar (modo completo com user auth):
 *   SUPABASE_SERVICE_ROLE_KEY=xxx SUPABASE_USER_PASSWORD=yyy node dist/index.js
 *
 * Para iniciar (modo degradado — writes usam service_role):
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node dist/index.js
 */
export {};
//# sourceMappingURL=index.d.ts.map
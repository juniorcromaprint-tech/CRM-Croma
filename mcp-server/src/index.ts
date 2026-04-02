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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAdminClient, initUserAuth } from "./supabase-client.js";
import { registerCrmTools } from "./tools/crm.js";
import { registerPropostasTools } from "./tools/propostas.js";
import { registerPedidosTools } from "./tools/pedidos.js";
import { registerCampoTools } from "./tools/campo.js";
import { registerFinanceiroTools } from "./tools/financeiro.js";
import { registerEstoqueTools } from "./tools/estoque.js";
import { registerBiTools } from "./tools/bi.js";
import { registerSistemaTools } from "./tools/sistema.js";
import { registerFiscalTools } from "./tools/fiscal.js";
import { registerQualidadeTools } from "./tools/qualidade.js";
import { registerAdminTools } from "./tools/admin.js";
import { registerImpressoraTools } from "./tools/impressora.js";
import { registerFornecedoresTools } from "./tools/fornecedores.js";
import { registerComprasTools } from "./tools/compras.js";

// ─── Inicialização do servidor ──────────────────────────────────────────────

const server = new McpServer({
  name: "croma-mcp-server",
  version: "1.0.0",
});

// ─── Registra todas as ferramentas ──────────────────────────────────────────

registerCrmTools(server);         // 7+8 ferramentas: clientes, leads, atividades, comissoes, contratos, campanhas, nps
registerPropostasTools(server);   // 5 ferramentas: propostas/orçamentos (+ enviar email)
registerPedidosTools(server);     // 6+2 ferramentas: pedidos, produção, apontamentos
registerCampoTools(server);       // 7+1 ferramentas: instalações, jobs campo, equipes
registerFinanceiroTools(server);  // 6+5 ferramentas: CR, CP, pagamentos, caixa, DAS, boleto
registerEstoqueTools(server);     // 3 ferramentas: estoque + registrar_movimento
registerBiTools(server);          // 3 ferramentas: BI e relatórios
registerSistemaTools(server);     // 2 ferramentas: sistema
registerFiscalTools(server);      // 3 ferramentas: NF-e
registerQualidadeTools(server);   // 3 ferramentas: ocorrências de qualidade
registerAdminTools(server);       // 3+7 ferramentas: catálogo, precificação, máquinas, acabamentos
registerImpressoraTools(server);  // 6 ferramentas: HP Latex 365 — jobs, resumo, vincular, registrar, custo_real_pedido, mapear_substrato
registerFornecedoresTools(server); // 5 ferramentas: listar, detalhe, cadastrar, atualizar, historico_compras
registerComprasTools(server);      // 5 ferramentas: listar, detalhe, criar, atualizar_status, registrar_recebimento

// Total: 91 ferramentas

// ─── Validação de credenciais ───────────────────────────────────────────────

function validateCredentials(): void {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.stderr.write(
      "[croma-mcp] ERRO: Variável de ambiente SUPABASE_SERVICE_ROLE_KEY não está definida.\n" +
      "[croma-mcp] Configure antes de iniciar o servidor.\n"
    );
    process.exit(1);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateCredentials();

  // Autentica como usuário real (Junior) para que writes respeitem RLS e triggers
  await initUserAuth();

  // Testa conectividade ao Supabase na inicialização
  try {
    const sb = getAdminClient();
    const { error } = await sb.from("profiles").select("id", { head: true, count: "exact" });
    if (error) {
      process.stderr.write(`[croma-mcp] Aviso: Falha ao conectar ao Supabase: ${error.message}\n`);
    } else {
      process.stderr.write("[croma-mcp] ✅ Conectado ao Supabase (djwjmfgplnqyffdcgdaw)\n");
    }
  } catch (err) {
    process.stderr.write(`[croma-mcp] Aviso: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  // Inicia o servidor via stdio (comunicação com Claude)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(`[croma-mcp] 🚀 Servidor Croma MCP iniciado (91 ferramentas)\n`);
}

main().catch((err) => {
  process.stderr.write(`[croma-mcp] Erro fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
/**
 * Ferramentas de Impressora — HP Latex 365
 * Consultar jobs de impressão, produção, custos e vincular ao CRM
 *
 * MODELO DE CUSTEIO: "LM Âncora"
 * Tinta HP original (bag 3L de outro modelo): R$1.560 → R$0,52/ml
 * Cartucho LM original = âncora de medição real
 * total_ml = lm_ml_real × 21,5316 (proporções históricas)
 * Fallback: 9,86 ml/m² (média histórica)
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export declare function registerImpressoraTools(server: McpServer): void;
//# sourceMappingURL=impressora.d.ts.map
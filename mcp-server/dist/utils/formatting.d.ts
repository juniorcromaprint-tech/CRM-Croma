/**
 * Utilitários de formatacao para respostas do MCP
 * Formata valores monetários, datas e status em portugues
 */
/**
 * Formata valor monetário em BRL
 */
export declare function formatBRL(value: number | null | undefined): string;
/**
 * Formata data ISO para formato brasileiro
 */
export declare function formatDate(dateStr: string | null | undefined): string;
/**
 * Formata data e hora
 */
export declare function formatDateTime(dateStr: string | null | undefined): string;
export declare function formatStatus(status: string | null | undefined): string;
/**
 * Formata CNPJ: 00.000.000/0001-00
 */
export declare function formatCNPJ(cnpj: string | null | undefined): string;
/**
 * Formata telefone: (00) 00000-0000
 */
export declare function formatPhone(phone: string | null | undefined): string;
/**
 * Verifica se uma data está vencida
 */
export declare function isVencido(dateStr: string | null | undefined): boolean;
/**
 * Calcula dias de atraso (positivo = atrasado)
 */
export declare function diasAtraso(dateStr: string | null | undefined): number;
//# sourceMappingURL=formatting.d.ts.map
/**
 * Utilitário de tratamento de erros com mensagens acionáveis em português
 */
/**
 * Converte erro do Supabase/PostgreSQL em mensagem legível
 */
export declare function handleSupabaseError(error: unknown): string;
/**
 * Formata resultado de erro para retorno no MCP
 */
export declare function errorResult(error: unknown): {
    content: Array<{
        type: "text";
        text: string;
    }>;
};
//# sourceMappingURL=errors.d.ts.map
/**
 * Utilitários de formatacao para respostas do MCP
 * Formata valores monetários, datas e status em portugues
 */
/**
 * Formata valor monetário em BRL
 */
export function formatBRL(value) {
    if (value == null)
        return "-";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}
/**
 * Formata data ISO para formato brasileiro
 */
export function formatDate(dateStr) {
    if (!dateStr)
        return "-";
    try {
        // Evita problema de timezone: datas ISO sem hora sao UTC 00:00 e ficam um dia atras no fuso -3h
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match)
            return match[3] + "/" + match[2] + "/" + match[1];
        const date = new Date(dateStr);
        return date.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
    }
    catch {
        return dateStr;
    }
}
/**
 * Formata data e hora
 */
export function formatDateTime(dateStr) {
    if (!dateStr)
        return "-";
    try {
        const date = new Date(dateStr);
        return date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
    catch {
        return dateStr;
    }
}
/**
 * Mapa de status para labels em portugues
 */
const STATUS_LABELS = {
    // Leads
    novo: "Novo",
    em_contato: "Em Contato",
    qualificando: "Qualificando",
    qualificado: "Qualificado",
    descartado: "Descartado",
    // Propostas
    rascunho: "Rascunho",
    enviada: "Enviada",
    em_revisao: "Em Revisao",
    aprovada: "Aprovada",
    recusada: "Recusada",
    expirada: "Expirada",
    // Pedidos
    aguardando_aprovacao: "Aguardando Aprovacao",
    aprovado: "Aprovado",
    em_producao: "Em Producao",
    producao_concluida: "Producao Concluida",
    em_instalacao: "Em Instalacao",
    entregue: "Entregue",
    faturado: "Faturado",
    cancelado: "Cancelado",
    // Producao
    pendente: "Pendente",
    em_andamento: "Em Andamento",
    concluido: "Concluido",
    pausado: "Pausado",
    retrabalho: "Retrabalho",
    // Financeiro
    aberto: "Aberto",
    parcial: "Parcial Pago",
    pago: "Pago",
    vencido: "Vencido",
    renegociado: "Renegociado",
    baixado: "Baixado",
    // Instalacao
    agendada: "Agendada",
    em_execucao: "Em Execucao",
    concluida: "Concluida",
    reagendada: "Reagendada",
};
export function formatStatus(status) {
    if (!status)
        return "-";
    return STATUS_LABELS[status] ?? status;
}
/**
 * Formata CNPJ: 00.000.000/0001-00
 */
export function formatCNPJ(cnpj) {
    if (!cnpj)
        return "-";
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14)
        return cnpj;
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
/**
 * Formata telefone: (00) 00000-0000
 */
export function formatPhone(phone) {
    if (!phone)
        return "-";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) {
        return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    if (digits.length === 10) {
        return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return phone;
}
/**
 * Verifica se uma data está vencida
 */
export function isVencido(dateStr) {
    if (!dateStr)
        return false;
    return new Date(dateStr) < new Date();
}
/**
 * Calcula dias de atraso (positivo = atrasado)
 */
export function diasAtraso(dateStr) {
    if (!dateStr)
        return 0;
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}
//# sourceMappingURL=formatting.js.map
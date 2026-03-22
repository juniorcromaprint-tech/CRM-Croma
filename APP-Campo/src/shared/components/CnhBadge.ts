// ============================================================================
// CnhBadge — utilitário de validade da CNH (versão App de Campo)
// Sem JSX — apenas a função getCnhStatus usada em selects nativos
// ============================================================================

/**
 * Retorna o status da CNH baseado na data de validade.
 */
export function getCnhStatus(cnhValidade: string | null | undefined): {
  status: "vencida" | "vence_em_breve" | "valida" | "nao_cadastrada";
  diasRestantes: number | null;
} {
  if (!cnhValidade) {
    return { status: "nao_cadastrada", diasRestantes: null };
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(cnhValidade);
  validade.setHours(0, 0, 0, 0);

  const diffMs = validade.getTime() - hoje.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return { status: "vencida", diasRestantes: diffDias };
  }
  if (diffDias <= 30) {
    return { status: "vence_em_breve", diasRestantes: diffDias };
  }
  return { status: "valida", diasRestantes: diffDias };
}

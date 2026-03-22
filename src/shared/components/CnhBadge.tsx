// ============================================================================
// CnhBadge — Indicador de validade da CNH para instaladores
// Usado em: ProducaoPage (ERP), JobFormSheet (App Campo), AdminUsuariosPage
// ============================================================================

interface CnhBadgeProps {
  cnhValidade: string | null | undefined;
  cnhCategoria?: string | null;
  showCategoria?: boolean;
}

/**
 * Retorna o status da CNH baseado na data de validade.
 * - vencida: vencida antes de hoje
 * - vence_em_breve: vence em até 30 dias
 * - valida: válida por mais de 30 dias
 * - nao_cadastrada: sem data registrada
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

export function CnhBadge({ cnhValidade, cnhCategoria, showCategoria = false }: CnhBadgeProps) {
  const { status, diasRestantes } = getCnhStatus(cnhValidade);

  const configs = {
    vencida: {
      label: "CNH Vencida",
      className: "bg-red-100 text-red-700 border border-red-200",
    },
    vence_em_breve: {
      label: `CNH vence em ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}`,
      className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    },
    valida: {
      label: cnhCategoria ? `CNH ${cnhCategoria}` : "CNH Válida",
      className: "bg-green-100 text-green-700 border border-green-200",
    },
    nao_cadastrada: {
      label: "CNH não cadastrada",
      className: "bg-slate-100 text-slate-500 border border-slate-200",
    },
  };

  const cfg = configs[status];

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}
    >
      {cfg.label}
      {showCategoria && cnhCategoria && status !== "nao_cadastrada" && status !== "valida" && (
        <span className="opacity-70">· {cnhCategoria}</span>
      )}
    </span>
  );
}

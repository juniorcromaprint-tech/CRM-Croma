// ============================================================================
// ADMIN PRODUTOS — Shared Constants & Helpers
// ============================================================================

export function categoriaBadgeColor(categoria: string): string {
  const map: Record<string, string> = {
    fachadas: "bg-blue-50 text-blue-700 border-blue-200",
    pdv: "bg-purple-50 text-purple-700 border-purple-200",
    comunicacao_interna: "bg-teal-50 text-teal-700 border-teal-200",
    campanhas: "bg-amber-50 text-amber-700 border-amber-200",
    envelopamento: "bg-rose-50 text-rose-700 border-rose-200",
    grandes_formatos: "bg-indigo-50 text-indigo-700 border-indigo-200",
    outros: "bg-slate-100 text-slate-600 border-slate-200",
    impressao: "bg-indigo-50 text-indigo-700 border-indigo-200",
    instalacao: "bg-orange-50 text-orange-700 border-orange-200",
    projeto: "bg-violet-50 text-violet-700 border-violet-200",
    manutencao: "bg-cyan-50 text-cyan-700 border-cyan-200",
  };
  return map[categoria] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

export const CATEGORIAS_PRODUTO = [
  { value: "fachadas", label: "Fachadas" },
  { value: "pdv", label: "PDV" },
  { value: "comunicacao_interna", label: "Comunicação Interna" },
  { value: "campanhas", label: "Campanhas" },
  { value: "envelopamento", label: "Envelopamento" },
  { value: "grandes_formatos", label: "Grandes Formatos" },
  { value: "outros", label: "Outros" },
];

export const UNIDADES_PADRAO = [
  { value: "m²", label: "m²" },
  { value: "un", label: "un" },
  { value: "m", label: "m" },
  { value: "par", label: "par" },
  { value: "pç", label: "pç" },
];

export const CATEGORIAS_SERVICO = [
  { value: "instalacao", label: "Instalação" },
  { value: "projeto", label: "Projeto" },
  { value: "manutencao", label: "Manutenção" },
  { value: "outros", label: "Outros" },
];

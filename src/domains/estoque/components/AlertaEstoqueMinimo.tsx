// src/domains/estoque/components/AlertaEstoqueMinimo.tsx

import { AlertTriangle, Loader2 } from "lucide-react";
import { useAlertasEstoqueMinimo } from "../hooks/useEstoqueSaldos";

export function AlertaEstoqueMinimo() {
  const { data: alertas = [], isLoading } = useAlertasEstoqueMinimo();

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Carregando alertas...</span>
      </div>
    );
  }

  if (alertas.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <AlertTriangle size={32} className="mx-auto text-slate-200 mb-2" />
        <p className="text-sm font-medium text-slate-600">Sem alertas</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Todos os materiais estão dentro do estoque mínimo.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border-b border-red-200">
        <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-red-700">
          {alertas.length} material{alertas.length > 1 ? "is" : ""} abaixo do mínimo
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {alertas.map((alerta: any) => {
          const nome = alerta.material?.nome ?? "Material";
          const unidade = alerta.material?.unidade ?? "";
          const minimo = alerta.material?.estoque_minimo ?? 0;
          const atual = alerta.quantidade ?? 0;
          const diferenca = atual - minimo;

          return (
            <div
              key={alerta.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{nome}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mínimo: {minimo.toLocaleString("pt-BR")} {unidade}
                </p>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="text-sm font-bold text-slate-700 font-mono">
                  {atual.toLocaleString("pt-BR")}{" "}
                  <span className="text-xs font-normal text-slate-400">{unidade}</span>
                </p>
                <p className="text-xs font-semibold text-red-600 mt-0.5">
                  {diferenca.toLocaleString("pt-BR")} {unidade}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

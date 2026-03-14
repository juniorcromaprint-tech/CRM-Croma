import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Wrench, Loader2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModeloMaterial {
  id: string;
  modelo_id: string;
  material_id: string;
  quantidade_por_unidade: number;
  unidade: string | null;
  material: {
    nome: string;
    preco_medio: number | null;
    unidade: string | null;
  } | null;
}

interface ModeloProcesso {
  id: string;
  modelo_id: string;
  etapa: string;
  tempo_por_unidade_min: number;
  ordem: number;
}

export interface OPMateriaisProps {
  modeloId: string;
  quantidade: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatQtd(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function formatMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OPMateriais({ modeloId, quantidade }: OPMateriaisProps) {
  const qty = Math.max(quantidade, 1);

  const { data: materiais = [], isLoading: loadingMat } = useQuery({
    queryKey: ["op-materiais", modeloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modelo_materiais")
        .select(`
          id,
          modelo_id,
          material_id,
          quantidade_por_unidade,
          unidade,
          material:materiais(nome, preco_medio, unidade)
        `)
        .eq("modelo_id", modeloId);
      if (error) throw error;
      return (data ?? []) as unknown as ModeloMaterial[];
    },
    enabled: !!modeloId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: processos = [], isLoading: loadingProc } = useQuery({
    queryKey: ["op-processos", modeloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modelo_processos")
        .select("id, modelo_id, etapa, tempo_por_unidade_min, ordem")
        .eq("modelo_id", modeloId)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as ModeloProcesso[];
    },
    enabled: !!modeloId,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = loadingMat || loadingProc;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
        <Loader2 size={16} className="animate-spin" />
        Carregando materiais...
      </div>
    );
  }

  if (materiais.length === 0 && processos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <Package size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-600">Sem BOM vinculada</p>
        <p className="text-xs text-slate-400 mt-1">
          Este modelo não tem materiais ou processos cadastrados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Materiais */}
      {materiais.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
            <Package size={16} className="text-blue-500" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Materiais — {qty} unidade{qty !== 1 ? "s" : ""}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-2 text-xs text-slate-400 font-semibold uppercase tracking-wide">
                  Material
                </th>
                <th className="text-right px-4 py-2 text-xs text-slate-400 font-semibold uppercase tracking-wide whitespace-nowrap">
                  Qtd / un
                </th>
                <th className="text-right px-4 py-2 text-xs text-slate-400 font-semibold uppercase tracking-wide">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {materiais.map((m) => {
                const qtdUnit = m.quantidade_por_unidade;
                const qtdTotal = qtdUnit * qty;
                const unidade = m.unidade ?? m.material?.unidade ?? "";
                return (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 font-medium">
                      {m.material?.nome ?? m.material_id}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                      {formatQtd(qtdUnit)}{unidade ? ` ${unidade}` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                      {formatQtd(qtdTotal)}{unidade ? ` ${unidade}` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Processos */}
      {processos.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
            <Wrench size={16} className="text-amber-500" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Processos — {qty} unidade{qty !== 1 ? "s" : ""}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-2 text-xs text-slate-400 font-semibold uppercase tracking-wide">
                  Etapa
                </th>
                <th className="text-right px-4 py-2 text-xs text-slate-400 font-semibold uppercase tracking-wide whitespace-nowrap">
                  Tempo / un
                </th>
                <th className="text-right px-4 py-2 text-xs text-slate-400 font-semibold uppercase tracking-wide">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {processos.map((p) => {
                const tempoUnit = p.tempo_por_unidade_min;
                const tempoTotal = tempoUnit * qty;
                return (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 font-medium capitalize">
                      {p.etapa}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                      {formatMinutos(tempoUnit)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                      {formatMinutos(tempoTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

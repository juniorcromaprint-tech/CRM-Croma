// src/domains/estoque/pages/MovimentacoesPage.tsx

import { useState } from "react";
import {
  ArrowRightLeft,
  Search,
  Loader2,
  Filter,
  Download,
  LayoutList,
  AlignJustify,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/shared/utils/format";
import { useMovimentacoes } from "../hooks/useMovimentacoes";
import { MovementTimeline } from "../components/MovementTimeline";
import type { EstoqueMovimentacao } from "../types/estoque.types";

type TipoMovimentacao = EstoqueMovimentacao["tipo"];

const TIPO_BADGE: Record<
  TipoMovimentacao,
  { label: string; className: string }
> = {
  entrada: {
    label: "Entrada",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  saida: {
    label: "Saída",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  reserva: {
    label: "Reserva",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  liberacao_reserva: {
    label: "Liberação",
    className: "bg-teal-50 text-teal-700 border-teal-200",
  },
  ajuste: {
    label: "Ajuste",
    className: "bg-slate-50 text-slate-700 border-slate-200",
  },
  devolucao: {
    label: "Devolução",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

const TIPOS_FILTRO = [
  { value: "todos", label: "Todos os tipos" },
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saída" },
  { value: "reserva", label: "Reserva" },
  { value: "liberacao_reserva", label: "Liberação de reserva" },
  { value: "ajuste", label: "Ajuste" },
  { value: "devolucao", label: "Devolução" },
];

const PAGE_SIZE = 20;

export default function MovimentacoesPage() {
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroDataDe, setFiltroDataDe] = useState<string>("");
  const [filtroDataAte, setFiltroDataAte] = useState<string>("");
  const [buscaMaterial, setBuscaMaterial] = useState("");
  const [pagina, setPagina] = useState(1);
  const [viewMode, setViewMode] = useState<"timeline" | "tabela">("timeline");

  const { data: movimentacoes = [], isLoading } = useMovimentacoes({
    tipo: filtroTipo !== "todos" ? filtroTipo : undefined,
    limit: 500,
  });

  // Filtros locais
  const filtered = (movimentacoes as EstoqueMovimentacao[]).filter((m) => {
    if (
      buscaMaterial &&
      !m.material?.nome?.toLowerCase().includes(buscaMaterial.toLowerCase())
    ) {
      return false;
    }
    if (filtroDataDe && m.created_at.slice(0, 10) < filtroDataDe) {
      return false;
    }
    if (filtroDataAte && m.created_at.slice(0, 10) > filtroDataAte) {
      return false;
    }
    return true;
  });

  const totalPaginas = Math.ceil(filtered.length / PAGE_SIZE);
  const paginado = filtered.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  const hasActiveFilters =
    buscaMaterial ||
    filtroTipo !== "todos" ||
    filtroDataDe ||
    filtroDataAte;

  function handleFiltroTipo(value: string) {
    setFiltroTipo(value);
    setPagina(1);
  }

  function handleBusca(value: string) {
    setBuscaMaterial(value);
    setPagina(1);
  }

  function exportarCSV() {
    const header = "Data,Material,Tipo,Quantidade,Referência,Motivo,Lote";
    const rows = (movimentacoes as EstoqueMovimentacao[]).map((m) =>
      [
        m.created_at.slice(0, 10),
        m.material?.nome ?? m.material_id,
        m.tipo,
        m.quantidade,
        m.referencia_tipo ?? "",
        m.motivo ?? "",
        m.lote ?? "",
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimentacoes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isEmpty = !isLoading && filtered.length === 0;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* Busca por material */}
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            placeholder="Buscar por material..."
            value={buscaMaterial}
            onChange={(e) => handleBusca(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        {/* Tipo */}
        <Select value={filtroTipo} onValueChange={handleFiltroTipo}>
          <SelectTrigger className="rounded-xl w-full sm:w-52">
            <Filter size={14} className="mr-2 text-slate-400 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_FILTRO.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Data De */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 whitespace-nowrap">De</label>
          <Input
            type="date"
            value={filtroDataDe}
            onChange={(e) => {
              setFiltroDataDe(e.target.value);
              setPagina(1);
            }}
            className="rounded-xl w-36 text-sm"
          />
        </div>

        {/* Data Até */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 whitespace-nowrap">
            Até
          </label>
          <Input
            type="date"
            value={filtroDataAte}
            onChange={(e) => {
              setFiltroDataAte(e.target.value);
              setPagina(1);
            }}
            className="rounded-xl w-36 text-sm"
          />
        </div>

        {/* Toggle de visualização */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 self-start sm:self-auto">
          <button
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === "timeline"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <AlignJustify size={13} />
            Timeline
          </button>
          <button
            onClick={() => setViewMode("tabela")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === "tabela"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LayoutList size={13} />
            Tabela
          </button>
        </div>

        <Button variant="outline" size="sm" className="rounded-xl gap-2 shrink-0 self-start sm:self-auto"
          onClick={exportarCSV} disabled={movimentacoes.length === 0}>
          <Download size={14} />
          Exportar CSV
        </Button>
      </div>

      {/* Contagem de resultados */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-slate-400">
          {filtered.length} movimentação{filtered.length !== 1 ? "ões" : ""}{" "}
          {hasActiveFilters ? "filtrada" + (filtered.length !== 1 ? "s" : "") : "no total"}
        </p>
      )}

      {/* Conteúdo */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          <span>Carregando movimentações...</span>
        </div>
      ) : isEmpty ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ArrowRightLeft size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">
            Nenhuma movimentação encontrada
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {hasActiveFilters
              ? "Tente ajustar os filtros."
              : "As movimentações de estoque aparecerão aqui."}
          </p>
        </div>
      ) : viewMode === "timeline" ? (
        /* ── MODO TIMELINE ── */
        <Card className="rounded-2xl border-slate-200 shadow-sm p-5">
          <MovementTimeline movimentacoes={filtered} loading={false} />
        </Card>
      ) : (
        /* ── MODO TABELA ── */
        <Card className="rounded-2xl border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                    Data
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                    Material
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                    Tipo
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                    Quantidade
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden md:table-cell">
                    Referência
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden lg:table-cell">
                    Motivo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginado.map((mov) => {
                  const tipoBadge =
                    TIPO_BADGE[mov.tipo] ?? {
                      label: mov.tipo,
                      className: "bg-slate-50 text-slate-700 border-slate-200",
                    };
                  const unidade = mov.material?.unidade ?? "";

                  return (
                    <tr
                      key={mov.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(mov.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {mov.material?.nome ?? mov.material_id}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${tipoBadge.className}`}
                        >
                          {tipoBadge.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {mov.quantidade.toLocaleString("pt-BR")}{" "}
                        <span className="text-xs text-slate-400">
                          {unidade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                        {mov.referencia_tipo && mov.referencia_id ? (
                          <span className="font-mono">
                            {mov.referencia_tipo} #
                            {mov.referencia_id.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell max-w-xs truncate">
                        {mov.motivo ?? (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400">
                Mostrando {(pagina - 1) * PAGE_SIZE + 1}–
                {Math.min(pagina * PAGE_SIZE, filtered.length)} de{" "}
                {filtered.length} movimentações
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="rounded-xl text-xs"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagina((p) => Math.min(totalPaginas, p + 1))
                  }
                  disabled={pagina === totalPaginas}
                  className="rounded-xl text-xs"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

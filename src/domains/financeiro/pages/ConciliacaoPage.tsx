// ============================================================================
// CONCILIAÇÃO BANCÁRIA — Croma Print ERP/CRM
// Comparação extrato bancário (CSV) vs lançamentos do sistema
// ============================================================================

import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { brl, formatDate } from "@/shared/utils/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  ArrowLeftRight,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Minus,
  Loader2,
  Zap,
} from "lucide-react";

const ConciliacaoIA = lazy(() => import("../components/ConciliacaoIA"));

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExtratoRow {
  data: string;
  descricao: string;
  valor: number;
  conciliado: boolean;
}

interface LancamentoRow {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  conciliado: boolean;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsv(text: string): { data: string; descricao: string; valor: number }[] {
  const sep = text.includes(";") ? ";" : ",";
  const lines = text.trim().split("\n").slice(1); // skip header
  return lines
    .map((line) => {
      const parts = line.split(sep);
      return {
        data: parts[0]?.trim() ?? "",
        descricao: parts[1]?.trim() ?? "",
        valor: parseFloat((parts[2]?.trim() ?? "0").replace(",", ".")),
      };
    })
    .filter((r) => !isNaN(r.valor));
}

// ─── Supabase query ───────────────────────────────────────────────────────────

interface PedidoLancamento {
  id: string;
  numero: string;
  data_prometida: string | null;
  valor_total: number | null;
  clientes: { nome_fantasia: string | null; razao_social: string | null } | null;
}

function useLancamentos() {
  return useQuery<LancamentoRow[]>({
    queryKey: ["conciliacao-lancamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select(
          "id, numero, data_prometida, valor_total, clientes(nome_fantasia, razao_social)"
        )
        .not("valor_total", "is", null)
        .is("excluido_em", null)
        .order("data_prometida", { ascending: false })
        .limit(200);

      if (error) {
        showError("Erro ao carregar lançamentos do sistema");
        throw error;
      }

      return ((data ?? []) as PedidoLancamento[]).map((p) => {
        const nomeCliente =
          p.clientes?.nome_fantasia || p.clientes?.razao_social || "—";
        return {
          id: p.id,
          data: p.data_prometida ?? "",
          descricao: `Pedido #${p.numero} — ${nomeCliente}`,
          valor: Number(p.valor_total) || 0,
          conciliado: false,
        };
      });
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "emerald" | "amber" | "slate";
}) {
  const colorMap = {
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    slate: "bg-slate-50 border-slate-100 text-slate-600",
  };

  const valueColor = {
    blue: "text-blue-800",
    emerald: "text-emerald-800",
    amber: value < 0 ? "text-rose-700" : value > 0 ? "text-amber-800" : "text-slate-600",
    slate: "text-slate-700",
  };

  return (
    <div className={`rounded-2xl border p-5 ${colorMap[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${valueColor[color]}`}>
        {brl(value)}
      </p>
    </div>
  );
}

// ─── Upload Area ──────────────────────────────────────────────────────────────

function UploadArea({ onFile }: { onFile: (rows: ExtratoRow[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = parseCsv(text);
        if (parsed.length === 0) {
          showError(
            "Nenhum dado encontrado no CSV. Verifique o formato: data;descricao;valor"
          );
          return;
        }
        onFile(parsed.map((r) => ({ ...r, conciliado: false })));
      };
      reader.readAsText(file, "UTF-8");
    },
    [onFile]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Área de upload do extrato bancário CSV"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors select-none
        ${
          dragging
            ? "border-blue-400 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40"
        }`}
    >
      <div className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-blue-500">
        <Upload size={22} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700">
          Clique ou arraste o arquivo CSV do extrato
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Formato esperado: <code className="font-mono">data;descricao;valor</code>
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleChange}
        aria-hidden="true"
      />
    </div>
  );
}

// ─── Extrato Table ────────────────────────────────────────────────────────────

function ExtratoTable({
  rows,
  onClear,
}: {
  rows: ExtratoRow[];
  onClear: () => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between px-1 pb-3">
        <span className="text-xs text-slate-500">
          {rows.length} linha{rows.length !== 1 ? "s" : ""} importada
          {rows.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-rose-500 transition-colors underline underline-offset-2"
        >
          Limpar
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider w-28">
              Data
            </th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider">
              Descrição
            </th>
            <th className="text-right px-3 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider w-32">
              Valor
            </th>
            <th className="text-center px-3 py-2 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`transition-colors ${
                row.conciliado ? "bg-emerald-50/60" : "hover:bg-slate-50"
              }`}
            >
              <td className="px-3 py-2 text-slate-500 tabular-nums text-xs whitespace-nowrap">
                {row.data}
              </td>
              <td className="px-3 py-2 text-slate-700 truncate max-w-[160px]">
                {row.descricao || "—"}
              </td>
              <td
                className={`px-3 py-2 text-right font-semibold tabular-nums ${
                  row.valor < 0 ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {brl(row.valor)}
              </td>
              <td className="px-3 py-2 text-center">
                {row.conciliado ? (
                  <CheckCircle2 size={14} className="text-emerald-500 mx-auto" />
                ) : (
                  <Minus size={14} className="text-slate-300 mx-auto" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Lancamentos Table ────────────────────────────────────────────────────────

function LancamentosTable({ rows }: { rows: LancamentoRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider w-28">
              Data
            </th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider">
              Descrição
            </th>
            <th className="text-right px-3 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider w-32">
              Valor
            </th>
            <th className="text-center px-3 py-2 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`transition-colors ${
                row.conciliado ? "bg-emerald-50/60" : "hover:bg-slate-50"
              }`}
            >
              <td className="px-3 py-2 text-slate-500 tabular-nums text-xs whitespace-nowrap">
                {row.data ? formatDate(row.data) : "—"}
              </td>
              <td className="px-3 py-2 text-slate-700 truncate max-w-[160px]">
                {row.descricao}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-600">
                {brl(row.valor)}
              </td>
              <td className="px-3 py-2 text-center">
                {row.conciliado ? (
                  <CheckCircle2 size={14} className="text-emerald-500 mx-auto" />
                ) : (
                  <Minus size={14} className="text-slate-300 mx-auto" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ConciliacaoPage() {
  const { data: lancamentosRaw = [], isLoading } = useLancamentos();

  const [extratoRows, setExtratoRows] = useState<ExtratoRow[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoRow[]>([]);

  // Sync lancamentosRaw into state (reset conciliado when fresh data arrives)
  useEffect(() => {
    setLancamentos(lancamentosRaw.map((r) => ({ ...r, conciliado: false })));
  }, [lancamentosRaw]);

  // ── Totais ─────────────────────────────────────────────────────────────────

  const totalExtrato = useMemo(
    () => extratoRows.reduce((acc, r) => acc + r.valor, 0),
    [extratoRows]
  );

  const totalSistema = useMemo(
    () => lancamentos.reduce((acc, r) => acc + r.valor, 0),
    [lancamentos]
  );

  const diferenca = totalExtrato - totalSistema;

  // ── Conciliados ────────────────────────────────────────────────────────────

  const conciliadosExtrato = extratoRows.filter((r) => r.conciliado).length;
  const conciliadosSistema = lancamentos.filter((r) => r.conciliado).length;
  const totalConciliados = Math.min(conciliadosExtrato, conciliadosSistema);

  // ── Auto-conciliar ─────────────────────────────────────────────────────────

  function handleConciliar() {
    const TOLERANCIA = 0.01;

    // Track which lancamentos were matched (by index) to avoid double-match
    const lancamentoMatchado = new Set<number>();

    const newExtrato = extratoRows.map((er) => {
      // Find first unmatched lancamento whose valor is close enough
      const idx = lancamentos.findIndex(
        (lr, i) =>
          !lancamentoMatchado.has(i) &&
          Math.abs(Math.abs(er.valor) - lr.valor) <= TOLERANCIA
      );

      if (idx !== -1) {
        lancamentoMatchado.add(idx);
        return { ...er, conciliado: true };
      }
      return { ...er, conciliado: false };
    });

    const newLancamentos = lancamentos.map((lr, i) => ({
      ...lr,
      conciliado: lancamentoMatchado.has(i),
    }));

    setExtratoRows(newExtrato);
    setLancamentos(newLancamentos);
  }

  function handleClearExtrato() {
    setExtratoRows([]);
    // Also reset conciliado flags in lancamentos
    setLancamentos((prev) => prev.map((r) => ({ ...r, conciliado: false })));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── Cabeçalho ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <ArrowLeftRight size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Conciliação Bancária
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Compare o extrato bancário com os lançamentos do sistema
          </p>
        </div>
      </div>

      {/* ─── Tabs: Manual vs IA ────────────────────────────────────────── */}
      <Tabs defaultValue="ia" className="space-y-4">
        <TabsList className="rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="ia" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5">
            <Zap size={14} />
            Conciliação IA
          </TabsTrigger>
          <TabsTrigger value="manual" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Manual (CSV)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ia">
          <Suspense fallback={<div className="flex items-center justify-center p-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" />Carregando...</div>}>
            <ConciliacaoIA />
          </Suspense>
        </TabsContent>

        <TabsContent value="manual" className="space-y-6">
      {/* ─── Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Total Extrato Bancário"
          value={totalExtrato}
          color="blue"
        />
        <SummaryCard
          label="Total Sistema"
          value={totalSistema}
          color="emerald"
        />
        <SummaryCard
          label="Diferença"
          value={diferenca}
          color="amber"
        />
      </div>

      {/* ─── Botão de conciliação + resumo ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            onClick={handleConciliar}
            disabled={extratoRows.length === 0 || lancamentos.length === 0}
            className="rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <ArrowLeftRight size={16} />
            Conciliar Automaticamente
          </Button>

          {totalConciliados > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-medium gap-1.5 px-3 py-1 text-sm">
              <CheckCircle2 size={13} />
              {totalConciliados} item{totalConciliados !== 1 ? "s" : ""}{" "}
              conciliado{totalConciliados !== 1 ? "s" : ""}
            </Badge>
          )}

          {extratoRows.length > 0 &&
            extratoRows.filter((r) => !r.conciliado).length > 0 && (
              <Badge className="bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-50 font-medium gap-1.5 px-3 py-1 text-sm">
                <XCircle size={13} />
                {extratoRows.filter((r) => !r.conciliado).length} pendente
                {extratoRows.filter((r) => !r.conciliado).length !== 1
                  ? "s"
                  : ""}
              </Badge>
            )}
        </div>

        {extratoRows.length > 0 && lancamentos.length > 0 && (
          <p className="text-xs text-slate-400">
            {totalConciliados} de {extratoRows.length} itens do extrato
            conciliados
          </p>
        )}
      </div>

      {/* ─── Painéis lado a lado ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Painel Esquerdo: Extrato Bancário ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 min-h-[420px]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <FileText size={14} />
            </div>
            <h2 className="font-semibold text-slate-800">Extrato Bancário</h2>
            {extratoRows.length > 0 && (
              <Badge className="ml-auto bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-xs font-medium">
                {extratoRows.length} linha{extratoRows.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {extratoRows.length === 0 ? (
            <UploadArea
              onFile={(rows) => {
                setExtratoRows(rows);
                // Reset conciliado on new upload
                setLancamentos((prev) =>
                  prev.map((r) => ({ ...r, conciliado: false }))
                );
              }}
            />
          ) : (
            <ExtratoTable rows={extratoRows} onClear={handleClearExtrato} />
          )}

          {/* Total extrato */}
          {extratoRows.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total
              </span>
              <span
                className={`text-base font-bold tabular-nums ${
                  totalExtrato < 0 ? "text-rose-600" : "text-slate-800"
                }`}
              >
                {brl(totalExtrato)}
              </span>
            </div>
          )}
        </div>

        {/* ── Painel Direito: Lançamentos do Sistema ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 min-h-[420px]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ArrowLeftRight size={14} />
            </div>
            <h2 className="font-semibold text-slate-800">
              Lançamentos do Sistema
            </h2>
            {!isLoading && (
              <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs font-medium">
                {lancamentos.length} registro
                {lancamentos.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
              <span className="text-sm">Carregando lançamentos...</span>
            </div>
          ) : lancamentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-400">
              <ArrowLeftRight size={36} className="text-slate-200" />
              <p className="text-sm">Nenhum lançamento encontrado</p>
            </div>
          ) : (
            <LancamentosTable rows={lancamentos} />
          )}

          {/* Total sistema */}
          {lancamentos.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total
              </span>
              <span className="text-base font-bold tabular-nums text-slate-800">
                {brl(totalSistema)}
              </span>
            </div>
          )}
        </div>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

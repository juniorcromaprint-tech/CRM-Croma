import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ===========================================================================
// CONSTANTS
// ===========================================================================

const SETORES = [
  "Criação",
  "Arquivos",
  "Impressão",
  "Router",
  "Acabamentos",
  "Serralheria",
  "Expedição",
  "Instalação",
  "Terceirizados",
] as const;

const SECTOR_DURATION_MS = 20_000;
const PROGRESS_TICK_MS = 100;
const PROGRESS_INCREMENT = 100 / (SECTOR_DURATION_MS / PROGRESS_TICK_MS); // 0.5 per tick

type Prioridade = "alta" | "media" | "baixa" | "normal" | "urgente";

interface Pedido {
  id: string;
  numero: number;
  cliente_nome: string;
  prioridade: Prioridade | null;
  data_prometida: string | null;
  status: string;
  setor_atual?: string | null;
}

// ===========================================================================
// HELPERS
// ===========================================================================

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T23:59:59");
  return d < new Date();
}

function getPrioridadeBadge(
  prioridade: Prioridade | null
): { label: string; classes: string } {
  switch (prioridade) {
    case "alta":
      return {
        label: "Alta",
        classes: "bg-orange-600 text-white",
      };
    case "urgente":
      return {
        label: "Urgente",
        classes: "bg-red-600 text-white animate-pulse",
      };
    case "media":
      return {
        label: "Média",
        classes: "bg-amber-500 text-white",
      };
    case "baixa":
      return {
        label: "Baixa",
        classes: "bg-emerald-600 text-white",
      };
    case "normal":
    default:
      return {
        label: "Normal",
        classes: "bg-slate-500 text-white",
      };
  }
}

// ===========================================================================
// OS CARD
// ===========================================================================

interface OsCardProps {
  pedido: Pedido;
}

function OsCard({ pedido }: OsCardProps) {
  const prio = getPrioridadeBadge(pedido.prioridade);
  const overdue = isOverdue(pedido.data_prometida);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-3 hover:border-slate-500 transition-colors">
      {/* Header row: numero + prioridade */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-400 text-xs font-mono tracking-widest uppercase">
          OS
        </span>
        <span className="text-white font-bold text-lg leading-none">
          #{pedido.numero}
        </span>
        <span
          className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${prio.classes}`}
        >
          {prio.label}
        </span>
      </div>

      {/* Cliente */}
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate leading-tight">
          {pedido.cliente_nome || "—"}
        </p>
      </div>

      {/* Data prometida */}
      <div className="flex items-center gap-2 mt-auto">
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 ${overdue ? "text-red-400" : "text-slate-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span
          className={`text-xs font-mono ${overdue ? "text-red-400 font-semibold" : "text-slate-400"}`}
        >
          {formatDate(pedido.data_prometida)}
          {overdue && " ⚠"}
        </span>
      </div>
    </div>
  );
}

// ===========================================================================
// MAIN PAGE
// ===========================================================================

export default function TvPage() {
  // ── Clock ──────────────────────────────────────────────────────────────────
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Sector rotation ────────────────────────────────────────────────────────
  const [sectorIdx, setSectorIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const sectorInterval = setInterval(() => {
      setSectorIdx((i) => (i + 1) % SETORES.length);
      setProgress(0);
    }, SECTOR_DURATION_MS);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + PROGRESS_INCREMENT, 100));
    }, PROGRESS_TICK_MS);

    return () => {
      clearInterval(sectorInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const currentSetor = SETORES[sectorIdx];

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: pedidos = [], isFetching } = useQuery({
    queryKey: ["tv-pedidos"],
    queryFn: async (): Promise<Pedido[]> => {
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          id,
          numero,
          prioridade,
          data_prometida,
          status,
          clientes ( nome_fantasia, razao_social )
        `)
        .in("status", ["em_producao", "aprovado", "produzido"])
        .order("prioridade", { ascending: false })
        .order("data_prometida", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        numero: row.numero,
        cliente_nome:
          row.clientes?.nome_fantasia ||
          row.clientes?.razao_social ||
          "Cliente não identificado",
        prioridade: row.prioridade ?? null,
        data_prometida: row.data_prometida ?? null,
        status: row.status,
        setor_atual: null,
      }));
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
  });

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 bg-slate-950 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none tracking-wide">
              CROMA PRINT
            </h1>
            <p className="text-slate-400 text-xs tracking-widest uppercase leading-tight">
              Monitor de Produção
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isFetching ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse"}`}
            />
            <span className="text-slate-400 text-xs uppercase tracking-wider">
              {isFetching ? "Atualizando" : "Ao vivo"}
            </span>
          </div>

          {/* Clock */}
          <div className="font-mono text-2xl font-bold text-white tabular-nums">
            {formatTime(time)}
          </div>
        </div>
      </header>

      {/* ── SECTOR TITLE ────────────────────────────────────────────────────── */}
      <div className="px-8 py-5 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-baseline gap-4">
          <span className="text-slate-500 text-sm uppercase tracking-widest font-medium">
            Setor
          </span>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">
            {currentSetor}
          </h2>
          <span className="ml-auto text-slate-500 text-sm">
            {pedidos.length} OS em produção
          </span>
        </div>
      </div>

      {/* ── OS GRID ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {pedidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
            <svg
              className="w-16 h-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-xl font-medium">Nenhuma OS em produção</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {pedidos.map((pedido) => (
              <OsCard key={pedido.id} pedido={pedido} />
            ))}
          </div>
        )}
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="flex-shrink-0 bg-slate-950 border-t border-slate-800 px-8 py-3">
        {/* Navigation dots */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {SETORES.map((setor, i) => (
            <button
              key={setor}
              type="button"
              aria-label={`Setor ${setor}`}
              title={setor}
              onClick={() => {
                setSectorIdx(i);
                setProgress(0);
              }}
              className={`transition-all duration-300 rounded-full ${
                i === sectorIdx
                  ? "w-6 h-2.5 bg-orange-500"
                  : "w-2.5 h-2.5 bg-slate-600 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>

        {/* Sector label strip */}
        <div className="flex items-center justify-center gap-1 mb-3 flex-wrap">
          {SETORES.map((setor, i) => (
            <span
              key={setor}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                i === sectorIdx
                  ? "text-orange-400 font-semibold"
                  : "text-slate-600"
              }`}
            >
              {setor}
            </span>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-slate-600 text-xs">
            Próximo: {SETORES[(sectorIdx + 1) % SETORES.length]}
          </span>
          <span className="text-slate-600 text-xs font-mono">
            {Math.round(((100 - progress) / 100) * 20)}s
          </span>
        </div>
      </footer>
    </div>
  );
}

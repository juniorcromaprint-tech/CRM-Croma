// ============================================================================
// OrcamentosPendentesPage — fila de revisão de orçamentos SHADOW
// MVP BLOCO 0.5 — Beira Rio (Quinta 28/05)
//
// Filtro fixo: cliente_id = Beira Rio + gerado_por_ia + aprovado_em IS NULL
//              + status rascunho/enviada + criados últimos 7 dias.
// ============================================================================

import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrcamentosPendentes } from "../hooks/useOrcamentosPendentes";
import type { PropostaPendente } from "../hooks/useOrcamentosPendentes";
import OrcamentoPendenteCard from "../components/OrcamentoPendenteCard";
import AprovarOrcamentoDialog from "../components/AprovarOrcamentoDialog";
import { brl } from "@/shared/utils/format";

export default function OrcamentosPendentesPage() {
  const {
    data: pendentes = [],
    isLoading,
    isFetching,
    refetch,
    error,
  } = useOrcamentosPendentes();

  const [aprovarTarget, setAprovarTarget] = useState<PropostaPendente | null>(
    null,
  );

  const totalAberto = useMemo(
    () => pendentes.reduce((s, p) => s + (p.total ?? 0), 0),
    [pendentes],
  );

  const foraFaixa = useMemo(
    () =>
      pendentes.filter(
        (p) => p.faixa?.status === "ok" && p.faixa?.dentro === false,
      ).length,
    [pendentes],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/orcamentos"
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="Voltar para Orçamentos"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              Orçamentos pendentes de aprovação
            </h1>
          </div>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500" />
            Beira Rio · gerados pela IA, aguardando revisão humana
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-xl"
        >
          {isFetching ? (
            <Loader2 size={14} className="animate-spin mr-2" />
          ) : (
            <RefreshCw size={14} className="mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Inbox size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : pendentes.length}
              </p>
              <p className="text-xs text-slate-500">Aguardando revisão</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <ShieldCheck size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800 leading-tight">
                {isLoading ? "..." : brl(totalAberto)}
              </p>
              <p className="text-xs text-slate-500">Valor total em revisão</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                foraFaixa > 0 ? "bg-amber-50" : "bg-emerald-50"
              }`}
            >
              <AlertTriangle
                size={20}
                className={foraFaixa > 0 ? "text-amber-600" : "text-emerald-600"}
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : foraFaixa}
              </p>
              <p className="text-xs text-slate-500">Fora da faixa histórica</p>
            </div>
          </div>
        </div>
      </div>

      {/* Estados */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">Erro ao carregar pendentes</p>
          <p className="text-xs">
            {(error as Error)?.message ?? "Erro desconhecido."}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : pendentes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 text-center px-6">
          <ShieldCheck size={48} className="text-emerald-200 mb-4" />
          <h2 className="text-xl font-bold text-slate-700">
            Nada pendente agora
          </h2>
          <p className="text-slate-400 mt-2 max-w-md text-sm">
            Quando a IA gerar um orçamento Beira Rio, ele aparece aqui para
            você revisar antes de enviar.
          </p>
          <Link to="/orcamentos" className="mt-6">
            <Button variant="outline" className="rounded-xl">
              Voltar para Orçamentos
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {pendentes.map((p) => (
            <OrcamentoPendenteCard
              key={p.id}
              proposta={p}
              onAprovar={(prop) => setAprovarTarget(prop)}
            />
          ))}
        </div>
      )}

      {/* Dialog aprovação */}
      <AprovarOrcamentoDialog
        open={!!aprovarTarget}
        onOpenChange={(open) => !open && setAprovarTarget(null)}
        propostaId={aprovarTarget?.id ?? null}
        numero={aprovarTarget?.numero}
        total={aprovarTarget?.total}
      />
    </div>
  );
}

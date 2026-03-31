// src/domains/qualidade/pages/QualidadeDashboardPage.tsx

import { useNavigate } from "react-router-dom";
import { useQualidadeKPIs } from "../hooks/useQualidadeKPIs";
import { useOcorrencias } from "../hooks/useOcorrencias";
import { QualidadeCharts } from "../components/QualidadeCharts";
import { formatDate } from "@/shared/utils/format";

import { lazy, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  ChevronRight,
  Loader2,
  SmilePlus,
} from "lucide-react";

const NPSDashboard = lazy(() => import("../components/NPSDashboard"));

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  aberta: { label: "Aberta", color: "bg-blue-100 text-blue-700 border-blue-200" },
  em_analise: { label: "Em Análise", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  em_tratativa: { label: "Em Tratativa", color: "bg-orange-100 text-orange-700 border-orange-200" },
  resolvida: { label: "Resolvida", color: "bg-green-100 text-green-700 border-green-200" },
  encerrada: { label: "Encerrada", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-green-100 text-green-700 border-green-200" },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  alta: { label: "Alta", color: "bg-orange-100 text-orange-700 border-orange-200" },
  critica: { label: "Crítica", color: "bg-red-100 text-red-700 border-red-200" },
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  highlight?: boolean;
}

function KpiCard({ label, value, icon: Icon, iconColor, highlight }: KpiCardProps) {
  return (
    <Card
      className={`rounded-2xl border ${
        highlight ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-slate-500">{label}</span>
          <div className={`p-2 rounded-xl ${iconColor}`}>
            <Icon size={16} className="text-white" />
          </div>
        </div>
        <p className={`text-3xl font-bold ${highlight ? "text-amber-700" : "text-slate-800"}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QualidadeDashboardPage() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: loadingKpis } = useQualidadeKPIs();
  const { data: ocorrencias = [], isLoading: loadingOcorrencias } = useOcorrencias();

  const recentes = [...ocorrencias]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const isLoading = loadingKpis || loadingOcorrencias;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard de Qualidade</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Visão geral de ocorrências e indicadores
          </p>
        </div>
        <Button
          className="rounded-xl bg-blue-600 hover:bg-blue-700"
          onClick={() => navigate("/qualidade/ocorrencias")}
        >
          Ver Todas
          <ChevronRight size={16} className="ml-1" />
        </Button>
      </div>

      {/* Tabs: Ocorrências vs NPS */}
      <Tabs defaultValue="ocorrencias">
        <TabsList className="rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="ocorrencias" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Ocorrências
          </TabsTrigger>
          <TabsTrigger value="nps" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5">
            <SmilePlus size={14} />
            NPS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nps" className="mt-4">
          <Suspense fallback={<div className="flex items-center justify-center p-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" />Carregando...</div>}>
            <NPSDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="ocorrencias" className="mt-4 space-y-6">
      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total de Ocorrências"
            value={kpis?.total_ocorrencias ?? 0}
            icon={Activity}
            iconColor="bg-blue-500"
          />
          <KpiCard
            label="Em Aberto"
            value={kpis?.abertas ?? 0}
            icon={AlertTriangle}
            iconColor="bg-amber-500"
            highlight={(kpis?.abertas ?? 0) > 0}
          />
          <KpiCard
            label="Resolvidas no Mês"
            value={kpis?.resolvidas_mes ?? 0}
            icon={CheckCircle2}
            iconColor="bg-green-500"
          />
          <KpiCard
            label="MTTR (horas)"
            value={kpis?.mttr_horas ?? 0}
            icon={Clock}
            iconColor="bg-slate-500"
          />
        </div>
      )}

      {/* Charts */}
      {kpis && !loadingKpis ? (
        <QualidadeCharts kpis={kpis} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      )}

      {/* Recentes */}
      <div className="bg-white rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Ocorrências Recentes</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-700 rounded-xl"
            onClick={() => navigate("/qualidade/ocorrencias")}
          >
            Ver todas
            <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>

        {loadingOcorrencias ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : recentes.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Nenhuma ocorrência</h3>
            <p className="text-sm text-slate-400 mt-1">
              Tudo certo por aqui
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentes.map((oc: any) => {
              const statusCfg = STATUS_CONFIG[oc.status] ?? {
                label: oc.status,
                color: "bg-slate-100 text-slate-600 border-slate-200",
              };
              const prioridadeCfg = PRIORIDADE_CONFIG[oc.prioridade] ?? {
                label: oc.prioridade,
                color: "bg-slate-100 text-slate-600 border-slate-200",
              };

              return (
                <button
                  key={oc.id}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => navigate(`/qualidade/ocorrencias/${oc.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {oc.descricao}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(oc.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`text-xs ${prioridadeCfg.color}`}>
                      {prioridadeCfg.label}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>
                      {statusCfg.label}
                    </Badge>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

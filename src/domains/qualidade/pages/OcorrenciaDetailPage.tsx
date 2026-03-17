// src/domains/qualidade/pages/OcorrenciaDetailPage.tsx

import { useParams, useNavigate } from "react-router-dom";
import { useOcorrencia, useAtualizarOcorrencia } from "../hooks/useOcorrencias";
import { TratativaTimeline } from "../components/TratativaTimeline";
import { formatDate } from "@/shared/utils/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowLeft,
  Package,
  Wrench,
  Building2,
  Loader2,
  ChevronRight,
} from "lucide-react";

// ─── Status config ────────────────────────────────────────────────────────────

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

// Linear workflow transitions
const STATUS_NEXT: Record<string, { value: string; label: string } | null> = {
  aberta: { value: "em_analise", label: "Iniciar Análise" },
  em_analise: { value: "em_tratativa", label: "Iniciar Tratativa" },
  em_tratativa: { value: "resolvida", label: "Marcar Resolvida" },
  resolvida: { value: "encerrada", label: "Encerrar Ocorrência" },
  encerrada: null,
};

function formatTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    retrabalho: "Retrabalho",
    devolucao: "Devolução",
    erro_producao: "Erro de Produção",
    erro_instalacao: "Erro de Instalação",
    divergencia_cliente: "Divergência c/ Cliente",
    material_defeituoso: "Material Defeituoso",
    outro: "Outro",
  };
  return labels[tipo] ?? tipo;
}

// ─── Info card ────────────────────────────────────────────────────────────────

interface InfoCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor: string;
}

function InfoCard({ icon: Icon, label, value, iconColor }: InfoCardProps) {
  return (
    <Card className="rounded-2xl border border-slate-200">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-xl ${iconColor}`}>
          <Icon size={16} className="text-white" />
        </div>
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-sm font-semibold text-slate-700">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OcorrenciaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: ocorrencia, isLoading } = useOcorrencia(id ?? "");
  const atualizarOcorrencia = useAtualizarOcorrencia();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!ocorrencia) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <AlertTriangle size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Ocorrência não encontrada</h3>
          <p className="text-sm text-slate-400 mt-1">
            Verifique o endereço ou volte para a lista
          </p>
          <Button
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={() => navigate("/qualidade/ocorrencias")}
          >
            Voltar para lista
          </Button>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[ocorrencia.status] ?? {
    label: ocorrencia.status,
    color: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const prioridadeCfg = PRIORIDADE_CONFIG[ocorrencia.prioridade] ?? {
    label: ocorrencia.prioridade,
    color: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const nextStatus = STATUS_NEXT[ocorrencia.status] ?? null;

  async function handleAdvanceStatus() {
    if (!nextStatus) return;
    await atualizarOcorrencia.mutateAsync({
      id: ocorrencia.id,
      dados: {
        status: nextStatus.value,
        ...(nextStatus.value === "resolvida" || nextStatus.value === "encerrada"
          ? { resolved_at: new Date().toISOString() }
          : {}),
      },
    });
  }

  const tratativas = ocorrencia.tratativas ?? [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="rounded-xl -ml-2 text-slate-500 hover:text-slate-700"
        onClick={() => navigate("/qualidade/ocorrencias")}
      >
        <ArrowLeft size={16} className="mr-1" />
        Voltar
      </Button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>
                {statusCfg.label}
              </Badge>
              <Badge variant="outline" className={`text-xs ${prioridadeCfg.color}`}>
                {prioridadeCfg.label}
              </Badge>
              <span className="text-xs text-slate-400">
                {formatTipoLabel(ocorrencia.tipo)}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">
              {ocorrencia.descricao}
            </h1>
            <p className="text-xs text-slate-400 mt-3">
              Registrada em {formatDate(ocorrencia.created_at)}
              {ocorrencia.resolved_at && (
                <> · Resolvida em {formatDate(ocorrencia.resolved_at)}</>
              )}
            </p>
          </div>

          {/* Advance status button */}
          {nextStatus && (
            <Button
              className="rounded-xl bg-blue-600 hover:bg-blue-700 shrink-0"
              onClick={handleAdvanceStatus}
              disabled={atualizarOcorrencia.isPending}
            >
              {atualizarOcorrencia.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ChevronRight size={16} className="mr-1" />
              )}
              {nextStatus.label}
            </Button>
          )}
        </div>
      </div>

      {/* Info cards — only shown when linked */}
      {(ocorrencia.pedido_id || ocorrencia.ordem_producao_id || ocorrencia.fornecedor_id) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ocorrencia.pedido_id && (
            <InfoCard
              icon={Package}
              label="Pedido Vinculado"
              value={`#${ocorrencia.pedido_id.slice(0, 8).toUpperCase()}`}
              iconColor="bg-blue-500"
            />
          )}
          {ocorrencia.ordem_producao_id && (
            <InfoCard
              icon={Wrench}
              label="OP Vinculada"
              value={`#${ocorrencia.ordem_producao_id.slice(0, 8).toUpperCase()}`}
              iconColor="bg-orange-500"
            />
          )}
          {ocorrencia.fornecedor_id && (
            <InfoCard
              icon={Building2}
              label="Fornecedor"
              value={ocorrencia.fornecedor_id.slice(0, 8).toUpperCase()}
              iconColor="bg-slate-500"
            />
          )}
        </div>
      )}

      {/* Tratativas */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-4">
          Tratativas ({tratativas.length})
        </h2>
        <TratativaTimeline
          tratativas={tratativas}
          ocorrencia_id={ocorrencia.id}
        />
      </div>
    </div>
  );
}

// src/domains/qualidade/pages/OcorrenciasPage.tsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOcorrencias } from "../hooks/useOcorrencias";
import { OcorrenciaForm } from "../components/OcorrenciaForm";
import { formatDate } from "@/shared/utils/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Plus,
  Loader2,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: "todas", label: "Todas" },
  { value: "aberta", label: "Abertas" },
  { value: "em_analise", label: "Em Análise" },
  { value: "em_tratativa", label: "Em Tratativa" },
  { value: "resolvida", label: "Resolvidas" },
  { value: "encerrada", label: "Encerradas" },
];

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

const TIPO_OPTIONS = [
  { value: "retrabalho", label: "Retrabalho" },
  { value: "devolucao", label: "Devolução" },
  { value: "erro_producao", label: "Erro de Produção" },
  { value: "erro_instalacao", label: "Erro de Instalação" },
  { value: "divergencia_cliente", label: "Divergência c/ Cliente" },
  { value: "material_defeituoso", label: "Material Defeituoso" },
  { value: "outro", label: "Outro" },
];

const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

function formatTipoLabel(tipo: string): string {
  return TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? tipo;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OcorrenciasPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [activeStatus, setActiveStatus] = useState("todas");
  const [filterPrioridade, setFilterPrioridade] = useState("todas");
  const [filterTipo, setFilterTipo] = useState("todos");

  const filtros = {
    status: activeStatus !== "todas" ? activeStatus : undefined,
    prioridade: filterPrioridade !== "todas" ? filterPrioridade : undefined,
    tipo: filterTipo !== "todos" ? filterTipo : undefined,
  };

  const { data: ocorrencias = [], isLoading } = useOcorrencias(filtros);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ocorrências</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestão de qualidade e não conformidades
          </p>
        </div>
        <Button
          className="rounded-xl bg-blue-600 hover:bg-blue-700"
          onClick={() => setShowForm(true)}
        >
          <Plus size={16} className="mr-2" />
          Nova Ocorrência
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status tabs */}
        <Tabs value={activeStatus} onValueChange={setActiveStatus}>
          <TabsList className="rounded-xl">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="rounded-lg text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex gap-2 ml-auto">
          {/* Prioridade */}
          <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
            <SelectTrigger className="rounded-xl w-36 text-sm">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas prioridades</SelectItem>
              {PRIORIDADE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Tipo */}
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="rounded-xl w-44 text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : ocorrencias.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Nenhuma ocorrência encontrada</h3>
            <p className="text-sm text-slate-400 mt-1">
              Ajuste os filtros ou registre uma nova ocorrência
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Descrição
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Tipo
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Prioridade
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Data
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Responsável
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ocorrencias as any[]).map((oc) => {
                const statusCfg = STATUS_CONFIG[oc.status] ?? {
                  label: oc.status,
                  color: "bg-slate-100 text-slate-600 border-slate-200",
                };
                const prioridadeCfg = PRIORIDADE_CONFIG[oc.prioridade] ?? {
                  label: oc.prioridade,
                  color: "bg-slate-100 text-slate-600 border-slate-200",
                };
                const responsavel = oc.responsavel
                  ? `${oc.responsavel.first_name ?? ""} ${oc.responsavel.last_name ?? ""}`.trim()
                  : "—";

                return (
                  <TableRow
                    key={oc.id}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => navigate(`/qualidade/ocorrencias/${oc.id}`)}
                  >
                    <TableCell className="font-medium text-slate-800">
                      {oc.descricao}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {formatTipoLabel(oc.tipo)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${prioridadeCfg.color}`}
                      >
                        {prioridadeCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(oc.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {responsavel}
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-300 text-xs">›</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Form dialog */}
      <OcorrenciaForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}

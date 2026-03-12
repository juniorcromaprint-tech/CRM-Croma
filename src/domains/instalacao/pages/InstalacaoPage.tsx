import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { gerarContasReceber } from "@/domains/financeiro/services/financeiro-automation.service";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {
  Wrench,
  CheckCircle2,
  Clock,
  Play,
  MapPin,
  User,
  Camera,
  Video,
  Search,
  RefreshCw,
  CalendarDays,
  Timer,
  Building2,
  AlertTriangle,
  Wifi,
  FileText,
  Image,
  ClipboardList,
} from "lucide-react";

import {
  instalacaoService,
  type CampoInstalacao,
  type CampoFoto,
} from "../services/instalacao.service";
import { useCampoRealtimeGlobal } from "../hooks/useCampoRealtime";
import ChecklistSheet from "../components/ChecklistSheet";

// ============================================================
// STATUS CONFIG (Campo)
// ============================================================

type CampoStatus = "Pendente" | "Em Andamento" | "Concluído" | "Cancelado";

const CAMPO_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; badgeVariant: string; icon: React.ElementType }
> = {
  Pendente: {
    label: "Pendente",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
    badgeVariant: "outline",
    icon: Clock,
  },
  "Em Andamento": {
    label: "Em Andamento",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
    badgeVariant: "outline",
    icon: Play,
  },
  Concluído: {
    label: "Concluído",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeVariant: "outline",
    icon: CheckCircle2,
  },
  Cancelado: {
    label: "Cancelado",
    color: "bg-red-50 text-red-600 border-red-200",
    badgeVariant: "outline",
    icon: AlertTriangle,
  },
};

function getStatusConfig(status: string) {
  return (
    CAMPO_STATUS_CONFIG[status] ?? {
      label: status,
      color: "bg-slate-50 text-slate-600 border-slate-200",
      badgeVariant: "outline",
      icon: Clock,
    }
  );
}

// ============================================================
// HELPERS
// ============================================================

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
}

function formatDateTimeBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuracao(minutos: number | null | undefined): string {
  if (!minutos) return "-";
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

// ============================================================
// KPI CARD
// ============================================================

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  sub,
  subColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-800 mt-0.5 leading-tight">
            {value}
          </p>
          {sub && (
            <p className={`text-xs mt-0.5 font-medium ${subColor ?? "text-slate-400"}`}>
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ============================================================
// JOB CARD
// ============================================================

function JobCard({
  job,
  onVerFotos,
  onChecklist,
}: {
  job: CampoInstalacao;
  onVerFotos: (job: CampoInstalacao) => void;
  onChecklist: (job: CampoInstalacao) => void;
}) {
  const temFotos = (job.fotos_antes ?? 0) + (job.fotos_depois ?? 0) > 0;
  const temProblema = !!job.issues;

  return (
    <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 text-sm">
                {job.os_number}
              </span>
              <StatusBadge status={job.status_campo} />
              {temProblema && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                  <AlertTriangle size={10} />
                  Ocorrência
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-medium uppercase tracking-wide">
              {job.tipo_servico}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-slate-500 font-medium">
              {formatDateBR(job.data_agendada)}
            </p>
            {job.duracao_minutos && (
              <p className="text-xs text-slate-400 flex items-center gap-1 justify-end mt-0.5">
                <Timer size={10} />
                {formatDuracao(job.duracao_minutos)}
              </p>
            )}
          </div>
        </div>

        <Separator className="my-3" />

        {/* Loja */}
        <div className="flex items-start gap-2 mb-2">
          <Building2 size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700 truncate">
              {job.loja_nome ?? "-"}
            </p>
            {job.loja_marca && job.loja_marca !== job.loja_nome && (
              <p className="text-xs text-slate-400 truncate">{job.loja_marca}</p>
            )}
          </div>
        </div>

        {/* Endereço */}
        {job.loja_endereco && (
          <div className="flex items-start gap-2 mb-2">
            <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500 truncate">
              {job.loja_endereco}
              {job.loja_estado ? ` — ${job.loja_estado}` : ""}
            </p>
          </div>
        )}

        {/* Técnico */}
        {job.tecnico_nome && job.tecnico_nome.trim() !== "" && (
          <div className="flex items-center gap-2 mb-2">
            <User size={14} className="text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-500 truncate">{job.tecnico_nome}</p>
          </div>
        )}

        {/* Horários */}
        {(job.started_at || job.finished_at) && (
          <div className="flex items-center gap-4 text-xs text-slate-400 mb-2">
            {job.started_at && (
              <span className="flex items-center gap-1">
                <Play size={10} className="text-cyan-500" />
                Início: {formatDateTimeBR(job.started_at)}
              </span>
            )}
            {job.finished_at && (
              <span className="flex items-center gap-1">
                <CheckCircle2 size={10} className="text-emerald-500" />
                Fim: {formatDateTimeBR(job.finished_at)}
              </span>
            )}
          </div>
        )}

        {/* Mídia + Checklist */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onClick={() => onVerFotos(job)}
            disabled={!temFotos}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              temFotos
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                : "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Camera size={12} />
            {job.fotos_antes ?? 0} antes / {job.fotos_depois ?? 0} depois
          </button>
          <button
            onClick={() => onChecklist(job)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
          >
            <ClipboardList size={12} />
            Checklist
          </button>
          {(job.total_videos ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Video size={12} />
              {job.total_videos} vídeos
            </span>
          )}
          {job.signature_url && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <FileText size={12} />
              Assinado
            </span>
          )}
        </div>

        {/* Ocorrência */}
        {job.issues && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-50 border border-red-100">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Ocorrência:</p>
            <p className="text-xs text-red-600">{job.issues}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// FOTOS SHEET
// ============================================================

function FotosSheet({
  job,
  open,
  onClose,
}: {
  job: CampoInstalacao | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ["campo-fotos", job?.job_id],
    queryFn: () => instalacaoService.buscarFotosPorJob(job!.job_id),
    enabled: open && !!job?.job_id,
  });

  const fotosAntes = fotos.filter((f) => f.photo_type === "before");
  const fotosDepois = fotos.filter((f) => f.photo_type === "after");
  const fotosOutras = fotos.filter(
    (f) => f.photo_type !== "before" && f.photo_type !== "after"
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Camera size={20} className="text-blue-600" />
            Fotos — {job?.os_number}
          </SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={job?.status_campo ?? ""} />
            <span className="text-sm text-slate-500">{job?.loja_nome}</span>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <RefreshCw size={20} className="animate-spin mr-2" />
            Carregando fotos...
          </div>
        ) : fotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Image size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma foto registrada</p>
          </div>
        ) : (
          <div className="space-y-6">
            {fotosAntes.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Antes ({fotosAntes.length})
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {fotosAntes.map((foto) => (
                    <FotoCard key={foto.id} foto={foto} />
                  ))}
                </div>
              </div>
            )}
            {fotosDepois.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Depois ({fotosDepois.length})
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {fotosDepois.map((foto) => (
                    <FotoCard key={foto.id} foto={foto} />
                  ))}
                </div>
              </div>
            )}
            {fotosOutras.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Outras ({fotosOutras.length})
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {fotosOutras.map((foto) => (
                    <FotoCard key={foto.id} foto={foto} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FotoCard({ foto }: { foto: CampoFoto }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
      <a href={foto.photo_url} target="_blank" rel="noopener noreferrer">
        <img
          src={foto.photo_url}
          alt={foto.description ?? foto.photo_type}
          className="w-full h-36 object-cover hover:opacity-90 transition-opacity"
          loading="lazy"
        />
      </a>
      {(foto.description || foto.note) && (
        <div className="p-2">
          {foto.description && (
            <p className="text-xs font-medium text-slate-600 truncate">{foto.description}</p>
          )}
          {foto.note && (
            <p className="text-xs text-slate-400 truncate">{foto.note}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos os status" },
  { value: "Pendente", label: "Pendente" },
  { value: "Em Andamento", label: "Em Andamento" },
  { value: "Concluído", label: "Concluído" },
  { value: "Cancelado", label: "Cancelado" },
];

export default function InstalacaoPage() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<"hoje" | "todas" | "ordens">("hoje");
  const [jobSelecionado, setJobSelecionado] = useState<CampoInstalacao | null>(null);
  const [sheetFotosAberta, setSheetFotosAberta] = useState(false);
  const [jobChecklist, setJobChecklist] = useState<CampoInstalacao | null>(null);
  const [sheetChecklistAberta, setSheetChecklistAberta] = useState(false);

  // Realtime global — invalida queries automaticamente
  useCampoRealtimeGlobal();

  const queryClient = useQueryClient();

  // Query: OS de hoje
  const {
    data: jobsHoje = [],
    isLoading: loadingHoje,
    refetch: refetchHoje,
  } = useQuery({
    queryKey: ["campo-instalacoes-hoje"],
    queryFn: instalacaoService.listarHoje,
    refetchInterval: 60_000, // fallback polling a cada 60s
    staleTime: 30_000,
  });

  // Query: Todas as OS com filtros
  const {
    data: jobsTodos = [],
    isLoading: loadingTodos,
    refetch: refetchTodos,
  } = useQuery({
    queryKey: [
      "campo-instalacoes-todas",
      filtroStatus,
      filtroDataInicio,
      filtroDataFim,
    ],
    queryFn: () =>
      instalacaoService.listarTodos({
        status: filtroStatus !== "todos" ? filtroStatus : undefined,
        dataInicio: filtroDataInicio || undefined,
        dataFim: filtroDataFim || undefined,
      }),
    enabled: abaAtiva === "todas",
    staleTime: 30_000,
  });

  // Query: Ordens de Instalação ERP (tabela ordens_instalacao)
  const {
    data: ordensErp = [],
    isLoading: loadingOrdens,
    refetch: refetchOrdens,
  } = useQuery({
    queryKey: ["ordens-instalacao-erp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_instalacao")
        .select("id, status, data_agendada, pedido_id, created_at, pedidos(numero, status)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        status: string;
        data_agendada: string | null;
        pedido_id: string | null;
        created_at: string;
        pedidos: { numero: string; status: string } | null;
      }>;
    },
    enabled: abaAtiva === "ordens",
    staleTime: 30_000,
  });

  const concluirInstalacao = useMutation({
    mutationFn: async (os: (typeof ordensErp)[0]) => {
      const { error } = await supabase
        .from("ordens_instalacao")
        .update({ status: "concluida" })
        .eq("id", os.id);
      if (error) throw error;
      if (os.pedido_id && os.pedidos?.status === "em_instalacao") {
        await supabase.from("pedidos").update({ status: "concluido" }).eq("id", os.pedido_id);
        await gerarContasReceber(os.pedido_id);
      }
    },
    onSuccess: () => {
      showSuccess("Instalação concluída com sucesso");
      queryClient.invalidateQueries({ queryKey: ["ordens-instalacao-erp"] });
    },
    onError: () => showError("Erro ao concluir instalação"),
  });

  // KPIs baseados em "hoje"
  const kpis = useMemo(() => {
    const total = jobsHoje.length;
    const pendentes = jobsHoje.filter((j) => j.status_campo === "Pendente").length;
    const emAndamento = jobsHoje.filter((j) => j.status_campo === "Em Andamento").length;
    const concluidas = jobsHoje.filter((j) => j.status_campo === "Concluído").length;
    const comProblema = jobsHoje.filter((j) => !!j.issues).length;
    return { total, pendentes, emAndamento, concluidas, comProblema };
  }, [jobsHoje]);

  // Filtro por busca (OS, loja, técnico)
  function filtrarPorBusca(lista: CampoInstalacao[]): CampoInstalacao[] {
    if (!busca.trim()) return lista;
    const q = busca.toLowerCase();
    return lista.filter(
      (j) =>
        j.os_number?.toLowerCase().includes(q) ||
        j.loja_nome?.toLowerCase().includes(q) ||
        j.loja_marca?.toLowerCase().includes(q) ||
        j.tecnico_nome?.toLowerCase().includes(q) ||
        j.loja_estado?.toLowerCase().includes(q)
    );
  }

  const jobsHojeFiltrados = useMemo(
    () => filtrarPorBusca(jobsHoje),
    [jobsHoje, busca]
  );

  const jobsTodosFiltrados = useMemo(
    () => filtrarPorBusca(jobsTodos),
    [jobsTodos, busca]
  );

  function abrirFotos(job: CampoInstalacao) {
    setJobSelecionado(job);
    setSheetFotosAberta(true);
  }

  function abrirChecklist(job: CampoInstalacao) {
    setJobChecklist(job);
    setSheetChecklistAberta(true);
  }

  const isLoading = abaAtiva === "hoje" ? loadingHoje : loadingTodos;
  const jobsAtivos = abaAtiva === "hoje" ? jobsHojeFiltrados : jobsTodosFiltrados;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <Wrench size={18} className="text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Instalações — Campo</h1>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Wifi size={10} />
              Realtime
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 ml-11">
            Monitoramento em tempo real das OS de campo
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl h-9 gap-2"
          onClick={() => abaAtiva === "hoje" ? refetchHoje() : abaAtiva === "todas" ? refetchTodos() : refetchOrdens()}
        >
          <RefreshCw size={14} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards (baseados em hoje) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Hoje"
          value={kpis.total}
          icon={CalendarDays}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          sub={new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "short",
          })}
        />
        <KpiCard
          label="Pendentes"
          value={kpis.pendentes}
          icon={Clock}
          iconBg="bg-yellow-100"
          iconColor="text-yellow-600"
          sub={kpis.total > 0 ? `${Math.round((kpis.pendentes / kpis.total) * 100)}% do total` : "—"}
        />
        <KpiCard
          label="Em Andamento"
          value={kpis.emAndamento}
          icon={Play}
          iconBg="bg-cyan-100"
          iconColor="text-cyan-600"
          sub="Em execução agora"
          subColor={kpis.emAndamento > 0 ? "text-cyan-600" : "text-slate-400"}
        />
        <KpiCard
          label="Concluídas"
          value={kpis.concluidas}
          icon={CheckCircle2}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          sub={
            kpis.total > 0
              ? `${Math.round((kpis.concluidas / kpis.total) * 100)}% de conclusão`
              : "—"
          }
          subColor="text-emerald-600"
        />
        <KpiCard
          label="Com Ocorrência"
          value={kpis.comProblema}
          icon={AlertTriangle}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          sub={kpis.comProblema > 0 ? "Requer atenção" : "Sem ocorrências"}
          subColor={kpis.comProblema > 0 ? "text-red-600" : "text-slate-400"}
        />
      </div>

      {/* Filtros */}
      <Card className="border-none shadow-sm rounded-2xl bg-white">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            {/* Busca */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                placeholder="Buscar por OS, loja, técnico..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 rounded-xl h-9 border-slate-200 text-sm"
              />
            </div>

            {/* Status */}
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-48 rounded-xl h-9 border-slate-200 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Data Início */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">De:</span>
              <Input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="rounded-xl h-9 border-slate-200 text-sm w-36"
              />
            </div>

            {/* Data Fim */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">Até:</span>
              <Input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="rounded-xl h-9 border-slate-200 text-sm w-36"
              />
            </div>

            {/* Limpar */}
            {(busca || filtroStatus !== "todos" || filtroDataInicio || filtroDataFim) && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl h-9 text-slate-500"
                onClick={() => {
                  setBusca("");
                  setFiltroStatus("todos");
                  setFiltroDataInicio("");
                  setFiltroDataFim("");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Abas: Hoje / Todas */}
      <Tabs
        value={abaAtiva}
        onValueChange={(v) => setAbaAtiva(v as "hoje" | "todas" | "ordens")}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="rounded-xl bg-slate-100 p-1">
            <TabsTrigger value="hoje" className="rounded-lg text-sm px-4">
              Hoje
              {kpis.total > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {kpis.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="todas" className="rounded-lg text-sm px-4">
              Todas
            </TabsTrigger>
            <TabsTrigger value="ordens" className="rounded-lg text-sm px-4">
              Ordens ERP
              {ordensErp.filter((o) => o.status !== "concluida" && o.status !== "cancelada").length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                  {ordensErp.filter((o) => o.status !== "concluida" && o.status !== "cancelada").length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <p className="text-sm text-slate-500">
            {jobsAtivos.length}{" "}
            {jobsAtivos.length === 1 ? "OS encontrada" : "OS encontradas"}
          </p>
        </div>

        {/* ABA: HOJE */}
        <TabsContent value="hoje" className="mt-4">
          {loadingHoje ? (
            <LoadingState />
          ) : jobsHojeFiltrados.length === 0 ? (
            <EmptyState
              mensagem={
                busca
                  ? "Nenhuma OS encontrada com esse filtro"
                  : "Nenhuma OS agendada para hoje"
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {jobsHojeFiltrados.map((job) => (
                <JobCard key={job.job_id} job={job} onVerFotos={abrirFotos} onChecklist={abrirChecklist} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ABA: TODAS */}
        <TabsContent value="todas" className="mt-4">
          {loadingTodos ? (
            <LoadingState />
          ) : jobsTodosFiltrados.length === 0 ? (
            <EmptyState
              mensagem={
                busca || filtroStatus !== "todos"
                  ? "Nenhuma OS encontrada com os filtros aplicados"
                  : "Nenhuma OS registrada"
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {jobsTodosFiltrados.map((job) => (
                <JobCard key={job.job_id} job={job} onVerFotos={abrirFotos} onChecklist={abrirChecklist} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ABA: ORDENS ERP */}
        <TabsContent value="ordens" className="mt-4">
          {loadingOrdens ? (
            <LoadingState />
          ) : ordensErp.length === 0 ? (
            <EmptyState mensagem="Nenhuma ordem de instalação registrada no ERP" />
          ) : (
            <div className="space-y-3">
              {ordensErp.map((os) => {
                const isConcluida = os.status === "concluida";
                const isCancelada = os.status === "cancelada";
                const statusConfig: Record<string, { label: string; cls: string }> = {
                  aguardando_agendamento: { label: "Aguardando Agendamento", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                  agendada:               { label: "Agendada",               cls: "bg-blue-50 text-blue-700 border-blue-200" },
                  em_execucao:            { label: "Em Execução",            cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
                  concluida:              { label: "Concluída",              cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  cancelada:              { label: "Cancelada",              cls: "bg-slate-50 text-slate-500 border-slate-200" },
                };
                const sc = statusConfig[os.status] ?? { label: os.status, cls: "bg-slate-50 text-slate-600 border-slate-200" };

                return (
                  <Card key={os.id} className="border-none shadow-sm rounded-2xl bg-white">
                    <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                          <Wrench size={16} className="text-orange-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">
                            Pedido {os.pedidos?.numero ?? "—"}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            {os.data_agendada && (
                              <span className="flex items-center gap-1">
                                <CalendarDays size={11} />
                                {new Date(os.data_agendada + "T00:00:00").toLocaleDateString("pt-BR")}
                              </span>
                            )}
                            <span className="text-slate-300">·</span>
                            <span>Status pedido: {os.pedidos?.status ?? "—"}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.cls}`}>
                          {sc.label}
                        </span>
                        {!isConcluida && !isCancelada && (
                          <Button
                            size="sm"
                            className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                            disabled={concluirInstalacao.isPending}
                            onClick={() => concluirInstalacao.mutate(os)}
                          >
                            <CheckCircle2 size={13} />
                            Concluir
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Sheet de Fotos */}
      <FotosSheet
        job={jobSelecionado}
        open={sheetFotosAberta}
        onClose={() => setSheetFotosAberta(false)}
      />

      {/* Sheet de Checklist */}
      <ChecklistSheet
        job={jobChecklist}
        open={sheetChecklistAberta}
        onClose={() => setSheetChecklistAberta(false)}
      />
    </div>
  );
}

// ============================================================
// ESTADOS AUXILIARES
// ============================================================

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="p-5 space-y-3">
            <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-2/3" />
            <div className="h-3 bg-slate-100 rounded-lg animate-pulse w-1/2" />
            <div className="h-3 bg-slate-100 rounded-lg animate-pulse w-3/4" />
            <div className="h-3 bg-slate-100 rounded-lg animate-pulse w-1/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ mensagem }: { mensagem: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Wrench size={24} className="opacity-40" />
      </div>
      <p className="text-sm font-medium">{mensagem}</p>
      <p className="text-xs mt-1 text-slate-300">
        O painel atualiza automaticamente em tempo real
      </p>
    </div>
  );
}

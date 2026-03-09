import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { brl } from "@/shared/utils/format";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Wrench,
  Plus,
  CalendarDays,
  List,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Users,
  Truck,
  Play,
  Pause,
  RotateCcw,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Edit,
  Trash2,
  Eye,
  ArrowRight,
  Calendar,
  ClipboardList,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type OrdemStatus =
  | "aguardando_agendamento"
  | "agendada"
  | "equipe_em_deslocamento"
  | "em_execucao"
  | "pendente"
  | "reagendada"
  | "concluida"
  | "nao_concluida";

interface OrdemInstalacao {
  id: string;
  numero: string | null;
  pedido_id: string;
  pedido_item_id: string | null;
  cliente_id: string;
  unidade_id: string | null;
  equipe_id: string | null;
  status: OrdemStatus;
  data_agendada: string | null;
  hora_prevista: string | null;
  data_execucao: string | null;
  endereco_completo: string | null;
  instrucoes: string | null;
  materiais_necessarios: string | null;
  custo_logistico: number | null;
  observacoes: string | null;
  motivo_reagendamento: string | null;
  created_at: string;
  updated_at: string;
  clientes: { nome_fantasia: string | null; razao_social: string } | null;
  cliente_unidades: { nome: string | null; cidade: string | null; estado: string | null } | null;
  equipes: { nome: string } | null;
  pedidos: { numero: string | null } | null;
}

interface Equipe {
  id: string;
  nome: string;
  tipo: string | null;
  regiao: string | null;
  ativo: boolean;
  created_at: string;
}

interface Pedido {
  id: string;
  numero: string | null;
  cliente_id: string;
  status: string;
  valor_total: number | null;
  clientes: { nome_fantasia: string | null; razao_social: string } | null;
}

interface Unidade {
  id: string;
  cliente_id: string;
  nome: string | null;
  cidade: string | null;
  estado: string | null;
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<OrdemStatus, { label: string; color: string; icon: React.ElementType }> = {
  aguardando_agendamento: {
    label: "Aguardando Agendamento",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: Clock,
  },
  agendada: {
    label: "Agendada",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: CalendarDays,
  },
  equipe_em_deslocamento: {
    label: "Em Deslocamento",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Truck,
  },
  em_execucao: {
    label: "Em Execucao",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
    icon: Play,
  },
  pendente: {
    label: "Pendente",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
    icon: Pause,
  },
  reagendada: {
    label: "Reagendada",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: RotateCcw,
  },
  concluida: {
    label: "Concluida",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  nao_concluida: {
    label: "Nao Concluida",
    color: "bg-red-50 text-red-600 border-red-200",
    icon: XCircle,
  },
};

const ALL_STATUSES: OrdemStatus[] = [
  "aguardando_agendamento",
  "agendada",
  "equipe_em_deslocamento",
  "em_execucao",
  "pendente",
  "reagendada",
  "concluida",
  "nao_concluida",
];

// Status transition map
const STATUS_TRANSITIONS: Record<OrdemStatus, OrdemStatus[]> = {
  aguardando_agendamento: ["agendada"],
  agendada: ["equipe_em_deslocamento", "reagendada"],
  equipe_em_deslocamento: ["em_execucao"],
  em_execucao: ["concluida", "nao_concluida", "pendente"],
  pendente: ["em_execucao", "reagendada", "nao_concluida"],
  reagendada: ["agendada"],
  concluida: [],
  nao_concluida: ["reagendada"],
};

// ============================================================================
// HELPERS
// ============================================================================

function getWeekDays(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - ((day === 0 ? 7 : day) - 1));
  monday.setHours(0, 0, 0, 0);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
}

function formatDayName(date: Date): string {
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

function formatDayShort(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function isSameDay(d1: Date, d2str: string | null): boolean {
  if (!d2str) return false;
  const d2 = new Date(d2str + "T00:00:00");
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function generateNumero(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `INST-${year}-${seq}`;
}

// ============================================================================
// KPI CARD
// ============================================================================

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
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">{label}</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight">{value}</p>
          {sub && <p className={`text-xs mt-0.5 font-medium ${subColor ?? "text-slate-400"}`}>{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STATUS BADGE
// ============================================================================

function StatusBadge({ status }: { status: OrdemStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ============================================================================
// WEEKLY CALENDAR VIEW
// ============================================================================

function WeeklyCalendar({
  ordens,
  weekStart,
  onPrevWeek,
  onNextWeek,
  onToday,
  onClickOrdem,
}: {
  ordens: OrdemInstalacao[];
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onClickOrdem: (ordem: OrdemInstalacao) => void;
}) {
  const days = getWeekDays(weekStart);

  const weekLabel = `${formatDayShort(days[0])} - ${formatDayShort(days[6])}`;

  return (
    <div className="space-y-4">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl h-9" onClick={onPrevWeek}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl h-9" onClick={onToday}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl h-9" onClick={onNextWeek}>
            <ChevronRight size={16} />
          </Button>
        </div>
        <span className="text-sm font-semibold text-slate-600">{weekLabel}</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayOrdens = ordens.filter((o) => isSameDay(day, o.data_agendada));
          const today = isToday(day);
          const isSunday = day.getDay() === 0;

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[140px] rounded-xl border p-2 flex flex-col ${
                today
                  ? "border-blue-300 bg-blue-50/40"
                  : isSunday
                  ? "border-slate-100 bg-slate-50/50"
                  : "border-slate-100 bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wide ${today ? "text-blue-600" : "text-slate-400"}`}>
                  {formatDayName(day)}
                </span>
                <span className={`text-sm font-bold ${today ? "text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md" : "text-slate-500"}`}>
                  {day.getDate()}
                </span>
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px]">
                {dayOrdens.map((ordem) => {
                  const cfg = STATUS_CONFIG[ordem.status as OrdemStatus] ?? STATUS_CONFIG.aguardando_agendamento;
                  return (
                    <button
                      key={ordem.id}
                      onClick={() => onClickOrdem(ordem)}
                      className={`w-full text-left p-2 rounded-lg border transition-all hover:shadow-sm cursor-pointer ${cfg.color}`}
                    >
                      <p className="text-[11px] font-bold truncate">{ordem.numero}</p>
                      <p className="text-[10px] truncate opacity-80">
                        {ordem.clientes?.nome_fantasia ?? ordem.clientes?.razao_social ?? "-"}
                      </p>
                      {ordem.cliente_unidades?.cidade && (
                        <p className="text-[9px] truncate opacity-60 flex items-center gap-0.5">
                          <MapPin size={8} />
                          {ordem.cliente_unidades.cidade}/{ordem.cliente_unidades.estado}
                        </p>
                      )}
                      {ordem.equipes?.nome && (
                        <p className="text-[9px] truncate opacity-60 flex items-center gap-0.5 mt-0.5">
                          <Users size={8} />
                          {ordem.equipes.nome}
                        </p>
                      )}
                    </button>
                  );
                })}

                {dayOrdens.length === 0 && !isSunday && (
                  <p className="text-[10px] text-slate-300 text-center pt-4">Sem instalacoes</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// LIST VIEW
// ============================================================================

function OrdemListView({
  ordens,
  onClickOrdem,
}: {
  ordens: OrdemInstalacao[];
  onClickOrdem: (ordem: OrdemInstalacao) => void;
}) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Numero</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">Unidade</th>
              <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Data</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Equipe</th>
              <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ordens.map((ordem) => (
              <tr key={ordem.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-mono text-xs font-bold text-slate-700">{ordem.numero}</span>
                </td>
                <td className="px-4 py-4 font-semibold text-slate-800 max-w-[180px] truncate">
                  {ordem.clientes?.nome_fantasia ?? ordem.clientes?.razao_social ?? "-"}
                </td>
                <td className="px-4 py-4 hidden md:table-cell">
                  <span className="text-xs text-slate-500">
                    {ordem.cliente_unidades
                      ? `${ordem.cliente_unidades.nome ?? ""} - ${ordem.cliente_unidades.cidade ?? ""}/${ordem.cliente_unidades.estado ?? ""}`
                      : "-"}
                  </span>
                </td>
                <td className="px-4 py-4 text-center text-sm text-slate-600">
                  {formatDateBR(ordem.data_agendada)}
                  {ordem.hora_prevista && (
                    <span className="block text-xs text-slate-400">{ordem.hora_prevista.slice(0, 5)}</span>
                  )}
                </td>
                <td className="px-4 py-4 hidden lg:table-cell">
                  <span className="text-xs text-slate-500">{ordem.equipes?.nome ?? "-"}</span>
                </td>
                <td className="px-4 py-4 text-center">
                  <StatusBadge status={ordem.status as OrdemStatus} />
                </td>
                <td className="px-6 py-4 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    onClick={() => onClickOrdem(ordem)}
                  >
                    <Eye size={15} />
                  </Button>
                </td>
              </tr>
            ))}

            {ordens.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  <ClipboardList className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                  <p className="font-medium">Nenhuma ordem encontrada</p>
                  <p className="text-xs">Ajuste os filtros ou crie uma nova ordem.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================================
// CREATE ORDEM DIALOG
// ============================================================================

interface CreateOrdemForm {
  pedido_id: string;
  unidade_id: string;
  equipe_id: string;
  data_agendada: string;
  hora_prevista: string;
  endereco_completo: string;
  instrucoes: string;
  materiais_necessarios: string;
}

const EMPTY_CREATE_FORM: CreateOrdemForm = {
  pedido_id: "",
  unidade_id: "",
  equipe_id: "",
  data_agendada: "",
  hora_prevista: "",
  endereco_completo: "",
  instrucoes: "",
  materiais_necessarios: "",
};

function CreateOrdemDialog({
  open,
  onOpenChange,
  pedidos,
  equipes,
  unidades,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidos: Pedido[];
  equipes: Equipe[];
  unidades: Unidade[];
  onSave: (form: CreateOrdemForm) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CreateOrdemForm>(EMPTY_CREATE_FORM);

  const selectedPedido = pedidos.find((p) => p.id === form.pedido_id);
  const filteredUnidades = unidades.filter(
    (u) => selectedPedido && u.cliente_id === selectedPedido.cliente_id
  );

  const setField = <K extends keyof CreateOrdemForm>(key: K, val: CreateOrdemForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!form.pedido_id) {
      showError("Selecione um pedido.");
      return;
    }
    onSave(form);
    setForm(EMPTY_CREATE_FORM);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Wrench size={20} className="text-blue-600" />
            Nova Ordem de Instalacao
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Pedido */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Pedido *</Label>
            <Select value={form.pedido_id} onValueChange={(v) => setField("pedido_id", v)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                <SelectValue placeholder="Selecionar pedido..." />
              </SelectTrigger>
              <SelectContent>
                {pedidos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.numero} - {p.clientes?.nome_fantasia ?? p.clientes?.razao_social ?? ""}
                    {p.valor_total ? ` (${brl(p.valor_total)})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unidade */}
          {selectedPedido && filteredUnidades.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Unidade do Cliente</Label>
              <Select value={form.unidade_id} onValueChange={(v) => setField("unidade_id", v)}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                  <SelectValue placeholder="Selecionar unidade..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredUnidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome ?? "Unidade"} - {u.cidade}/{u.estado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Equipe */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Equipe</Label>
            <Select value={form.equipe_id} onValueChange={(v) => setField("equipe_id", v)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                <SelectValue placeholder="Selecionar equipe..." />
              </SelectTrigger>
              <SelectContent>
                {equipes.filter((e) => e.ativo).map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.nome} {eq.regiao ? `(${eq.regiao})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Data e hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Data Agendada</Label>
              <Input
                type="date"
                value={form.data_agendada}
                onChange={(e) => setField("data_agendada", e.target.value)}
                className="h-11 rounded-xl border-slate-200 bg-slate-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Hora Prevista</Label>
              <Input
                type="time"
                value={form.hora_prevista}
                onChange={(e) => setField("hora_prevista", e.target.value)}
                className="h-11 rounded-xl border-slate-200 bg-slate-50"
              />
            </div>
          </div>

          {/* Endereco */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Endereco Completo</Label>
            <Textarea
              value={form.endereco_completo}
              onChange={(e) => setField("endereco_completo", e.target.value)}
              placeholder="Rua, numero, bairro, cidade - UF, CEP"
              rows={2}
              className="rounded-xl border-slate-200 bg-slate-50 resize-none"
            />
          </div>

          {/* Instrucoes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Instrucoes para a equipe</Label>
            <Textarea
              value={form.instrucoes}
              onChange={(e) => setField("instrucoes", e.target.value)}
              placeholder="Detalhes sobre a instalacao, acessos, contato local..."
              rows={3}
              className="rounded-xl border-slate-200 bg-slate-50 resize-none"
            />
          </div>

          {/* Materiais */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Materiais Necessarios</Label>
            <Textarea
              value={form.materiais_necessarios}
              onChange={(e) => setField("materiais_necessarios", e.target.value)}
              placeholder="Lista de materiais que a equipe deve levar..."
              rows={2}
              className="rounded-xl border-slate-200 bg-slate-50 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.pedido_id}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl min-w-[140px]"
          >
            {saving ? "Salvando..." : "Criar Ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DETAIL DIALOG
// ============================================================================

function DetailDialog({
  ordem,
  open,
  onOpenChange,
  onStatusChange,
  updating,
}: {
  ordem: OrdemInstalacao | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStatusChange: (ordemId: string, newStatus: OrdemStatus, motivo?: string) => void;
  updating: boolean;
}) {
  const [showReagendamento, setShowReagendamento] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (!ordem) return null;

  const currentStatus = ordem.status as OrdemStatus;
  const transitions = STATUS_TRANSITIONS[currentStatus] || [];

  const handleTransition = (newStatus: OrdemStatus) => {
    if (newStatus === "reagendada") {
      setShowReagendamento(true);
      return;
    }
    onStatusChange(ordem.id, newStatus);
  };

  const handleReagendar = () => {
    if (!motivo.trim()) {
      showError("Informe o motivo do reagendamento.");
      return;
    }
    onStatusChange(ordem.id, "reagendada", motivo);
    setShowReagendamento(false);
    setMotivo("");
  };

  const clienteName = ordem.clientes?.nome_fantasia ?? ordem.clientes?.razao_social ?? "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-slate-800">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Wrench size={20} className="text-blue-600" />
            </div>
            <div>
              <span className="font-mono text-sm text-slate-500 block">{ordem.numero}</span>
              <span className="text-lg">{clienteName}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Status */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Status atual:</span>
            <StatusBadge status={currentStatus} />
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase">Pedido</p>
              <p className="text-sm font-semibold text-slate-700 font-mono">
                {ordem.pedidos?.numero ?? "-"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase">Equipe</p>
              <p className="text-sm font-semibold text-slate-700">{ordem.equipes?.nome ?? "Nao atribuida"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase">Data Agendada</p>
              <p className="text-sm font-semibold text-slate-700">{formatDateBR(ordem.data_agendada)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase">Hora Prevista</p>
              <p className="text-sm font-semibold text-slate-700">
                {ordem.hora_prevista ? ordem.hora_prevista.slice(0, 5) : "-"}
              </p>
            </div>
          </div>

          {/* Unidade */}
          {ordem.cliente_unidades && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase">Unidade</p>
              <p className="text-sm text-slate-700">
                {ordem.cliente_unidades.nome ?? ""}
                {ordem.cliente_unidades.cidade ? ` - ${ordem.cliente_unidades.cidade}/${ordem.cliente_unidades.estado}` : ""}
              </p>
            </div>
          )}

          {/* Endereco */}
          {ordem.endereco_completo && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase flex items-center gap-1">
                <MapPin size={11} /> Endereco
              </p>
              <p className="text-sm text-slate-700">{ordem.endereco_completo}</p>
            </div>
          )}

          <Separator />

          {/* Instrucoes */}
          {ordem.instrucoes && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase">Instrucoes</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-xl p-3 border border-slate-100">
                {ordem.instrucoes}
              </p>
            </div>
          )}

          {/* Materiais */}
          {ordem.materiais_necessarios && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase">Materiais Necessarios</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-xl p-3 border border-slate-100">
                {ordem.materiais_necessarios}
              </p>
            </div>
          )}

          {/* Custo logistico */}
          {ordem.custo_logistico != null && ordem.custo_logistico > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase">Custo Logistico</p>
              <p className="text-sm font-bold text-slate-700">{brl(ordem.custo_logistico)}</p>
            </div>
          )}

          {/* Observacoes */}
          {ordem.observacoes && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase">Observacoes</p>
              <p className="text-sm text-slate-600">{ordem.observacoes}</p>
            </div>
          )}

          {/* Motivo reagendamento */}
          {ordem.motivo_reagendamento && (
            <div className="space-y-1">
              <p className="text-xs text-red-400 font-medium uppercase">Motivo Reagendamento</p>
              <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3 border border-red-100">
                {ordem.motivo_reagendamento}
              </p>
            </div>
          )}

          {/* Data Execucao */}
          {ordem.data_execucao && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase">Data Execucao</p>
              <p className="text-sm font-semibold text-emerald-700">{formatDateBR(ordem.data_execucao)}</p>
            </div>
          )}

          <Separator />

          {/* Workflow buttons */}
          {transitions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Acoes de Status</p>

              {showReagendamento ? (
                <div className="space-y-3 bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <p className="text-sm font-semibold text-purple-800">Reagendamento</p>
                  <Textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Motivo do reagendamento (obrigatorio)..."
                    rows={2}
                    className="rounded-xl border-purple-200 bg-white resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => {
                        setShowReagendamento(false);
                        setMotivo("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                      onClick={handleReagendar}
                      disabled={updating || !motivo.trim()}
                    >
                      <RotateCcw size={14} className="mr-1" />
                      Confirmar Reagendamento
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {transitions.map((newStatus) => {
                    const cfg = STATUS_CONFIG[newStatus];
                    const Icon = cfg.icon;
                    return (
                      <Button
                        key={newStatus}
                        size="sm"
                        variant="outline"
                        className={`rounded-xl text-xs font-semibold ${cfg.color}`}
                        onClick={() => handleTransition(newStatus)}
                        disabled={updating}
                      >
                        <Icon size={14} className="mr-1.5" />
                        {cfg.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historico</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <span>Criada em {new Date(ordem.created_at).toLocaleDateString("pt-BR")} {new Date(ordem.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {ordem.data_agendada && (
                <div className="flex items-center gap-3 text-xs text-blue-600">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Agendada para {formatDateBR(ordem.data_agendada)}</span>
                </div>
              )}
              {ordem.motivo_reagendamento && (
                <div className="flex items-center gap-3 text-xs text-purple-600">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>Reagendada: {ordem.motivo_reagendamento}</span>
                </div>
              )}
              {ordem.data_execucao && (
                <div className="flex items-center gap-3 text-xs text-emerald-600">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Executada em {formatDateBR(ordem.data_execucao)}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full bg-slate-200" />
                <span>Ultima atualizacao: {new Date(ordem.updated_at).toLocaleDateString("pt-BR")} {new Date(ordem.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// EQUIPES TAB
// ============================================================================

interface EquipeForm {
  nome: string;
  tipo: string;
  regiao: string;
  ativo: boolean;
}

const EMPTY_EQUIPE_FORM: EquipeForm = { nome: "", tipo: "", regiao: "", ativo: true };

function EquipesTab({
  equipes,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  saving,
}: {
  equipes: Equipe[];
  isLoading: boolean;
  onCreate: (form: EquipeForm) => void;
  onUpdate: (id: string, form: EquipeForm) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EquipeForm>(EMPTY_EQUIPE_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_EQUIPE_FORM);
    setDialogOpen(true);
  };

  const openEdit = (eq: Equipe) => {
    setEditingId(eq.id);
    setForm({
      nome: eq.nome,
      tipo: eq.tipo ?? "",
      regiao: eq.regiao ?? "",
      ativo: eq.ativo,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.nome.trim()) {
      showError("Nome da equipe e obrigatorio.");
      return;
    }
    if (editingId) {
      onUpdate(editingId, form);
    } else {
      onCreate(form);
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const setField = <K extends keyof EquipeForm>(key: K, val: EquipeForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {equipes.length} equipe{equipes.length !== 1 ? "s" : ""} cadastrada{equipes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-4 shadow-sm">
          <Plus size={18} className="mr-2" />
          Nova Equipe
        </Button>
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">Regiao</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {equipes.map((eq) => (
                <tr key={eq.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">{eq.nome}</td>
                  <td className="px-4 py-4 text-slate-500 hidden sm:table-cell">{eq.tipo ?? "-"}</td>
                  <td className="px-4 py-4 text-slate-500 hidden md:table-cell">{eq.regiao ?? "-"}</td>
                  <td className="px-4 py-4 text-center">
                    <span
                      className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        eq.ativo
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {eq.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        onClick={() => openEdit(eq)}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        onClick={() => setDeleteId(eq.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {equipes.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <Users className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                    <p className="font-medium">Nenhuma equipe cadastrada</p>
                    <p className="text-xs">Crie a primeira equipe de instalacao.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Users size={20} className="text-blue-600" />
              {editingId ? "Editar Equipe" : "Nova Equipe"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                placeholder="Ex: Equipe A - Porto Alegre"
                className="h-11 rounded-xl border-slate-200 bg-slate-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Tipo</Label>
              <Select value={form.tipo || "_none"} onValueChange={(v) => setField("tipo", v === "_none" ? "" : v)}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                  <SelectValue placeholder="Selecionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  <SelectItem value="interna">Interna</SelectItem>
                  <SelectItem value="terceirizada">Terceirizada</SelectItem>
                  <SelectItem value="mista">Mista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Regiao</Label>
              <Input
                value={form.regiao}
                onChange={(e) => setField("regiao", e.target.value)}
                placeholder="Ex: Grande Porto Alegre, Serra Gaucha"
                className="h-11 rounded-xl border-slate-200 bg-slate-50"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label className="text-sm font-semibold text-slate-700">Equipe ativa</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => setField("ativo", v)} />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.nome.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl min-w-[120px]"
            >
              {editingId ? "Salvar" : "Criar Equipe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Trash2 size={18} className="text-red-500" />
              Excluir Equipe
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            Tem certeza que deseja excluir{" "}
            <strong>{equipes.find((e) => e.id === deleteId)?.nome ?? "esta equipe"}</strong>?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function InstalacaoPage() {
  const queryClient = useQueryClient();

  // ── State ────────────────────────────────────
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [weekStart, setWeekStart] = useState(() => new Date());
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterEquipe, setFilterEquipe] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOrdem, setDetailOrdem] = useState<OrdemInstalacao | null>(null);

  // ── Queries ──────────────────────────────────

  const { data: ordensRaw = [], isLoading: loadingOrdens } = useQuery({
    queryKey: ["ordens_instalacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_instalacao")
        .select("*, clientes(nome_fantasia, razao_social), cliente_unidades(nome, cidade, estado), equipes(nome), pedidos(numero)")
        .order("data_agendada", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrdemInstalacao[];
    },
  });

  const { data: equipes = [], isLoading: loadingEquipes } = useQuery({
    queryKey: ["equipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipes")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Equipe[];
    },
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos_para_instalacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero, cliente_id, status, valor_total, clientes(nome_fantasia, razao_social)")
        .in("status", ["aprovado", "em_producao", "produzido", "pronto"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Pedido[];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["cliente_unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_unidades")
        .select("id, cliente_id, nome, cidade, estado")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Unidade[];
    },
  });

  // ── Mutations ────────────────────────────────

  const createOrdemMutation = useMutation({
    mutationFn: async (form: CreateOrdemForm) => {
      const selectedPedido = pedidos.find((p) => p.id === form.pedido_id);
      const payload = {
        numero: generateNumero(),
        pedido_id: form.pedido_id,
        cliente_id: selectedPedido?.cliente_id ?? "",
        unidade_id: form.unidade_id || null,
        equipe_id: form.equipe_id || null,
        status: "aguardando_agendamento" as const,
        data_agendada: form.data_agendada || null,
        hora_prevista: form.hora_prevista || null,
        endereco_completo: form.endereco_completo || null,
        instrucoes: form.instrucoes || null,
        materiais_necessarios: form.materiais_necessarios || null,
      };

      if (form.data_agendada && form.equipe_id) {
        (payload as Record<string, unknown>).status = "agendada";
      }

      const { error } = await supabase.from("ordens_instalacao").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens_instalacao"] });
      setCreateOpen(false);
      showSuccess("Ordem de instalacao criada com sucesso.");
    },
    onError: (err: Error) => {
      showError(`Erro ao criar ordem: ${err.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      ordemId,
      newStatus,
      motivo,
    }: {
      ordemId: string;
      newStatus: OrdemStatus;
      motivo?: string;
    }) => {
      const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
      if (motivo) updates.motivo_reagendamento = motivo;
      if (newStatus === "em_execucao") updates.data_execucao = new Date().toISOString().split("T")[0];
      if (newStatus === "concluida") updates.data_execucao = new Date().toISOString().split("T")[0];

      const { error } = await supabase.from("ordens_instalacao").update(updates).eq("id", ordemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens_instalacao"] });
      setDetailOrdem(null);
      showSuccess("Status atualizado com sucesso.");
    },
    onError: (err: Error) => {
      showError(`Erro ao atualizar: ${err.message}`);
    },
  });

  const createEquipeMutation = useMutation({
    mutationFn: async (form: EquipeForm) => {
      const { error } = await supabase.from("equipes").insert({
        nome: form.nome,
        tipo: form.tipo || null,
        regiao: form.regiao || null,
        ativo: form.ativo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipes"] });
      showSuccess("Equipe criada com sucesso.");
    },
    onError: (err: Error) => {
      showError(`Erro ao criar equipe: ${err.message}`);
    },
  });

  const updateEquipeMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: EquipeForm }) => {
      const { error } = await supabase
        .from("equipes")
        .update({
          nome: form.nome,
          tipo: form.tipo || null,
          regiao: form.regiao || null,
          ativo: form.ativo,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipes"] });
      showSuccess("Equipe atualizada.");
    },
    onError: (err: Error) => {
      showError(`Erro ao atualizar equipe: ${err.message}`);
    },
  });

  const deleteEquipeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipes"] });
      showSuccess("Equipe removida.");
    },
    onError: (err: Error) => {
      showError(`Erro ao remover equipe: ${err.message}`);
    },
  });

  // ── Filtered/derived data ──────────────────────

  const ordens = useMemo(() => {
    let list = ordensRaw;

    if (filterStatus !== "todos") {
      list = list.filter((o) => o.status === filterStatus);
    }

    if (filterEquipe !== "todos") {
      list = list.filter((o) => o.equipe_id === filterEquipe);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (o) =>
          (o.numero ?? "").toLowerCase().includes(term) ||
          (o.clientes?.nome_fantasia ?? "").toLowerCase().includes(term) ||
          (o.clientes?.razao_social ?? "").toLowerCase().includes(term) ||
          (o.cliente_unidades?.cidade ?? "").toLowerCase().includes(term)
      );
    }

    return list;
  }, [ordensRaw, filterStatus, filterEquipe, searchTerm]);

  // KPI counts
  const aguardandoCount = ordensRaw.filter((o) => o.status === "aguardando_agendamento").length;
  const agendadasCount = ordensRaw.filter(
    (o) => o.status === "agendada" || o.status === "equipe_em_deslocamento"
  ).length;
  const emExecucaoCount = ordensRaw.filter((o) => o.status === "em_execucao").length;

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const concluidasMes = ordensRaw.filter(
    (o) => o.status === "concluida" && o.data_execucao && new Date(o.data_execucao + "T00:00:00") >= firstOfMonth
  ).length;

  // Week navigation
  const prevWeek = () => setWeekStart((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  const nextWeek = () => setWeekStart((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });
  const goToday = () => setWeekStart(new Date());

  // ── Render ─────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Wrench size={20} className="text-blue-600" />
            </div>
            Instalacoes
          </h1>
          <p className="text-slate-500 mt-1 ml-1">
            Gestao de ordens de instalacao e equipes de campo
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
        >
          <Plus size={20} className="mr-2" />
          Nova Ordem
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="agenda" className="space-y-6">
        <TabsList className="bg-white shadow-sm rounded-2xl p-1.5 border border-slate-100 h-auto flex gap-1 w-full md:w-auto">
          {[
            { value: "agenda", label: "Agenda", icon: Calendar },
            { value: "equipes", label: "Equipes", icon: Users },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-1 md:flex-none flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 transition-all"
            >
              <Icon size={16} />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Tab: Agenda ── */}
        <TabsContent value="agenda" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Aguardando Agendamento"
              value={aguardandoCount}
              icon={Clock}
              iconBg="bg-slate-100"
              iconColor="text-slate-500"
              sub="ordens sem data"
              subColor="text-slate-400"
            />
            <KpiCard
              label="Agendadas"
              value={agendadasCount}
              icon={CalendarDays}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              sub="agendadas + em deslocamento"
              subColor="text-blue-500"
            />
            <KpiCard
              label="Em Execucao"
              value={emExecucaoCount}
              icon={Play}
              iconBg="bg-cyan-50"
              iconColor="text-cyan-600"
              sub="em andamento agora"
              subColor="text-cyan-500"
            />
            <KpiCard
              label="Concluidas no Mes"
              value={concluidasMes}
              icon={CheckCircle2}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              sub={`${now.toLocaleDateString("pt-BR", { month: "long" })} ${now.getFullYear()}`}
              subColor="text-emerald-500"
            />
          </div>

          {/* View toggle + filters */}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-white rounded-xl border border-slate-100 shadow-sm p-1">
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "calendar" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <CalendarDays size={14} /> Agenda
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === "list" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <List size={14} /> Lista
              </button>
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input
                placeholder="Buscar numero, cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-slate-200 bg-white h-10 shadow-sm text-sm"
              />
            </div>

            {/* Status filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48 rounded-xl border-slate-200 bg-white shadow-sm h-10 text-sm">
                <SelectValue placeholder="Filtrar status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Equipe filter */}
            <Select value={filterEquipe} onValueChange={setFilterEquipe}>
              <SelectTrigger className="w-48 rounded-xl border-slate-200 bg-white shadow-sm h-10 text-sm">
                <SelectValue placeholder="Filtrar equipe..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as equipes</SelectItem>
                {equipes.filter((e) => e.ativo).map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loading */}
          {loadingOrdens ? (
            <div className="text-center py-16">
              <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-400 mt-3">Carregando ordens...</p>
            </div>
          ) : viewMode === "calendar" ? (
            <WeeklyCalendar
              ordens={ordens}
              weekStart={weekStart}
              onPrevWeek={prevWeek}
              onNextWeek={nextWeek}
              onToday={goToday}
              onClickOrdem={setDetailOrdem}
            />
          ) : (
            <OrdemListView ordens={ordens} onClickOrdem={setDetailOrdem} />
          )}
        </TabsContent>

        {/* ── Tab: Equipes ── */}
        <TabsContent value="equipes">
          <EquipesTab
            equipes={equipes}
            isLoading={loadingEquipes}
            onCreate={(form) => createEquipeMutation.mutate(form)}
            onUpdate={(id, form) => updateEquipeMutation.mutate({ id, form })}
            onDelete={(id) => deleteEquipeMutation.mutate(id)}
            saving={createEquipeMutation.isPending || updateEquipeMutation.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* Create Ordem Dialog */}
      <CreateOrdemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        pedidos={pedidos}
        equipes={equipes}
        unidades={unidades}
        onSave={(form) => createOrdemMutation.mutate(form)}
        saving={createOrdemMutation.isPending}
      />

      {/* Detail Dialog */}
      <DetailDialog
        ordem={detailOrdem}
        open={detailOrdem !== null}
        onOpenChange={(open) => { if (!open) setDetailOrdem(null); }}
        onStatusChange={(ordemId, newStatus, motivo) =>
          updateStatusMutation.mutate({ ordemId, newStatus, motivo })
        }
        updating={updateStatusMutation.isPending}
      />
    </div>
  );
}

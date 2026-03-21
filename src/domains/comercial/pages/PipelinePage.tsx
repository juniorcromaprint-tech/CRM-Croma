import { useState, useCallback, useRef, type DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { brl } from "@/shared/utils/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  TrendingUp,
  Users,
  DollarSign,
  Target,
  Clock,
  Phone,
  Mail,
  Building2,
  CalendarDays,
  GripVertical,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type LeadStatus = "novo" | "em_contato" | "qualificando" | "qualificado" | "descartado";
type LeadTemperatura = "frio" | "morno" | "quente";

interface Lead {
  id: string;
  empresa: string;
  contato_nome: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  telefone: string | null;
  email: string | null;
  cargo: string | null;
  segmento: string | null;
  origem_id: string | null;
  vendedor_id: string | null;
  status: LeadStatus;
  temperatura: LeadTemperatura;
  valor_estimado: number | null;
  score: number | null;
  motivo_descarte: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Stage Configuration ────────────────────────────────────────────────────

interface StageConfig {
  status: LeadStatus;
  label: string;
  color: string;
  dotColor: string;
  bgActive: string;
}

const STAGES: StageConfig[] = [
  {
    status: "novo",
    label: "Novos",
    color: "bg-blue-50 border-blue-200",
    dotColor: "bg-blue-500",
    bgActive: "ring-blue-400 bg-blue-50/50",
  },
  {
    status: "em_contato",
    label: "Em Contato",
    color: "bg-yellow-50 border-yellow-200",
    dotColor: "bg-yellow-500",
    bgActive: "ring-yellow-400 bg-yellow-50/50",
  },
  {
    status: "qualificando",
    label: "Qualificando",
    color: "bg-orange-50 border-orange-200",
    dotColor: "bg-orange-500",
    bgActive: "ring-orange-400 bg-orange-50/50",
  },
  {
    status: "qualificado",
    label: "Qualificados",
    color: "bg-emerald-50 border-emerald-200",
    dotColor: "bg-emerald-500",
    bgActive: "ring-emerald-400 bg-emerald-50/50",
  },
  {
    status: "descartado",
    label: "Descartados",
    color: "bg-slate-50 border-slate-300",
    dotColor: "bg-slate-400",
    bgActive: "ring-slate-400 bg-slate-50/50",
  },
];

const STAGE_INDEX: Record<LeadStatus, number> = {
  novo: 0,
  em_contato: 1,
  qualificando: 2,
  qualificado: 3,
  descartado: 4,
};

// ─── Temperature Config ─────────────────────────────────────────────────────

import { TEMPERATURA_CONFIG } from "../constants/temperatura";

// ─── Status Transition Rules ────────────────────────────────────────────────

function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return false;
  // Can always be discarded
  if (to === "descartado") return true;
  // From discarded, can only go back to adjacent stages or novo
  if (from === "descartado") return to === "novo";
  // Otherwise, only adjacent stages
  const fromIdx = STAGE_INDEX[from];
  const toIdx = STAGE_INDEX[to];
  return Math.abs(fromIdx - toIdx) === 1;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  const created = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function daysLabel(days: number): string {
  if (days === 0) return "Hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const dragCounterRef = useRef<Record<string, number>>({});

  // ─── Fetch all leads ─────────────────────────────────────────────────────

  const {
    data: leads = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["pipeline", "leads"],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw new Error(`Erro ao buscar leads: ${error.message}`);
      return (data ?? []) as Lead[];
    },
  });

  // ─── Update lead status mutation ──────────────────────────────────────────

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: LeadStatus;
    }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status })
        .eq("id", id);

      if (error) throw new Error(`Erro ao mover lead: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["comercial"] });
      showSuccess("Lead movido com sucesso");
    },
    onError: (err: Error) => {
      showError(err.message);
    },
  });

  // ─── Update lead notes mutation ───────────────────────────────────────────

  const updateNotes = useMutation({
    mutationFn: async ({
      id,
      observacoes,
    }: {
      id: string;
      observacoes: string;
    }) => {
      const { error } = await supabase
        .from("leads")
        .update({ observacoes })
        .eq("id", id);

      if (error)
        throw new Error(`Erro ao salvar observações: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      showSuccess("Observações salvas");
      setSelectedLead(null);
    },
    onError: (err: Error) => {
      showError(err.message);
    },
  });

  // ─── Filtered leads ───────────────────────────────────────────────────────

  const filteredLeads = leads.filter((lead) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      lead.empresa.toLowerCase().includes(term) ||
      (lead.contato_nome && lead.contato_nome.toLowerCase().includes(term))
    );
  });

  // ─── Leads grouped by stage ───────────────────────────────────────────────

  const leadsByStage: Record<LeadStatus, Lead[]> = {
    novo: [],
    em_contato: [],
    qualificando: [],
    qualificado: [],
    descartado: [],
  };

  for (const lead of filteredLeads) {
    if (leadsByStage[lead.status]) {
      leadsByStage[lead.status].push(lead);
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totalLeads = leads.filter((l) => l.status !== "descartado").length;
  const totalValor = leads
    .filter((l) => l.status !== "descartado")
    .reduce((sum, l) => sum + (l.valor_estimado ?? 0), 0);
  const convertidos = leads.filter((l) => l.status === "convertido").length;
  const conversionRate =
    leads.length > 0 ? ((convertidos / leads.length) * 100).toFixed(1) : "0.0";
  const ticketMedio = totalLeads > 0 ? totalValor / totalLeads : 0;

  // ─── Drag & Drop Handlers ────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, leadId: string) => {
      e.dataTransfer.setData("text/plain", leadId);
      e.dataTransfer.effectAllowed = "move";
      setDraggedLeadId(leadId);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedLeadId(null);
    setDragOverStage(null);
    dragCounterRef.current = {};
  }, []);

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>, stage: LeadStatus) => {
      e.preventDefault();
      const key = stage;
      dragCounterRef.current[key] = (dragCounterRef.current[key] || 0) + 1;
      setDragOverStage(stage);
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>, stage: LeadStatus) => {
      e.preventDefault();
      const key = stage;
      dragCounterRef.current[key] = (dragCounterRef.current[key] || 0) - 1;
      if (dragCounterRef.current[key] <= 0) {
        dragCounterRef.current[key] = 0;
        if (dragOverStage === stage) {
          setDragOverStage(null);
        }
      }
    },
    [dragOverStage]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, targetStage: LeadStatus) => {
      e.preventDefault();
      setDragOverStage(null);
      dragCounterRef.current = {};

      const leadId = e.dataTransfer.getData("text/plain");
      if (!leadId) return;

      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;

      if (lead.status === targetStage) return;

      if (!canTransition(lead.status, targetStage)) {
        showError(
          `Transição inválida: ${STAGES[STAGE_INDEX[lead.status]].label} → ${STAGES[STAGE_INDEX[targetStage]].label}. Mova apenas para estágios adjacentes.`
        );
        return;
      }

      updateStatus.mutate({ id: leadId, status: targetStage });
    },
    [leads, updateStatus]
  );

  // ─── Card click handler ───────────────────────────────────────────────────

  const handleCardClick = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setEditNotes(lead.observacoes ?? "");
  }, []);

  const handleSaveNotes = useCallback(() => {
    if (!selectedLead) return;
    updateNotes.mutate({ id: selectedLead.id, observacoes: editNotes });
  }, [selectedLead, editNotes, updateNotes]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-100 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-32 bg-slate-50 rounded-xl animate-pulse" />
              <div className="h-32 bg-slate-50 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <X size={48} className="mx-auto text-red-300 mb-3" />
          <h3 className="font-semibold text-slate-700 text-lg">
            Erro ao carregar pipeline
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Verifique sua conexão e tente novamente.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["pipeline"] })
            }
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Pipeline de Vendas
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Arraste os cards entre as colunas para atualizar o status
          </p>
        </div>
      </div>

      {/* ─── Stats Bar ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <DollarSign size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Valor Total
              </p>
              <p className="text-lg font-bold text-slate-800">
                {brl(totalValor)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Users size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Leads Ativos
              </p>
              <p className="text-lg font-bold text-slate-800">{totalLeads}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Target size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Conversão
              </p>
              <p className="text-lg font-bold text-slate-800">
                {conversionRate}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Ticket Médio
              </p>
              <p className="text-lg font-bold text-slate-800">
                {brl(ticketMedio)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search Bar ──────────────────────────────────────────── */}
      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <Input
          placeholder="Buscar por empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* ─── Kanban Board ────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4 min-h-[60vh]">
        {STAGES.map((stage) => {
          const stageLeads = leadsByStage[stage.status];
          const stageValor = stageLeads.reduce(
            (sum, l) => sum + (l.valor_estimado ?? 0),
            0
          );
          const isDragOver = dragOverStage === stage.status;

          return (
            <div
              key={stage.status}
              className={`
                flex flex-col rounded-2xl border transition-all duration-200
                ${stage.color}
                ${isDragOver ? `ring-2 ${stage.bgActive}` : ""}
              `}
              onDragEnter={(e) => handleDragEnter(e, stage.status)}
              onDragLeave={(e) => handleDragLeave(e, stage.status)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.status)}
            >
              {/* Column Header */}
              <div className="p-3 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${stage.dotColor}`}
                  />
                  <h3 className="font-semibold text-slate-700 text-sm">
                    {stage.label}
                  </h3>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-xs px-1.5 py-0 h-5 bg-white/60"
                  >
                    {stageLeads.length}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {brl(stageValor)}
                </p>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto p-2 pt-0 space-y-2 min-h-[200px]">
                {stageLeads.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                    {search ? "Sem resultados" : "Vazio"}
                  </div>
                ) : (
                  stageLeads.map((lead) => {
                    const days = daysSince(lead.created_at);
                    const tempCfg = TEMPERATURA_CONFIG[lead.temperatura] ?? TEMPERATURA_CONFIG.frio;
                    const TempIcon = tempCfg.icon;
                    const isDragging = draggedLeadId === lead.id;

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick(lead)}
                        className={`
                          bg-white rounded-2xl border border-slate-200 p-3 cursor-grab
                          hover:shadow-md transition-all duration-150 group
                          active:cursor-grabbing select-none
                          ${isDragging ? "opacity-50 rotate-2 shadow-lg" : "shadow-sm"}
                        `}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-800 text-sm truncate leading-tight">
                              {lead.empresa}
                            </h4>
                            {lead.contato_nome && (
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {lead.contato_nome}
                                {lead.cargo ? ` · ${lead.cargo}` : ""}
                              </p>
                            )}
                          </div>
                          <GripVertical
                            size={14}
                            className="text-slate-300 group-hover:text-slate-400 mt-0.5 flex-shrink-0"
                          />
                        </div>

                        {/* Card Body */}
                        <div className="space-y-1.5">
                          {/* Value */}
                          {lead.valor_estimado != null &&
                            lead.valor_estimado > 0 && (
                              <p className="text-sm font-bold text-emerald-600">
                                {brl(lead.valor_estimado)}
                              </p>
                            )}

                          {/* Temperature + Days */}
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium ${tempCfg.textClass}`}
                            >
                              <TempIcon size={12} />
                              {tempCfg.label}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <Clock size={11} />
                              {daysLabel(days)}
                            </span>
                          </div>

                          {/* Score bar */}
                          {lead.score != null && lead.score > 0 && (
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  lead.score >= 70
                                    ? "bg-emerald-400"
                                    : lead.score >= 40
                                      ? "bg-amber-400"
                                      : "bg-red-400"
                                }`}
                                style={{ width: `${Math.min(lead.score, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Lead Detail Dialog ──────────────────────────────────── */}
      <Dialog
        open={selectedLead !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedLead(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 size={18} className="text-slate-500" />
              {selectedLead?.empresa}
            </DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4 py-2">
              {/* Status & Temperature */}
              <div className="flex items-center gap-3">
                <Badge
                  className={`${
                    STAGES[STAGE_INDEX[selectedLead.status]]
                      ? ""
                      : "bg-slate-100 text-slate-700"
                  }`}
                  variant="secondary"
                >
                  <span
                    className={`w-2 h-2 rounded-full mr-1.5 ${
                      STAGES[STAGE_INDEX[selectedLead.status]]?.dotColor ??
                      "bg-slate-400"
                    }`}
                  />
                  {STAGES[STAGE_INDEX[selectedLead.status]]?.label ??
                    selectedLead.status}
                </Badge>
                {(() => {
                  const tc =
                    TEMPERATURA_CONFIG[selectedLead.temperatura] ?? TEMPERATURA_CONFIG.frio;
                  const TIcon = tc.icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${tc.textClass}`}
                    >
                      <TIcon size={14} />
                      {tc.label}
                    </span>
                  );
                })()}
                {selectedLead.score != null && selectedLead.score > 0 && (
                  <span className="text-xs text-slate-500">
                    Score: {selectedLead.score}/100
                  </span>
                )}
              </div>

              {/* Contact Info */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-sm">
                {selectedLead.contato_nome && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Users size={14} className="text-slate-400" />
                    <span>
                      {selectedLead.contato_nome}
                      {selectedLead.cargo
                        ? ` — ${selectedLead.cargo}`
                        : ""}
                    </span>
                  </div>
                )}
                {(selectedLead.contato_telefone || selectedLead.telefone) && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone size={14} className="text-slate-400" />
                    <span>
                      {selectedLead.contato_telefone ?? selectedLead.telefone}
                    </span>
                  </div>
                )}
                {(selectedLead.contato_email || selectedLead.email) && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail size={14} className="text-slate-400" />
                    <span>
                      {selectedLead.contato_email ?? selectedLead.email}
                    </span>
                  </div>
                )}
                {selectedLead.segmento && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Target size={14} className="text-slate-400" />
                    <span className="capitalize">
                      {selectedLead.segmento}
                    </span>
                  </div>
                )}
                {selectedLead.valor_estimado != null &&
                  selectedLead.valor_estimado > 0 && (
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                      <DollarSign size={14} className="text-emerald-400" />
                      <span>{brl(selectedLead.valor_estimado)}</span>
                    </div>
                  )}
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <CalendarDays size={13} className="text-slate-400" />
                  <span>
                    Criado há {daysLabel(daysSince(selectedLead.created_at))}
                  </span>
                </div>
              </div>

              {/* Move to stage */}
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">
                  Mover para estágio
                </Label>
                <Select
                  value={selectedLead.status}
                  onValueChange={(newStatus) => {
                    const ns = newStatus as LeadStatus;
                    if (!canTransition(selectedLead.status, ns)) {
                      showError(
                        "Transição inválida. Mova apenas para estágios adjacentes ou descartado."
                      );
                      return;
                    }
                    updateStatus.mutate(
                      { id: selectedLead.id, status: ns },
                      {
                        onSuccess: () => {
                          setSelectedLead({
                            ...selectedLead,
                            status: ns,
                          });
                        },
                      }
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem
                        key={s.status}
                        value={s.status}
                        disabled={!canTransition(selectedLead.status, s.status) && s.status !== selectedLead.status}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${s.dotColor}`}
                          />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes / Observations */}
              <div>
                <Label
                  htmlFor="lead-notes"
                  className="text-xs text-slate-500 mb-1.5 block"
                >
                  Observações / Próximos passos
                </Label>
                <Textarea
                  id="lead-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Anotações sobre o lead, próximos passos, follow-up..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Discard reason */}
              {selectedLead.status === "descartado" &&
                selectedLead.motivo_descarte && (
                  <div className="bg-red-50 rounded-xl p-3 text-sm text-red-700">
                    <p className="font-medium text-xs text-red-500 mb-1">
                      Motivo do descarte
                    </p>
                    <p>{selectedLead.motivo_descarte}</p>
                  </div>
                )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLead(null)}>
              Fechar
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={updateNotes.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateNotes.isPending ? "Salvando..." : "Salvar Observações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

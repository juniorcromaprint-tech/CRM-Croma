import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { brl as formatBRL } from "@/shared/utils/format";
import { ilikeTerm } from "@/shared/utils/searchUtils";
import {
  UserPlus, Search, Filter, Plus, Phone, Mail, Building2,
  Thermometer, ChevronRight, AlertTriangle, Loader2, Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { TEMPERATURA_CONFIG } from "../constants/temperatura";
import QueryErrorState from "@/shared/components/QueryErrorState";
import { LEAD_STATUS_CONFIG, getStatusConfig } from "@/shared/constants/status";

const PAGE_SIZE = 20;

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeadDuplicado {
  id: string;
  empresa: string | null;
  contato_nome: string | null;
  status: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const canDelete = profile?.role === 'admin' || profile?.role === 'diretor';
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewLead, setShowNewLead] = useState(false);
  const [page, setPage] = useState(1);
  const [showConfirmDup, setShowConfirmDup] = useState(false);
  const [leadsDuplicados, setLeadsDuplicados] = useState<LeadDuplicado[]>([]);
  const [confirmDeleteLeadId, setConfirmDeleteLeadId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    empresa: "", contato_nome: "", contato_email: "", contato_telefone: "",
    segmento: "", status: "novo", temperatura: "frio", valor_estimado: "",
    proximo_contato: "", observacoes: "",
  });

  // ── Duplicate detection ──────────────────────────────────────────────────

  const verificarDuplicata = useCallback(async (termo: string) => {
    if (!termo || termo.trim().length < 3) return;

    const t = ilikeTerm(termo.trim());
    const { data } = await supabase
      .from("leads")
      .select("id, empresa, contato_nome, status")
      .or(`empresa.ilike.${t},contato_nome.ilike.${t}`)
      .limit(3);

    setLeadsDuplicados((data ?? []) as LeadDuplicado[]);
  }, []);

  const limparDuplicatas = () => setLeadsDuplicados([]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: leadsResult, isLoading, isError, refetch } = useQuery({
    queryKey: ["leads", search, statusFilter, page],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("leads")
        .select("*", { count: "exact" })
        .is("excluido_em", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (search) {
        const t = ilikeTerm(search);
        query = query.or(`empresa.ilike.${t},contato_nome.ilike.${t}`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { data: data ?? [], total: count ?? 0 };
    },
  });

  const leads = leadsResult?.data ?? [];
  const totalLeads = leadsResult?.total ?? 0;
  const totalPages = Math.ceil(totalLeads / PAGE_SIZE);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const { data: stats } = useQuery({
    queryKey: ["leads", "stats"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("status, temperatura, valor_estimado");
      const byStatus: Record<string, number> = {};
      const byTemp: Record<string, number> = {};
      let totalValor = 0;

      data?.forEach((l) => {
        byStatus[l.status] = (byStatus[l.status] || 0) + 1;
        byTemp[l.temperatura] = (byTemp[l.temperatura] || 0) + 1;
        totalValor += Number(l.valor_estimado) || 0;
      });

      return { byStatus, byTemp, total: data?.length || 0, totalValor };
    },
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createLead = useMutation({
    mutationFn: async (newLead: typeof form) => {
      const { error } = await supabase.from("leads").insert({
        ...newLead,
        valor_estimado: newLead.valor_estimado ? Math.max(0, Number(newLead.valor_estimado)) : null,
        proximo_contato: newLead.proximo_contato || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      showSuccess("Lead criado com sucesso!");
      setShowNewLead(false);
      setLeadsDuplicados([]);
      setSearch("");
      setForm({
        empresa: "", contato_nome: "", contato_email: "", contato_telefone: "",
        segmento: "", status: "novo", temperatura: "frio", valor_estimado: "",
        proximo_contato: "", observacoes: "",
      });
    },
    onError: (err: any) => showError(err.message || "Erro ao criar lead"),
  });

  const deleteLead = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("leads")
        .update({
          excluido_em: new Date().toISOString(),
          excluido_por: profile?.id ?? null,
        })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      showSuccess("Lead excluído com sucesso");
      setConfirmDeleteLeadId(null);
    },
    onError: (err: any) => showError(err.message || "Erro ao excluir lead"),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSalvar = () => {
    if (leadsDuplicados.length > 0) {
      setShowConfirmDup(true);
    } else {
      createLead.mutate(form);
    }
  };

  const handleConfirmarCriacao = () => {
    setShowConfirmDup(false);
    createLead.mutate(form);
  };

  const handleFecharDialog = () => {
    setShowNewLead(false);
    setLeadsDuplicados([]);
    setForm({
      empresa: "", contato_nome: "", contato_email: "", contato_telefone: "",
      segmento: "", status: "novo", temperatura: "frio", valor_estimado: "", observacoes: "",
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (isError) {
    return <QueryErrorState onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leads</h1>
          <p className="text-slate-500 mt-1">
            {stats?.total ?? 0} leads · {formatBRL(stats?.totalValor ?? 0)} em pipeline
          </p>
        </div>
        <Button onClick={() => setShowNewLead(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" /> Novo Lead
        </Button>
      </div>

      {/* Stats Pills */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(stats?.byTemp ?? {}).map(([temp, count]) => (
          <span key={temp} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${TEMPERATURA_CONFIG[temp as keyof typeof TEMPERATURA_CONFIG]?.badgeColor || "bg-slate-100 text-slate-600"}`}>
            <Thermometer size={12} /> {TEMPERATURA_CONFIG[temp as keyof typeof TEMPERATURA_CONFIG]?.label || temp}: {count}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar empresa ou contato..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter size={14} className="mr-2 text-slate-400" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Leads List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
                <div className="h-5 bg-slate-100 rounded w-1/3 mb-3" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : leads && leads.length > 0 ? (
          leads.map((lead) => (
            <div
              key={lead.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow group cursor-pointer"
              onClick={() => navigate(`/leads/${lead.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 truncate">{lead.empresa}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusConfig(LEAD_STATUS_CONFIG, lead.status as any).color}`}>
                      {getStatusConfig(LEAD_STATUS_CONFIG, lead.status as any).label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TEMPERATURA_CONFIG[lead.temperatura as keyof typeof TEMPERATURA_CONFIG]?.badgeColor || "bg-slate-100"}`}>
                      {TEMPERATURA_CONFIG[lead.temperatura as keyof typeof TEMPERATURA_CONFIG]?.label || lead.temperatura}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                    {lead.contato_nome && (
                      <span className="flex items-center gap-1"><Building2 size={13} /> {lead.contato_nome}</span>
                    )}
                    {lead.contato_telefone && (
                      <span className="flex items-center gap-1"><Phone size={13} /> {lead.contato_telefone}</span>
                    )}
                    {lead.contato_email && (
                      <span className="flex items-center gap-1"><Mail size={13} /> {lead.contato_email}</span>
                    )}
                    {lead.valor_estimado && (
                      <span className="font-medium text-emerald-600">{formatBRL(Number(lead.valor_estimado))}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteLeadId(lead.id); }}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Excluir lead"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors mt-1" />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <UserPlus size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Nenhum lead encontrado</h3>
            <p className="text-sm text-slate-400 mt-1">Clique em "Novo Lead" para começar a prospectar</p>
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-4 py-2 text-sm text-slate-600">
                Página {page} de {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* ── New Lead Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showNewLead} onOpenChange={(open) => { if (!open) handleFecharDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Empresa */}
            <div>
              <Label htmlFor="empresa">Empresa *</Label>
              <Input
                id="empresa"
                value={form.empresa}
                onChange={e => {
                  setForm({ ...form, empresa: e.target.value });
                  limparDuplicatas();
                }}
                onBlur={e => verificarDuplicata(e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>

            {/* Contato + Telefone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="contato_nome">Contato</Label>
                <Input
                  id="contato_nome"
                  value={form.contato_nome}
                  onChange={e => {
                    setForm({ ...form, contato_nome: e.target.value });
                    limparDuplicatas();
                  }}
                  onBlur={e => {
                    if (!form.empresa && e.target.value.trim().length >= 3) {
                      verificarDuplicata(e.target.value);
                    }
                  }}
                  placeholder="Nome do contato"
                />
              </div>
              <div>
                <Label htmlFor="contato_telefone">Telefone</Label>
                <Input
                  id="contato_telefone"
                  value={form.contato_telefone}
                  onChange={e => setForm({ ...form, contato_telefone: e.target.value })}
                  placeholder="(51) 99999-9999"
                />
              </div>
            </div>

            {/* Alerta de duplicatas */}
            {leadsDuplicados.length > 0 && (
              <div className="mt-1 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div className="flex items-center gap-2 text-yellow-700 text-sm font-medium mb-2">
                  <AlertTriangle size={14} />
                  Possíveis duplicatas encontradas
                </div>
                {leadsDuplicados.map(lead => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between text-xs text-yellow-600 py-1 border-b border-yellow-100 last:border-0"
                  >
                    <span>
                      {lead.empresa ?? lead.contato_nome}
                      {lead.empresa && lead.contato_nome ? ` — ${lead.contato_nome}` : ""}
                    </span>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">
                      {getStatusConfig(LEAD_STATUS_CONFIG, lead.status as any).label}
                    </Badge>
                  </div>
                ))}
                <p className="text-xs text-yellow-500 mt-2">
                  Verifique antes de criar um novo lead.
                </p>
              </div>
            )}

            {/* Email */}
            <div>
              <Label htmlFor="contato_email">Email</Label>
              <Input
                id="contato_email"
                type="email"
                value={form.contato_email}
                onChange={e => setForm({ ...form, contato_email: e.target.value })}
                placeholder="contato@empresa.com"
              />
            </div>

            {/* Temperatura + Valor */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Temperatura</Label>
                <Select value={form.temperatura} onValueChange={v => setForm({ ...form, temperatura: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frio">Frio</SelectItem>
                    <SelectItem value="morno">Morno</SelectItem>
                    <SelectItem value="quente">Quente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="valor_estimado">Valor Estimado</Label>
                <Input
                  id="valor_estimado"
                  type="number"
                  min={0}
                  value={form.valor_estimado}
                  onChange={e => setForm({ ...form, valor_estimado: e.target.value })}
                  placeholder="50000"
                />
              </div>
            </div>

            {/* Segmento */}
            <div>
              <Label>Segmento</Label>
              <Select value={form.segmento} onValueChange={v => setForm({ ...form, segmento: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="calcados">Calçados</SelectItem>
                  <SelectItem value="varejo">Varejo</SelectItem>
                  <SelectItem value="franquia">Franquia</SelectItem>
                  <SelectItem value="supermercado">Supermercado</SelectItem>
                  <SelectItem value="farmacia">Farmácia</SelectItem>
                  <SelectItem value="academia">Academia</SelectItem>
                  <SelectItem value="restaurante">Restaurante</SelectItem>
                  <SelectItem value="concessionaria">Concessionária</SelectItem>
                  <SelectItem value="shopping">Shopping</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Próximo contato */}
            <div>
              <Label htmlFor="proximo_contato">Próximo contato</Label>
              <Input
                id="proximo_contato"
                type="datetime-local"
                value={form.proximo_contato}
                onChange={e => setForm({ ...form, proximo_contato: e.target.value })}
              />
            </div>

            {/* Observações */}
            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={form.observacoes}
                onChange={e => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Notas sobre o lead..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleFecharDialog}>Cancelar</Button>
            <Button
              onClick={handleSalvar}
              disabled={!form.empresa || createLead.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createLead.isPending ? <><Loader2 size={16} className="animate-spin mr-2" />Salvando...</> : "Criar Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmação de exclusão de lead ────────────────────────────── */}
      <AlertDialog open={!!confirmDeleteLeadId} onOpenChange={(open) => { if (!open) setConfirmDeleteLeadId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lead será removido permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteLeadId && deleteLead.mutate(confirmDeleteLeadId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLead.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmação de duplicata ─────────────────────────────────────── */}
      <AlertDialog open={showConfirmDup} onOpenChange={setShowConfirmDup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-yellow-500" />
              Possíveis duplicatas encontradas
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Os seguintes leads com nome/empresa similar já existem:</p>
                <ul className="space-y-1">
                  {leadsDuplicados.map(lead => (
                    <li key={lead.id} className="flex items-center justify-between text-sm bg-yellow-50 px-3 py-1.5 rounded-lg">
                      <span className="font-medium text-slate-700">
                        {lead.empresa ?? lead.contato_nome}
                        {lead.empresa && lead.contato_nome ? ` — ${lead.contato_nome}` : ""}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusConfig(LEAD_STATUS_CONFIG, lead.status as any).color}`}>
                        {getStatusConfig(LEAD_STATUS_CONFIG, lead.status as any).label}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-slate-500">
                  Deseja criar um novo lead mesmo assim?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e revisar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarCriacao}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Criar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

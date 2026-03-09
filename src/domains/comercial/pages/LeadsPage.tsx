import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { brl as formatBRL } from "@/shared/utils/format";
import {
  UserPlus, Search, Filter, Plus, Phone, Mail, Building2,
  Thermometer, ChevronRight, MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-blue-100 text-blue-700" },
  contatado: { label: "Contatado", color: "bg-sky-100 text-sky-700" },
  qualificado: { label: "Qualificado", color: "bg-emerald-100 text-emerald-700" },
  proposta_enviada: { label: "Proposta Enviada", color: "bg-amber-100 text-amber-700" },
  negociando: { label: "Negociando", color: "bg-purple-100 text-purple-700" },
  convertido: { label: "Convertido", color: "bg-green-100 text-green-700" },
  perdido: { label: "Perdido", color: "bg-red-100 text-red-700" },
};

const TEMP_CONFIG: Record<string, { label: string; color: string }> = {
  frio: { label: "Frio", color: "bg-cyan-100 text-cyan-700" },
  morno: { label: "Morno", color: "bg-amber-100 text-amber-700" },
  quente: { label: "Quente", color: "bg-red-100 text-red-700" },
};

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewLead, setShowNewLead] = useState(false);

  // Form state
  const [form, setForm] = useState({
    empresa: "", contato_nome: "", contato_email: "", contato_telefone: "",
    segmento: "", status: "novo", temperatura: "frio", valor_estimado: "",
    observacoes: "",
  });

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads", search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (search) {
        query = query.or(`empresa.ilike.%${search}%,contato_nome.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createLead = useMutation({
    mutationFn: async (newLead: typeof form) => {
      const { error } = await supabase.from("leads").insert({
        ...newLead,
        valor_estimado: newLead.valor_estimado ? Number(newLead.valor_estimado) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      showSuccess("Lead criado com sucesso!");
      setShowNewLead(false);
      setForm({ empresa: "", contato_nome: "", contato_email: "", contato_telefone: "", segmento: "", status: "novo", temperatura: "frio", valor_estimado: "", observacoes: "" });
    },
    onError: (err: any) => showError(err.message || "Erro ao criar lead"),
  });

  const { data: stats } = useQuery({
    queryKey: ["leads", "stats"],
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
          <span key={temp} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${TEMP_CONFIG[temp]?.color || "bg-slate-100 text-slate-600"}`}>
            <Thermometer size={12} /> {TEMP_CONFIG[temp]?.label || temp}: {count}
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
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter size={14} className="mr-2 text-slate-400" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Leads List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
                <div className="h-5 bg-slate-100 rounded w-1/3 mb-3" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : leads && leads.length > 0 ? (
          leads.map((lead) => (
            <div key={lead.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow group cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 truncate">{lead.empresa}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_CONFIG[lead.status]?.color || "bg-slate-100"}`}>
                      {STATUS_CONFIG[lead.status]?.label || lead.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${TEMP_CONFIG[lead.temperatura]?.color || "bg-slate-100"}`}>
                      {TEMP_CONFIG[lead.temperatura]?.label || lead.temperatura}
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
                <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors mt-1" />
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

      {/* New Lead Dialog */}
      <Dialog open={showNewLead} onOpenChange={setShowNewLead}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="empresa">Empresa *</Label>
              <Input id="empresa" value={form.empresa} onChange={e => setForm({...form, empresa: e.target.value})} placeholder="Nome da empresa" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="contato_nome">Contato</Label>
                <Input id="contato_nome" value={form.contato_nome} onChange={e => setForm({...form, contato_nome: e.target.value})} placeholder="Nome do contato" />
              </div>
              <div>
                <Label htmlFor="contato_telefone">Telefone</Label>
                <Input id="contato_telefone" value={form.contato_telefone} onChange={e => setForm({...form, contato_telefone: e.target.value})} placeholder="(51) 99999-9999" />
              </div>
            </div>
            <div>
              <Label htmlFor="contato_email">Email</Label>
              <Input id="contato_email" type="email" value={form.contato_email} onChange={e => setForm({...form, contato_email: e.target.value})} placeholder="contato@empresa.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Temperatura</Label>
                <Select value={form.temperatura} onValueChange={v => setForm({...form, temperatura: v})}>
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
                <Input id="valor_estimado" type="number" value={form.valor_estimado} onChange={e => setForm({...form, valor_estimado: e.target.value})} placeholder="50000" />
              </div>
            </div>
            <div>
              <Label>Segmento</Label>
              <Select value={form.segmento} onValueChange={v => setForm({...form, segmento: v})}>
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
            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea id="observacoes" value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} placeholder="Notas sobre o lead..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewLead(false)}>Cancelar</Button>
            <Button
              onClick={() => createLead.mutate(form)}
              disabled={!form.empresa || createLead.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createLead.isPending ? "Salvando..." : "Criar Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

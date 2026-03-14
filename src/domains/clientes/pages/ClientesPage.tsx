import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { formatCNPJ, formatPhone } from "@/shared/utils/format";
import { ilikeTerm } from "@/shared/utils/searchUtils";
import { Link } from "react-router-dom";
import {
  Building2, Search, Plus, Phone, Mail, MapPin,
  ChevronRight, Star, Filter, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";

const PAGE_SIZE = 20;

const CLASSIFICACAO_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  A: { label: "A", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "💎" },
  B: { label: "B", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: "🥇" },
  C: { label: "C", color: "bg-slate-100 text-slate-600 border-slate-200", icon: "🥈" },
  D: { label: "D", color: "bg-orange-100 text-orange-700 border-orange-200", icon: "🥉" },
};

const SEGMENTO_LABELS: Record<string, string> = {
  calcados: "Calçados", varejo: "Varejo", franquia: "Franquia",
  supermercado: "Supermercado", farmacia: "Farmácia", academia: "Academia",
  restaurante: "Restaurante", concessionaria: "Concessionária", clinica: "Clínica",
  shopping: "Shopping", construtora: "Construtora", escritorio: "Escritório", outro: "Outro",
};

export default function ClientesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    razao_social: "", nome_fantasia: "", cnpj: "", segmento: "",
    classificacao: "C", email: "", telefone: "", website: "",
    endereco_cidade: "", endereco_estado: "", observacoes: "",
  });

  const { data: clientesResult, isLoading } = useQuery({
    queryKey: ["clientes", search, segFilter, classFilter, page],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("clientes")
        .select("*, unidades_cliente(count)", { count: "exact" })
        .eq("ativo", true)
        .order("nome_fantasia", { ascending: true })
        .range(from, to);

      if (segFilter && segFilter !== "all") query = query.eq("segmento", segFilter);
      if (classFilter && classFilter !== "all") query = query.eq("classificacao", classFilter);
      if (search) { const t = ilikeTerm(search); query = query.or(`razao_social.ilike.${t},nome_fantasia.ilike.${t},cnpj.ilike.${t}`); }

      const { data, count, error } = await query;
      if (error) throw error;
      return { data: data ?? [], total: count ?? 0 };
    },
  });

  const clientes = clientesResult?.data ?? [];
  const totalClientes = clientesResult?.total ?? 0;
  const totalPages = Math.ceil(totalClientes / PAGE_SIZE);

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const createCliente = useMutation({
    mutationFn: async (newCliente: typeof form) => {
      const { endereco_cidade, endereco_estado, ...rest } = newCliente;
      const { error } = await supabase.from("clientes").insert({
        ...rest,
        cidade: endereco_cidade,
        estado: endereco_estado,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      showSuccess("Cliente criado com sucesso!");
      setShowNew(false);
      setForm({ razao_social: "", nome_fantasia: "", cnpj: "", segmento: "", classificacao: "C", email: "", telefone: "", website: "", endereco_cidade: "", endereco_estado: "", observacoes: "" });
    },
    onError: (err: any) => showError(err.message || "Erro ao criar cliente"),
  });

  const { data: stats } = useQuery({
    queryKey: ["clientes", "stats"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("classificacao, segmento").eq("ativo", true);
      const byClass: Record<string, number> = {};
      data?.forEach(c => { byClass[c.classificacao] = (byClass[c.classificacao] || 0) + 1; });
      return { total: data?.length || 0, byClass };
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500 mt-1">
            {stats?.total ?? 0} clientes ativos
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" /> Novo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(stats?.byClass ?? {}).map(([cls, count]) => (
          <span key={cls} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${CLASSIFICACAO_CONFIG[cls]?.color || "bg-slate-100"}`}>
            {CLASSIFICACAO_CONFIG[cls]?.icon} {CLASSIFICACAO_CONFIG[cls]?.label}: {count}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Buscar por nome, fantasia ou CNPJ..." value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-10" />
        </div>
        <Select value={segFilter} onValueChange={handleFilterChange(setSegFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos segmentos</SelectItem>
            {Object.entries(SEGMENTO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={classFilter} onValueChange={handleFilterChange(setClassFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Classificação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(CLASSIFICACAO_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Client List */}
      <div className="space-y-3">
        {isLoading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
              <div className="h-5 bg-slate-100 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))
        ) : clientes && clientes.length > 0 ? (
          clientes.map((c: any) => (
            <Link key={c.id} to={`/clientes/${c.id}`} className="block">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-slate-800 truncate">{c.nome_fantasia || c.razao_social}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${CLASSIFICACAO_CONFIG[c.classificacao]?.color || "bg-slate-100"}`}>
                        {CLASSIFICACAO_CONFIG[c.classificacao]?.icon} {CLASSIFICACAO_CONFIG[c.classificacao]?.label}
                      </span>
                      {c.segmento && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
                          {SEGMENTO_LABELS[c.segmento] || c.segmento}
                        </span>
                      )}
                    </div>
                    {c.razao_social !== c.nome_fantasia && c.nome_fantasia && (
                      <p className="text-xs text-slate-400 mb-1">{c.razao_social}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      {c.cnpj && <span className="font-mono text-xs">{formatCNPJ(c.cnpj)}</span>}
                      {c.telefone && <span className="flex items-center gap-1"><Phone size={13} /> {formatPhone(c.telefone)}</span>}
                      {c.email && <span className="flex items-center gap-1"><Mail size={13} /> {c.email}</span>}
                      {c.cidade && (
                        <span className="flex items-center gap-1"><MapPin size={13} /> {c.cidade}/{c.estado}</span>
                      )}
                      {c.unidades_cliente?.[0]?.count > 0 && (
                        <span className="text-xs text-blue-500 font-medium">{c.unidades_cliente[0].count} unidade(s)</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors mt-1" />
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Nenhum cliente encontrado</h3>
            <p className="text-sm text-slate-400 mt-1">Clique em "Novo Cliente" para cadastrar</p>
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

      {/* New Client Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Razão Social *</Label>
              <Input value={form.razao_social} onChange={e => setForm({...form, razao_social: e.target.value})} placeholder="Razão Social Ltda" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome Fantasia</Label>
                <Input value={form.nome_fantasia} onChange={e => setForm({...form, nome_fantasia: e.target.value})} placeholder="Nome Fantasia" />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0001-00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Segmento</Label>
                <Select value={form.segmento} onValueChange={v => setForm({...form, segmento: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEGMENTO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Classificação</Label>
                <Select value={form.classificacao} onValueChange={v => setForm({...form, classificacao: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLASSIFICACAO_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(51) 3333-3333" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="contato@empresa.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input value={form.endereco_cidade} onChange={e => setForm({...form, endereco_cidade: e.target.value})} placeholder="Porto Alegre" />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={form.endereco_estado} onChange={e => setForm({...form, endereco_estado: e.target.value})} placeholder="RS" maxLength={2} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button
              onClick={() => createCliente.mutate(form)}
              disabled={!form.razao_social || createCliente.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createCliente.isPending ? "Salvando..." : "Criar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

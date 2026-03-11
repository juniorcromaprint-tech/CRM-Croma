import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, FileText, Copy, Trash2, ArrowRight, Loader2, Eye, TrendingUp, CheckCircle2, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOrcamentos, useExcluirOrcamento, useDuplicarOrcamento } from "../hooks/useOrcamentos";
import { brl } from "@/shared/utils/format";
import { useAuth } from "@/contexts/AuthContext";
import type { OrcamentoStatus } from "../services/orcamento.service";

const STATUS_CONFIG: Record<OrcamentoStatus, { label: string; cls: string }> = {
  rascunho:    { label: "Rascunho",     cls: "bg-slate-100 text-slate-600 border-slate-200" },
  enviada:     { label: "Enviada",      cls: "bg-blue-100 text-blue-700 border-blue-200" },
  em_revisao:  { label: "Em revisão",   cls: "bg-amber-100 text-amber-700 border-amber-200" },
  aprovada:    { label: "Aprovada",     cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  recusada:    { label: "Recusada",     cls: "bg-red-100 text-red-700 border-red-200" },
  expirada:    { label: "Expirada",     cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

export default function OrcamentosPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = !profile?.role || profile.role === 'admin';
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrcamentoStatus | "todos">("todos");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const filtros = {
    search: search || undefined,
    status: statusFilter !== "todos" ? statusFilter : undefined,
  };

  const { data: orcamentos = [], isLoading } = useOrcamentos(filtros);
  const { data: todos = [] } = useOrcamentos();
  const excluir = useExcluirOrcamento();
  const duplicar = useDuplicarOrcamento();

  const kpis = useMemo(() => {
    const total = todos.length;
    const pendentes = todos.filter((o) => o.status === "enviada" || o.status === "em_revisao").length;
    const aprovados = todos.filter((o) => o.status === "aprovada").length;
    const valorAberto = todos
      .filter((o) => o.status === "enviada" || o.status === "em_revisao")
      .reduce((acc, o) => acc + (o.total ?? 0), 0);
    return { total, pendentes, aprovados, valorAberto };
  }, [todos]);

  const handleNovo = () => {
    navigate("/orcamentos/novo");
  };

  const handleExcluir = () => {
    if (deleteId) {
      excluir.mutate({ id: deleteId, userId: profile?.id }, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const canDelete = (status: OrcamentoStatus) => ["rascunho", "expirada", "recusada"].includes(status);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Orçamentos</h1>
          <p className="text-slate-500 mt-1">Gerencie propostas comerciais com precificação automática</p>
        </div>
        <Button
          onClick={handleNovo}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
        >
          <Plus size={20} className="mr-2" /> Novo Orçamento
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{isLoading ? "..." : kpis.total}</p>
              <p className="text-xs text-slate-500">Total de orçamentos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{isLoading ? "..." : kpis.pendentes}</p>
              <p className="text-xs text-slate-500">Aguardando resposta</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{isLoading ? "..." : kpis.aprovados}</p>
              <p className="text-xs text-slate-500">Aprovados</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <DollarSign size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800 leading-tight">{isLoading ? "..." : brl(kpis.valorAberto)}</p>
              <p className="text-xs text-slate-500">Valor em aberto</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por número ou título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl border-slate-200"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrcamentoStatus | "todos")}>
          <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl border-slate-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table / Cards */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : orcamentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText size={48} className="text-slate-200 mb-4" />
          <h2 className="text-xl font-bold text-slate-700">Nenhum orçamento encontrado</h2>
          <p className="text-slate-400 mt-2 max-w-sm">
            {search || statusFilter !== "todos"
              ? "Tente ajustar os filtros de busca"
              : "Crie seu primeiro orçamento com precificação automática"}
          </p>
          {!search && statusFilter === "todos" && (
            <Button onClick={handleNovo} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
              <Plus size={16} className="mr-2" /> Criar Orçamento
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Número</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Título</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orcamentos.map((orc) => {
                  const sc = STATUS_CONFIG[orc.status] ?? STATUS_CONFIG.rascunho;
                  return (
                    <tr key={orc.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-mono font-medium text-slate-600">{orc.numero}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-sm font-medium text-slate-800 truncate max-w-[200px]">{orc.titulo}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-sm text-slate-600 truncate max-w-[160px]">
                          {orc.cliente?.nome_fantasia || orc.cliente?.razao_social || "—"}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-sm font-bold tabular-nums text-slate-800">{brl(orc.total)}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border ${sc.cls}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link to={`/orcamentos/${orc.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                              <Eye size={15} />
                            </Button>
                          </Link>
                          <Link to={`/orcamentos/${orc.id}/editar`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                              <ArrowRight size={15} />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            onClick={() => duplicar.mutate(orc.id)}
                            disabled={duplicar.isPending}
                            title="Duplicar"
                          >
                            <Copy size={15} />
                          </Button>
                          {(canDelete(orc.status) || isAdmin) && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => { setDeleteId(orc.id); setDeleteName(orc.titulo || orc.numero); }}
                              title={canDelete(orc.status) ? "Excluir" : "Excluir (Admin)"}
                            >
                              <Trash2 size={15} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {orcamentos.map((orc) => {
              const sc = STATUS_CONFIG[orc.status] ?? STATUS_CONFIG.rascunho;
              return (
                <div key={orc.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">{orc.numero}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${sc.cls}`}>{sc.label}</span>
                      </div>
                      <p className="font-semibold text-slate-800">{orc.titulo}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {orc.cliente?.nome_fantasia || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold tabular-nums text-slate-800">{brl(orc.total)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link to={`/orcamentos/${orc.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full rounded-xl h-9 text-xs">
                        <Eye size={13} className="mr-1" /> Ver
                      </Button>
                    </Link>
                    <Link to={`/orcamentos/${orc.id}/editar`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full rounded-xl h-9 text-xs">
                        Editar
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Orçamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteName}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              disabled={excluir.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {excluir.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

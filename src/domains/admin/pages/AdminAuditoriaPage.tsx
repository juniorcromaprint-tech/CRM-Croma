import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/shared/utils/format";
import { Shield, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface RegistroAuditoria {
  id: string;
  created_at: string;
  user_id: string | null;
  acao: string;
  tabela: string;
  registro_id: string | null;
  detalhes: Record<string, unknown> | null;
  ip: string | null;
}

const PAGE_SIZE = 30;

export default function AdminAuditoriaPage() {
  const [search, setSearch] = useState("");
  const [tabelaFilter, setTabelaFilter] = useState("todas");
  const [page, setPage] = useState(0);

  const { data: registros, isLoading } = useQuery({
    queryKey: ["auditoria", tabelaFilter, search, page],
    queryFn: async () => {
      let q = supabase
        .from("registros_auditoria")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (tabelaFilter && tabelaFilter !== "todas") {
        q = q.eq("tabela", tabelaFilter);
      }

      if (search) {
        q = q.or(`acao.ilike.%${search}%,tabela.ilike.%${search}%,registro_id.ilike.%${search}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RegistroAuditoria[];
    },
  });

  const { data: tabelas } = useQuery({
    queryKey: ["auditoria-tabelas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_auditoria")
        .select("tabela")
        .limit(500);
      if (error) throw error;
      const unique = [...new Set((data ?? []).map((r: { tabela: string }) => r.tabela))].sort();
      return unique;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    setPage(0);
  }, [search]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Auditoria</h1>
          <p className="text-sm text-slate-500 mt-1">
            Registro de ações realizadas no sistema
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por ação, tabela, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Select value={tabelaFilter} onValueChange={(v) => { setTabelaFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[200px] rounded-xl">
            <SelectValue placeholder="Filtrar por tabela" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as tabelas</SelectItem>
            {(tabelas ?? []).map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {(registros ?? []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Shield size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhum registro encontrado</h3>
          <p className="text-sm text-slate-400 mt-1">
            Os registros de auditoria aparecerão aqui conforme ações forem realizadas.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Usuário</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Ação</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tabela</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Registro</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {(registros ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs truncate max-w-[120px]">
                      {r.user_id ? r.user_id.slice(0, 8) + "..." : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {r.acao}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{r.tabela}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs truncate max-w-[120px]">
                      {r.registro_id ? r.registro_id.slice(0, 8) + "..." : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[200px]">
                      {r.detalhes ? JSON.stringify(r.detalhes).slice(0, 80) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação simples */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-300"
            >
              ← Anterior
            </button>
            <span className="text-xs text-slate-500">Página {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(registros?.length ?? 0) < PAGE_SIZE}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-300"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

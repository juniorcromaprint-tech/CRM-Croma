import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, FileText, ChevronRight } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-slate-100 text-slate-600 border-slate-200" },
  enviado: { label: "Enviado", className: "bg-blue-50 text-blue-700 border-blue-100" },
  aprovado: { label: "Aprovado", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  recusado: { label: "Recusado", className: "bg-red-50 text-red-600 border-red-100" },
  convertido: { label: "OS Gerada", className: "bg-purple-50 text-purple-700 border-purple-100" },
};

const ALL_STATUS = ["rascunho", "enviado", "aprovado", "recusado", "convertido"];

// Dados de demonstração
const MOCK_ORCAMENTOS = [
  {
    id: "orc-1",
    numero: "ORC-2026-001",
    titulo: "Fachada ACM + Letras Caixa - Loja Centro",
    status: "aprovado",
    total: 18500,
    created_at: "2026-02-15T10:00:00Z",
    clientes: { razao_social: "Calçados Beira Rio S/A", nome_fantasia: "Beira Rio" },
    profiles: { first_name: "Edmar" },
  },
  {
    id: "orc-2",
    numero: "ORC-2026-002",
    titulo: "Campanha Verão 2026 - 45 Lojas",
    status: "enviado",
    total: 32800,
    created_at: "2026-02-28T14:30:00Z",
    clientes: { razao_social: "Lojas Renner S.A.", nome_fantasia: "Renner" },
    profiles: { first_name: "Regiane" },
  },
  {
    id: "orc-3",
    numero: "ORC-2026-003",
    titulo: "Adesivação Vitrine + Banners PDV",
    status: "rascunho",
    total: 4200,
    created_at: "2026-03-05T09:15:00Z",
    clientes: { razao_social: "Rede Farmácias São João", nome_fantasia: "Farmácias São João" },
    profiles: { first_name: "Edmar" },
  },
  {
    id: "orc-4",
    numero: "ORC-2026-004",
    titulo: "Projeto Visual Completo - Nova Unidade Shopping",
    status: "aprovado",
    total: 27350,
    created_at: "2026-03-01T11:00:00Z",
    clientes: { razao_social: "Grupo Paquetá Calçados", nome_fantasia: "Paquetá" },
    profiles: { first_name: "Viviane" },
  },
  {
    id: "orc-5",
    numero: "ORC-2026-005",
    titulo: "Sinalização Interna + Ambientação",
    status: "convertido",
    total: 9800,
    created_at: "2026-01-20T08:00:00Z",
    clientes: { razao_social: "Supermercados BIG", nome_fantasia: "BIG" },
    profiles: { first_name: "Edmar" },
  },
  {
    id: "orc-6",
    numero: "ORC-2026-006",
    titulo: "Envelopamento de Frota - 12 Veículos",
    status: "recusado",
    total: 15600,
    created_at: "2026-02-10T16:00:00Z",
    clientes: { razao_social: "Visual Print Comércio e Representações", nome_fantasia: "Visual Print" },
    profiles: { first_name: "Regiane" },
  },
  {
    id: "orc-7",
    numero: "ORC-2026-007",
    titulo: "Totem + Painel Luminoso - Fachada",
    status: "enviado",
    total: 12300,
    created_at: "2026-03-07T13:00:00Z",
    clientes: { razao_social: "Agência Kreatif Comunicação Ltda", nome_fantasia: "Kreatif" },
    profiles: { first_name: "Viviane" },
  },
];

export default function OrcamentosList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);

  const orcamentos = MOCK_ORCAMENTOS;

  const filtered = useMemo(() => {
    let result = orcamentos;

    if (filterStatus.length > 0) {
      result = result.filter((o) => filterStatus.includes(o.status));
    }

    const term = searchTerm.toLowerCase().trim();
    if (term) {
      result = result.filter(
        (o) =>
          (o.numero || "").toLowerCase().includes(term) ||
          (o.titulo || "").toLowerCase().includes(term) ||
          (o.clientes?.razao_social || "").toLowerCase().includes(term) ||
          (o.clientes?.nome_fantasia || "").toLowerCase().includes(term)
      );
    }
    return result;
  }, [orcamentos, searchTerm, filterStatus]);

  const toggleStatus = (status: string) => {
    setFilterStatus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const totalAprovado = useMemo(() => {
    return orcamentos
      .filter((o) => o.status === "aprovado")
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
  }, [orcamentos]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Orçamentos</h1>
          <p className="text-slate-500 mt-1">
            {orcamentos.length} orçamento{orcamentos.length !== 1 ? "s" : ""}
            {totalAprovado > 0 && (
              <span className="ml-2 text-emerald-600 font-semibold">
                · {totalAprovado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} aprovados
              </span>
            )}
            <span className="ml-2 text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100 font-medium">DEMO</span>
          </p>
        </div>
        <Button
          onClick={() => navigate("/orcamentos/novo")}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
        >
          <Plus size={20} className="mr-2" /> Novo Orçamento
        </Button>
      </div>

      {/* Filtros de status */}
      <div className="flex flex-wrap gap-2">
        {ALL_STATUS.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const isActive = filterStatus.includes(status);
          const count = orcamentos.filter(o => o.status === status).length;
          return (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                isActive ? cfg.className + " ring-2 ring-offset-1 ring-blue-400" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
        {filterStatus.length > 0 && (
          <button
            onClick={() => setFilterStatus([])}
            className="text-xs text-slate-400 hover:text-slate-600 px-2"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input
          placeholder="Buscar por número, título ou cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 rounded-xl border-slate-200 bg-white h-12 shadow-sm"
        />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">Nenhum orçamento encontrado</h3>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 px-1">
            {filtered.length} orçamento{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-3">
            {filtered.map((orc) => {
              const s = STATUS_CONFIG[orc.status] || STATUS_CONFIG.rascunho;
              const clienteNome = orc.clientes?.nome_fantasia || orc.clientes?.razao_social || "—";

              return (
                <Card
                  key={orc.id}
                  onClick={() => navigate(`/orcamentos/${orc.id}`)}
                  className="border-none shadow-sm rounded-2xl hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group bg-white"
                >
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 flex-shrink-0">
                        <FileText size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-400">{orc.numero}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${s.className}`}>
                            {s.label}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-base mt-0.5 group-hover:text-blue-700 transition-colors truncate">
                          {orc.titulo}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          <span className="text-sm text-slate-500">{clienteNome}</span>
                          <span className="text-xs text-slate-400">
                            {new Date(orc.created_at).toLocaleDateString("pt-BR")}
                          </span>
                          {orc.profiles && (
                            <span className="text-xs text-slate-400">{orc.profiles.first_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-slate-800 text-lg">
                          {Number(orc.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      </div>
                      <ChevronRight className="text-slate-300 group-hover:text-blue-600 transition-colors" size={20} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

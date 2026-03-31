// src/domains/compras/pages/CotacoesPage.tsx

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSearch,
  Loader2,
  Plus,
  Scale,
  ShoppingBag,
  Trophy,
  XCircle,
} from "lucide-react";
import { brl, formatDate } from "@/shared/utils/format";
import {
  useSolicitacoesCompra,
  useCotacoesPorSolicitacao,
  useSelecionarCotacao,
  useAtualizarStatusSolicitacao,
} from "../hooks/useCotacoes";
import SolicitacaoForm from "../components/SolicitacaoForm";
import CotacaoFormDialog from "../components/CotacaoFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SolStatus = "pendente" | "aprovada" | "cotando" | "comprada" | "cancelada";

const STATUS_CONFIG: Record<SolStatus, { label: string; className: string; icon: typeof Clock }> = {
  pendente: { label: "Pendente", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  aprovada: { label: "Aprovada", className: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 },
  cotando: { label: "Em Cotação", className: "bg-purple-50 text-purple-700 border-purple-200", icon: Scale },
  comprada: { label: "Comprada", className: "bg-green-50 text-green-700 border-green-200", icon: ShoppingBag },
  cancelada: { label: "Cancelada", className: "bg-red-50 text-red-600 border-red-200", icon: XCircle },
};

const URGENCIA_CONFIG: Record<string, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-slate-50 text-slate-600" },
  normal: { label: "Normal", className: "bg-blue-50 text-blue-600" },
  alta: { label: "Alta", className: "bg-orange-50 text-orange-700" },
  critica: { label: "Crítica", className: "bg-red-50 text-red-700" },
};

const TABS = [
  { value: "todos", label: "Todas" },
  { value: "pendente", label: "Pendentes" },
  { value: "cotando", label: "Em Cotação" },
  { value: "comprada", label: "Compradas" },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-100 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-40" />
          <div className="h-3 bg-slate-100 rounded w-56" />
        </div>
        <div className="h-5 bg-slate-100 rounded w-24" />
      </div>
    </div>
  );
}

// ─── Card de Cotações (expandido) ─────────────────────────────────────────────

function CotacoesPanel({ solicitacao }: { solicitacao: any }) {
  const { data: cotacoes = [], isLoading } = useCotacoesPorSolicitacao(solicitacao.id);
  const selecionarMut = useSelecionarCotacao();
  const [addOpen, setAddOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-400">
        <Loader2 size={18} className="animate-spin mr-2" /> Carregando cotações...
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Lista de cotações */}
      {cotacoes.length === 0 ? (
        <div className="bg-slate-50 rounded-xl p-6 text-center">
          <FileSearch size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Nenhuma cotação recebida ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cotacoes.map((cot: any, idx: number) => {
            const fornNome = cot.fornecedor?.nome_fantasia || cot.fornecedor?.razao_social || "—";
            return (
              <div
                key={cot.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                  cot.selecionada
                    ? "bg-green-50 border-green-200 ring-1 ring-green-300"
                    : "bg-white border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    idx === 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {idx === 0 ? <Trophy size={16} /> : `#${idx + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{fornNome}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                      <span>Unit: {brl(cot.valor_unitario)}</span>
                      {cot.prazo_entrega_dias && <span>Prazo: {cot.prazo_entrega_dias}d</span>}
                      {cot.condicao_pagamento && <span>{cot.condicao_pagamento}</span>}
                      {cot.validade && <span>Validade: {formatDate(cot.validade)}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-slate-800">{brl(cot.valor_total)}</span>
                  {cot.selecionada ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200">Vencedora</Badge>
                  ) : solicitacao.status === "cotando" ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-lg text-xs h-7">
                          Selecionar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar seleção?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Selecionar <strong>{fornNome}</strong> como fornecedor vencedor
                            por <strong>{brl(cot.valor_total)}</strong>?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                            onClick={(e) => {
                              e.preventDefault();
                              selecionarMut.mutate(
                                { cotacaoId: cot.id, solicitacaoId: solicitacao.id },
                                { onSettled: () => {} }
                              );
                            }}
                          >
                            {selecionarMut.isPending ? (
                              <Loader2 size={16} className="animate-spin mr-1" />
                            ) : null}
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botão adicionar cotação */}
      {(solicitacao.status === "cotando" || solicitacao.status === "aprovada") && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddOpen(true)}
          className="rounded-xl w-full border-dashed"
        >
          <Plus size={16} className="mr-2" /> Adicionar Cotação de Fornecedor
        </Button>
      )}

      <CotacaoFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        solicitacao={solicitacao}
      />
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function CotacoesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: solicitacoes = [], isLoading, isError } = useSolicitacoesCompra();
  const statusMut = useAtualizarStatusSolicitacao();

  const filtered = useMemo(() => {
    if (activeTab === "todos") return solicitacoes;
    return solicitacoes.filter((s: any) => s.status === activeTab);
  }, [solicitacoes, activeTab]);

  const handleIniciarCotacao = (id: string) => {
    statusMut.mutate({ id, status: "cotando" });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Cotações de Compra
          </h1>
          <p className="text-slate-500 mt-1">
            Solicite cotações a fornecedores e compare preços
          </p>
        </div>
        <Button
          onClick={() => setFormOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm self-start md:self-auto"
        >
          <Plus size={18} className="mr-2" /> Nova Solicitação
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: "Pendentes", status: "pendente", color: "amber" },
          { label: "Em Cotação", status: "cotando", color: "purple" },
          { label: "Compradas", status: "comprada", color: "green" },
          { label: "Total", status: null, color: "blue" },
        ] as const).map(({ label, status, color }) => {
          const count = status
            ? solicitacoes.filter((s: any) => s.status === status).length
            : solicitacoes.length;
          return (
            <div
              key={label}
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
            >
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className={`text-2xl font-bold mt-1 text-${color}-600`}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs de status */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white shadow-sm rounded-2xl p-1.5 border border-slate-100 h-auto flex flex-wrap gap-1 w-full">
          {TABS.map(({ value, label }) => {
            const count = value === "todos"
              ? solicitacoes.length
              : solicitacoes.filter((s: any) => s.status === value).length;
            return (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 transition-all"
              >
                {label}
                {count > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-current/10 min-w-[20px] text-center">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : isError ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <XCircle className="mx-auto h-12 w-12 text-red-300 mb-3" />
                <h3 className="text-lg font-semibold text-slate-700">Erro ao carregar solicitações</h3>
                <p className="text-slate-500 mt-1 text-sm">Verifique a conexão com o banco de dados.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Scale size={40} className="mx-auto text-slate-300 mb-3" />
                <h3 className="font-semibold text-slate-600">Nenhuma solicitação encontrada</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {solicitacoes.length === 0
                    ? "Crie a primeira solicitação de cotação."
                    : "Não há solicitações nesta etapa."}
                </p>
                {solicitacoes.length === 0 && (
                  <Button
                    onClick={() => setFormOpen(true)}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  >
                    <Plus size={18} className="mr-2" /> Nova Solicitação
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 px-1">
                  Mostrando {filtered.length} solicitaç{filtered.length !== 1 ? "ões" : "ão"}
                </p>
                <div className="grid gap-3">
                  {filtered.map((sol: any) => {
                    const statusCfg = STATUS_CONFIG[sol.status as SolStatus] ?? STATUS_CONFIG.pendente;
                    const urgCfg = URGENCIA_CONFIG[sol.urgencia] ?? URGENCIA_CONFIG.normal;
                    const materialNome = sol.material?.nome ?? "Material";
                    const isExpanded = expandedId === sol.id;
                    const StatusIcon = statusCfg.icon;

                    return (
                      <div
                        key={sol.id}
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all"
                      >
                        {/* Row principal */}
                        <div
                          onClick={() => setExpandedId(isExpanded ? null : sol.id)}
                          className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 flex-shrink-0">
                                <Scale size={22} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {sol.numero && (
                                    <span className="font-mono text-xs text-slate-400 font-semibold">
                                      {sol.numero}
                                    </span>
                                  )}
                                  <Badge variant="outline" className={statusCfg.className}>
                                    <StatusIcon size={12} className="mr-1" />
                                    {statusCfg.label}
                                  </Badge>
                                  <Badge variant="outline" className={urgCfg.className}>
                                    {urgCfg.label}
                                  </Badge>
                                </div>
                                <h3 className="font-bold text-slate-800 text-base mt-1 truncate">
                                  {materialNome}
                                </h3>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                  <span>Qtd: {sol.quantidade} {sol.material?.unidade}</span>
                                  <span>Criado em {formatDate(sol.created_at)}</span>
                                  {sol.solicitante?.full_name && (
                                    <span>Por: {sol.solicitante.full_name}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {sol.status === "pendente" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleIniciarCotacao(sol.id);
                                  }}
                                  disabled={statusMut.isPending}
                                  className="rounded-lg text-xs h-8"
                                >
                                  Iniciar Cotação
                                </Button>
                              )}
                              {isExpanded ? (
                                <ChevronDown size={20} className="text-slate-400" />
                              ) : (
                                <ChevronRight size={20} className="text-slate-300" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Painel expandido com cotações */}
                        {isExpanded && (
                          <div className="px-5 pb-5 border-t border-slate-100">
                            <CotacoesPanel solicitacao={sol} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Form Dialog */}
      <SolicitacaoForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

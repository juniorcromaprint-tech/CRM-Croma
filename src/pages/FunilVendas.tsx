import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Trophy,
  Target,
  Users,
  DollarSign,
  Clock,
  User,
  Building2,
  Phone,
  Mail,
  FileText,
  X,
  Kanban,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FaseId =
  | "prospecto"
  | "contato_feito"
  | "proposta_enviada"
  | "negociacao"
  | "fechado_ganho"
  | "perdido";

interface Oportunidade {
  id: string;
  empresa: string;
  contato: string;
  telefone?: string;
  email?: string;
  titulo: string;
  valor: number;
  fase: FaseId;
  vendedor: string;
  diasSemAtualizar: number;
  descricao: string;
}

// ─── Stage Config ─────────────────────────────────────────────────────────────

const FASES: {
  id: FaseId;
  label: string;
  color: string;
  headerBg: string;
  dotColor: string;
}[] = [
  {
    id: "prospecto",
    label: "Prospecto",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    headerBg: "bg-slate-50 border-slate-200",
    dotColor: "bg-slate-400",
  },
  {
    id: "contato_feito",
    label: "Contato Feito",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    headerBg: "bg-blue-50 border-blue-200",
    dotColor: "bg-blue-500",
  },
  {
    id: "proposta_enviada",
    label: "Proposta Enviada",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    headerBg: "bg-amber-50 border-amber-200",
    dotColor: "bg-amber-500",
  },
  {
    id: "negociacao",
    label: "Negociação",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    headerBg: "bg-orange-50 border-orange-200",
    dotColor: "bg-orange-500",
  },
  {
    id: "fechado_ganho",
    label: "Fechado - Ganho",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    headerBg: "bg-emerald-50 border-emerald-200",
    dotColor: "bg-emerald-500",
  },
  {
    id: "perdido",
    label: "Perdido",
    color: "bg-red-100 text-red-600 border-red-200",
    headerBg: "bg-red-50 border-red-200",
    dotColor: "bg-red-400",
  },
];

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_OPORTUNIDADES: Oportunidade[] = [
  {
    id: "op-1",
    empresa: "Calçados Beira Rio S/A",
    contato: "Marcos Silva",
    titulo: "Kit PDV Verão 2026 - 150 Lojas",
    valor: 65000,
    fase: "negociacao",
    vendedor: "Edmar",
    diasSemAtualizar: 3,
    descricao: "Campanha completa de verão para toda a rede",
  },
  {
    id: "op-2",
    empresa: "Lojas Renner S.A.",
    contato: "Julia Santos",
    titulo: "Adesivação de Vitrines - 45 Lojas",
    valor: 32000,
    fase: "proposta_enviada",
    vendedor: "Regiane",
    diasSemAtualizar: 5,
    descricao: "Campanha Dia das Mães 2026",
  },
  {
    id: "op-3",
    empresa: "Farmácias São João",
    contato: "Pedro Alves",
    titulo: "Sinalização Interna Nova Rede",
    valor: 18500,
    fase: "contato_feito",
    vendedor: "Viviane",
    diasSemAtualizar: 1,
    descricao: "Padronização de 30 novas unidades",
  },
  {
    id: "op-4",
    empresa: "Grupo Paquetá",
    contato: "Carla Mendes",
    titulo: "Fachada ACM + Letras Caixa Shopping",
    valor: 27350,
    fase: "fechado_ganho",
    vendedor: "Edmar",
    diasSemAtualizar: 0,
    descricao: "Entrega prevista em 15 dias",
  },
  {
    id: "op-5",
    empresa: "Supermercados BIG",
    contato: "André Lima",
    titulo: "Campanha Black Friday - 80 Lojas",
    valor: 94000,
    fase: "prospecto",
    vendedor: "Regiane",
    diasSemAtualizar: 7,
    descricao: "Levantamento inicial feito, precisa de reunião",
  },
  {
    id: "op-6",
    empresa: "Construcard Material de Construção",
    contato: "Márcio Duarte",
    titulo: "Padronização Visual - 12 Unidades",
    valor: 45000,
    fase: "negociacao",
    vendedor: "Viviane",
    diasSemAtualizar: 2,
    descricao: "Aguardando aprovação do board",
  },
  {
    id: "op-7",
    empresa: "Visual Print Curitiba",
    contato: "Marina Costa",
    titulo: "Envelopamento de Frota 8 Veículos",
    valor: 12000,
    fase: "perdido",
    vendedor: "Edmar",
    diasSemAtualizar: 14,
    descricao: "Perdemos para concorrente com menor preço",
  },
  {
    id: "op-8",
    empresa: "Drogaria Pague Menos",
    contato: "Thiago Neves",
    titulo: "Kit Campanhas 2026 - 60 Lojas",
    valor: 78000,
    fase: "proposta_enviada",
    vendedor: "Regiane",
    diasSemAtualizar: 4,
    descricao: "Proposta enviada pelo sistema, aguardando retorno",
  },
  {
    id: "op-9",
    empresa: "Academia Bodytech Porto Alegre",
    contato: "Fernanda Luz",
    titulo: "Ambientação + Identidade Visual",
    valor: 22000,
    fase: "contato_feito",
    vendedor: "Viviane",
    diasSemAtualizar: 8,
    descricao: "Interessados em toda comunicação visual da academia",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const getDiasLabel = (dias: number) => {
  if (dias === 0) return "Hoje";
  if (dias === 1) return "1 dia";
  return `${dias} dias`;
};

const getDiasColor = (dias: number) => {
  if (dias === 0) return "bg-emerald-100 text-emerald-700";
  if (dias <= 3) return "bg-blue-100 text-blue-700";
  if (dias <= 7) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-600";
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyColumn = () => (
  <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
    <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center mb-2">
      <Plus size={14} className="text-slate-300" />
    </div>
    <p className="text-xs text-slate-400">Nenhuma oportunidade</p>
  </div>
);

// ─── Opportunity Card ─────────────────────────────────────────────────────────

interface CardProps {
  op: Oportunidade;
  faseIndex: number;
  onMove: (id: string, direction: "prev" | "next") => void;
  onClick: (op: Oportunidade) => void;
}

const OportunidadeCard = ({ op, faseIndex, onMove, onClick }: CardProps) => {
  const isFirst = faseIndex === 0;
  const isLast = faseIndex === FASES.length - 1;
  const fase = FASES[faseIndex];

  return (
    <Card
      onClick={() => onClick(op)}
      className="border border-slate-100 shadow-sm rounded-2xl hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group bg-white"
    >
      <CardContent className="p-4">
        {/* Header: company + days badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm leading-tight truncate group-hover:text-blue-700 transition-colors">
              {op.empresa}
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{op.contato}</p>
          </div>
          <span
            className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${getDiasColor(
              op.diasSemAtualizar
            )}`}
          >
            {getDiasLabel(op.diasSemAtualizar)}
          </span>
        </div>

        {/* Deal title */}
        <p className="text-xs text-slate-600 leading-snug line-clamp-2 mb-3">
          {op.titulo}
        </p>

        {/* Value */}
        <div className="flex items-center gap-1.5 mb-3">
          <DollarSign size={13} className="text-emerald-600 shrink-0" />
          <span className="font-bold text-emerald-700 text-sm">
            {formatBRL(op.valor)}
          </span>
        </div>

        {/* Footer: vendor + move buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <User size={11} />
            <span>{op.vendedor}</span>
          </div>
          <div className="flex items-center gap-1">
            {!isFirst && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(op.id, "prev");
                }}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                title="Mover para etapa anterior"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            {!isLast && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(op.id, "next");
                }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  fase.id === "negociacao"
                    ? "bg-orange-100 hover:bg-orange-200 text-orange-600 hover:text-orange-700"
                    : "bg-blue-50 hover:bg-blue-100 text-blue-500 hover:text-blue-700"
                }`}
                title="Mover para próxima etapa"
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── New Opportunity Form State ───────────────────────────────────────────────

interface NovaOportunidadeForm {
  empresa: string;
  contato: string;
  telefone: string;
  email: string;
  titulo: string;
  valor: string;
  descricao: string;
  vendedor: string;
  fase: FaseId;
}

const FORM_INITIAL: NovaOportunidadeForm = {
  empresa: "",
  contato: "",
  telefone: "",
  email: "",
  titulo: "",
  valor: "",
  descricao: "",
  vendedor: "",
  fase: "prospecto",
};

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function FunilVendas() {
  const [oportunidades, setOportunidades] =
    useState<Oportunidade[]>(MOCK_OPORTUNIDADES);
  const [selectedOp, setSelectedOp] = useState<Oportunidade | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [form, setForm] = useState<NovaOportunidadeForm>(FORM_INITIAL);
  const [formErrors, setFormErrors] = useState<Partial<NovaOportunidadeForm>>(
    {}
  );

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const inPipelineIds: FaseId[] = [
      "prospecto",
      "contato_feito",
      "proposta_enviada",
      "negociacao",
    ];
    const totalPipeline = oportunidades
      .filter((o) => inPipelineIds.includes(o.fase))
      .reduce((acc, o) => acc + o.valor, 0);

    const totalGanho = oportunidades
      .filter((o) => o.fase === "fechado_ganho")
      .reduce((acc, o) => acc + o.valor, 0);

    const totalFechados = oportunidades.filter(
      (o) => o.fase === "fechado_ganho" || o.fase === "perdido"
    ).length;

    const totalGanhos = oportunidades.filter(
      (o) => o.fase === "fechado_ganho"
    ).length;

    const convRate =
      totalFechados > 0
        ? Math.round((totalGanhos / totalFechados) * 100)
        : 0;

    const countByFase = FASES.reduce(
      (acc, f) => {
        acc[f.id] = oportunidades.filter((o) => o.fase === f.id).length;
        return acc;
      },
      {} as Record<FaseId, number>
    );

    return { totalPipeline, totalGanho, convRate, countByFase };
  }, [oportunidades]);

  // ── Move handler ───────────────────────────────────────────────────────────

  const moveOportunidade = (id: string, direction: "prev" | "next") => {
    setOportunidades((prev) =>
      prev.map((op) => {
        if (op.id !== id) return op;
        const currentIndex = FASES.findIndex((f) => f.id === op.fase);
        const nextIndex =
          direction === "next" ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex < 0 || nextIndex >= FASES.length) return op;
        return { ...op, fase: FASES[nextIndex].id, diasSemAtualizar: 0 };
      })
    );
  };

  // ── Open detail ────────────────────────────────────────────────────────────

  const openDetail = (op: Oportunidade) => {
    setSelectedOp(op);
    setIsDetailOpen(true);
  };

  // ── New opportunity ────────────────────────────────────────────────────────

  const validateForm = () => {
    const errors: Partial<NovaOportunidadeForm> = {};
    if (!form.empresa.trim()) errors.empresa = "Campo obrigatório";
    if (!form.titulo.trim()) errors.titulo = "Campo obrigatório";
    const valorNum = parseFloat(form.valor.replace(",", "."));
    if (!form.valor || isNaN(valorNum) || valorNum <= 0)
      errors.valor = "Informe um valor válido maior que zero";
    return errors;
  };

  const handleSaveNew = () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    const novaOp: Oportunidade = {
      id: `op-${Date.now()}`,
      empresa: form.empresa.trim(),
      contato: form.contato.trim(),
      telefone: form.telefone.trim() || undefined,
      email: form.email.trim() || undefined,
      titulo: form.titulo.trim(),
      valor: parseFloat(form.valor.replace(",", ".")),
      fase: form.fase,
      vendedor: form.vendedor.trim() || "—",
      diasSemAtualizar: 0,
      descricao: form.descricao.trim(),
    };
    setOportunidades((prev) => [novaOp, ...prev]);
    setForm(FORM_INITIAL);
    setFormErrors({});
    setIsNewOpen(false);
  };

  const updateForm = (field: keyof NovaOportunidadeForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // ── Selected op fase info ──────────────────────────────────────────────────

  const selectedFase = selectedOp
    ? FASES.find((f) => f.id === selectedOp.fase)
    : null;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              Funil de Vendas
            </h1>
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold px-2 py-0.5 rounded-lg">
              DEMO
            </Badge>
          </div>
          <p className="text-slate-500 mt-1">
            Gerencie oportunidades e acompanhe o pipeline comercial.
          </p>
        </div>
        <Button
          onClick={() => setIsNewOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
        >
          <Plus size={20} className="mr-2" />
          Nova Oportunidade
        </Button>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Pipeline total */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <TrendingUp size={20} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-medium">Em Pipeline</p>
            <p className="text-base font-bold text-slate-800 truncate">
              {formatBRL(stats.totalPipeline)}
            </p>
          </div>
        </div>
        {/* Won total */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Trophy size={20} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-medium">Ganho no Mês</p>
            <p className="text-base font-bold text-emerald-700 truncate">
              {formatBRL(stats.totalGanho)}
            </p>
          </div>
        </div>
        {/* Conversion rate */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <Target size={20} className="text-orange-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Conversão</p>
            <p className="text-base font-bold text-slate-800">
              {stats.convRate}%
            </p>
          </div>
        </div>
        {/* Total opportunities */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Kanban size={20} className="text-slate-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total</p>
            <p className="text-base font-bold text-slate-800">
              {oportunidades.length} oport.
            </p>
          </div>
        </div>
      </div>

      {/* ── Kanban Board (desktop) / Stacked list (mobile) ── */}
      <div className="hidden md:flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {FASES.map((fase, faseIndex) => {
          const opsInFase = oportunidades.filter((o) => o.fase === fase.id);
          const total = opsInFase.reduce((acc, o) => acc + o.valor, 0);

          return (
            <div
              key={fase.id}
              className="flex-shrink-0 w-[260px] flex flex-col"
            >
              {/* Column Header */}
              <div
                className={`rounded-2xl border px-3 py-2.5 mb-2 ${fase.headerBg}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${fase.dotColor}`}
                    />
                    <span className="text-xs font-bold text-slate-700 leading-tight">
                      {fase.label}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${fase.color}`}
                  >
                    {opsInFase.length}
                  </span>
                </div>
                {opsInFase.length > 0 && (
                  <p className="text-[11px] text-slate-500 pl-4 font-medium">
                    {formatBRL(total)}
                  </p>
                )}
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-[120px]">
                {opsInFase.length === 0 ? (
                  <EmptyColumn />
                ) : (
                  opsInFase.map((op) => (
                    <OportunidadeCard
                      key={op.id}
                      op={op}
                      faseIndex={faseIndex}
                      onMove={moveOportunidade}
                      onClick={openDetail}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Mobile: Vertical stacked list grouped by stage ── */}
      <div className="md:hidden space-y-4">
        {FASES.map((fase, faseIndex) => {
          const opsInFase = oportunidades.filter((o) => o.fase === fase.id);
          const total = opsInFase.reduce((acc, o) => acc + o.valor, 0);

          if (opsInFase.length === 0) return null;

          return (
            <div key={fase.id}>
              {/* Section header */}
              <div
                className={`flex items-center justify-between rounded-xl border px-3 py-2 mb-2 ${fase.headerBg}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${fase.dotColor}`} />
                  <span className="text-xs font-bold text-slate-700">
                    {fase.label}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${fase.color}`}
                  >
                    {opsInFase.length}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {formatBRL(total)}
                </span>
              </div>
              <div className="space-y-2">
                {opsInFase.map((op) => (
                  <OportunidadeCard
                    key={op.id}
                    op={op}
                    faseIndex={faseIndex}
                    onMove={moveOportunidade}
                    onClick={openDetail}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Detail Modal ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          {selectedOp && selectedFase && (
            <>
              <DialogHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Building2 size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base font-bold text-slate-800 leading-tight">
                      {selectedOp.empresa}
                    </DialogTitle>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {selectedOp.titulo}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${selectedFase.color}`}
                  >
                    {selectedFase.label}
                  </span>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Value highlight */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">
                      Valor estimado
                    </p>
                    <p className="text-xl font-bold text-emerald-700">
                      {formatBRL(selectedOp.valor)}
                    </p>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <User size={13} className="text-slate-400" />
                      <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                        Contato
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {selectedOp.contato}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users size={13} className="text-slate-400" />
                      <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                        Vendedor
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {selectedOp.vendedor}
                    </p>
                  </div>
                  {selectedOp.telefone && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Phone size={13} className="text-slate-400" />
                        <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                          Telefone
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {selectedOp.telefone}
                      </p>
                    </div>
                  )}
                  {selectedOp.email && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Mail size={13} className="text-slate-400" />
                        <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                          E-mail
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700 truncate">
                        {selectedOp.email}
                      </p>
                    </div>
                  )}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock size={13} className="text-slate-400" />
                      <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                        Última atualização
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {getDiasLabel(selectedOp.diasSemAtualizar)} atrás
                    </p>
                  </div>
                </div>

                {/* Description */}
                {selectedOp.descricao && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FileText size={13} className="text-slate-400" />
                      <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                        Descrição
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {selectedOp.descricao}
                    </p>
                  </div>
                )}

                {/* Move buttons inside detail */}
                {(() => {
                  const idx = FASES.findIndex(
                    (f) => f.id === selectedOp.fase
                  );
                  return (
                    <div className="flex gap-2 pt-1">
                      {idx > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl border-slate-200 text-slate-600"
                          onClick={() => {
                            moveOportunidade(selectedOp.id, "prev");
                            setSelectedOp((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    fase: FASES[idx - 1].id,
                                    diasSemAtualizar: 0,
                                  }
                                : prev
                            );
                          }}
                        >
                          <ChevronLeft size={16} className="mr-1" />
                          {FASES[idx - 1].label}
                        </Button>
                      )}
                      {idx < FASES.length - 1 && (
                        <Button
                          size="sm"
                          className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => {
                            moveOportunidade(selectedOp.id, "next");
                            setSelectedOp((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    fase: FASES[idx + 1].id,
                                    diasSemAtualizar: 0,
                                  }
                                : prev
                            );
                          }}
                        >
                          {FASES[idx + 1].label}
                          <ChevronRight size={16} className="ml-1" />
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── New Opportunity Modal ── */}
      <Dialog
        open={isNewOpen}
        onOpenChange={(open) => {
          if (!open) {
            setForm(FORM_INITIAL);
            setFormErrors({});
          }
          setIsNewOpen(open);
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              Nova Oportunidade
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Empresa */}
            <div className="space-y-1.5">
              <Label htmlFor="nova-empresa" className="text-sm font-semibold text-slate-700">
                Empresa <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nova-empresa"
                placeholder="Nome da empresa"
                value={form.empresa}
                onChange={(e) => updateForm("empresa", e.target.value)}
                className={`rounded-xl h-11 border-slate-200 ${
                  formErrors.empresa ? "border-red-400 focus-visible:ring-red-400" : ""
                }`}
              />
              {formErrors.empresa && (
                <p className="text-xs text-red-500">{formErrors.empresa}</p>
              )}
            </div>

            {/* Contato */}
            <div className="space-y-1.5">
              <Label htmlFor="nova-contato" className="text-sm font-semibold text-slate-700">
                Contato
              </Label>
              <Input
                id="nova-contato"
                placeholder="Nome do responsável"
                value={form.contato}
                onChange={(e) => updateForm("contato", e.target.value)}
                className="rounded-xl h-11 border-slate-200"
              />
            </div>

            {/* Telefone + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nova-telefone" className="text-sm font-semibold text-slate-700">
                  Telefone
                </Label>
                <Input
                  id="nova-telefone"
                  placeholder="(51) 99999-9999"
                  value={form.telefone}
                  onChange={(e) => updateForm("telefone", e.target.value)}
                  className="rounded-xl h-11 border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nova-email" className="text-sm font-semibold text-slate-700">
                  E-mail
                </Label>
                <Input
                  id="nova-email"
                  type="email"
                  placeholder="email@empresa.com"
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  className="rounded-xl h-11 border-slate-200"
                />
              </div>
            </div>

            {/* Título */}
            <div className="space-y-1.5">
              <Label htmlFor="nova-titulo" className="text-sm font-semibold text-slate-700">
                Título do negócio <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nova-titulo"
                placeholder="Ex: Kit PDV Campanha Verão - 50 Lojas"
                value={form.titulo}
                onChange={(e) => updateForm("titulo", e.target.value)}
                className={`rounded-xl h-11 border-slate-200 ${
                  formErrors.titulo ? "border-red-400 focus-visible:ring-red-400" : ""
                }`}
              />
              {formErrors.titulo && (
                <p className="text-xs text-red-500">{formErrors.titulo}</p>
              )}
            </div>

            {/* Valor + Vendedor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nova-valor" className="text-sm font-semibold text-slate-700">
                  Valor estimado (R$) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nova-valor"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.valor}
                  onChange={(e) => updateForm("valor", e.target.value)}
                  className={`rounded-xl h-11 border-slate-200 ${
                    formErrors.valor ? "border-red-400 focus-visible:ring-red-400" : ""
                  }`}
                />
                {formErrors.valor && (
                  <p className="text-xs text-red-500">{formErrors.valor}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nova-vendedor" className="text-sm font-semibold text-slate-700">
                  Vendedor
                </Label>
                <Input
                  id="nova-vendedor"
                  placeholder="Nome do vendedor"
                  value={form.vendedor}
                  onChange={(e) => updateForm("vendedor", e.target.value)}
                  className="rounded-xl h-11 border-slate-200"
                />
              </div>
            </div>

            {/* Stage */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">
                Etapa inicial
              </Label>
              <Select
                value={form.fase}
                onValueChange={(val) => updateForm("fase", val as FaseId)}
              >
                <SelectTrigger className="rounded-xl h-11 border-slate-200">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {FASES.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="nova-descricao" className="text-sm font-semibold text-slate-700">
                Descrição
              </Label>
              <Textarea
                id="nova-descricao"
                placeholder="Contexto, observações e próximos passos..."
                value={form.descricao}
                onChange={(e) => updateForm("descricao", e.target.value)}
                className="rounded-xl border-slate-200 resize-none min-h-[80px]"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setForm(FORM_INITIAL);
                setFormErrors({});
                setIsNewOpen(false);
              }}
              className="rounded-xl border-slate-200 text-slate-600"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveNew}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus size={16} className="mr-1.5" />
              Criar Oportunidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

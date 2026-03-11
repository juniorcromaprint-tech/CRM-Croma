// ============================================================================
// CHECKLIST SHEET — Execução digital de checklists de instalação/produção
// Abre como Sheet lateral a partir de um job de instalação
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Minus,
  ClipboardList,
  Loader2,
  Play,
  ChevronRight,
  TriangleAlert,
} from "lucide-react";
import {
  useChecklists,
  useChecklistItens,
  useChecklistExecucao,
  useChecklistExecucaoItens,
  useIniciarChecklist,
  useMarcarItem,
  useConcluirChecklist,
  CATEGORIA_CONFIG,
  type ChecklistItem,
  type ChecklistExecucaoItem,
} from "../hooks/useChecklist";
import type { CampoInstalacao } from "../services/instalacao.service";

// ─── Status item config ───────────────────────────────────────────────────────

const ITEM_STATUS_CONFIG = {
  conforme: {
    label: "Conforme",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  nao_conforme: {
    label: "Não Conforme",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
  },
  nao_aplicavel: {
    label: "N/A",
    icon: Minus,
    color: "text-slate-400",
    bg: "bg-slate-50 border-slate-200",
    badgeClass: "bg-slate-100 text-slate-500 border-slate-200",
  },
  pendente: {
    label: "Pendente",
    icon: ClipboardList,
    color: "text-amber-500",
    bg: "bg-amber-50 border-amber-200",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
} as const;

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ total, conforme, naoConforme, naoAplicavel }: {
  total: number;
  conforme: number;
  naoConforme: number;
  naoAplicavel: number;
}) {
  const percentConforme = total > 0 ? (conforme / total) * 100 : 0;
  const percentNaoConforme = total > 0 ? (naoConforme / total) * 100 : 0;
  const percentNaoAplicavel = total > 0 ? (naoAplicavel / total) * 100 : 0;
  const pendente = total - conforme - naoConforme - naoAplicavel;

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
        <div className="bg-emerald-500 transition-all" style={{ width: `${percentConforme}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${percentNaoConforme}%` }} />
        <div className="bg-slate-300 transition-all" style={{ width: `${percentNaoAplicavel}%` }} />
      </div>
      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{conforme} conformes</span>
        {naoConforme > 0 && <span className="flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500" />{naoConforme} não conf.</span>}
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" />{naoAplicavel} N/A</span>
        {pendente > 0 && <span className="flex items-center gap-1 text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-300" />{pendente} pendentes</span>}
        <span className="ml-auto font-medium text-slate-700">{total > 0 ? Math.round(((conforme + naoAplicavel) / total) * 100) : 0}% ok</span>
      </div>
    </div>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────────

function ChecklistItemRow({
  item,
  execucaoItem,
  onMark,
  disabled,
}: {
  item: ChecklistItem;
  execucaoItem?: ChecklistExecucaoItem;
  onMark: (itemId: string, status: ChecklistExecucaoItem["status"]) => void;
  disabled: boolean;
}) {
  const status = execucaoItem?.status ?? "pendente";
  const cfg = ITEM_STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const catCfg = CATEGORIA_CONFIG[item.categoria] ?? { label: item.categoria, color: "bg-slate-50 text-slate-600 border-slate-200", emoji: "•" };

  return (
    <div className={`rounded-xl border p-3 transition-colors ${cfg.bg}`}>
      <div className="flex items-start gap-3">
        {/* Número */}
        <span className="text-[11px] font-bold text-slate-400 w-6 flex-shrink-0 pt-0.5 tabular-nums">
          {item.numero_item}.
        </span>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <p className={`text-sm font-medium ${status === 'pendente' ? 'text-slate-700' : status === 'conforme' ? 'text-emerald-800' : status === 'nao_conforme' ? 'text-red-800' : 'text-slate-500'}`}>
              {item.descricao}
            </p>
            {item.obrigatorio && (
              <span className="text-[10px] text-red-500 font-semibold">*obrigatório</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${catCfg.color}`}>
              <span>{catCfg.emoji}</span>
              {catCfg.label}
            </span>
          </div>
        </div>

        {/* Ações */}
        {!disabled && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              title="Conforme"
              onClick={() => onMark(item.id, "conforme")}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                status === "conforme"
                  ? "bg-emerald-500 text-white"
                  : "bg-white border border-slate-200 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300"
              }`}
            >
              <CheckCircle2 size={15} />
            </button>
            <button
              title="Não Conforme"
              onClick={() => onMark(item.id, "nao_conforme")}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                status === "nao_conforme"
                  ? "bg-red-500 text-white"
                  : "bg-white border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
              }`}
            >
              <XCircle size={15} />
            </button>
            <button
              title="Não Aplicável"
              onClick={() => onMark(item.id, "nao_aplicavel")}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                status === "nao_aplicavel"
                  ? "bg-slate-400 text-white"
                  : "bg-white border border-slate-200 text-slate-400 hover:bg-slate-100"
              }`}
            >
              <Minus size={15} />
            </button>
          </div>
        )}

        {/* Status badge (modo somente leitura) */}
        {disabled && (
          <Badge variant="secondary" className={`text-[10px] flex-shrink-0 ${cfg.badgeClass}`}>
            <Icon size={10} className="mr-1" />
            {cfg.label}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ChecklistSheetProps {
  job: CampoInstalacao | null;
  open: boolean;
  onClose: () => void;
}

export default function ChecklistSheet({ job, open, onClose }: ChecklistSheetProps) {
  const [checklistSelecionadoId, setChecklistSelecionadoId] = useState<string>("");
  const [obsGerais, setObsGerais] = useState("");
  const [showObs, setShowObs] = useState(false);

  const { data: checklists = [] } = useChecklists();
  const { data: itens = [], isLoading: loadingItens } = useChecklistItens(checklistSelecionadoId || undefined);
  const { data: execucao, isLoading: loadingExec } = useChecklistExecucao(
    job?.job_id,
    checklistSelecionadoId || undefined
  );
  const { data: execucaoItens = [] } = useChecklistExecucaoItens(execucao?.id);

  const iniciar = useIniciarChecklist();
  const marcar = useMarcarItem();
  const concluir = useConcluirChecklist();

  // Mapa itemId → execucaoItem
  const execucaoMap = useMemo(() => {
    const map = new Map<string, ChecklistExecucaoItem>();
    execucaoItens.forEach((ei) => map.set(ei.item_id, ei));
    return map;
  }, [execucaoItens]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = execucaoItens.length;
    const conforme = execucaoItens.filter((i) => i.status === "conforme").length;
    const naoConforme = execucaoItens.filter((i) => i.status === "nao_conforme").length;
    const naoAplicavel = execucaoItens.filter((i) => i.status === "nao_aplicavel").length;
    return { total, conforme, naoConforme, naoAplicavel };
  }, [execucaoItens]);

  // Itens agrupados por categoria
  const itensPorCategoria = useMemo(() => {
    const grupos: Record<string, ChecklistItem[]> = {};
    itens.forEach((item) => {
      if (!grupos[item.categoria]) grupos[item.categoria] = [];
      grupos[item.categoria].push(item);
    });
    return grupos;
  }, [itens]);

  const concluido = execucao?.status === "concluido";
  const emAndamento = execucao?.status === "em_andamento";

  async function handleIniciar() {
    if (!job || !checklistSelecionadoId) return;
    await iniciar.mutateAsync({
      checklistId: checklistSelecionadoId,
      referenciaId: job.job_id,
    });
  }

  async function handleMarcar(itemId: string, status: ChecklistExecucaoItem["status"]) {
    if (!execucao) return;
    await marcar.mutateAsync({ execucaoId: execucao.id, itemId, status });
  }

  async function handleConcluir() {
    if (!execucao || !checklistSelecionadoId || !job) return;
    await concluir.mutateAsync({
      execucaoId: execucao.id,
      referenciaId: job.job_id,
      checklistId: checklistSelecionadoId,
      observacoesGerais: obsGerais || undefined,
    });
  }

  const temNaoConforme = stats.naoConforme > 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-5">
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList size={20} className="text-blue-600" />
            Checklist — {job?.os_number}
          </SheetTitle>
          <p className="text-sm text-slate-500">{job?.loja_nome}</p>
        </SheetHeader>

        {/* Seleção do checklist */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
            Selecionar Checklist
          </label>
          <Select
            value={checklistSelecionadoId}
            onValueChange={(v) => setChecklistSelecionadoId(v)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Escolha o tipo de checklist..." />
            </SelectTrigger>
            <SelectContent>
              {checklists.map((cl) => (
                <SelectItem key={cl.id} value={cl.id}>
                  <span className="flex items-center gap-2">
                    <ClipboardList size={13} className="text-blue-500" />
                    {cl.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading state */}
        {checklistSelecionadoId && (loadingItens || loadingExec) && (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            Carregando...
          </div>
        )}

        {/* Iniciar checklist */}
        {checklistSelecionadoId && !loadingExec && !execucao && itens.length > 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
              <ClipboardList size={30} className="text-blue-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-800 mb-1">
                {checklists.find((c) => c.id === checklistSelecionadoId)?.nome}
              </p>
              <p className="text-sm text-slate-500">{itens.length} itens para verificar</p>
            </div>
            <Button
              onClick={handleIniciar}
              disabled={iniciar.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 gap-2"
            >
              {iniciar.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Play size={15} />
              )}
              Iniciar Checklist
            </Button>
          </div>
        )}

        {/* Execução em andamento ou concluída */}
        {execucao && itens.length > 0 && (
          <div className="space-y-4">
            {/* Status + progresso */}
            <div className={`rounded-xl border p-4 ${concluido ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {concluido ? (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  ) : (
                    <Play size={16} className="text-blue-600" />
                  )}
                  <span className={`text-sm font-semibold ${concluido ? "text-emerald-700" : "text-blue-700"}`}>
                    {concluido ? "Checklist Concluído" : "Em Andamento"}
                  </span>
                  {temNaoConforme && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                      <TriangleAlert size={10} />
                      {stats.naoConforme} não conforme{stats.naoConforme > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {stats.conforme + stats.naoAplicavel}/{stats.total} verificados
                </span>
              </div>
              <ProgressBar
                total={stats.total}
                conforme={stats.conforme}
                naoConforme={stats.naoConforme}
                naoAplicavel={stats.naoAplicavel}
              />
            </div>

            {/* Itens por categoria */}
            {Object.entries(itensPorCategoria).map(([categoria, itemsGrupo]) => {
              const catCfg = CATEGORIA_CONFIG[categoria] ?? {
                label: categoria,
                color: "bg-slate-50 text-slate-600 border-slate-200",
                emoji: "•",
              };
              return (
                <div key={categoria}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${catCfg.color}`}>
                      {catCfg.emoji} {catCfg.label}
                    </span>
                    <span className="text-xs text-slate-400">{itemsGrupo.length} itens</span>
                  </div>
                  <div className="space-y-2">
                    {itemsGrupo.map((item) => (
                      <ChecklistItemRow
                        key={item.id}
                        item={item}
                        execucaoItem={execucaoMap.get(item.id)}
                        onMark={handleMarcar}
                        disabled={concluido}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Observações gerais + concluir */}
            {emAndamento && (
              <>
                <Separator />
                <div>
                  <button
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-2"
                    onClick={() => setShowObs((v) => !v)}
                  >
                    <ChevronRight
                      size={14}
                      className={`transition-transform ${showObs ? "rotate-90" : ""}`}
                    />
                    Observações gerais (opcional)
                  </button>
                  {showObs && (
                    <Textarea
                      value={obsGerais}
                      onChange={(e) => setObsGerais(e.target.value)}
                      placeholder="Anotações sobre a verificação..."
                      className="rounded-xl text-sm min-h-[80px]"
                    />
                  )}
                </div>

                <Button
                  onClick={handleConcluir}
                  disabled={concluir.isPending || stats.total === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 gap-2"
                >
                  {concluir.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  Concluir Checklist
                  {temNaoConforme && (
                    <span className="ml-1 text-xs opacity-80">
                      ({stats.naoConforme} não conf.)
                    </span>
                  )}
                </Button>
              </>
            )}

            {/* Conclusão info */}
            {concluido && execucao.concluido_em && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                <CheckCircle2 size={14} className="inline mr-1.5" />
                Concluído em{" "}
                {new Date(execucao.concluido_em).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {execucao.observacoes_gerais && (
                  <p className="mt-1.5 text-emerald-600 text-xs">{execucao.observacoes_gerais}</p>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

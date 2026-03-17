// ============================================================================
// ORÇAMENTO EDITOR PAGE — v3.0
// Editor completo com seleção de produto → modelo → materiais → acabamentos
// Layout 2 colunas: wizard 3 etapas (esquerda) + pricing em tempo real (direita)
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, FileText,
  ChevronDown, ChevronUp, AlertTriangle, Package, Layers, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  useOrcamento,
  useCriarOrcamento,
  useAtualizarOrcamento,
  useAdicionarItemDetalhado,
  useRemoverItemOrcamento,
  useSalvarServicos,
} from "../hooks/useOrcamentos";
import { useRegrasPrecificacao } from "../hooks/useOrcamentoPricing";
import { useItemEditor } from "../hooks/useItemEditor";
import PricingCalculator from "../components/PricingCalculator";
import ProdutoSelector from "../components/ProdutoSelector";
import MaterialEditor from "../components/MaterialEditor";
import AcabamentoSelector from "../components/AcabamentoSelector";
import ServicoSelector from "../components/ServicoSelector";
import TemplateSelector from "../components/TemplateSelector";
import ItemStep3Revisao from "../components/ItemStep3Revisao";
import ClienteCombobox from "@/shared/components/ClienteCombobox";
import type { OrcamentoServicoItem } from "../components/ServicoSelector";
import type { OrcamentoTemplate } from "../components/TemplateSelector";
import type { RegraPrecificacao } from "@/shared/services/orcamento-pricing.service";
import { validarDesconto } from "@/shared/services/orcamento-pricing.service";
import { brl } from "@/shared/utils/format";
import { showError, showSuccess } from "@/utils/toast";
import { toast } from "sonner";
import { orcamentoService } from "../services/orcamento.service";
import { CondicoesPagamento, type PaymentConditions } from "../components/CondicoesPagamento";
import AIButton from '@/domains/ai/components/AIButton';
import ComposicaoSugestao from '@/domains/ai/components/ComposicaoSugestao';
import AISidebar from '@/domains/ai/components/AISidebar';
import { useAISidebar } from '@/domains/ai/hooks/useAISidebar';
import { useAnalisarOrcamento } from '@/domains/ai/hooks/useAnalisarOrcamento';
import { useComposicaoProduto } from '@/domains/ai/hooks/useComposicaoProduto';
import { useQueryClient } from '@tanstack/react-query';
import type { AIResponse } from '@/domains/ai/types/ai.types';

import type { ItemEditorState } from "../hooks/useItemEditor";

// ─── Step definitions ────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { label: "Produto", icon: Package },
  { label: "Materiais", icon: Layers },
  { label: "Revisão", icon: CheckCircle },
] as const;

// ─── StepIndicator component ─────────────────────────────────────────────────

interface StepIndicatorProps {
  currentStep: number; // 1, 2, or 3
}

function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-0 mb-5">
      {WIZARD_STEPS.map((step, idx) => {
        const stepNum = idx + 1;
        const isDone = currentStep > stepNum;
        const isActive = currentStep === stepNum;
        const Icon = step.icon;

        return (
          <React.Fragment key={stepNum}>
            <div className="flex flex-col items-center gap-1 min-w-[64px]">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isDone
                    ? "bg-emerald-500 text-white"
                    : isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                <Icon size={14} />
              </div>
              <span
                className={`text-[10px] font-medium leading-tight text-center ${
                  isDone
                    ? "text-emerald-600"
                    : isActive
                    ? "text-blue-700"
                    : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mb-4 transition-colors ${
                  currentStep > stepNum ? "bg-emerald-400" : "bg-slate-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── StepSummaryBadge — compact summary of prior steps ──────────────────────

interface StepSummaryBadgeProps {
  item: ItemEditorState;
  visibleFrom: number; // show only when currentStep >= visibleFrom
  currentStep: number;
}

function StepSummaryBadge({ item, visibleFrom, currentStep }: StepSummaryBadgeProps) {
  if (currentStep < visibleFrom) return null;

  const parts: string[] = [];
  if (item.descricao) parts.push(item.descricao);
  if (item.quantidade > 1) parts.push(`x${item.quantidade}`);
  if (item.largura_cm && item.altura_cm) parts.push(`${item.largura_cm}x${item.altura_cm}cm`);

  if (parts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {parts.map((p, i) => (
        <Badge key={i} variant="secondary" className="text-xs bg-slate-100 text-slate-600 border-slate-200">
          {p}
        </Badge>
      ))}
      {item.materiais.length > 0 && (
        <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          {item.materiais.length} {item.materiais.length === 1 ? "material" : "materiais"}
        </Badge>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function OrcamentoEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "novo";

  const { data: orcamento, isLoading } = useOrcamento(isNew ? undefined : id);
  const criar = useCriarOrcamento();
  const atualizar = useAtualizarOrcamento();
  const adicionarItem = useAdicionarItemDetalhado();
  const removerItem = useRemoverItemOrcamento();
  const salvarServicos = useSalvarServicos();

  // ─── Form state (header) ────────────────────────────────────────────────
  const [titulo, setTitulo] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [descontoPercentual, setDescontoPercentual] = useState(0);
  const [condicoes, setCondicoes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [validadeDias, setValidadeDias] = useState(10);

  // ─── Item editor hook ───────────────────────────────────────────────────
  const editor = useItemEditor();

  // ─── Item form visibility ───────────────────────────────────────────────
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemFormExpanded, setItemFormExpanded] = useState(true);

  // ─── Serviços state ─────────────────────────────────────────────────────
  const [servicos, setServicos] = useState<OrcamentoServicoItem[]>([]);

  // ─── Template modal ─────────────────────────────────────────────────────
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // ─── AI state ────────────────────────────────────────────────────────────
  const queryClient = useQueryClient();
  const [composicaoResult, setComposicaoResult] = useState<AIResponse | null>(null);
  const analisarOrcamento = useAnalisarOrcamento();
  const composicaoProduto = useComposicaoProduto();
  const aiSidebar = useAISidebar({
    entityType: 'proposta',
    entityId: id ?? '',
    onActionsApplied: () => {
      queryClient.invalidateQueries({ queryKey: ['proposta', id] });
    },
  });

  // ─── Payment conditions ──────────────────────────────────────────────────
  const [paymentConditions, setPaymentConditions] = useState<PaymentConditions>({
    forma_pagamento: '',
    parcelas_count: 1,
    entrada_percentual: 0,
    prazo_dias: [],
  });

  // ─── Pre-fill form when editing ─────────────────────────────────────────
  useEffect(() => {
    if (orcamento) {
      setTitulo(orcamento.titulo || "");
      setClienteId(orcamento.cliente_id || "");
      setDescontoPercentual(orcamento.desconto_percentual || 0);
      setCondicoes(orcamento.condicoes_pagamento || "");
      setObservacoes(orcamento.observacoes || "");
      setValidadeDias(orcamento.validade_dias || 10);
      setPaymentConditions({
        forma_pagamento: (orcamento as any).forma_pagamento || '',
        parcelas_count: (orcamento as any).parcelas_count || 1,
        entrada_percentual: (orcamento as any).entrada_percentual || 0,
        prazo_dias: (orcamento as any).prazo_dias || [],
      });

      // Load existing servicos
      if (orcamento.servicos && orcamento.servicos.length > 0) {
        setServicos(
          orcamento.servicos.map((s) => ({
            servico_id: s.servico_id,
            descricao: s.descricao,
            horas: s.horas,
            valor_unitario: s.valor_unitario,
            valor_total: s.valor_total,
          })),
        );
      }
    }
  }, [orcamento]);

  // ─── Pricing & alerts — delegated to useItemEditor ──────────────────────
  const { pricingResult, markupSugerido, validacaoMarkup, isDefaultConfig } = editor;
  // newItem shorthand for local convenience
  const newItem = editor.newItem;
  const currentStep = editor.currentStep;

  // ─── Desconto validation ────────────────────────────────────────────────
  const { data: regrasDesconto = [] } = useRegrasPrecificacao();

  const descontoValidation = useMemo(() => {
    if (descontoPercentual <= 0) return { valido: true, desconto_maximo: 10, requer_aprovacao: false, aviso: null };
    const subtotal = orcamento?.subtotal ?? 0;
    return validarDesconto(
      descontoPercentual,
      null, // categoria geral
      regrasDesconto as RegraPrecificacao[],
      subtotal,
    );
  }, [descontoPercentual, regrasDesconto, orcamento?.subtotal]);

  // ─── Item handlers — delegated to useItemEditor ─────────────────────────

  const handleProdutoChange = editor.handleProdutoChange;
  const handleModeloChange = editor.handleModeloChange;
  const handleMateriaisChange = editor.handleMateriaisChange;
  const handleAcabamentosChange = editor.handleAcabamentosChange;

  // ─── Step navigation (with validation) ───────────────────────────────────

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!newItem.descricao.trim()) {
        showError("Informe a descricao do item antes de continuar");
        return;
      }
      // A-08: Validar quantidade mínima na navegação do wizard
      if (!newItem.quantidade || newItem.quantidade < 1) {
        showError("Quantidade mínima é 1");
        return;
      }
    }
    if (currentStep === 2) {
      const hasMateriais = newItem.materiais.length > 0;
      const hasDimensoes = newItem.largura_cm !== null && newItem.altura_cm !== null;
      if (!hasMateriais && !hasDimensoes) {
        showError("Adicione pelo menos 1 material ou informe as dimensoes (largura x altura)");
        return;
      }
    }
    editor.nextStep();
  };

  const handlePrevStep = () => {
    editor.prevStep();
  };

  const handleSave = async () => {
    if (!titulo.trim()) { showError("Informe o titulo do orcamento"); return; }
    if (!clienteId) { showError("Selecione o cliente"); return; }
    if (!descontoValidation.valido) {
      showError(`Desconto de ${descontoPercentual}% excede o máximo permitido (${descontoValidation.desconto_maximo}%). Reduza ou solicite aprovação.`);
      return;
    }
    if (!isNew && (orcamento?.total ?? 0) <= 0) {
      showError('Orçamento sem valor. Configure os materiais do modelo antes de salvar.');
      return;
    }

    if (isNew) {
      const orc = await criar.mutateAsync({
        titulo,
        cliente_id: clienteId,
        validade_dias: validadeDias,
        condicoes_pagamento: condicoes || null,
        observacoes: observacoes || null,
      });
      navigate(`/orcamentos/${orc.id}/editar`, { replace: true });
    } else if (id) {
      await atualizar.mutateAsync({
        id,
        updates: {
          titulo,
          cliente_id: clienteId,
          desconto_percentual: descontoPercentual,
          condicoes_pagamento: condicoes || null,
          observacoes: observacoes || null,
          validade_dias: validadeDias,
          forma_pagamento: paymentConditions.forma_pagamento || null,
          parcelas_count: paymentConditions.parcelas_count,
          entrada_percentual: paymentConditions.entrada_percentual,
          prazo_dias: paymentConditions.prazo_dias,
        } as any,
        version: (orcamento as any)?.version,
      });

      // Salvar serviços
      if (servicos.length > 0) {
        await salvarServicos.mutateAsync({
          propostaId: id,
          servicos: servicos.map((s) => ({
            servico_id: s.servico_id,
            descricao: s.descricao,
            horas: s.horas,
            valor_unitario: s.valor_unitario,
            valor_total: s.valor_total,
          })),
        });
      }
    }
  };

  const handleAddItem = async () => {
    if (editor.isDefaultConfig) { showError("Configure os parâmetros de precificação antes de adicionar itens"); return; }
    if (!newItem.descricao.trim()) { showError("Informe a descricao do item"); return; }
    if (!id || isNew) { showError("Salve o orcamento antes de adicionar itens"); return; }
    if (pricingResult === null) { showError("Preencha os dados do item corretamente"); return; }

    // A-08: Quantidade deve ser >= 1
    if (!newItem.quantidade || newItem.quantidade < 1) {
      showError("Quantidade mínima é 1");
      return;
    }

    // C-01: Bloquear item com valor R$ 0,00 — modelo precisa ter BOM populada
    if (!pricingResult.precoTotal || pricingResult.precoTotal <= 0) {
      showError("Não é possível adicionar item com valor R$ 0,00. Verifique se o modelo possui materiais e processos cadastrados.");
      return;
    }

    try {
      await adicionarItem.mutateAsync({
        propostaId: id,
        item: {
          produto_id: newItem.produto_id,
          modelo_id: newItem.modelo_id ?? undefined,
          descricao: newItem.descricao,
          especificacao: newItem.especificacao || null,
          quantidade: newItem.quantidade,
          unidade: "un",
          largura_cm: newItem.largura_cm,
          altura_cm: newItem.altura_cm,
          area_m2: pricingResult.areaM2,
          custo_mp: pricingResult.custoMP,
          custo_mo: pricingResult.custoMO,
          custo_fixo: Math.max(0, pricingResult.custoTotal - pricingResult.custoMP - pricingResult.custoMO),
          markup_percentual: newItem.markup_percentual,
          preco_override: editor.isPrecoOverride,
          valor_unitario: pricingResult.precoUnitario,
          valor_total: pricingResult.precoTotal,
          ordem: (orcamentoItens.length ?? 0) + 1,
          // Detalhes do item
          materiais: newItem.materiais.map((m) => ({
            material_id: m.material_id ?? null,
            descricao: m.descricao,
            quantidade: m.quantidade,
            unidade: m.unidade,
            custo_unitario: m.custo_unitario,
            custo_total: m.quantidade * m.custo_unitario,
          })),
          acabamentos: newItem.acabamentos.map((a) => ({
            acabamento_id: a.acabamento_id ?? null,
            descricao: a.descricao,
            quantidade: a.quantidade,
            custo_unitario: a.custo_unitario,
            custo_total: a.quantidade * a.custo_unitario,
          })),
          processos: newItem.processos.map((p, idx) => ({
            etapa: p.etapa,
            tempo_minutos: p.tempo_minutos,
            ordem: idx,
          })),
        },
      });

      // NOTE: recalcularTotais + cache invalidation already handled by
      // useAdicionarItemDetalhado hook's mutationFn and onSuccess
      editor.reset();
      setShowItemForm(false);
      showSuccess("Item adicionado com sucesso!");
    } catch (err: any) {
      console.error("[handleAddItem] Falha ao adicionar item:", err);
      showError(err?.message || "Erro ao adicionar item ao orçamento");
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!id) return;
    await removerItem.mutateAsync({ itemId, propostaId: id });
    await orcamentoService.recalcularTotais(id);
  };

  const handleTemplateSelect = async (template: OrcamentoTemplate) => {
    if (!template.itens || template.itens.length === 0) {
      setShowTemplateModal(false);
      return;
    }

    if (template.itens.length === 1) {
      // Single item: populate the editor form
      const firstItem = template.itens[0];
      editor.reset();
      editor.setNewItem((s) => ({
        ...s,
        descricao: firstItem.descricao,
        especificacao: firstItem.especificacao || "",
        quantidade: firstItem.quantidade,
        largura_cm: firstItem.largura_cm,
        altura_cm: firstItem.altura_cm,
        markup_percentual: firstItem.markup_percentual,
      }));
      setShowItemForm(true);
      setShowTemplateModal(false);
      showSuccess(`Template "${template.nome}" aplicado!`);
    } else {
      // Multiple items: add all directly to the budget
      if (!id || isNew) {
        showError("Salve o orcamento antes de aplicar templates com multiplos itens");
        setShowTemplateModal(false);
        return;
      }
      try {
        for (const item of template.itens) {
          const largura = item.largura_cm ?? undefined;
          const altura = item.altura_cm ?? undefined;
          await adicionarItem.mutateAsync({
            propostaId: id,
            item: {
              descricao: item.descricao,
              especificacao: item.especificacao || "",
              quantidade: item.quantidade ?? 1,
              largura_cm: largura ?? null,
              altura_cm: altura ?? null,
              area_m2: (largura && altura) ? (largura * altura) / 10000 : undefined,
              markup_percentual: item.markup_percentual ?? 40,
              valor_unitario: 0,
              valor_total: 0,
              // Templates não carregam materiais/processos — itens ficam como rascunho
              materiais: [],
              acabamentos: [],
              processos: [],
            },
          });
        }
        await orcamentoService.recalcularTotais(id);
        showSuccess(
          `${template.itens.length} itens adicionados. Abra cada item para selecionar produto/modelo e calcular o preço.`,
        );
      } catch {
        showError("Erro ao aplicar template");
      }
      setShowTemplateModal(false);
    }
  };

  // ─── Derived data ───────────────────────────────────────────────────────

  const isSaving = criar.isPending || atualizar.isPending;

  const orcamentoItens = (orcamento as {
    itens?: Array<{
      id: string;
      descricao: string;
      especificacao: string | null;
      quantidade: number;
      largura_cm: number | null;
      altura_cm: number | null;
      valor_unitario: number;
      valor_total: number;
      custo_mp?: number;
      custo_mo?: number;
      markup_percentual?: number;
      materiais?: Array<{ descricao: string; quantidade: number; custo_unitario: number; custo_total: number }>;
      acabamentos?: Array<{ descricao: string; quantidade: number; custo_unitario: number; custo_total: number }>;
    }>;
  } | undefined)?.itens ?? [];

  const totalServicos = servicos.reduce((sum, s) => sum + s.valor_total, 0);

  // ─── Loading state ──────────────────────────────────────────────────────

  if (!isNew && isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-16">
      {/* ══════════ HEADER ══════════ */}
      <div className="flex items-center gap-4">
        <Link to="/orcamentos">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">
            {isNew ? "Novo Orçamento" : `Editar ${orcamento?.numero || "Orçamento"}`}
          </h1>
          {!isNew && orcamento && (
            <p className="text-slate-500 text-sm mt-0.5">
              {orcamento.titulo} · {brl(orcamento.total)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => setShowTemplateModal(true)}
            >
              <FileText size={14} /> Template
            </Button>
          )}
          {!isNew && (
            <AIButton
              label="Analisar Orcamento"
              onClick={(model) => {
                analisarOrcamento.mutate({ propostaId: id!, model }, {
                  onSuccess: (data) => aiSidebar.open(data),
                });
              }}
              isLoading={analisarOrcamento.isPending}
            />
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-5"
          >
            {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* ══════════ DADOS DO ORCAMENTO ══════════ */}
      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-slate-800">Dados do Orçamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="titulo">Titulo *</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Fachada principal + PDV loja centro"
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label>Cliente *</Label>
              <ClienteCombobox
                value={clienteId}
                onValueChange={setClienteId}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="validade">Validade (dias)</Label>
              <Input
                id="validade"
                type="number"
                min={1}
                value={validadeDias}
                onChange={(e) => setValidadeDias(Number(e.target.value))}
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="desconto">Desconto (%)</Label>
              <Input
                id="desconto"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={descontoPercentual}
                onChange={(e) => setDescontoPercentual(Number(e.target.value))}
                className={`mt-1.5 rounded-xl ${
                  !descontoValidation.valido
                    ? "border-red-400 focus-visible:ring-red-400"
                    : descontoValidation.aviso
                      ? "border-amber-400 focus-visible:ring-amber-400"
                      : ""
                }`}
              />
              {!descontoValidation.valido && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {descontoValidation.aviso}
                </p>
              )}
              {descontoValidation.valido && descontoValidation.aviso && (
                <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {descontoValidation.aviso}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="condicoes">Condições de Pagamento</Label>
              <Input
                id="condicoes"
                value={condicoes}
                onChange={(e) => setCondicoes(e.target.value)}
                placeholder="Ex: 50% entrada + 50% na entrega"
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações adicionais para o cliente..."
                className="mt-1.5 rounded-xl min-h-[80px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════════ ITENS DO ORCAMENTO ══════════ */}
      {!isNew && (
        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold text-slate-800">
              Itens do Orcamento
              {orcamentoItens.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({orcamentoItens.length} {orcamentoItens.length === 1 ? "item" : "itens"})
                </span>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-9 gap-2"
              onClick={() => {
                setShowItemForm((s) => !s);
                editor.reset();
              }}
            >
              <Plus size={15} /> Adicionar Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ──── Existing items table ──── */}
            {orcamentoItens.length > 0 ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Descrição</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Qtd</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Unit</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                      <th className="w-8 py-2.5 px-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orcamentoItens.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 group">
                        <td className="py-3 px-3">
                          <p className="font-medium text-slate-800">{item.descricao}</p>
                          {item.especificacao && <p className="text-xs text-slate-400 mt-0.5">{item.especificacao}</p>}
                          {item.largura_cm && item.altura_cm && (
                            <p className="text-xs text-slate-400 mt-0.5">{item.largura_cm}x{item.altura_cm}cm</p>
                          )}
                          {/* Material/acabamento badges */}
                          {(item.materiais?.length || item.acabamentos?.length) ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.materiais?.map((m, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] h-5 bg-blue-50 text-blue-700 border-blue-200">
                                  {m.descricao}
                                </Badge>
                              ))}
                              {item.acabamentos?.map((a, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200">
                                  {a.descricao}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600 tabular-nums hidden md:table-cell">{item.quantidade}</td>
                        <td className="py-3 px-3 text-right text-slate-600 tabular-nums hidden md:table-cell">{brl(item.valor_unitario)}</td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-800 tabular-nums">{brl(item.valor_total)}</td>
                        <td className="py-3 px-3">
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-xl">
                Nenhum item adicionado ainda
              </div>
            )}

            {/* ══════════ NEW ITEM FORM — 3-STEP WIZARD ══════════ */}
            {showItemForm && (
              <div className="border border-blue-200 bg-blue-50/30 rounded-2xl overflow-hidden">
                {/* Form header */}
                <div
                  className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-blue-200 cursor-pointer"
                  onClick={() => setItemFormExpanded((e) => !e)}
                >
                  <p className="text-sm font-semibold text-blue-800">Novo Item — Etapa {currentStep} de 3</p>
                  <div className="flex items-center gap-2">
                    {pricingResult && (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                        {brl(pricingResult.precoUnitario)}/un
                      </Badge>
                    )}
                    {itemFormExpanded ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} className="text-blue-500" />}
                  </div>
                </div>

                {itemFormExpanded && (
                  <div className="p-5">
                    {/* Step Indicator */}
                    <StepIndicator currentStep={currentStep} />

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* ──── LEFT COLUMN (3/5) — Wizard steps ──── */}
                      <div className="lg:col-span-3 space-y-5">

                        {/* ════ STEP 1: Produto & Cliente ════ */}
                        {currentStep === 1 && (
                          <>
                            {/* Produto & Modelo Selector */}
                            <ProdutoSelector
                              produtoId={newItem.produto_id}
                              modeloId={newItem.modelo_id}
                              onProdutoChange={handleProdutoChange}
                              onModeloChange={handleModeloChange}
                            />

                            {/* Descricao + Especificacao */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="md:col-span-2">
                                <Label className="text-xs">Descrição *</Label>
                                <Input
                                  value={newItem.descricao}
                                  onChange={(e) => editor.setNewItem((s) => ({ ...s, descricao: e.target.value }))}
                                  placeholder="Ex: Banner lona 440g com ilhos"
                                  className="mt-1 rounded-xl h-9 text-sm"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Label className="text-xs">Especificação</Label>
                                <Input
                                  value={newItem.especificacao}
                                  onChange={(e) => editor.setNewItem((s) => ({ ...s, especificacao: e.target.value }))}
                                  placeholder="Detalhes adicionais..."
                                  className="mt-1 rounded-xl h-9 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Quantidade</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={newItem.quantidade}
                                  onChange={(e) => {
                                    // A-08: Garantir quantidade >= 1
                                    const val = Math.max(1, Number(e.target.value) || 1);
                                    editor.setNewItem((s) => ({ ...s, quantidade: val }));
                                  }}
                                  className="mt-1 rounded-xl h-9 text-sm"
                                />
                              </div>
                            </div>

                            {/* Step 1 — Nav */}
                            <div className="flex justify-end pt-2">
                              <Button
                                onClick={handleNextStep}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6"
                              >
                                Próximo
                              </Button>
                            </div>
                          </>
                        )}

                        {/* ════ STEP 2: Medidas & Materiais ════ */}
                        {currentStep === 2 && (
                          <>
                            {/* Summary of step 1 selections */}
                            <StepSummaryBadge item={newItem} visibleFrom={2} currentStep={currentStep} />

                            {/* Dimensoes */}
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Dimensoes (opcional — para calcular area)
                              </p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">Largura (cm)</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={newItem.largura_cm ?? ""}
                                    onChange={(e) => editor.setNewItem((s) => ({ ...s, largura_cm: e.target.value ? Number(e.target.value) : null }))}
                                    placeholder="Opcional"
                                    className="mt-1 rounded-xl h-9 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Altura (cm)</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={newItem.altura_cm ?? ""}
                                    onChange={(e) => editor.setNewItem((s) => ({ ...s, altura_cm: e.target.value ? Number(e.target.value) : null }))}
                                    placeholder="Opcional"
                                    className="mt-1 rounded-xl h-9 text-sm"
                                  />
                                </div>
                              </div>
                              {newItem.largura_cm && newItem.altura_cm && (
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                  Area: {((newItem.largura_cm * newItem.altura_cm) / 10000).toFixed(2)} m²
                                </p>
                              )}
                            </div>

                            {/* Materiais */}
                            <MaterialEditor
                              materiais={newItem.materiais}
                              onChange={handleMateriaisChange}
                            />

                            {/* Acabamentos */}
                            <AcabamentoSelector
                              selected={newItem.acabamentos}
                              onChange={handleAcabamentosChange}
                            />

                            {/* Step 2 — Nav */}
                            <div className="flex justify-between pt-2">
                              <Button
                                variant="outline"
                                onClick={handlePrevStep}
                                className="rounded-xl px-5"
                              >
                                Voltar
                              </Button>
                              <Button
                                onClick={handleNextStep}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6"
                              >
                                Próximo
                              </Button>
                            </div>
                          </>
                        )}

                        {/* ════ STEP 3: Revisao & Alertas ════ */}
                        {currentStep === 3 && (
                          <>
                            {/* Summary of prior steps */}
                            <StepSummaryBadge item={newItem} visibleFrom={3} currentStep={currentStep} />

                            <ItemStep3Revisao
                              markup={newItem.markup_percentual}
                              markupSugerido={markupSugerido}
                              markupMinimo={validacaoMarkup.markup_minimo}
                              validacaoMarkup={validacaoMarkup}
                              pricingResult={pricingResult}
                              quantidade={newItem.quantidade}
                              alerts={editor.alerts}
                              overrideSource={editor.overrideSource}
                              isPrecoOverride={editor.isPrecoOverride}
                              precoOverrideValue={editor.precoOverrideValue}
                              precoM2OverrideValue={editor.precoM2OverrideValue}
                              hasArea={!!(newItem.largura_cm && newItem.altura_cm)}
                              isDefaultConfig={isDefaultConfig}
                              volumeDiscount={editor.volumeDiscount}
                              onMarkupChange={editor.handleMarkupChange}
                              onPrecoOverride={editor.handlePrecoOverride}
                              onPrecoM2Override={editor.handlePrecoM2Override}
                              onMarkupSugeridoClick={() => editor.handleMarkupChange(markupSugerido)}
                            />

                            {/* Step 3 — Nav */}
                            <div className="flex justify-between pt-2">
                              <Button
                                variant="outline"
                                onClick={handlePrevStep}
                                className="rounded-xl px-5"
                              >
                                Voltar
                              </Button>
                              <Button
                                onClick={handleAddItem}
                                disabled={editor.isDefaultConfig || adicionarItem.isPending || !pricingResult}
                                className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 px-6"
                              >
                                {adicionarItem.isPending
                                  ? <Loader2 className="animate-spin mr-2" size={14} />
                                  : <Plus size={14} className="mr-2" />
                                }
                                Adicionar Item
                              </Button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* ──── RIGHT COLUMN (2/5) — Pricing sidebar (visible in ALL steps) ──── */}
                      <div className="lg:col-span-2">
                        <div className="sticky top-4 space-y-4">
                          <PricingCalculator resultado={pricingResult} quantidade={newItem.quantidade} />

                          {/* Quick summary */}
                          {pricingResult && (
                            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-xs">
                              <p className="font-semibold text-slate-700 text-sm">Resumo do Item</p>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Quantidade</span>
                                <span className="font-medium tabular-nums">{newItem.quantidade}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Materiais</span>
                                <span className="font-medium tabular-nums">{newItem.materiais.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Acabamentos</span>
                                <span className="font-medium tabular-nums">{newItem.acabamentos.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Processos</span>
                                <span className="font-medium tabular-nums">{newItem.processos.length}</span>
                              </div>
                              <Separator />
                              <div className="flex justify-between">
                                <span className="font-semibold text-slate-700">Preço Total</span>
                                <span className="font-bold text-blue-700 tabular-nums">{brl(pricingResult.precoTotal)}</span>
                              </div>
                            </div>
                          )}

                          {/* Cancel button — always visible */}
                          <Button
                            variant="ghost" size="sm" className="rounded-xl w-full"
                            onClick={() => {
                              setShowItemForm(false);
                              editor.reset();
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══════════ SERVICOS ══════════ */}
            {!isNew && (
              <div className="mt-6">
                <ServicoSelector
                  servicos={servicos}
                  onChange={setServicos}
                />
              </div>
            )}

            {/* ══════════ RESUMO FINANCEIRO ══════════ */}
            {!isNew && orcamento && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex flex-col items-end gap-1.5 text-sm">
                  <div className="flex gap-8 w-72">
                    <span className="text-slate-500 flex-1">Subtotal Itens</span>
                    <span className="font-medium tabular-nums text-right">{brl(orcamento.subtotal - totalServicos)}</span>
                  </div>
                  {totalServicos > 0 && (
                    <div className="flex gap-8 w-72">
                      <span className="text-slate-500 flex-1">Serviços</span>
                      <span className="font-medium tabular-nums text-right">{brl(totalServicos)}</span>
                    </div>
                  )}
                  <div className="flex gap-8 w-72">
                    <span className="text-slate-500 flex-1">Subtotal</span>
                    <span className="font-medium tabular-nums text-right">{brl(orcamento.subtotal)}</span>
                  </div>
                  {orcamento.desconto_percentual > 0 && (
                    <div className="flex gap-8 w-72">
                      <span className="text-red-500 flex-1">Desconto ({orcamento.desconto_percentual}%)</span>
                      <span className="font-medium tabular-nums text-red-600 text-right">-{brl(orcamento.desconto_valor)}</span>
                    </div>
                  )}
                  <Separator className="my-2 w-72" />
                  <div className="flex gap-8 w-72">
                    <span className="font-bold text-slate-800 text-base flex-1">Total</span>
                    <span className="font-bold text-blue-700 text-base tabular-nums text-right">{brl(orcamento.total)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isNew && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Salve o orçamento primeiro para poder adicionar itens com precificação automática.
        </div>
      )}

      {/* ══════════ CONDIÇÕES DE PAGAMENTO ══════════ */}
      <CondicoesPagamento
        value={paymentConditions}
        onChange={setPaymentConditions}
        valorTotal={orcamento?.total ?? 0}
      />

      {/* ══════════ AI RESULTS ══════════ */}

      {composicaoResult && (
        <div className="mt-4">
          <ComposicaoSugestao
            result={composicaoResult}
            onClose={() => setComposicaoResult(null)}
          />
        </div>
      )}

      {/* Template modal */}
      <TemplateSelector
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelect={handleTemplateSelect}
      />

      <AISidebar
        isOpen={aiSidebar.isOpen}
        response={aiSidebar.response}
        isLoading={analisarOrcamento.isPending}
        onClose={aiSidebar.close}
        onApply={aiSidebar.applyActions}
        onReanalyze={() => analisarOrcamento.mutate({ propostaId: id!, model: undefined }, {
          onSuccess: (data) => aiSidebar.setResponse(data),
        })}
        isReanalyzing={analisarOrcamento.isPending}
        title="Análise do Orçamento"
      />
    </div>
  );
}

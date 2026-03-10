// ============================================================================
// ORÇAMENTO EDITOR PAGE — v2.0
// Editor completo com seleção de produto → modelo → materiais → acabamentos
// Layout 2 colunas: formulário + pricing em tempo real
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, FileText,
  ChevronDown, ChevronUp, AlertTriangle,
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
import { useOrcamentoPricing } from "../hooks/useOrcamentoPricing";
import PricingCalculator from "../components/PricingCalculator";
import ProdutoSelector from "../components/ProdutoSelector";
import MaterialEditor from "../components/MaterialEditor";
import AcabamentoSelector from "../components/AcabamentoSelector";
import ServicoSelector from "../components/ServicoSelector";
import TemplateSelector from "../components/TemplateSelector";
import type { OrcamentoServicoItem } from "../components/ServicoSelector";
import type { OrcamentoTemplate } from "../components/TemplateSelector";
import type { Produto, ProdutoModelo } from "../hooks/useProdutosModelos";
import type {
  OrcamentoMaterial,
  OrcamentoAcabamento,
  OrcamentoProcesso,
  OrcamentoItemInput,
} from "@/shared/services/orcamento-pricing.service";
import { brl } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { orcamentoService } from "../services/orcamento.service";

// ─── Item editor state ──────────────────────────────────────────────────────

interface ItemEditorState {
  produto_id: string | null;
  modelo_id: string | null;
  descricao: string;
  especificacao: string;
  quantidade: number;
  largura_cm: number | null;
  altura_cm: number | null;
  materiais: OrcamentoMaterial[];
  acabamentos: OrcamentoAcabamento[];
  processos: OrcamentoProcesso[];
  markup_percentual: number;
  categoria: string | null;
}

const DEFAULT_ITEM: ItemEditorState = {
  produto_id: null,
  modelo_id: null,
  descricao: "",
  especificacao: "",
  quantidade: 1,
  largura_cm: null,
  altura_cm: null,
  materiais: [],
  acabamentos: [],
  processos: [],
  markup_percentual: 40,
  categoria: null,
};

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

  // ─── Item editor state ──────────────────────────────────────────────────
  const [newItem, setNewItem] = useState<ItemEditorState>(DEFAULT_ITEM);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemFormExpanded, setItemFormExpanded] = useState(true);

  // ─── Serviços state ─────────────────────────────────────────────────────
  const [servicos, setServicos] = useState<OrcamentoServicoItem[]>([]);

  // ─── Template modal ─────────────────────────────────────────────────────
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // ─── Load clientes for dropdown ─────────────────────────────────────────
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, razao_social, nome_fantasia")
        .eq("ativo", true)
        .order("razao_social")
        .limit(200);
      return data ?? [];
    },
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

  // ─── Pricing for the item being edited ──────────────────────────────────
  const pricingInput: OrcamentoItemInput | null = useMemo(() => {
    if (!newItem.descricao && !newItem.produto_id) return null;
    return {
      descricao: newItem.descricao || "Item",
      quantidade: newItem.quantidade,
      largura_cm: newItem.largura_cm,
      altura_cm: newItem.altura_cm,
      materiais: newItem.materiais,
      acabamentos: newItem.acabamentos,
      processos: newItem.processos,
      markup_percentual: newItem.markup_percentual,
    };
  }, [newItem]);

  const { resultado: pricingResult, markupSugerido, validacaoMarkup } =
    useOrcamentoPricing(pricingInput, newItem.categoria);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleProdutoChange = useCallback((produto: Produto | null) => {
    setNewItem((s) => ({
      ...s,
      produto_id: produto?.id ?? null,
      categoria: produto?.categoria ?? null,
      descricao: produto?.nome ?? s.descricao,
    }));
  }, []);

  const handleModeloChange = useCallback((modelo: ProdutoModelo | null) => {
    if (!modelo) {
      setNewItem((s) => ({ ...s, modelo_id: null }));
      return;
    }

    // Auto-preenche tudo do modelo selecionado
    const materiaisFromModelo: OrcamentoMaterial[] = (modelo.materiais ?? []).map((m) => ({
      material_id: m.material_id,
      descricao: m.material?.nome ?? `Material ${m.material_id}`,
      quantidade: m.quantidade_por_unidade,
      unidade: m.unidade ?? "un",
      custo_unitario: m.material?.preco_medio ?? 0,
    }));

    const processosFromModelo: OrcamentoProcesso[] = (modelo.processos ?? []).map((p) => ({
      etapa: p.etapa,
      tempo_minutos: p.tempo_por_unidade_min,
    }));

    setNewItem((s) => ({
      ...s,
      modelo_id: modelo.id,
      descricao: s.descricao || modelo.nome,
      especificacao: modelo.nome,
      largura_cm: modelo.largura_cm ?? s.largura_cm,
      altura_cm: modelo.altura_cm ?? s.altura_cm,
      markup_percentual: modelo.markup_padrao ?? s.markup_percentual,
      materiais: materiaisFromModelo,
      processos: processosFromModelo,
    }));
  }, []);

  const handleMateriaisChange = useCallback((materiais: OrcamentoMaterial[]) => {
    setNewItem((s) => ({ ...s, materiais }));
  }, []);

  const handleAcabamentosChange = useCallback((acabamentos: OrcamentoAcabamento[]) => {
    setNewItem((s) => ({ ...s, acabamentos }));
  }, []);

  const handleSave = async () => {
    if (!titulo.trim()) { showError("Informe o titulo do orcamento"); return; }
    if (!clienteId) { showError("Selecione o cliente"); return; }

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
        },
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
    if (!newItem.descricao.trim()) { showError("Informe a descricao do item"); return; }
    if (!id || isNew) { showError("Salve o orcamento antes de adicionar itens"); return; }
    if (pricingResult === null) { showError("Preencha os dados do item corretamente"); return; }

    await adicionarItem.mutateAsync({
      propostaId: id,
      item: {
        produto_id: newItem.produto_id,
        descricao: newItem.descricao,
        especificacao: newItem.especificacao || null,
        quantidade: newItem.quantidade,
        unidade: "un",
        largura_cm: newItem.largura_cm,
        altura_cm: newItem.altura_cm,
        area_m2: pricingResult.areaM2,
        custo_mp: pricingResult.custoMP + pricingResult.custosAcabamentos,
        custo_mo: pricingResult.custoMO,
        custo_fixo: pricingResult.custoTotal - pricingResult.custoMP - pricingResult.custosAcabamentos - pricingResult.custoMO,
        markup_percentual: newItem.markup_percentual,
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
      },
    });

    await orcamentoService.recalcularTotais(id);
    setNewItem(DEFAULT_ITEM);
    setShowItemForm(false);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!id) return;
    await removerItem.mutateAsync({ itemId, propostaId: id });
    await orcamentoService.recalcularTotais(id);
  };

  const handleTemplateSelect = (template: OrcamentoTemplate) => {
    // Aplicar template: popula itens (para agora, apenas o primeiro)
    if (template.itens && template.itens.length > 0) {
      const firstItem = template.itens[0];
      setNewItem({
        ...DEFAULT_ITEM,
        descricao: firstItem.descricao,
        especificacao: firstItem.especificacao || "",
        quantidade: firstItem.quantidade,
        largura_cm: firstItem.largura_cm,
        altura_cm: firstItem.altura_cm,
        markup_percentual: firstItem.markup_percentual,
      });
      setShowItemForm(true);
    }
    setShowTemplateModal(false);
    showSuccess(`Template "${template.nome}" aplicado!`);
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
            {isNew ? "Novo Orcamento" : `Editar ${orcamento?.numero || "Orcamento"}`}
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
          <CardTitle className="text-base font-semibold text-slate-800">Dados do Orcamento</CardTitle>
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
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue placeholder="Selecionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(clientes as Array<{ id: string; razao_social: string; nome_fantasia: string | null }>).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="condicoes">Condicoes de Pagamento</Label>
              <Input
                id="condicoes"
                value={condicoes}
                onChange={(e) => setCondicoes(e.target.value)}
                placeholder="Ex: 50% entrada + 50% na entrega"
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="obs">Observacoes</Label>
              <Textarea
                id="obs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observacoes adicionais para o cliente..."
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
              onClick={() => { setShowItemForm((s) => !s); setNewItem(DEFAULT_ITEM); }}
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
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Descricao</th>
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

            {/* ══════════ NEW ITEM FORM (2-column layout) ══════════ */}
            {showItemForm && (
              <div className="border border-blue-200 bg-blue-50/30 rounded-2xl overflow-hidden">
                {/* Form header */}
                <div
                  className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-blue-200 cursor-pointer"
                  onClick={() => setItemFormExpanded((e) => !e)}
                >
                  <p className="text-sm font-semibold text-blue-800">Novo Item</p>
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
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* ──── LEFT COLUMN (3/5) — Item details ──── */}
                      <div className="lg:col-span-3 space-y-5">
                        {/* Produto & Modelo Selector */}
                        <ProdutoSelector
                          produtoId={newItem.produto_id}
                          modeloId={newItem.modelo_id}
                          onProdutoChange={handleProdutoChange}
                          onModeloChange={handleModeloChange}
                        />

                        {/* Descricao manual (caso nao selecione produto) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <Label className="text-xs">Descricao *</Label>
                            <Input
                              value={newItem.descricao}
                              onChange={(e) => setNewItem((s) => ({ ...s, descricao: e.target.value }))}
                              placeholder="Ex: Banner lona 440g com ilhos"
                              className="mt-1 rounded-xl h-9 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Especificacao</Label>
                            <Input
                              value={newItem.especificacao}
                              onChange={(e) => setNewItem((s) => ({ ...s, especificacao: e.target.value }))}
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
                              onChange={(e) => setNewItem((s) => ({ ...s, quantidade: Number(e.target.value) }))}
                              className="mt-1 rounded-xl h-9 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Largura (cm)</Label>
                            <Input
                              type="number"
                              min={1}
                              value={newItem.largura_cm ?? ""}
                              onChange={(e) => setNewItem((s) => ({ ...s, largura_cm: e.target.value ? Number(e.target.value) : null }))}
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
                              onChange={(e) => setNewItem((s) => ({ ...s, altura_cm: e.target.value ? Number(e.target.value) : null }))}
                              placeholder="Opcional"
                              className="mt-1 rounded-xl h-9 text-sm"
                            />
                          </div>
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

                        {/* Markup */}
                        <div className="flex items-end gap-4">
                          <div className="flex-1">
                            <Label className="text-xs">Markup (%)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={newItem.markup_percentual}
                              onChange={(e) => setNewItem((s) => ({ ...s, markup_percentual: Number(e.target.value) }))}
                              className="mt-1 rounded-xl h-9 text-sm"
                            />
                          </div>
                          {markupSugerido !== newItem.markup_percentual && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl h-9 text-xs"
                              onClick={() => setNewItem((s) => ({ ...s, markup_percentual: markupSugerido }))}
                            >
                              Sugerido: {markupSugerido}%
                            </Button>
                          )}
                        </div>
                        {!validacaoMarkup.valido && (
                          <div className="flex items-center gap-2 text-amber-600 text-xs mt-1">
                            <AlertTriangle size={14} />
                            {validacaoMarkup.aviso}
                          </div>
                        )}
                      </div>

                      {/* ──── RIGHT COLUMN (2/5) — Pricing sidebar ──── */}
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
                                <span className="font-semibold text-slate-700">Preco Total</span>
                                <span className="font-bold text-blue-700 tabular-nums">{brl(pricingResult.precoTotal)}</span>
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={handleAddItem}
                              disabled={adicionarItem.isPending || !pricingResult}
                              className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 w-full"
                            >
                              {adicionarItem.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : <Plus size={14} className="mr-2" />}
                              Adicionar Item
                            </Button>
                            <Button
                              variant="ghost" size="sm" className="rounded-xl w-full"
                              onClick={() => { setShowItemForm(false); setNewItem(DEFAULT_ITEM); }}
                            >
                              Cancelar
                            </Button>
                          </div>
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
                      <span className="text-slate-500 flex-1">Servicos</span>
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
          Salve o orcamento primeiro para poder adicionar itens com precificacao automatica.
        </div>
      )}

      {/* Template modal */}
      <TemplateSelector
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
}

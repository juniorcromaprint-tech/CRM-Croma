import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  useOrcamento,
  useCriarOrcamento,
  useAtualizarOrcamento,
  useAdicionarItemOrcamento,
  useRemoverItemOrcamento,
} from "../hooks/useOrcamentos";
import { useOrcamentoPricing } from "../hooks/useOrcamentoPricing";
import PricingCalculator from "../components/PricingCalculator";
import { brl } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { orcamentoService } from "../services/orcamento.service";

interface ItemFormState {
  descricao: string;
  quantidade: number;
  largura_cm: number | null;
  altura_cm: number | null;
  markup_percentual: number;
  especificacao: string;
}

const DEFAULT_ITEM: ItemFormState = {
  descricao: "",
  quantidade: 1,
  largura_cm: null,
  altura_cm: null,
  markup_percentual: 40,
  especificacao: "",
};

export default function OrcamentoEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "novo";

  const { data: orcamento, isLoading } = useOrcamento(isNew ? undefined : id);
  const criar = useCriarOrcamento();
  const atualizar = useAtualizarOrcamento();
  const adicionarItem = useAdicionarItemOrcamento();
  const removerItem = useRemoverItemOrcamento();

  // Form state
  const [titulo, setTitulo] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [descontoPercentual, setDescontoPercentual] = useState(0);
  const [condicoes, setCondicoes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [validadeDias, setValidadeDias] = useState(10);

  // Item being added
  const [newItem, setNewItem] = useState<ItemFormState>(DEFAULT_ITEM);
  const [showItemForm, setShowItemForm] = useState(false);

  // Load clientes for dropdown
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

  // Pre-fill form when editing
  useEffect(() => {
    if (orcamento) {
      setTitulo(orcamento.titulo || "");
      setClienteId(orcamento.cliente_id || "");
      setDescontoPercentual(orcamento.desconto_percentual || 0);
      setCondicoes(orcamento.condicoes_pagamento || "");
      setObservacoes(orcamento.observacoes || "");
      setValidadeDias(orcamento.validade_dias || 10);
    }
  }, [orcamento]);

  // Pricing for new item
  const pricingInput = newItem.descricao ? {
    descricao: newItem.descricao,
    quantidade: newItem.quantidade,
    largura_cm: newItem.largura_cm,
    altura_cm: newItem.altura_cm,
    materiais: [],
    acabamentos: [],
    processos: [],
    markup_percentual: newItem.markup_percentual,
  } : null;

  const { resultado: pricingResult, validacaoMarkup } = useOrcamentoPricing(pricingInput, null);

  const handleSave = async () => {
    if (!titulo.trim()) { showError("Informe o título do orçamento"); return; }
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
    }
  };

  const handleAddItem = async () => {
    if (!newItem.descricao.trim()) { showError("Informe a descrição do item"); return; }
    if (!id || isNew) { showError("Salve o orçamento antes de adicionar itens"); return; }
    if (pricingResult === null) { showError("Preencha os dados do item corretamente"); return; }

    await adicionarItem.mutateAsync({
      propostaId: id,
      item: {
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
        ordem: ((orcamento as { itens?: unknown[] } | undefined)?.itens?.length ?? 0) + 1,
      },
    });

    // Recalculate totals
    await orcamentoService.recalcularTotais(id);
    setNewItem(DEFAULT_ITEM);
    setShowItemForm(false);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!id) return;
    await removerItem.mutateAsync({ itemId, propostaId: id });
    await orcamentoService.recalcularTotais(id);
  };

  const isSaving = criar.isPending || atualizar.isPending;

  // Access itens from orcamento via type assertion since the hook returns Orcamento with optional itens
  const orcamentoItens = (orcamento as { itens?: Array<{
    id: string;
    descricao: string;
    especificacao: string | null;
    quantidade: number;
    largura_cm: number | null;
    altura_cm: number | null;
    valor_unitario: number;
    valor_total: number;
  }> } | undefined)?.itens ?? [];

  if (!isNew && isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-4xl">
      {/* Header */}
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
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-5"
        >
          {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
          Salvar
        </Button>
      </div>

      {/* Main form */}
      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-slate-800">Dados do Orçamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="titulo">Título *</Label>
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

      {/* Items */}
      {!isNew && (
        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold text-slate-800">
              Itens do Orçamento
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
              onClick={() => setShowItemForm((s) => !s)}
            >
              <Plus size={15} /> Adicionar Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Existing items */}
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
                            <p className="text-xs text-slate-400 mt-0.5">{item.largura_cm}×{item.altura_cm}cm</p>
                          )}
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

            {/* New item form */}
            {showItemForm && (
              <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-4">
                <p className="text-sm font-semibold text-blue-800">Novo Item</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label className="text-xs">Descrição *</Label>
                    <Input
                      value={newItem.descricao}
                      onChange={(e) => setNewItem((s) => ({ ...s, descricao: e.target.value }))}
                      placeholder="Ex: Banner lona 440g"
                      className="mt-1 rounded-xl h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Especificação</Label>
                    <Input
                      value={newItem.especificacao}
                      onChange={(e) => setNewItem((s) => ({ ...s, especificacao: e.target.value }))}
                      placeholder="Material, acabamento..."
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
                  <div>
                    <Label className="text-xs">Markup (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={newItem.markup_percentual}
                      onChange={(e) => setNewItem((s) => ({ ...s, markup_percentual: Number(e.target.value) }))}
                      className="mt-1 rounded-xl h-9 text-sm"
                    />
                    {!validacaoMarkup.valido && (
                      <p className="text-xs text-amber-600 mt-1">{validacaoMarkup.aviso}</p>
                    )}
                  </div>
                </div>

                {/* Pricing Calculator */}
                <PricingCalculator resultado={pricingResult} quantidade={newItem.quantidade} />

                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost" size="sm" className="rounded-xl"
                    onClick={() => { setShowItemForm(false); setNewItem(DEFAULT_ITEM); }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddItem}
                    disabled={adicionarItem.isPending}
                    className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {adicionarItem.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : <Plus size={14} className="mr-1" />}
                    Adicionar
                  </Button>
                </div>
              </div>
            )}

            {/* Summary */}
            {!isNew && orcamento && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex flex-col items-end gap-1 text-sm">
                  <div className="flex gap-8">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium tabular-nums w-28 text-right">{brl(orcamento.subtotal)}</span>
                  </div>
                  {orcamento.desconto_percentual > 0 && (
                    <div className="flex gap-8">
                      <span className="text-red-500">Desconto ({orcamento.desconto_percentual}%)</span>
                      <span className="font-medium tabular-nums text-red-600 w-28 text-right">-{brl(orcamento.desconto_valor)}</span>
                    </div>
                  )}
                  <Separator className="my-2 w-64" />
                  <div className="flex gap-8">
                    <span className="font-bold text-slate-800 text-base">Total</span>
                    <span className="font-bold text-blue-700 text-base tabular-nums w-28 text-right">{brl(orcamento.total)}</span>
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
    </div>
  );
}

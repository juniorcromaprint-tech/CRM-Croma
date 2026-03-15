// src/domains/compras/components/PedidoCompraForm.tsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { brl } from "@/shared/utils/format";
import { showError } from "@/utils/toast";
import { useCriarPedidoCompra } from "../hooks/usePedidosCompra";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface NewPCItem {
  material_id: string;
  quantidade: number;
  valor_unitario: number;
}

interface PedidoCompraFormProps {
  open: boolean;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generatePCNumero(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `PC-${year}-${seq}`;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function PedidoCompraForm({ open, onClose }: PedidoCompraFormProps) {
  const criarPedido = useCriarPedidoCompra();

  // Form state
  const [fornecedorId, setFornecedorId] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<NewPCItem[]>([]);

  // Temp item state
  const [tempMaterialId, setTempMaterialId] = useState("");
  const [tempQuantidade, setTempQuantidade] = useState("");
  const [tempValorUnitario, setTempValorUnitario] = useState("");

  // Queries
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fornecedores")
        .select("id, nome_fantasia, razao_social")
        .eq("ativo", true)
        .order("nome_fantasia", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; nome_fantasia: string | null; razao_social: string }[];
    },
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ["materiais-select"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("materiais")
        .select("id, codigo, nome, unidade, preco_medio")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; codigo: string | null; nome: string; unidade: string | null; preco_medio: number | null }[];
    },
  });

  function resetForm() {
    setFornecedorId("");
    setDataEntrega("");
    setObservacoes("");
    setItens([]);
    resetTempItem();
  }

  function resetTempItem() {
    setTempMaterialId("");
    setTempQuantidade("");
    setTempValorUnitario("");
  }

  function handleAddItem() {
    if (!tempMaterialId) {
      showError("Selecione um material.");
      return;
    }
    const qty = parseFloat(tempQuantidade);
    const unit = parseFloat(tempValorUnitario);
    if (!qty || qty <= 0) {
      showError("Informe a quantidade.");
      return;
    }
    if (!unit || unit <= 0) {
      showError("Informe o valor unitário.");
      return;
    }
    setItens((prev) => [...prev, { material_id: tempMaterialId, quantidade: qty, valor_unitario: unit }]);
    resetTempItem();
  }

  function handleRemoveItem(index: number) {
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  function getMaterialLabel(id: string): string {
    const m = materiais.find((mat) => mat.id === id);
    if (!m) return id;
    return m.codigo ? `${m.codigo} - ${m.nome}` : m.nome;
  }

  async function handleSubmit() {
    if (!fornecedorId) {
      showError("Selecione um fornecedor.");
      return;
    }
    if (itens.length === 0) {
      showError("Adicione pelo menos um item.");
      return;
    }

    const valorTotal = itens.reduce((sum, i) => sum + i.quantidade * i.valor_unitario, 0);

    await criarPedido.mutateAsync({
      pedido: {
        numero: generatePCNumero(),
        fornecedor_id: fornecedorId,
        status: "rascunho" as const,
        valor_total: valorTotal,
        data_entrega: dataEntrega || undefined,
        observacoes: observacoes || undefined,
      },
      itens: itens.map((item) => ({
        material_id: item.material_id,
        quantidade: item.quantidade,
        preco_unitario: item.valor_unitario,
        subtotal: item.quantidade * item.valor_unitario,
      })),
    });
    resetForm();
    onClose();
  }

  const totalGeral = itens.reduce((sum, i) => sum + i.quantidade * i.valor_unitario, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart size={22} className="text-blue-600" />
            Novo Pedido de Compra
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Fornecedor */}
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">
              Fornecedor <span className="text-red-500">*</span>
            </Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger className="rounded-xl border-slate-200">
                <SelectValue placeholder="Selecione um fornecedor" />
              </SelectTrigger>
              <SelectContent>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome_fantasia || f.razao_social}
                  </SelectItem>
                ))}
                {fornecedores.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400">
                    Nenhum fornecedor ativo cadastrado
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Data de Entrega */}
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Previsão de Entrega</Label>
            <Input
              type="date"
              value={dataEntrega}
              onChange={(e) => setDataEntrega(e.target.value)}
              className="rounded-xl border-slate-200"
            />
          </div>

          {/* Itens */}
          <div className="space-y-3">
            <Label className="text-slate-700 font-medium">
              Itens <span className="text-red-500">*</span>
            </Label>

            {/* Adicionar item */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Adicionar item
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <Select
                    value={tempMaterialId}
                    onValueChange={(val) => {
                      setTempMaterialId(val);
                      const mat = materiais.find((m) => m.id === val);
                      if (mat?.preco_medio && !tempValorUnitario) {
                        setTempValorUnitario(String(mat.preco_medio));
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 bg-white">
                      <SelectValue placeholder="Selecione o material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materiais.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.codigo ? `${m.codigo} - ` : ""}
                          {m.nome}
                          {m.unidade ? ` (${m.unidade})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    type="number"
                    min={0}
                    step="0.001"
                    placeholder="Qtde"
                    value={tempQuantidade}
                    onChange={(e) => setTempQuantidade(e.target.value)}
                    className="rounded-xl border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Valor unitário"
                    value={tempValorUnitario}
                    onChange={(e) => setTempValorUnitario(e.target.value)}
                    className="rounded-xl border-slate-200 bg-white"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="rounded-xl"
              >
                <Plus size={14} className="mr-1" /> Adicionar Item
              </Button>
            </div>

            {/* Lista de itens */}
            {itens.length > 0 && (
              <div className="space-y-2">
                {itens.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {getMaterialLabel(item.material_id)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.quantidade} × {brl(item.valor_unitario)} ={" "}
                        <span className="font-semibold text-slate-700">
                          {brl(item.quantidade * item.valor_unitario)}
                        </span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg h-8 w-8 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-end">
                  <p className="text-sm font-bold text-slate-800">
                    Total: {brl(totalGeral)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais..."
              className="rounded-xl border-slate-200 min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => { resetForm(); onClose(); }}
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={criarPedido.isPending || !fornecedorId || itens.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            {criarPedido.isPending ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus size={16} className="mr-2" />
                Criar Pedido de Compra
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

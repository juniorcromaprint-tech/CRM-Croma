// ============================================================================
// ABA 2 — MODELOS (inclui DialogModelo + PainelModeloDetalhe)
// ============================================================================

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Layers,
  Loader2,
  Save,
  Search,
  Plus,
  Pencil,
  PowerOff,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import type { Produto, ProdutoModelo, ModeloMaterial, ModeloProcesso, Material } from "./types";
import { categoriaBadgeColor, UNIDADES_PADRAO } from "./constants";

// ----------------------------------------------------------------------------
// DIALOG — MODELO
// ----------------------------------------------------------------------------

interface DialogModeloProps {
  open: boolean;
  onClose: () => void;
  produtoId: string;
  modelo?: ProdutoModelo | null;
}

function DialogModelo({ open, onClose, produtoId, modelo }: DialogModeloProps) {
  const queryClient = useQueryClient();
  const isEdit = !!modelo;

  const { data: produtosList = [] } = useQuery({
    queryKey: ["produtos-lista-dialog"],
    queryFn: async () => {
      const { data } = await (supabase as unknown as any)
        .from("produtos")
        .select("id, nome, categoria")
        .eq("ativo", true)
        .order("nome");
      return (data ?? []) as Produto[];
    },
    enabled: open && !isEdit,
  });

  const [form, setForm] = useState({
    produtoId: produtoId,
    nome: "",
    largura_cm: "",
    altura_cm: "",
    markup_padrao: "45",
    margem_minima: "25",
    tempo_producao_min: "",
    ncm: "",
    descricao_fiscal: "",
    ativo: true,
  });

  useEffect(() => {
    if (open) {
      if (modelo) {
        setForm({
          produtoId: modelo.produto_id,
          nome: modelo.nome,
          largura_cm: modelo.largura_cm != null ? String(modelo.largura_cm) : "",
          altura_cm: modelo.altura_cm != null ? String(modelo.altura_cm) : "",
          markup_padrao: String(modelo.markup_padrao),
          margem_minima: String(modelo.margem_minima),
          tempo_producao_min:
            modelo.tempo_producao_min != null ? String(modelo.tempo_producao_min) : "",
          ncm: modelo.ncm ?? "",
          descricao_fiscal: modelo.descricao_fiscal ?? "",
          ativo: modelo.ativo,
        });
      } else {
        setForm({
          produtoId: produtoId,
          nome: "",
          largura_cm: "",
          altura_cm: "",
          markup_padrao: "45",
          margem_minima: "25",
          tempo_producao_min: "",
          ncm: "",
          descricao_fiscal: "",
          ativo: true,
        });
      }
    }
  }, [open, modelo, produtoId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.produtoId) throw new Error("Selecione o produto");
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");
      const payload: Record<string, unknown> = {
        produto_id: form.produtoId,
        nome: form.nome.trim(),
        markup_padrao: parseFloat(form.markup_padrao) || 45,
        margem_minima: parseFloat(form.margem_minima) || 25,
        ncm: form.ncm.trim(),
        descricao_fiscal: form.descricao_fiscal.trim() || null,
        ativo: form.ativo,
      };
      if (form.largura_cm) payload.largura_cm = parseFloat(form.largura_cm);
      if (form.altura_cm) payload.altura_cm = parseFloat(form.altura_cm);
      // M-02: Calcular area_m2 automaticamente
      if (form.largura_cm && form.altura_cm) {
        payload.area_m2 = (parseFloat(form.largura_cm) / 100) * (parseFloat(form.altura_cm) / 100);
      }
      if (form.tempo_producao_min)
        payload.tempo_producao_min = parseInt(form.tempo_producao_min);

      if (isEdit && modelo) {
        const { error } = await (supabase as unknown as any)
          .from("produto_modelos")
          .update(payload)
          .eq("id", modelo.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as unknown as any)
          .from("produto_modelos")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-produto-modelos"] });
      queryClient.invalidateQueries({ queryKey: ["produto_modelos"] });
    },
  });

  function handleSave() {
    // BUG-02: NCM obrigatório — NF-e não pode ser emitida sem ele
    if (!form.ncm.trim()) {
      showError("NCM é obrigatório. Preencha o código NCM para poder salvar o modelo.");
      return;
    }
    mutation.mutate(undefined, {
      onSuccess: () => {
        showSuccess(isEdit ? "Modelo atualizado!" : "Modelo criado!");
        onClose();
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao salvar modelo.";
        showError(msg);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Modelo" : "Novo Modelo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!isEdit && (
            <div className="space-y-1">
              <Label>Produto *</Label>
              <Select
                value={form.produtoId}
                onValueChange={(v) => setForm((f) => ({ ...f, produtoId: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o produto..." />
                </SelectTrigger>
                <SelectContent>
                  {produtosList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: 60x160cm"
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Largura padrão (cm)</Label>
              <Input
                type="number"
                value={form.largura_cm}
                onChange={(e) => setForm((f) => ({ ...f, largura_cm: e.target.value }))}
                placeholder="90"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Altura padrão (cm)</Label>
              <Input
                type="number"
                value={form.altura_cm}
                onChange={(e) => setForm((f) => ({ ...f, altura_cm: e.target.value }))}
                placeholder="120"
                className="rounded-xl"
              />
            </div>
          </div>
          {form.largura_cm && form.altura_cm && parseFloat(form.largura_cm) > 0 && parseFloat(form.altura_cm) > 0 && (
            <p className="text-xs text-slate-500 -mt-1">
              Área calculada: = {((parseFloat(form.largura_cm) / 100) * (parseFloat(form.altura_cm) / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Markup Padrão (%)</Label>
              <Input
                type="number"
                value={form.markup_padrao}
                onChange={(e) => setForm((f) => ({ ...f, markup_padrao: e.target.value }))}
                placeholder="45"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Margem Mínima (%)</Label>
              <Input
                type="number"
                value={form.margem_minima}
                onChange={(e) => setForm((f) => ({ ...f, margem_minima: e.target.value }))}
                placeholder="25"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Tempo Produção (min)</Label>
            <Input
              type="number"
              value={form.tempo_producao_min}
              onChange={(e) =>
                setForm((f) => ({ ...f, tempo_producao_min: e.target.value }))
              }
              placeholder="Opcional"
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-ncm">NCM *</Label>
              <Input
                id="edit-ncm"
                value={form.ncm}
                onChange={(e) => setForm((f) => ({ ...f, ncm: e.target.value }))}
                placeholder="Ex: 4911.99.90"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-descricao-fiscal">Descrição Fiscal</Label>
              <Input
                id="edit-descricao-fiscal"
                value={form.descricao_fiscal}
                onChange={(e) => setForm((f) => ({ ...f, descricao_fiscal: e.target.value }))}
                placeholder="Descrição para NF-e"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo-modelo"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="ativo-modelo">Modelo ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// PAINEL EXPANDIDO — MATERIAIS E PROCESSOS DO MODELO
// ----------------------------------------------------------------------------

interface PainelModeloDetalheProps {
  modeloId: string;
}

function PainelModeloDetalhe({ modeloId }: PainelModeloDetalheProps) {
  const queryClient = useQueryClient();

  // Materiais do modelo
  const { data: modeloMateriais = [], isLoading: loadingMateriais } = useQuery({
    queryKey: ["modelo-materiais", modeloId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("modelo_materiais")
        .select(`*, material:materiais(nome, preco_medio)`)
        .eq("modelo_id", modeloId);
      if (error) throw error;
      return (data ?? []) as ModeloMaterial[];
    },
  });

  // Processos do modelo
  const { data: modeloProcessos = [], isLoading: loadingProcessos } = useQuery({
    queryKey: ["modelo-processos", modeloId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("modelo_processos")
        .select("*")
        .eq("modelo_id", modeloId)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as ModeloProcesso[];
    },
  });

  // Lista de materiais disponíveis
  const { data: materiais = [] } = useQuery({
    queryKey: ["materiais-lista"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("materiais")
        .select("id, nome, unidade, preco_medio")
        .eq("ativo", true)
        .order("nome")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Material[];
    },
  });

  // Form adicionar material
  const [novoMaterialId, setNovoMaterialId] = useState("");
  const [novoMaterialQtd, setNovoMaterialQtd] = useState("");
  const [novoMaterialUnidade, setNovoMaterialUnidade] = useState("m²");
  const [materialSearch, setMaterialSearch] = useState("");

  // Form adicionar processo
  const [novaEtapa, setNovaEtapa] = useState("");
  const [novoTempo, setNovoTempo] = useState("");

  const addMaterial = useMutation({
    mutationFn: async () => {
      if (!novoMaterialId) throw new Error("Selecione um material");
      const qtd = parseFloat(novoMaterialQtd);
      if (isNaN(qtd) || qtd <= 0) throw new Error("Quantidade inválida");
      const { error } = await (supabase as unknown as any).from("modelo_materiais").insert({
        modelo_id: modeloId,
        material_id: novoMaterialId,
        quantidade_por_unidade: qtd,
        unidade: novoMaterialUnidade || null,
      });
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["modelo-materiais", modeloId] });
      queryClient.invalidateQueries({ queryKey: ["produto_modelos"] });
      queryClient.invalidateQueries({ queryKey: ["admin-produto-modelos"] });
    },
  });

  const removeMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as unknown as any)
        .from("modelo_materiais")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["modelo-materiais", modeloId] });
    },
  });

  const addProcesso = useMutation({
    mutationFn: async () => {
      if (!novaEtapa.trim()) throw new Error("Informe a etapa");
      const tempo = parseInt(novoTempo);
      if (isNaN(tempo) || tempo <= 0) throw new Error("Tempo inválido");
      const { error } = await (supabase as unknown as any).from("modelo_processos").insert({
        modelo_id: modeloId,
        etapa: novaEtapa.trim(),
        tempo_por_unidade_min: tempo,
        ordem: modeloProcessos.length + 1,
      });
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["modelo-processos", modeloId] });
      queryClient.invalidateQueries({ queryKey: ["produto_modelos"] });
    },
  });

  const removeProcesso = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as unknown as any)
        .from("modelo_processos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["modelo-processos", modeloId] });
    },
  });

  function handleAddMaterial() {
    addMaterial.mutate(undefined, {
      onSuccess: () => {
        setNovoMaterialId("");
        setNovoMaterialQtd("");
        setMaterialSearch("");
        showSuccess("Material adicionado!");
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao adicionar material.";
        showError(msg);
      },
    });
  }

  function handleAddProcesso() {
    addProcesso.mutate(undefined, {
      onSuccess: () => {
        setNovaEtapa("");
        setNovoTempo("");
        showSuccess("Processo adicionado!");
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao adicionar processo.";
        showError(msg);
      },
    });
  }

  const filteredMateriais = materiais.filter((m) =>
    m.nome.toLowerCase().includes(materialSearch.toLowerCase())
  );

  if (loadingMateriais || loadingProcessos) {
    return (
      <div className="flex items-center gap-2 py-4 px-4 text-slate-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border-t border-slate-100 px-4 py-4 space-y-5">
      {/* Materiais */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Materiais do Modelo
        </p>
        {modeloMateriais.length === 0 ? (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Nenhum material configurado — orçamento não funcionará sem materiais.
          </p>
        ) : (
          <div className="space-y-1 mb-2">
            {modeloMateriais.map((mm) => (
              <div
                key={mm.id}
                className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-700">
                  {mm.material?.nome ?? mm.material_id}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-mono text-xs">
                    {mm.quantidade_por_unidade} {mm.unidade ?? ""}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() =>
                      removeMaterial.mutate(mm.id, {
                        onSuccess: () => showSuccess("Material removido"),
                        onError: () => showError("Erro ao remover"),
                      })
                    }
                    disabled={removeMaterial.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar material */}
        <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-slate-500">Adicionar Material</p>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-40 relative">
              <Input
                placeholder="Buscar material..."
                value={materialSearch}
                onChange={(e) => {
                  setMaterialSearch(e.target.value);
                  setNovoMaterialId("");
                }}
                className="h-8 text-xs rounded-lg"
              />
              {materialSearch && filteredMateriais.length > 0 && !novoMaterialId && (
                <div className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto mt-1 min-w-60">
                  {filteredMateriais.slice(0, 20).map((m) => (
                    <button
                      key={m.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                      onClick={() => {
                        setNovoMaterialId(m.id);
                        setMaterialSearch(m.nome);
                        setNovoMaterialUnidade(m.unidade);
                      }}
                    >
                      {m.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input
              type="number"
              step="0.001"
              placeholder="Qtd"
              value={novoMaterialQtd}
              onChange={(e) => setNovoMaterialQtd(e.target.value)}
              className="h-8 w-20 text-xs rounded-lg"
            />
            <Select value={novoMaterialUnidade} onValueChange={setNovoMaterialUnidade}>
              <SelectTrigger className="h-8 w-20 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES_PADRAO.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleAddMaterial}
              disabled={addMaterial.isPending || !novoMaterialId || !novoMaterialQtd}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              {addMaterial.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3 mr-1" />
              )}
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Processos */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Processos de Produção
        </p>
        {modeloProcessos.length > 0 && (
          <div className="space-y-1 mb-2">
            {modeloProcessos.map((proc) => (
              <div
                key={proc.id}
                className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono w-4">{proc.ordem}.</span>
                  <span className="font-medium text-slate-700">{proc.etapa}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-mono text-xs">
                    {proc.tempo_por_unidade_min} min
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() =>
                      removeProcesso.mutate(proc.id, {
                        onSuccess: () => showSuccess("Processo removido"),
                        onError: () => showError("Erro ao remover"),
                      })
                    }
                    disabled={removeProcesso.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar processo */}
        <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-slate-500">Adicionar Processo</p>
          <div className="flex gap-2">
            <Input
              placeholder="Nome da etapa (ex: Impressão UV)"
              value={novaEtapa}
              onChange={(e) => setNovaEtapa(e.target.value)}
              className="h-8 text-xs rounded-lg flex-1"
            />
            <Input
              type="number"
              placeholder="Min"
              value={novoTempo}
              onChange={(e) => setNovoTempo(e.target.value)}
              className="h-8 w-16 text-xs rounded-lg"
            />
            <Button
              size="sm"
              onClick={handleAddProcesso}
              disabled={addProcesso.isPending || !novaEtapa || !novoTempo}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              {addProcesso.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3 mr-1" />
              )}
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// TAB MODELOS
// ----------------------------------------------------------------------------

export function TabModelos() {
  const [search, setSearch] = useState("");
  const [expandedModeloId, setExpandedModeloId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>("");
  const [editingModelo, setEditingModelo] = useState<ProdutoModelo | null>(null);

  const queryClient = useQueryClient();

  const { data: produtos = [] } = useQuery({
    queryKey: ["admin-produtos"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("produtos")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
  });

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ["admin-produto-modelos"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("produto_modelos")
        .select(`*, produto:produtos(nome, categoria)`)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ProdutoModelo[];
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as unknown as any)
        .from("produto_modelos")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-produto-modelos"] });
      queryClient.invalidateQueries({ queryKey: ["produto_modelos"] });
    },
  });

  const filtered = modelos.filter((m) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      m.nome.toLowerCase().includes(q) ||
      (m.produto?.nome ?? "").toLowerCase().includes(q) ||
      (m.produto?.categoria ?? "").toLowerCase().includes(q)
    );
  });

  function openNew(produtoId?: string) {
    setEditingModelo(null);
    setSelectedProdutoId(produtoId ?? (produtos[0]?.id ?? ""));
    setDialogOpen(true);
  }

  function openEdit(modelo: ProdutoModelo) {
    setEditingModelo(modelo);
    setSelectedProdutoId(modelo.produto_id);
    setDialogOpen(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando modelos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl border-slate-200 bg-white"
          />
        </div>
        <Button
          onClick={() => openNew()}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Modelo
        </Button>
      </div>

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Modelos de Produto</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {filtered.length} modelo{filtered.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <CardDescription>
            Clique em uma linha para expandir e configurar materiais e processos
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum modelo encontrado.</p>
            </div>
          ) : (
            <div>
              {filtered.map((modelo) => {
                const isExpanded = expandedModeloId === modelo.id;
                return (
                  <div key={modelo.id} className="border-b border-slate-50">
                    <div
                      className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50/60 transition-colors cursor-pointer"
                      onClick={() =>
                        setExpandedModeloId(isExpanded ? null : modelo.id)
                      }
                    >
                      <span className="text-slate-400">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                      <div className="flex-1 grid grid-cols-7 gap-2 items-center text-sm">
                        <div className="col-span-2">
                          <div className="font-medium text-slate-800">
                            {modelo.produto?.nome ?? "—"}
                          </div>
                          {modelo.produto?.categoria && (
                            <span
                              className={`text-xs font-medium px-1.5 py-0.5 rounded border ${categoriaBadgeColor(modelo.produto.categoria)}`}
                            >
                              {modelo.produto.categoria}
                            </span>
                          )}
                        </div>
                        <div className="col-span-2 font-medium text-slate-700">{modelo.nome}</div>
                        <div className="text-slate-500 font-mono text-xs">
                          {modelo.largura_cm != null && modelo.altura_cm != null
                            ? `${modelo.largura_cm}×${modelo.altura_cm}cm`
                            : modelo.area_m2 != null
                            ? `${modelo.area_m2}m²`
                            : "—"}
                        </div>
                        <div>
                          <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700">
                            {modelo.markup_padrao}%
                          </Badge>
                        </div>
                        <div>
                          <Badge
                            variant="secondary"
                            className={
                              modelo.ativo
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }
                          >
                            {modelo.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => openEdit(modelo)}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-7 w-7 p-0 hover:bg-slate-100 ${
                            modelo.ativo
                              ? "text-slate-400 hover:text-amber-600"
                              : "text-slate-300 hover:text-green-600"
                          }`}
                          onClick={() =>
                            toggleAtivo.mutate(
                              { id: modelo.id, ativo: !modelo.ativo },
                              {
                                onSuccess: () =>
                                  showSuccess(
                                    modelo.ativo ? "Modelo desativado" : "Modelo ativado"
                                  ),
                                onError: () => showError("Erro ao alterar status"),
                              }
                            )
                          }
                          disabled={toggleAtivo.isPending}
                          title={modelo.ativo ? "Desativar" : "Ativar"}
                        >
                          <PowerOff className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {isExpanded && <PainelModeloDetalhe modeloId={modelo.id} />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DialogModelo
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        produtoId={selectedProdutoId}
        modelo={editingModelo}
      />
    </div>
  );
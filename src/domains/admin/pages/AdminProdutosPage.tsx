// ============================================================================
// ADMIN PRODUTOS PAGE — Croma Print ERP/CRM
// Gestão de Produtos, Modelos, Acabamentos, Serviços e Materiais Sem Preço
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Package,
  Layers,
  AlertTriangle,
  Loader2,
  Save,
  Search,
  Plus,
  Pencil,
  PowerOff,
  ChevronDown,
  ChevronRight,
  Trash2,
  Wrench,
  Scissors,
} from "lucide-react";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface Produto {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: string;
  descricao: string | null;
  unidade_padrao: string;
  ativo: boolean;
}

interface ProdutoModelo {
  id: string;
  produto_id: string;
  nome: string;
  largura_cm: number | null;
  altura_cm: number | null;
  area_m2: number | null;
  markup_padrao: number;
  margem_minima: number;
  tempo_producao_min: number | null;
  ativo: boolean;
  ncm: string | null;
  descricao_fiscal: string | null;
  produto?: { nome: string; categoria: string } | null;
}

interface ModeloMaterial {
  id: string;
  modelo_id: string;
  material_id: string;
  quantidade_por_unidade: number;
  unidade: string | null;
  material?: { nome: string; preco_medio: number | null };
}

interface ModeloProcesso {
  id: string;
  modelo_id: string;
  etapa: string;
  tempo_por_unidade_min: number;
  ordem: number;
}

interface Material {
  id: string;
  nome: string;
  unidade: string;
  preco_medio: number | null;
}

interface MaterialSemPreco {
  id: string;
  codigo: string | null;
  nome: string;
  unidade: string;
  preco_medio: number | null;
}

interface Acabamento {
  id: string;
  nome: string;
  custo_unitario: number;
  unidade: string;
  ativo: boolean;
  descricao: string | null;
}

interface Servico {
  id: string;
  nome: string;
  categoria: string;
  custo_hora: number;
  preco_fixo: number | null;
  ativo: boolean;
  descricao: string | null;
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function categoriaBadgeColor(categoria: string): string {
  const map: Record<string, string> = {
    fachadas: "bg-blue-50 text-blue-700 border-blue-200",
    pdv: "bg-purple-50 text-purple-700 border-purple-200",
    comunicacao_interna: "bg-teal-50 text-teal-700 border-teal-200",
    campanhas: "bg-amber-50 text-amber-700 border-amber-200",
    envelopamento: "bg-rose-50 text-rose-700 border-rose-200",
    grandes_formatos: "bg-indigo-50 text-indigo-700 border-indigo-200",
    outros: "bg-slate-100 text-slate-600 border-slate-200",
    impressao: "bg-indigo-50 text-indigo-700 border-indigo-200",
    instalacao: "bg-orange-50 text-orange-700 border-orange-200",
    projeto: "bg-violet-50 text-violet-700 border-violet-200",
    manutencao: "bg-cyan-50 text-cyan-700 border-cyan-200",
  };
  return map[categoria] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

const CATEGORIAS_PRODUTO = [
  { value: "fachadas", label: "Fachadas" },
  { value: "pdv", label: "PDV" },
  { value: "comunicacao_interna", label: "Comunicação Interna" },
  { value: "campanhas", label: "Campanhas" },
  { value: "envelopamento", label: "Envelopamento" },
  { value: "grandes_formatos", label: "Grandes Formatos" },
  { value: "outros", label: "Outros" },
];

const UNIDADES_PADRAO = [
  { value: "m²", label: "m²" },
  { value: "un", label: "un" },
  { value: "m", label: "m" },
  { value: "par", label: "par" },
  { value: "pç", label: "pç" },
];

const CATEGORIAS_SERVICO = [
  { value: "instalacao", label: "Instalação" },
  { value: "projeto", label: "Projeto" },
  { value: "manutencao", label: "Manutenção" },
  { value: "outros", label: "Outros" },
];

// ----------------------------------------------------------------------------
// DIALOG — PRODUTO
// ----------------------------------------------------------------------------

interface DialogProdutoProps {
  open: boolean;
  onClose: () => void;
  produto?: Produto | null;
}

function DialogProduto({ open, onClose, produto }: DialogProdutoProps) {
  const queryClient = useQueryClient();
  const isEdit = !!produto;

  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    categoria: "fachadas",
    descricao: "",
    unidade_padrao: "m²",
    ativo: true,
  });

  useEffect(() => {
    if (open) {
      if (produto) {
        setForm({
          codigo: produto.codigo ?? "",
          nome: produto.nome,
          categoria: produto.categoria,
          descricao: produto.descricao ?? "",
          unidade_padrao: produto.unidade_padrao,
          ativo: produto.ativo,
        });
      } else {
        setForm({
          codigo: "",
          nome: "",
          categoria: "fachadas",
          descricao: "",
          unidade_padrao: "m²",
          ativo: true,
        });
      }
    }
  }, [open, produto]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");
      if (!form.categoria) throw new Error("Categoria é obrigatória");
      const payload = {
        codigo: form.codigo.trim() || null,
        nome: form.nome.trim(),
        categoria: form.categoria,
        descricao: form.descricao.trim() || null,
        unidade_padrao: form.unidade_padrao,
        ativo: form.ativo,
      };
      if (isEdit && produto) {
        const { error } = await (supabase as unknown as any)
          .from("produtos")
          .update(payload)
          .eq("id", produto.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as unknown as any)
          .from("produtos")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
  });

  function handleSave() {
    mutation.mutate(undefined, {
      onSuccess: () => {
        showSuccess(isEdit ? "Produto atualizado!" : "Produto criado!");
        onClose();
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao salvar produto.";
        showError(msg);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código (opcional)</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="PRD-001"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Unidade Padrão</Label>
              <Select
                value={form.unidade_padrao}
                onValueChange={(v) => setForm((f) => ({ ...f, unidade_padrao: v }))}
              >
                <SelectTrigger className="rounded-xl">
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
            </div>
          </div>

          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Banner Roll-up"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label>Categoria *</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_PRODUTO.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Descrição (opcional)</Label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Descrição detalhada do produto..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo-produto"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="ativo-produto">Produto ativo</Label>
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
        ncm: form.ncm.trim() || null,
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
              <Label>Largura (cm)</Label>
              <Input
                type="number"
                value={form.largura_cm}
                onChange={(e) => setForm((f) => ({ ...f, largura_cm: e.target.value }))}
                placeholder="60"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Altura (cm)</Label>
              <Input
                type="number"
                value={form.altura_cm}
                onChange={(e) => setForm((f) => ({ ...f, altura_cm: e.target.value }))}
                placeholder="160"
                className="rounded-xl"
              />
            </div>
          </div>

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
              <Label htmlFor="edit-ncm">NCM</Label>
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
// ABA 1 — PRODUTOS
// ----------------------------------------------------------------------------

function TabProdutos() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["admin-produtos"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("produtos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as unknown as any)
        .from("produtos")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
  });

  const filtered = produtos.filter((p) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      p.nome.toLowerCase().includes(q) ||
      (p.codigo ?? "").toLowerCase().includes(q) ||
      p.categoria.toLowerCase().includes(q)
    );
  });

  function openNew() {
    setEditingProduto(null);
    setDialogOpen(true);
  }

  function openEdit(produto: Produto) {
    setEditingProduto(produto);
    setDialogOpen(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando produtos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome, código ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl border-slate-200 bg-white"
          />
        </div>
        <Button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Produtos Cadastrados</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <CardDescription>Catálogo completo de produtos do sistema</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Código</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoria</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Unidade</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((produto) => (
                    <tr
                      key={produto.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                        {produto.codigo ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{produto.nome}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${categoriaBadgeColor(produto.categoria)}`}
                        >
                          {produto.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {produto.unidade_padrao}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={
                            produto.ativo
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }
                        >
                          {produto.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => openEdit(produto)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 w-7 p-0 hover:bg-slate-100 ${
                              produto.ativo
                                ? "text-slate-400 hover:text-amber-600"
                                : "text-slate-300 hover:text-green-600"
                            }`}
                            onClick={() =>
                              toggleAtivo.mutate(
                                { id: produto.id, ativo: !produto.ativo },
                                {
                                  onSuccess: () =>
                                    showSuccess(
                                      produto.ativo ? "Produto desativado" : "Produto ativado"
                                    ),
                                  onError: () => showError("Erro ao alterar status"),
                                }
                              )
                            }
                            disabled={toggleAtivo.isPending}
                            title={produto.ativo ? "Desativar" : "Ativar"}
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <DialogProduto
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        produto={editingProduto}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// ABA 2 — MODELOS
// ----------------------------------------------------------------------------

function TabModelos() {
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
}

// ----------------------------------------------------------------------------
// ABA 3 — SEM PREÇO
// ----------------------------------------------------------------------------

interface MaterialRowProps {
  material: MaterialSemPreco;
  onSave: (id: string, novoPreco: number) => void;
  isSaving: boolean;
}

function MaterialSemPrecoRow({ material, onSave, isSaving }: MaterialRowProps) {
  const [preco, setPreco] = useState("");

  function handleSave() {
    const valor = parseFloat(preco.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      showError("Informe um preço válido maior que zero.");
      return;
    }
    onSave(material.id, valor);
    setPreco("");
  }

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3 font-mono text-slate-400 text-xs">
        {material.codigo ?? "—"}
      </td>
      <td className="px-4 py-3 font-medium text-slate-800">{material.nome}</td>
      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{material.unidade}</td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          Sem preço
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 items-center">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
              R$
            </span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="h-8 w-28 pl-8 text-sm"
              placeholder="0,00"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !preco}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Save className="h-3 w-3 mr-1" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </td>
    </tr>
  );
}

interface TabSemPrecoProps {
  onCountChange?: (count: number) => void;
}

function TabSemPreco({ onCountChange }: TabSemPrecoProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: materiaisSemPreco = [], isLoading } = useQuery({
    queryKey: ["materiais-sem-preco"],
    queryFn: async () => {
      const { data } = await (supabase as unknown as any)
        .from("materiais")
        .select("id, codigo, nome, unidade, preco_medio")
        .or("preco_medio.is.null,preco_medio.eq.0")
        .eq("ativo", true)
        .order("nome")
        .limit(200);
      return (data ?? []) as MaterialSemPreco[];
    },
  });

  useEffect(() => {
    if (onCountChange) {
      onCountChange(materiaisSemPreco.length);
    }
  }, [materiaisSemPreco.length, onCountChange]);

  const updatePreco = useMutation({
    mutationFn: async ({ id, preco }: { id: string; preco: number }) => {
      const { error } = await (supabase as unknown as any)
        .from("materiais")
        .update({
          preco_medio: preco,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais-sem-preco"] });
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
    },
  });

  const filtered = materiaisSemPreco.filter((m) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      m.nome.toLowerCase().includes(q) ||
      (m.codigo ?? "").toLowerCase().includes(q) ||
      m.unidade.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Verificando materiais...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {materiaisSemPreco.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {materiaisSemPreco.length} material{materiaisSemPreco.length !== 1 ? "is" : ""} sem preço cadastrado
            </p>
            <p className="text-amber-700 mt-0.5 text-xs">
              Materiais sem preço não entram no cálculo automático de orçamentos. Informe o preço médio por unidade.
            </p>
          </div>
        </div>
      )}

      {materiaisSemPreco.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome, código ou unidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl border-slate-200 bg-white"
          />
        </div>
      )}

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-slate-800 text-base">Materiais Sem Preço</CardTitle>
            </div>
            {materiaisSemPreco.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                {materiaisSemPreco.length} pendente{materiaisSemPreco.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <CardDescription>
            Informe o preço médio de cada material para que os orçamentos sejam calculados corretamente
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 && materiaisSemPreco.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="text-green-500 font-semibold mb-2">Tudo certo!</div>
              <p className="text-sm">Todos os materiais ativos possuem preço cadastrado.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">Nenhum material encontrado para o termo pesquisado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Código</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Unidade</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Preço Atual</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nova Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((material) => (
                    <MaterialSemPrecoRow
                      key={material.id}
                      material={material}
                      onSave={(id, novoPreco) =>
                        updatePreco.mutate(
                          { id, preco: novoPreco },
                          {
                            onSuccess: () => showSuccess("Preço atualizado!"),
                            onError: () => showError("Erro ao atualizar preço."),
                          }
                        )
                      }
                      isSaving={updatePreco.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
// DIALOG — ACABAMENTO
// ----------------------------------------------------------------------------

interface DialogAcabamentoProps {
  open: boolean;
  onClose: () => void;
  acabamento?: Acabamento | null;
}

function DialogAcabamento({ open, onClose, acabamento }: DialogAcabamentoProps) {
  const queryClient = useQueryClient();
  const isEdit = !!acabamento;

  const [form, setForm] = useState({
    nome: "",
    custo_unitario: "",
    unidade: "un",
    descricao: "",
    ativo: true,
  });

  useEffect(() => {
    if (open) {
      if (acabamento) {
        setForm({
          nome: acabamento.nome,
          custo_unitario: String(acabamento.custo_unitario),
          unidade: acabamento.unidade,
          descricao: acabamento.descricao ?? "",
          ativo: acabamento.ativo,
        });
      } else {
        setForm({ nome: "", custo_unitario: "", unidade: "un", descricao: "", ativo: true });
      }
    }
  }, [open, acabamento]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");
      const custo = parseFloat(form.custo_unitario);
      if (isNaN(custo) || custo < 0) throw new Error("Custo unitário inválido");
      const payload = {
        nome: form.nome.trim(),
        custo_unitario: custo,
        unidade: form.unidade,
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
      };
      if (isEdit && acabamento) {
        const { error } = await (supabase as unknown as any)
          .from("acabamentos")
          .update(payload)
          .eq("id", acabamento.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as unknown as any)
          .from("acabamentos")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-acabamentos"] });
      queryClient.invalidateQueries({ queryKey: ["acabamentos"] });
    },
  });

  function handleSave() {
    mutation.mutate(undefined, {
      onSuccess: () => {
        showSuccess(isEdit ? "Acabamento atualizado!" : "Acabamento criado!");
        onClose();
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao salvar acabamento.";
        showError(msg);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Acabamento" : "Novo Acabamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Laminação Fosca"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Custo Unitário (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.custo_unitario}
                onChange={(e) => setForm((f) => ({ ...f, custo_unitario: e.target.value }))}
                placeholder="0,00"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Select
                value={form.unidade}
                onValueChange={(v) => setForm((f) => ({ ...f, unidade: v }))}
              >
                <SelectTrigger className="rounded-xl">
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
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição (opcional)</Label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo-acabamento"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="ativo-acabamento">Acabamento ativo</Label>
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
// ABA 4 — ACABAMENTOS
// ----------------------------------------------------------------------------

function TabAcabamentos() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAcabamento, setEditingAcabamento] = useState<Acabamento | null>(null);
  const [tableExists, setTableExists] = useState<boolean | null>(null);

  const { data: acabamentos = [], isLoading } = useQuery({
    queryKey: ["admin-acabamentos"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as unknown as any)
          .from("acabamentos")
          .select("*")
          .order("nome");
        if (error) {
          if (
            error.message?.includes("does not exist") ||
            error.code === "42P01"
          ) {
            setTableExists(false);
            return [];
          }
          throw error;
        }
        setTableExists(true);
        return (data ?? []) as Acabamento[];
      } catch {
        setTableExists(false);
        return [];
      }
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as unknown as any)
        .from("acabamentos")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-acabamentos"] });
      queryClient.invalidateQueries({ queryKey: ["acabamentos"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Verificando tabela de acabamentos...</span>
      </div>
    );
  }

  if (tableExists === false) {
    return (
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-amber-800">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Execute a migration 006 primeiro</p>
          <p className="text-sm mt-1 text-amber-700">
            A tabela <code className="bg-amber-100 px-1 rounded">acabamentos</code> não existe no
            banco de dados. Execute a migration{" "}
            <code className="bg-amber-100 px-1 rounded">006_orcamento_module.sql</code> para
            habilitar esta funcionalidade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          onClick={() => {
            setEditingAcabamento(null);
            setDialogOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Acabamento
        </Button>
      </div>

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Acabamentos</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {acabamentos.length} acabamento{acabamentos.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <CardDescription>Opções de acabamento disponíveis para orçamentos</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {acabamentos.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Scissors className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum acabamento cadastrado.</p>
              <p className="text-xs mt-1">Adicione opções de acabamento clicando em "Novo Acabamento".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Custo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Unidade</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {acabamentos.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">{a.nome}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {formatBRL(a.custo_unitario)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{a.unidade}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={
                            a.ativo
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }
                        >
                          {a.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => {
                              setEditingAcabamento(a);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 w-7 p-0 hover:bg-slate-100 ${
                              a.ativo
                                ? "text-slate-400 hover:text-amber-600"
                                : "text-slate-300 hover:text-green-600"
                            }`}
                            onClick={() =>
                              toggleAtivo.mutate(
                                { id: a.id, ativo: !a.ativo },
                                {
                                  onSuccess: () =>
                                    showSuccess(a.ativo ? "Desativado" : "Ativado"),
                                  onError: () => showError("Erro ao alterar status"),
                                }
                              )
                            }
                            disabled={toggleAtivo.isPending}
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <DialogAcabamento
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        acabamento={editingAcabamento}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// DIALOG — SERVIÇO
// ----------------------------------------------------------------------------

interface DialogServicoProps {
  open: boolean;
  onClose: () => void;
  servico?: Servico | null;
}

function DialogServico({ open, onClose, servico }: DialogServicoProps) {
  const queryClient = useQueryClient();
  const isEdit = !!servico;

  const [form, setForm] = useState({
    nome: "",
    categoria: "instalacao",
    custo_hora: "",
    preco_fixo: "",
    descricao: "",
    ativo: true,
  });

  useEffect(() => {
    if (open) {
      if (servico) {
        setForm({
          nome: servico.nome,
          categoria: servico.categoria,
          custo_hora: String(servico.custo_hora),
          preco_fixo: servico.preco_fixo != null ? String(servico.preco_fixo) : "",
          descricao: servico.descricao ?? "",
          ativo: servico.ativo,
        });
      } else {
        setForm({
          nome: "",
          categoria: "instalacao",
          custo_hora: "",
          preco_fixo: "",
          descricao: "",
          ativo: true,
        });
      }
    }
  }, [open, servico]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");
      const payload: Record<string, unknown> = {
        nome: form.nome.trim(),
        categoria: form.categoria,
        custo_hora: parseFloat(form.custo_hora) || 0,
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
      };
      if (form.preco_fixo) payload.preco_fixo = parseFloat(form.preco_fixo);
      if (isEdit && servico) {
        const { error } = await (supabase as unknown as any)
          .from("servicos")
          .update(payload)
          .eq("id", servico.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as unknown as any)
          .from("servicos")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-servicos"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
    },
  });

  function handleSave() {
    mutation.mutate(undefined, {
      onSuccess: () => {
        showSuccess(isEdit ? "Serviço atualizado!" : "Serviço criado!");
        onClose();
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao salvar serviço.";
        showError(msg);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Instalação de Fachada"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_SERVICO.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Custo/hora (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.custo_hora}
                onChange={(e) => setForm((f) => ({ ...f, custo_hora: e.target.value }))}
                placeholder="0,00"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Preço Fixo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.preco_fixo}
                onChange={(e) => setForm((f) => ({ ...f, preco_fixo: e.target.value }))}
                placeholder="Opcional"
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição (opcional)</Label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo-servico"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="ativo-servico">Serviço ativo</Label>
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
// ABA 5 — SERVIÇOS
// ----------------------------------------------------------------------------

function TabServicos() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [tableExists, setTableExists] = useState<boolean | null>(null);

  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ["admin-servicos"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as unknown as any)
          .from("servicos")
          .select("*")
          .order("nome");
        if (error) {
          if (
            error.message?.includes("does not exist") ||
            error.code === "42P01"
          ) {
            setTableExists(false);
            return [];
          }
          throw error;
        }
        setTableExists(true);
        return (data ?? []) as Servico[];
      } catch {
        setTableExists(false);
        return [];
      }
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as unknown as any)
        .from("servicos")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-servicos"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Verificando tabela de serviços...</span>
      </div>
    );
  }

  if (tableExists === false) {
    return (
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-amber-800">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Execute a migration 006 primeiro</p>
          <p className="text-sm mt-1 text-amber-700">
            A tabela <code className="bg-amber-100 px-1 rounded">servicos</code> não existe no
            banco de dados. Execute a migration{" "}
            <code className="bg-amber-100 px-1 rounded">006_orcamento_module.sql</code> para
            habilitar esta funcionalidade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          onClick={() => {
            setEditingServico(null);
            setDialogOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Serviços</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {servicos.length} serviço{servicos.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <CardDescription>Serviços disponíveis para inclusão nos orçamentos</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {servicos.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum serviço cadastrado.</p>
              <p className="text-xs mt-1">Adicione serviços clicando em "Novo Serviço".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoria</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Custo/hora</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Preço Fixo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">{s.nome}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${categoriaBadgeColor(s.categoria)}`}
                        >
                          {s.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {formatBRL(s.custo_hora)}/h
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                        {s.preco_fixo != null ? formatBRL(s.preco_fixo) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={
                            s.ativo
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }
                        >
                          {s.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => {
                              setEditingServico(s);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 w-7 p-0 hover:bg-slate-100 ${
                              s.ativo
                                ? "text-slate-400 hover:text-amber-600"
                                : "text-slate-300 hover:text-green-600"
                            }`}
                            onClick={() =>
                              toggleAtivo.mutate(
                                { id: s.id, ativo: !s.ativo },
                                {
                                  onSuccess: () =>
                                    showSuccess(s.ativo ? "Desativado" : "Ativado"),
                                  onError: () => showError("Erro ao alterar status"),
                                }
                              )
                            }
                            disabled={toggleAtivo.isPending}
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <DialogServico
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        servico={editingServico}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------------

export default function AdminProdutosPage() {
  const [semPrecoCount, setSemPrecoCount] = useState<number>(0);

  return (
    <div className="space-y-6 p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Package className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Produtos e Materiais</h1>
          <p className="text-sm text-slate-500">
            Gerencie o catálogo de produtos, modelos, acabamentos, serviços e materiais sem preço
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="produtos">
        <TabsList className="bg-slate-100 rounded-xl p-1 h-auto gap-1 flex-wrap">
          <TabsTrigger
            value="produtos"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Package className="h-4 w-4 mr-1.5" />
            Produtos
          </TabsTrigger>
          <TabsTrigger
            value="modelos"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Layers className="h-4 w-4 mr-1.5" />
            Modelos
          </TabsTrigger>
          <TabsTrigger
            value="sem-preco"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5 text-amber-500" />
            Sem Preço
            {semPrecoCount > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {semPrecoCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="acabamentos"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Scissors className="h-4 w-4 mr-1.5" />
            Acabamentos
          </TabsTrigger>
          <TabsTrigger
            value="servicos"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm"
          >
            <Wrench className="h-4 w-4 mr-1.5" />
            Serviços
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-6">
          <TabProdutos />
        </TabsContent>

        <TabsContent value="modelos" className="mt-6">
          <TabModelos />
        </TabsContent>

        <TabsContent value="sem-preco" className="mt-6">
          <TabSemPreco onCountChange={setSemPrecoCount} />
        </TabsContent>

        <TabsContent value="acabamentos" className="mt-6">
          <TabAcabamentos />
        </TabsContent>

        <TabsContent value="servicos" className="mt-6">
          <TabServicos />
        </TabsContent>
      </Tabs>
    </div>
  );
}

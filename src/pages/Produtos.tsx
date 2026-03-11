import React, { useState, useMemo } from "react";
import {
  Package, Plus, Search, Edit, Trash2, Tag, Calculator,
  Layers, Box, Ruler, DollarSign, Clock, Settings,
  ChevronRight, Loader2, List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCategorias, useProdutos, useProdutoModelos,
  useCriarProduto, useAtualizarProduto,
  useCriarModelo, useAtualizarModelo, useExcluirModelo,
  type Produto, type ProdutoModelo, type CategoriaProduto,
} from "@/domains/comercial/hooks/useProdutosModelos";
import { showSuccess, showError } from "@/utils/toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────
// Category visual config
// ─────────────────────────────────────────────
const CAT_STYLE: Record<string, { color: string; bgIcon: string; icon: React.ReactNode }> = {
  adesivos:       { color: "bg-blue-100 text-blue-700 border-blue-200",     bgIcon: "bg-blue-50 text-blue-600",     icon: <Tag size={14} /> },
  banners_lonas:  { color: "bg-purple-100 text-purple-700 border-purple-200", bgIcon: "bg-purple-50 text-purple-600", icon: <Layers size={14} /> },
  placas:         { color: "bg-teal-100 text-teal-700 border-teal-200",     bgIcon: "bg-teal-50 text-teal-600",     icon: <Box size={14} /> },
  fachadas:       { color: "bg-amber-100 text-amber-700 border-amber-200",  bgIcon: "bg-amber-50 text-amber-600",   icon: <Package size={14} /> },
  letreiros:      { color: "bg-orange-100 text-orange-700 border-orange-200", bgIcon: "bg-orange-50 text-orange-600", icon: <Package size={14} /> },
  luminosos:      { color: "bg-yellow-100 text-yellow-700 border-yellow-200", bgIcon: "bg-yellow-50 text-yellow-600", icon: <Package size={14} /> },
  grafica:        { color: "bg-green-100 text-green-700 border-green-200",  bgIcon: "bg-green-50 text-green-600",   icon: <Package size={14} /> },
  estruturas:     { color: "bg-stone-100 text-stone-700 border-stone-200",  bgIcon: "bg-stone-50 text-stone-600",   icon: <Package size={14} /> },
  displays:       { color: "bg-rose-100 text-rose-700 border-rose-200",     bgIcon: "bg-rose-50 text-rose-600",     icon: <Package size={14} /> },
  iluminacao:     { color: "bg-cyan-100 text-cyan-700 border-cyan-200",     bgIcon: "bg-cyan-50 text-cyan-600",     icon: <Package size={14} /> },
  servicos:       { color: "bg-slate-100 text-slate-600 border-slate-200",  bgIcon: "bg-slate-50 text-slate-500",   icon: <Settings size={14} /> },
};

function getCatStyle(slug: string) {
  return CAT_STYLE[slug] ?? {
    color: "bg-slate-100 text-slate-600 border-slate-200",
    bgIcon: "bg-slate-50 text-slate-500",
    icon: <Package size={14} />,
  };
}

// ─────────────────────────────────────────────
// Margin color helper
// ─────────────────────────────────────────────
function margemColor(m: number) {
  if (m >= 25) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (m >= 15) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

// ─────────────────────────────────────────────
// ModelsDialog — lista e CRUD de modelos de 1 produto
// ─────────────────────────────────────────────
function ModelsDialog({
  produto, categorias, open, onClose,
}: {
  produto: Produto;
  categorias: CategoriaProduto[];
  open: boolean;
  onClose: () => void;
}) {
  const { data: modelos = [], isLoading } = useProdutoModelos(produto.id);
  const criarModelo = useCriarModelo();
  const atualizarModelo = useAtualizarModelo();
  const excluirModelo = useExcluirModelo();

  const [editingModelo, setEditingModelo] = useState<ProdutoModelo | null>(null);
  const [deleteModeloId, setDeleteModeloId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    markup_padrao: 40,
    margem_minima: 20,
    tempo_producao_min: 30,
    preco_fixo: "" as string | number,
    unidade_venda: "m2",
  });

  const openNew = () => {
    setEditingModelo(null);
    setForm({ nome: "", markup_padrao: 40, margem_minima: 20, tempo_producao_min: 30, preco_fixo: "", unidade_venda: "m2" });
    setFormOpen(true);
  };

  const openEdit = (m: ProdutoModelo) => {
    setEditingModelo(m);
    setForm({
      nome: m.nome,
      markup_padrao: m.markup_padrao,
      margem_minima: m.margem_minima,
      tempo_producao_min: m.tempo_producao_min ?? 30,
      preco_fixo: m.preco_fixo ?? "",
      unidade_venda: m.unidade_venda ?? "m2",
    });
    setFormOpen(true);
  };

  const handleSave = () => {
    const dados = {
      nome: form.nome.trim(),
      markup_padrao: form.markup_padrao,
      margem_minima: form.margem_minima,
      tempo_producao_min: form.tempo_producao_min,
      preco_fixo: form.preco_fixo !== "" ? Number(form.preco_fixo) : null,
      unidade_venda: form.unidade_venda,
    };
    if (!dados.nome) return;

    if (editingModelo) {
      atualizarModelo.mutate(
        { id: editingModelo.id, dados },
        { onSuccess: () => { showSuccess("Modelo atualizado!"); setFormOpen(false); }, onError: (e) => showError(e.message) }
      );
    } else {
      criarModelo.mutate(
        { produto_id: produto.id, ...dados },
        { onSuccess: () => { showSuccess("Modelo criado!"); setFormOpen(false); }, onError: (e) => showError(e.message) }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteModeloId) return;
    excluirModelo.mutate(deleteModeloId, {
      onSuccess: () => { showSuccess("Modelo excluído!"); setDeleteModeloId(null); },
      onError: (e) => showError(e.message),
    });
  };

  const cat = categorias.find((c) => c.slug === produto.categoria);
  const catStyle = getCatStyle(produto.categoria);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${catStyle.color}`}>
                {cat?.nome ?? produto.categoria}
              </span>
              {produto.nome}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-500">{modelos.length} modelo{modelos.length !== 1 ? "s" : ""}</p>
            <Button size="sm" onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-8 px-3 text-xs">
              <Plus size={13} className="mr-1" /> Novo Modelo
            </Button>
          </div>

          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-blue-600" size={24} />
              </div>
            ) : modelos.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Package size={32} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm">Nenhum modelo cadastrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {modelos.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.nome}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                        <span>Markup: {m.markup_padrao}%</span>
                        {m.tempo_producao_min && <span>{m.tempo_producao_min} min</span>}
                        {m.preco_fixo && <span className="font-medium text-blue-600">R$ {m.preco_fixo.toFixed(2)}</span>}
                        <span className={`font-medium px-1.5 py-0.5 rounded border text-[10px] ${margemColor(m.margem_minima)}`}>
                          min {m.margem_minima}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => openEdit(m)}>
                        <Edit size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteModeloId(m.id)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Form dialog for create/edit modelo */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-800">
              {editingModelo ? "Editar Modelo" : "Novo Modelo"}
              <span className="ml-2 text-sm font-normal text-slate-500">— {produto.nome}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Nome do Modelo</Label>
              <Input
                placeholder="Ex: 40x60cm, 1ª linha: Oracal 1 cor..."
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="h-10 rounded-xl border-slate-200 bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700 flex justify-between">
                  <span>Markup (%)</span>
                  <span className="text-emerald-600">{form.markup_padrao}%</span>
                </Label>
                <input
                  type="range" min={5} max={200} step={5} value={form.markup_padrao}
                  onChange={(e) => setForm((f) => ({ ...f, markup_padrao: +e.target.value }))}
                  className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700 flex justify-between">
                  <span>Margem mín. (%)</span>
                  <span className="text-blue-600">{form.margem_minima}%</span>
                </Label>
                <input
                  type="range" min={5} max={60} step={1} value={form.margem_minima}
                  onChange={(e) => setForm((f) => ({ ...f, margem_minima: +e.target.value }))}
                  className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700 flex justify-between">
                  <span>Produção (min)</span>
                  <span className="text-slate-600">{form.tempo_producao_min} min</span>
                </Label>
                <input
                  type="range" min={5} max={600} step={5} value={form.tempo_producao_min}
                  onChange={(e) => setForm((f) => ({ ...f, tempo_producao_min: +e.target.value }))}
                  className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-slate-700">Preço fixo (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                  <Input
                    type="number" min={0} step={0.01} value={form.preco_fixo}
                    onChange={(e) => setForm((f) => ({ ...f, preco_fixo: e.target.value }))}
                    placeholder="0,00" className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Unidade de Venda</Label>
              <Select value={form.unidade_venda} onValueChange={(v) => setForm((f) => ({ ...f, unidade_venda: v }))}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["m2", "m", "un", "ml", "kg", "l", "hr"].map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.nome.trim() || criarModelo.isPending || atualizarModelo.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl min-w-[120px]"
            >
              {(criarModelo.isPending || atualizarModelo.isPending) ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
              {editingModelo ? "Salvar" : "Criar Modelo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete modelo confirm */}
      <AlertDialog open={!!deleteModeloId} onOpenChange={(v) => !v && setDeleteModeloId(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Modelo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={excluirModelo.isPending} className="rounded-xl bg-red-600 hover:bg-red-700 text-white">
              {excluirModelo.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : null} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────
// ProdutoFormDialog — criar/editar produto
// ─────────────────────────────────────────────
function ProdutoFormDialog({
  open, onClose, categorias, editando,
}: {
  open: boolean;
  onClose: () => void;
  categorias: CategoriaProduto[];
  editando?: Produto | null;
}) {
  const criarProduto = useCriarProduto();
  const atualizarProduto = useAtualizarProduto();
  const queryClient = useQueryClient();

  // soft delete
  const desativarProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccess("Produto desativado!");
      onClose();
    },
    onError: (e: Error) => showError(e.message),
  });

  const [form, setForm] = useState({
    nome: editando?.nome ?? "",
    categoria: editando?.categoria ?? (categorias[0]?.slug ?? "adesivos"),
    unidade_padrao: editando?.unidade_padrao ?? "m2",
    descricao: editando?.descricao ?? "",
  });

  // Sync when editing changes
  React.useEffect(() => {
    setForm({
      nome: editando?.nome ?? "",
      categoria: editando?.categoria ?? (categorias[0]?.slug ?? "adesivos"),
      unidade_padrao: editando?.unidade_padrao ?? "m2",
      descricao: editando?.descricao ?? "",
    });
  }, [editando, categorias]);

  const handleSave = () => {
    const dados = { nome: form.nome.trim(), categoria: form.categoria, unidade_padrao: form.unidade_padrao, descricao: form.descricao || null };
    if (!dados.nome) return;

    if (editando) {
      atualizarProduto.mutate(
        { id: editando.id, dados },
        { onSuccess: () => { showSuccess("Produto atualizado!"); onClose(); }, onError: (e) => showError(e.message) }
      );
    } else {
      criarProduto.mutate(dados, {
        onSuccess: () => { showSuccess("Produto criado!"); onClose(); },
        onError: (e) => showError(e.message),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Package size={18} className="text-blue-600" />
            {editando ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Nome do Produto</Label>
            <Input
              placeholder="Ex: Adesivo Jateado, Banner Lona..."
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="h-11 rounded-xl border-slate-200 bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Unidade Padrão</Label>
              <Select value={form.unidade_padrao} onValueChange={(v) => setForm((f) => ({ ...f, unidade_padrao: v }))}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["m2", "m", "un", "ml", "kg", "l", "hr"].map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Descrição (opcional)</Label>
            <Textarea
              placeholder="Notas internas sobre este produto..."
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              rows={2}
              className="rounded-xl border-slate-200 bg-slate-50 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {editando && (
            <Button
              variant="ghost"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl mr-auto"
              onClick={() => desativarProduto.mutate(editando.id)}
              disabled={desativarProduto.isPending}
            >
              <Trash2 size={14} className="mr-1" /> Desativar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={!form.nome.trim() || criarProduto.isPending || atualizarProduto.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl min-w-[120px]"
          >
            {(criarProduto.isPending || atualizarProduto.isPending) ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
            {editando ? "Salvar" : "Criar Produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function ProdutosPage() {
  const { data: categorias = [], isLoading: loadingCats } = useCategorias();
  const { data: produtos = [], isLoading: loadingProdutos } = useProdutos();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");

  // Dialog state
  const [modelsOpen, setModelsOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editandoProduto, setEditandoProduto] = useState<Produto | null>(null);

  const isLoading = loadingCats || loadingProdutos;

  // Filtered products
  const filtered = useMemo(() => {
    let list = produtos;
    if (filterCat !== "all") list = list.filter((p) => p.categoria === filterCat);
    const term = searchTerm.toLowerCase().trim();
    if (term) list = list.filter((p) => p.nome.toLowerCase().includes(term) || p.categoria.toLowerCase().includes(term));
    return list;
  }, [produtos, filterCat, searchTerm]);

  // Category counts
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: produtos.length };
    categorias.forEach((c) => { counts[c.slug] = produtos.filter((p) => p.categoria === c.slug).length; });
    return counts;
  }, [produtos, categorias]);

  const openModels = (p: Produto) => { setSelectedProduto(p); setModelsOpen(true); };
  const openEdit = (p: Produto, e: React.MouseEvent) => { e.stopPropagation(); setEditandoProduto(p); setFormOpen(true); };
  const openNew = () => { setEditandoProduto(null); setFormOpen(true); };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Produtos</h1>
          <p className="text-slate-500 mt-1">
            {isLoading ? "Carregando..." : `${produtos.length} produto${produtos.length !== 1 ? "s" : ""} cadastrado${produtos.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto">
          <Plus size={20} className="mr-2" /> Novo Produto
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input
          placeholder="Buscar por nome ou categoria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 rounded-xl border-slate-200 bg-white h-12 shadow-sm"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterCat("all")}
          className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
            filterCat === "all" ? "bg-slate-800 text-white border-slate-800 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          Todos ({catCounts.all})
        </button>
        {categorias.map((cat) => {
          const style = getCatStyle(cat.slug);
          const count = catCounts[cat.slug] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={cat.slug}
              onClick={() => setFilterCat(cat.slug)}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterCat === cat.slug ? style.color + " ring-2 ring-offset-1 ring-blue-400 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {style.icon} {cat.nome} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Results info + clear */}
      {(searchTerm || filterCat !== "all") && (
        <p className="text-sm text-slate-500 px-1">
          {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          <button onClick={() => { setSearchTerm(""); setFilterCat("all"); }} className="ml-2 text-blue-500 hover:text-blue-700 underline">
            Limpar filtros
          </button>
        </p>
      )}

      {/* Product Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">Nenhum produto encontrado</h3>
          <p className="text-slate-500 mt-1 text-sm">Tente ajustar a busca ou os filtros.</p>
          {!searchTerm && filterCat === "all" && (
            <Button onClick={openNew} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
              <Plus size={16} className="mr-2" /> Criar Produto
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((produto) => {
            const cat = categorias.find((c) => c.slug === produto.categoria);
            const style = getCatStyle(produto.categoria);
            return (
              <Card key={produto.id} className="border-none shadow-sm rounded-2xl bg-white hover:shadow-md transition-all group">
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  {/* Top row: icon + category badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bgIcon}`}>
                      <Package size={20} />
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border flex-shrink-0 max-w-[140px] truncate ${style.color}`} title={cat?.nome ?? produto.categoria}>
                      {cat?.nome ?? produto.categoria}
                    </span>
                  </div>

                  {/* Product name */}
                  <h3 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-blue-700 transition-colors line-clamp-2">
                    {produto.nome}
                  </h3>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Ruler size={11} className="text-slate-400" /> {produto.unidade_padrao}
                    </span>
                    {produto.descricao && (
                      <span className="text-slate-400 italic truncate max-w-[150px]">{produto.descricao}</span>
                    )}
                  </div>

                  <Separator />

                  {/* Models preview */}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <List size={12} className="text-slate-400" />
                    <span>Ver modelos disponíveis</span>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto pt-1 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 rounded-lg h-8 text-xs font-medium border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => openModels(produto)}
                    >
                      <List size={13} className="mr-1" /> Modelos
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg h-8 w-8 flex-shrink-0"
                      onClick={(e) => openEdit(produto, e)}
                    >
                      <Edit size={13} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Models dialog */}
      {selectedProduto && (
        <ModelsDialog
          produto={selectedProduto}
          categorias={categorias}
          open={modelsOpen}
          onClose={() => { setModelsOpen(false); setSelectedProduto(null); }}
        />
      )}

      {/* Produto form dialog */}
      <ProdutoFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditandoProduto(null); }}
        categorias={categorias}
        editando={editandoProduto}
      />
    </div>
  );
}

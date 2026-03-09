import React, { useState, useMemo } from "react";
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  Tag,
  Calculator,
  Layers,
  Box,
  Ruler,
  DollarSign,
  Clock,
  Settings,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Produto {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  valor_mp: number;
  markup: number;
  minutos_producao: number;
  preco_venda: number;
  margem_minima: number;
  observacoes?: string;
}

// ─────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────
const MOCK_PRODUTOS: Produto[] = [
  { id: "p-1",  nome: "Fachada ACM 3mm",               categoria: "fachadas",           unidade: "m²", valor_mp: 85,  markup: 45, minutos_producao: 120, preco_venda: 195,  margem_minima: 20 },
  { id: "p-2",  nome: "Banner Lona 440g",               categoria: "pdv",                unidade: "m²", valor_mp: 18,  markup: 80, minutos_producao: 15,  preco_venda: 42,   margem_minima: 25 },
  { id: "p-3",  nome: "Letra Caixa Aço LED",            categoria: "fachadas",           unidade: "un", valor_mp: 320, markup: 50, minutos_producao: 180, preco_venda: 685,  margem_minima: 22 },
  { id: "p-4",  nome: "Adesivo Vinil Impressão",        categoria: "pdv",                unidade: "m²", valor_mp: 22,  markup: 75, minutos_producao: 20,  preco_venda: 55,   margem_minima: 28 },
  { id: "p-5",  nome: "Display MDF 1,80m",              categoria: "pdv",                unidade: "un", valor_mp: 95,  markup: 60, minutos_producao: 90,  preco_venda: 215,  margem_minima: 25 },
  { id: "p-6",  nome: "Painel Luminoso LED",            categoria: "fachadas",           unidade: "m²", valor_mp: 280, markup: 40, minutos_producao: 240, preco_venda: 680,  margem_minima: 20 },
  { id: "p-7",  nome: "Faixa Promocional Lona",         categoria: "campanhas",          unidade: "m²", valor_mp: 16,  markup: 80, minutos_producao: 10,  preco_venda: 38,   margem_minima: 30 },
  { id: "p-8",  nome: "Placa Sinalização PVC",          categoria: "comunicacao_interna",unidade: "un", valor_mp: 28,  markup: 70, minutos_producao: 25,  preco_venda: 72,   margem_minima: 25 },
  { id: "p-9",  nome: "Totem Retratil 60x160cm",        categoria: "pdv",                unidade: "un", valor_mp: 180, markup: 55, minutos_producao: 60,  preco_venda: 395,  margem_minima: 22 },
  { id: "p-10", nome: "Envelopamento Veículo Completo", categoria: "envelopamento",      unidade: "un", valor_mp: 850, markup: 45, minutos_producao: 480, preco_venda: 2100, margem_minima: 18 },
  { id: "p-11", nome: "Backdrop Evento 3x2m",           categoria: "campanhas",          unidade: "un", valor_mp: 145, markup: 60, minutos_producao: 45,  preco_venda: 320,  margem_minima: 22 },
  { id: "p-12", nome: "Adesivação de Parede",           categoria: "comunicacao_interna",unidade: "m²", valor_mp: 45,  markup: 65, minutos_producao: 35,  preco_venda: 110,  margem_minima: 25 },
];

// ─────────────────────────────────────────────
// Category config
// ─────────────────────────────────────────────
interface CategoriaConfig {
  id: string;
  label: string;
  color: string;
  bgIcon: string;
  icon: React.ReactNode;
}

const CATEGORIAS: CategoriaConfig[] = [
  {
    id: "fachadas",
    label: "Fachadas",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    bgIcon: "bg-blue-50 text-blue-600",
    icon: <Box size={14} />,
  },
  {
    id: "pdv",
    label: "PDV / Materiais",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    bgIcon: "bg-purple-50 text-purple-600",
    icon: <Tag size={14} />,
  },
  {
    id: "comunicacao_interna",
    label: "Comunicação Interna",
    color: "bg-teal-100 text-teal-700 border-teal-200",
    bgIcon: "bg-teal-50 text-teal-600",
    icon: <Layers size={14} />,
  },
  {
    id: "campanhas",
    label: "Campanhas",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    bgIcon: "bg-amber-50 text-amber-600",
    icon: <Package size={14} />,
  },
  {
    id: "envelopamento",
    label: "Envelopamento",
    color: "bg-rose-100 text-rose-700 border-rose-200",
    bgIcon: "bg-rose-50 text-rose-600",
    icon: <ChevronRight size={14} />,
  },
];

const getCategoriaConfig = (id: string): CategoriaConfig =>
  CATEGORIAS.find((c) => c.id === id) ?? {
    id,
    label: id,
    color: "bg-slate-100 text-slate-600 border-slate-200",
    bgIcon: "bg-slate-50 text-slate-500",
    icon: <Package size={14} />,
  };

// ─────────────────────────────────────────────
// Pricing helpers
// ─────────────────────────────────────────────
const MO_RATE = 0.28; // R$/min — estimated labor rate

function calcPreco(valorMp: number, minutos: number, markup: number) {
  const mo = minutos * MO_RATE;
  const custo = valorMp + mo;
  const venda = custo / (1 - markup / 100);
  return { mo, custo, venda };
}

function calcMargemReal(precoVenda: number, custo: number): number {
  if (precoVenda <= 0) return 0;
  return ((precoVenda - custo) / precoVenda) * 100;
}

function margemColor(margem: number): string {
  if (margem >= 25) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (margem >= 15) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

// ─────────────────────────────────────────────
// Empty form state
// ─────────────────────────────────────────────
const EMPTY_FORM: Omit<Produto, "id"> = {
  nome: "",
  categoria: "pdv",
  unidade: "m²",
  valor_mp: 0,
  markup: 40,
  minutos_producao: 30,
  preco_venda: 0,
  margem_minima: 20,
  observacoes: "",
};

// ─────────────────────────────────────────────
// Pricing Preview widget
// ─────────────────────────────────────────────
function PricingPreview({
  valorMp,
  minutos,
  markup,
}: {
  valorMp: number;
  minutos: number;
  markup: number;
}) {
  const { mo, custo, venda } = calcPreco(valorMp, minutos, markup);
  const margem = calcMargemReal(venda, custo);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <Calculator size={13} /> Simulação de Preço
      </p>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-600">MP (matéria-prima):</span>
          <span className="font-semibold text-slate-800">{fmt(valorMp)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">
            MO estimada ({minutos} min × R$ 0,28):
          </span>
          <span className="font-semibold text-slate-800">{fmt(mo)}</span>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between items-center">
          <span className="text-slate-600 font-medium">Custo total:</span>
          <span className="font-bold text-slate-800">{fmt(custo)}</span>
        </div>
        <div className="flex justify-between items-center pt-1">
          <span className="text-slate-700 font-semibold">
            Preço de venda ({markup}% markup):
          </span>
          <span className="font-black text-blue-700 text-base">{fmt(venda)}</span>
        </div>
      </div>
      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
        <span className="text-xs text-slate-500">Margem calculada:</span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-md border ${margemColor(
            margem
          )}`}
        >
          {margem.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>(MOCK_PRODUTOS);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Produto, "id">>(EMPTY_FORM);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Derived data ──────────────────────────
  const filtered = useMemo(() => {
    let list = produtos;

    if (filterCat !== "all") {
      list = list.filter((p) => p.categoria === filterCat);
    }

    const term = searchTerm.toLowerCase().trim();
    if (term) {
      list = list.filter(
        (p) =>
          p.nome.toLowerCase().includes(term) ||
          p.categoria.toLowerCase().includes(term) ||
          getCategoriaConfig(p.categoria).label.toLowerCase().includes(term)
      );
    }

    return list;
  }, [produtos, filterCat, searchTerm]);

  // Count per category (from all products, for badges)
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: produtos.length };
    CATEGORIAS.forEach((c) => {
      counts[c.id] = produtos.filter((p) => p.categoria === c.id).length;
    });
    return counts;
  }, [produtos]);

  // ── Dialog helpers ────────────────────────
  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: Produto, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(p.id);
    setForm({
      nome: p.nome,
      categoria: p.categoria,
      unidade: p.unidade,
      valor_mp: p.valor_mp,
      markup: p.markup,
      minutos_producao: p.minutos_producao,
      preco_venda: p.preco_venda,
      margem_minima: p.margem_minima,
      observacoes: p.observacoes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const { venda } = calcPreco(form.valor_mp, form.minutos_producao, form.markup);

    if (editingId) {
      setProdutos((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? { ...p, ...form, preco_venda: Math.round(venda * 100) / 100 }
            : p
        )
      );
    } else {
      const newId = `p-${Date.now()}`;
      setProdutos((prev) => [
        ...prev,
        { id: newId, ...form, preco_venda: Math.round(venda * 100) / 100 },
      ]);
    }
    setDialogOpen(false);
  };

  const confirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const handleDelete = () => {
    if (deleteId) {
      setProdutos((prev) => prev.filter((p) => p.id !== deleteId));
      setDeleteId(null);
    }
  };

  const setField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Render ────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Produtos
          </h1>
          <p className="text-slate-500 mt-1 flex items-center flex-wrap gap-2">
            {produtos.length} produto{produtos.length !== 1 ? "s" : ""}{" "}
            cadastrado{produtos.length !== 1 ? "s" : ""}
            <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100 font-medium">
              DEMO
            </span>
          </p>
        </div>
        <Button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
        >
          <Plus size={20} className="mr-2" /> Novo Produto
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <Input
          placeholder="Buscar por nome ou categoria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 rounded-xl border-slate-200 bg-white h-12 shadow-sm"
        />
      </div>

      {/* ── Category filter chips ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {/* All button */}
        <button
          onClick={() => setFilterCat("all")}
          className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
            filterCat === "all"
              ? "bg-slate-800 text-white border-slate-800 shadow-sm"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          Todos ({catCounts.all})
        </button>

        {CATEGORIAS.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCat(cat.id)}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterCat === cat.id
                ? cat.color + " ring-2 ring-offset-1 ring-blue-400 shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {cat.icon}
            {cat.label}
            <span className="opacity-70">({catCounts[cat.id] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* ── Results count ── */}
      {(searchTerm || filterCat !== "all") && (
        <p className="text-sm text-slate-500 px-1">
          {filtered.length} produto{filtered.length !== 1 ? "s" : ""}{" "}
          encontrado{filtered.length !== 1 ? "s" : ""}
          {(searchTerm || filterCat !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterCat("all");
              }}
              className="ml-2 text-blue-500 hover:text-blue-700 underline"
            >
              Limpar filtros
            </button>
          )}
        </p>
      )}

      {/* ── Product Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Nenhum produto encontrado
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            Tente ajustar a busca ou os filtros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((produto) => {
            const cat = getCategoriaConfig(produto.categoria);
            const { custo } = calcPreco(
              produto.valor_mp,
              produto.minutos_producao,
              produto.markup
            );
            const margem = calcMargemReal(produto.preco_venda, custo);
            const fmtBRL = (v: number) =>
              v.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
                minimumFractionDigits: 2,
              });

            return (
              <Card
                key={produto.id}
                className="border-none shadow-sm rounded-2xl bg-white hover:shadow-md transition-all group"
              >
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  {/* Top row: icon + category badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.bgIcon}`}
                    >
                      <Package size={20} />
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border flex-shrink-0 max-w-[120px] truncate ${cat.color}`}
                      title={cat.label}
                    >
                      {cat.label}
                    </span>
                  </div>

                  {/* Product name */}
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-blue-700 transition-colors line-clamp-2">
                      {produto.nome}
                    </h3>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Ruler size={11} className="text-slate-400" />
                      {produto.unidade}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-slate-400" />
                      {produto.minutos_producao} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Settings size={11} className="text-slate-400" />
                      {produto.markup}% markup
                    </span>
                  </div>

                  <Separator />

                  {/* Pricing mini-preview */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Custo MP:</span>
                      <span className="font-medium text-slate-700">
                        {fmtBRL(produto.valor_mp)}/{produto.unidade}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">→ Venda:</span>
                      <span className="font-bold text-blue-700">
                        {fmtBRL(produto.preco_venda)}/{produto.unidade}
                      </span>
                    </div>
                  </div>

                  {/* Margin badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Margem real:
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${margemColor(
                        margem
                      )}`}
                    >
                      {margem.toFixed(1)}%
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto pt-1 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg h-8 text-xs font-medium"
                      onClick={(e) => openEdit(produto, e)}
                    >
                      <Edit size={13} className="mr-1" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg h-8 w-8 flex-shrink-0"
                      onClick={(e) => confirmDelete(produto.id, e)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────
           Novo / Edit Dialog
          ───────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Package size={20} className="text-blue-600" />
              {editingId ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* ── SEÇÃO: IDENTIFICAÇÃO ── */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Tag size={12} /> Identificação
              </p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-slate-700">
                    Nome do Produto
                  </Label>
                  <Input
                    placeholder="Ex: Fachada ACM 3mm"
                    value={form.nome}
                    onChange={(e) => setField("nome", e.target.value)}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-slate-700">
                      Categoria
                    </Label>
                    <Select
                      value={form.categoria}
                      onValueChange={(v) => setField("categoria", v)}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-slate-700">
                      Unidade de Medida
                    </Label>
                    <Select
                      value={form.unidade}
                      onValueChange={(v) => setField("unidade", v)}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                        <SelectValue placeholder="Unidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        {["m²", "m", "un", "ml", "kg", "l"].map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── SEÇÃO: PRODUÇÃO ── */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock size={12} /> Tempo de Produção
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                    <span>Tempo estimado (minutos)</span>
                    <span className="text-blue-600 font-bold">
                      {form.minutos_producao} min
                    </span>
                  </Label>
                  <input
                    type="range"
                    min={5}
                    max={600}
                    step={5}
                    value={form.minutos_producao}
                    onChange={(e) =>
                      setField("minutos_producao", Number(e.target.value))
                    }
                    className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>5 min</span>
                    <span>5 h</span>
                    <span>10 h</span>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                  <strong>Etapas típicas:</strong> arte finalização → impressão /
                  corte → acabamento → instalação
                </div>
              </div>
            </div>

            <Separator />

            {/* ── SEÇÃO: PRECIFICAÇÃO ── */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <DollarSign size={12} /> Precificação
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-slate-700">
                      Valor MP (R$/{form.unidade})
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                        R$
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.valor_mp || ""}
                        onChange={(e) =>
                          setField("valor_mp", parseFloat(e.target.value) || 0)
                        }
                        className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-9"
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                      <span>Markup (%)</span>
                      <span className="text-emerald-600 font-bold">
                        {form.markup}%
                      </span>
                    </Label>
                    <input
                      type="range"
                      min={10}
                      max={200}
                      step={5}
                      value={form.markup}
                      onChange={(e) =>
                        setField("markup", Number(e.target.value))
                      }
                      className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-500 mt-3"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-slate-700">
                    Margem mínima p/ negociação (%)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={form.margem_minima || ""}
                    onChange={(e) =>
                      setField(
                        "margem_minima",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="h-11 rounded-xl border-slate-200 bg-slate-50"
                    placeholder="Ex: 20"
                  />
                  <p className="text-xs text-slate-400">
                    Abaixo desta margem o sistema deve alertar o vendedor ao
                    emitir orçamento.
                  </p>
                </div>

                {/* Pricing preview */}
                <PricingPreview
                  valorMp={form.valor_mp}
                  minutos={form.minutos_producao}
                  markup={form.markup}
                />
              </div>
            </div>

            <Separator />

            {/* ── SEÇÃO: OBSERVAÇÕES ── */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Layers size={12} /> Observações
              </p>
              <Textarea
                placeholder="Notas internas sobre este produto: materiais utilizados, fornecedores preferenciais, restrições técnicas..."
                value={form.observacoes}
                onChange={(e) => setField("observacoes", e.target.value)}
                rows={3}
                className="rounded-xl border-slate-200 bg-slate-50 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.nome.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl min-w-[120px]"
            >
              {editingId ? "Salvar Alterações" : "Criar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────
           Delete confirmation dialog
          ───────────────────────────────────────── */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Trash2 size={18} className="text-red-500" /> Excluir Produto
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            Tem certeza que deseja excluir{" "}
            <strong>
              {produtos.find((p) => p.id === deleteId)?.nome ?? "este produto"}
            </strong>
            ? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteId(null)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState, useMemo } from "react";
import {
  Package, Plus, Search, Edit, Trash2, Tag, Layers, Box, Ruler,
  DollarSign, Clock, Settings, ChevronDown, ChevronUp, Loader2,
  List, FlaskConical, Workflow, AlertTriangle, Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useCategorias, useProdutos, useProdutoModelos,
  useCriarProduto, useAtualizarProduto,
  useCriarModelo, useAtualizarModelo, useExcluirModelo,
  type Produto, type ProdutoModelo, type CategoriaProduto, type ModeloMaterial, type ModeloProcesso,
} from "@/domains/comercial/hooks/useProdutosModelos";
import { showSuccess, showError } from "@/utils/toast";

// ─────────────────────────────────────────────
// Category visual config
// ─────────────────────────────────────────────
const CAT_STYLE: Record<string, { color: string; bgIcon: string; icon: React.ReactNode }> = {
  adesivos:      { color: "bg-blue-100 text-blue-700 border-blue-200",     bgIcon: "bg-blue-50 text-blue-600",     icon: <Tag size={14} /> },
  banners_lonas: { color: "bg-purple-100 text-purple-700 border-purple-200", bgIcon: "bg-purple-50 text-purple-600", icon: <Layers size={14} /> },
  placas:        { color: "bg-teal-100 text-teal-700 border-teal-200",     bgIcon: "bg-teal-50 text-teal-600",     icon: <Box size={14} /> },
  fachadas:      { color: "bg-amber-100 text-amber-700 border-amber-200",  bgIcon: "bg-amber-50 text-amber-600",   icon: <Package size={14} /> },
  letreiros:     { color: "bg-orange-100 text-orange-700 border-orange-200", bgIcon: "bg-orange-50 text-orange-600", icon: <Package size={14} /> },
  luminosos:     { color: "bg-yellow-100 text-yellow-700 border-yellow-200", bgIcon: "bg-yellow-50 text-yellow-600", icon: <Package size={14} /> },
  grafica:       { color: "bg-green-100 text-green-700 border-green-200",  bgIcon: "bg-green-50 text-green-600",   icon: <Package size={14} /> },
  estruturas:    { color: "bg-stone-100 text-stone-700 border-stone-200",  bgIcon: "bg-stone-50 text-stone-600",   icon: <Package size={14} /> },
  displays:      { color: "bg-rose-100 text-rose-700 border-rose-200",     bgIcon: "bg-rose-50 text-rose-600",     icon: <Package size={14} /> },
  iluminacao:    { color: "bg-cyan-100 text-cyan-700 border-cyan-200",     bgIcon: "bg-cyan-50 text-cyan-600",     icon: <Package size={14} /> },
  servicos:      { color: "bg-slate-100 text-slate-600 border-slate-200",  bgIcon: "bg-slate-50 text-slate-500",   icon: <Settings size={14} /> },
};
function getCatStyle(slug: string) {
  return CAT_STYLE[slug] ?? { color: "bg-slate-100 text-slate-600 border-slate-200", bgIcon: "bg-slate-50 text-slate-500", icon: <Package size={14} /> };
}
function margemColor(m: number) {
  if (m >= 25) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (m >= 15) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Material { id: string; nome: string; unidade: string; preco_medio: number | null; }
type TipoMaterial = "material" | "acabamento";
type ModeloMaterialEx = ModeloMaterial & { tipo: TipoMaterial };

// ─────────────────────────────────────────────
// Hook: materiais catalog
// ─────────────────────────────────────────────
function useMateriaisCatalog() {
  return useQuery({
    queryKey: ["materiais-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materiais").select("id, nome, unidade, preco_medio").eq("ativo", true).order("nome").limit(600);
      if (error) throw error;
      return (data ?? []) as Material[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─────────────────────────────────────────────
// ModeloDetalhePanel — materiais + processos inline
// ─────────────────────────────────────────────
function ModeloDetalhePanel({ modeloId }: { modeloId: string }) {
  const queryClient = useQueryClient();
  const { data: catalog = [] } = useMateriaisCatalog();

  // Materiais do modelo
  const { data: mMateriais = [], isLoading: loadMat } = useQuery({
    queryKey: ["modelo-materiais", modeloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modelo_materiais")
        .select("*, material:materiais(nome, preco_medio)")
        .eq("modelo_id", modeloId)
        .order("tipo")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((d) => ({ ...d, tipo: (d.tipo ?? "material") as TipoMaterial })) as ModeloMaterialEx[];
    },
  });

  // Processos do modelo
  const { data: mProcessos = [], isLoading: loadProc } = useQuery({
    queryKey: ["modelo-processos", modeloId],
    queryFn: async () => {
      const { data, error } = await supabase.from("modelo_processos").select("*").eq("modelo_id", modeloId).order("ordem");
      if (error) throw error;
      return data as ModeloProcesso[];
    },
  });

  // Add material state
  const [matSearch, setMatSearch] = useState("");
  const [matId, setMatId] = useState("");
  const [matQtd, setMatQtd] = useState("");
  const [matUnd, setMatUnd] = useState("m²");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [matTipo, setMatTipo] = useState<TipoMaterial>("material");

  // Add processo state
  const [etapa, setEtapa] = useState("");
  const [tempo, setTempo] = useState("");

  const filteredMat = catalog.filter((m) => m.nome.toLowerCase().includes(matSearch.toLowerCase()) && matSearch.length > 1);

  const addMat = useMutation({
    mutationFn: async () => {
      if (!matId) throw new Error("Selecione um material");
      const qtd = parseFloat(matQtd);
      if (isNaN(qtd) || qtd <= 0) throw new Error("Quantidade inválida");
      const { error } = await supabase.from("modelo_materiais").insert({ modelo_id: modeloId, material_id: matId, quantidade_por_unidade: qtd, unidade: matUnd || null, tipo: matTipo });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modelo-materiais", modeloId] });
      queryClient.invalidateQueries({ queryKey: ["produto_modelos"] });
      setMatId(""); setMatQtd(""); setMatSearch(""); setMatTipo("material");
      showSuccess("Material adicionado!");
    },
    onError: (e: Error) => showError(e.message),
  });

  const removeMat = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("modelo_materiais").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["modelo-materiais", modeloId] }); showSuccess("Material removido"); },
    onError: (e: Error) => showError(e.message),
  });

  const addProc = useMutation({
    mutationFn: async () => {
      if (!etapa.trim()) throw new Error("Informe a etapa");
      const t = parseInt(tempo);
      if (isNaN(t) || t <= 0) throw new Error("Tempo inválido");
      const { error } = await supabase.from("modelo_processos").insert({ modelo_id: modeloId, etapa: etapa.trim(), tempo_por_unidade_min: t, ordem: mProcessos.length + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modelo-processos", modeloId] });
      queryClient.invalidateQueries({ queryKey: ["produto_modelos"] });
      setEtapa(""); setTempo("");
      showSuccess("Processo adicionado!");
    },
    onError: (e: Error) => showError(e.message),
  });

  const removeProc = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("modelo_processos").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["modelo-processos", modeloId] }); showSuccess("Processo removido"); },
    onError: (e: Error) => showError(e.message),
  });

  if (loadMat || loadProc) {
    return <div className="flex items-center gap-2 py-3 px-4 text-slate-400 text-xs"><Loader2 size={12} className="animate-spin" /> Carregando...</div>;
  }

  // Grouped materials
  const materiaisBase = mMateriais.filter((mm) => mm.tipo !== "acabamento");
  const acabamentos   = mMateriais.filter((mm) => mm.tipo === "acabamento");

  // Calculate total cost from materials
  const custoMateriais = mMateriais.reduce((sum, mm) => sum + (mm.material?.preco_medio ?? 0) * mm.quantidade_por_unidade, 0);
  const tempoTotal = mProcessos.reduce((sum, p) => sum + p.tempo_por_unidade_min, 0);

  return (
    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 space-y-5">

      {/* ── Summary strip ── */}
      {(mMateriais.length > 0 || mProcessos.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {mMateriais.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-lg px-2.5 py-1.5">
              <FlaskConical size={11} />
              <span>{materiaisBase.length} base{acabamentos.length > 0 ? ` • ${acabamentos.length} acabamento${acabamentos.length !== 1 ? "s" : ""}` : ""}</span>
              {custoMateriais > 0 && <span className="font-semibold">• R$ {custoMateriais.toFixed(2)}/un</span>}
            </div>
          )}
          {mProcessos.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs bg-violet-50 text-violet-700 border border-violet-100 rounded-lg px-2.5 py-1.5">
              <Workflow size={11} />
              <span>{mProcessos.length} etapa{mProcessos.length !== 1 ? "s" : ""}</span>
              <span className="font-semibold">• {tempoTotal} min total</span>
            </div>
          )}
        </div>
      )}

      {/* ── MATERIAL BASE ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <FlaskConical size={12} /> Material Base / Substrato
        </p>
        {materiaisBase.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
            <AlertTriangle size={12} /> Sem material base — o custo de MP não será calculado.
          </div>
        ) : (
          <div className="space-y-1 mb-2">
            {materiaisBase.map((mm) => (
              <div key={mm.id} className="flex items-center justify-between gap-2 bg-white border border-blue-100 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-700 truncate">{mm.material?.nome ?? "Material"}</span>
                  {mm.material?.preco_medio && (
                    <span className="text-xs text-slate-400 ml-2">R$ {mm.material.preco_medio.toFixed(2)}/{mm.unidade}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-500 font-mono bg-blue-50 rounded px-1.5 py-0.5 border border-blue-100">
                    {mm.quantidade_por_unidade} {mm.unidade ?? ""}
                  </span>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                    onClick={() => removeMat.mutate(mm.id)} disabled={removeMat.isPending}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ACABAMENTOS ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Scissors size={12} /> Materiais de Acabamento
        </p>
        {acabamentos.length === 0 ? (
          <p className="text-xs text-slate-400 mb-2 italic">Nenhum acabamento cadastrado.</p>
        ) : (
          <div className="space-y-1 mb-2">
            {acabamentos.map((mm) => (
              <div key={mm.id} className="flex items-center justify-between gap-2 bg-white border border-amber-100 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-700 truncate">{mm.material?.nome ?? "Material"}</span>
                  {mm.material?.preco_medio && (
                    <span className="text-xs text-slate-400 ml-2">R$ {mm.material.preco_medio.toFixed(2)}/{mm.unidade}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-500 font-mono bg-amber-50 rounded px-1.5 py-0.5 border border-amber-100">
                    {mm.quantidade_por_unidade} {mm.unidade ?? ""}
                  </span>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                    onClick={() => removeMat.mutate(mm.id)} disabled={removeMat.isPending}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ADD MATERIAL FORM ── */}
      <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Adicionar Material</p>
          {/* Toggle tipo */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[11px] font-medium">
            <button
              className={`px-3 py-1 flex items-center gap-1 transition-colors ${matTipo === "material" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              onClick={() => setMatTipo("material")}
            >
              <FlaskConical size={10} /> Base
            </button>
            <button
              className={`px-3 py-1 flex items-center gap-1 transition-colors ${matTipo === "acabamento" ? "bg-amber-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              onClick={() => setMatTipo("acabamento")}
            >
              <Scissors size={10} /> Acabamento
            </button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap relative">
          <div className="flex-1 min-w-40 relative">
            <Input
              placeholder="Buscar no catálogo de materiais..."
              value={matSearch}
              onChange={(e) => { setMatSearch(e.target.value); setMatId(""); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="h-8 text-xs rounded-lg"
            />
            {showSuggestions && matSearch.length > 1 && filteredMat.length > 0 && !matId && (
              <div className="absolute z-20 top-9 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                {filteredMat.slice(0, 20).map((m) => (
                  <button key={m.id} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex justify-between gap-2"
                    onMouseDown={() => { setMatId(m.id); setMatSearch(m.nome); setMatUnd(m.unidade); setShowSuggestions(false); }}>
                    <span className="font-medium text-slate-700">{m.nome}</span>
                    <span className="text-slate-400 shrink-0">{m.preco_medio ? `R$ ${m.preco_medio.toFixed(2)}/${m.unidade}` : m.unidade}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Input type="number" step="0.001" placeholder="Qtd" value={matQtd} onChange={(e) => setMatQtd(e.target.value)} className="h-8 w-20 text-xs rounded-lg" />
          <Select value={matUnd} onValueChange={setMatUnd}>
            <SelectTrigger className="h-8 w-20 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["m²", "m", "un", "ml", "kg", "l", "m²/h"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => addMat.mutate()} disabled={addMat.isPending || !matId || !matQtd}
            className={`h-8 text-xs rounded-lg px-3 text-white ${matTipo === "acabamento" ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}>
            {addMat.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} className="mr-1" />} Add
          </Button>
        </div>
      </div>

      {/* ── PROCESSOS ── */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Workflow size={12} /> Processos de Produção
        </p>

        {mProcessos.length > 0 && (
          <div className="space-y-1 mb-2">
            {mProcessos.map((proc) => (
              <div key={proc.id} className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-slate-400 font-mono w-5 shrink-0">{proc.ordem}.</span>
                  <span className="text-sm font-medium text-slate-700 truncate">{proc.etapa}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-slate-500 bg-slate-50 rounded px-1.5 py-0.5 border border-slate-100">
                    {proc.tempo_por_unidade_min} min
                  </span>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                    onClick={() => removeProc.mutate(proc.id)} disabled={removeProc.isPending}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add processo form */}
        <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Adicionar Etapa</p>
          <div className="flex gap-2">
            <Input placeholder="Ex: Impressão UV, Corte Router, Aplicação..." value={etapa} onChange={(e) => setEtapa(e.target.value)}
              className="h-8 text-xs rounded-lg flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && etapa && tempo) addProc.mutate(); }}
            />
            <div className="relative">
              <Input type="number" placeholder="Min" value={tempo} onChange={(e) => setTempo(e.target.value)}
                className="h-8 w-20 text-xs rounded-lg pr-7"
                onKeyDown={(e) => { if (e.key === "Enter" && etapa && tempo) addProc.mutate(); }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">min</span>
            </div>
            <Button size="sm" onClick={() => addProc.mutate()} disabled={addProc.isPending || !etapa || !tempo}
              className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3">
              {addProc.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} className="mr-1" />} Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ModeloFormDialog — criar/editar modelo
// ─────────────────────────────────────────────
function ModeloFormDialog({
  open, onClose, produto, editando,
}: { open: boolean; onClose: () => void; produto: Produto; editando?: ProdutoModelo | null }) {
  const criarModelo = useCriarModelo();
  const atualizarModelo = useAtualizarModelo();

  const [form, setForm] = useState({
    nome: "",
    markup_padrao: 40,
    margem_minima: 20,
    tempo_producao_min: 30,
    preco_fixo: "" as string | number,
    unidade_venda: "m2",
  });

  React.useEffect(() => {
    setForm({
      nome: editando?.nome ?? "",
      markup_padrao: editando?.markup_padrao ?? 40,
      margem_minima: editando?.margem_minima ?? 20,
      tempo_producao_min: editando?.tempo_producao_min ?? 30,
      preco_fixo: editando?.preco_fixo ?? "",
      unidade_venda: editando?.unidade_venda ?? "m2",
    });
  }, [editando, open]);

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
    const isPending = criarModelo.isPending || atualizarModelo.isPending;
    if (editando) {
      atualizarModelo.mutate({ id: editando.id, dados }, {
        onSuccess: () => { showSuccess("Modelo atualizado!"); onClose(); },
        onError: (e) => showError(e.message),
      });
    } else {
      criarModelo.mutate({ produto_id: produto.id, ...dados }, {
        onSuccess: () => { showSuccess("Modelo criado!"); onClose(); },
        onError: (e) => showError(e.message),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-800">
            {editando ? "Editar Modelo" : "Novo Modelo"}
            <span className="ml-2 text-sm font-normal text-slate-400">— {produto.nome}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Nome do Modelo</Label>
            <Input placeholder="Ex: 40x60cm, 1ª linha: Oracal 1 cor..." value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="h-10 rounded-xl border-slate-200 bg-slate-50" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700 flex justify-between">
                <span>Markup (%)</span>
                <span className="text-emerald-600 font-bold">{form.markup_padrao}%</span>
              </Label>
              <input type="range" min={5} max={200} step={5} value={form.markup_padrao}
                onChange={(e) => setForm((f) => ({ ...f, markup_padrao: +e.target.value }))}
                className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700 flex justify-between">
                <span>Margem mín. (%)</span>
                <span className="text-blue-600 font-bold">{form.margem_minima}%</span>
              </Label>
              <input type="range" min={5} max={60} step={1} value={form.margem_minima}
                onChange={(e) => setForm((f) => ({ ...f, margem_minima: +e.target.value }))}
                className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700 flex justify-between">
                <span>Tempo produção</span>
                <span className="text-slate-500">{form.tempo_producao_min} min</span>
              </Label>
              <input type="range" min={5} max={600} step={5} value={form.tempo_producao_min}
                onChange={(e) => setForm((f) => ({ ...f, tempo_producao_min: +e.target.value }))}
                className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-slate-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Preço fixo (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                <Input type="number" min={0} step={0.01} value={form.preco_fixo}
                  onChange={(e) => setForm((f) => ({ ...f, preco_fixo: e.target.value }))}
                  placeholder="Opcional" className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Unidade de Venda</Label>
            <Select value={form.unidade_venda} onValueChange={(v) => setForm((f) => ({ ...f, unidade_venda: v }))}>
              <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
              <SelectContent>{["m2", "m", "un", "ml", "kg", "l", "hr"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nome.trim() || criarModelo.isPending || atualizarModelo.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl min-w-[120px]">
            {(criarModelo.isPending || atualizarModelo.isPending) && <Loader2 className="animate-spin mr-2" size={14} />}
            {editando ? "Salvar" : "Criar Modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// ModelsDialog — lista modelos + expand detalhe
// ─────────────────────────────────────────────
function ModelsDialog({
  produto, categorias, open, onClose,
}: { produto: Produto; categorias: CategoriaProduto[]; open: boolean; onClose: () => void }) {
  const { data: modelos = [], isLoading } = useProdutoModelos(produto.id);
  const excluirModelo = useExcluirModelo();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingModelo, setEditingModelo] = useState<ProdutoModelo | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const cat = categorias.find((c) => c.slug === produto.categoria);
  const catStyle = getCatStyle(produto.categoria);

  const handleDelete = () => {
    if (!deleteId) return;
    excluirModelo.mutate(deleteId, {
      onSuccess: () => { showSuccess("Modelo excluído!"); setDeleteId(null); if (expandedId === deleteId) setExpandedId(null); },
      onError: (e) => showError(e.message),
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-hidden flex flex-col rounded-2xl p-0">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${catStyle.color}`}>
                  {cat?.nome ?? produto.categoria}
                </span>
                <h2 className="font-bold text-slate-800 text-lg leading-tight">{produto.nome}</h2>
              </div>
              <Button size="sm" onClick={() => { setEditingModelo(null); setFormOpen(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-8 px-3 text-xs shrink-0">
                <Plus size={13} className="mr-1" /> Novo Modelo
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isLoading ? "Carregando..." : `${modelos.length} modelo${modelos.length !== 1 ? "s" : ""} • Clique em ▾ para ver materiais e processos`}
            </p>
          </div>

          {/* Models list — scrollable */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
            ) : modelos.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Package size={36} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm">Nenhum modelo cadastrado</p>
                <Button variant="outline" size="sm" onClick={() => { setEditingModelo(null); setFormOpen(true); }}
                  className="mt-3 rounded-xl text-xs">
                  <Plus size={12} className="mr-1" /> Adicionar primeiro modelo
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {modelos.map((m) => {
                  const isExpanded = expandedId === m.id;
                  const hasMateriais = (m.materiais?.length ?? 0) > 0;
                  const hasProcessos = (m.processos?.length ?? 0) > 0;
                  return (
                    <div key={m.id}>
                      {/* Model row */}
                      <div className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${isExpanded ? "bg-slate-50" : ""}`}>
                        {/* Expand button */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : m.id)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all shrink-0 ${
                            isExpanded ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500"
                          }`}
                          title="Ver materiais e processos"
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {/* Model info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{m.nome}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                            <span className="flex items-center gap-1"><Settings size={10} /> {m.markup_padrao}% markup</span>
                            {m.tempo_producao_min && <span className="flex items-center gap-1"><Clock size={10} /> {m.tempo_producao_min} min</span>}
                            {m.preco_fixo && <span className="font-medium text-blue-600">R$ {m.preco_fixo.toFixed(2)}</span>}
                            <span className={`font-medium px-1.5 py-0.5 rounded border text-[10px] ${margemColor(m.margem_minima)}`}>
                              mín {m.margem_minima}%
                            </span>
                          </div>
                        </div>

                        {/* Status badges */}
                        <div className="flex gap-1 shrink-0">
                          {hasMateriais && (
                            <span title="Tem materiais" className="w-5 h-5 flex items-center justify-center rounded bg-blue-50 text-blue-500">
                              <FlaskConical size={11} />
                            </span>
                          )}
                          {hasProcessos && (
                            <span title="Tem processos" className="w-5 h-5 flex items-center justify-center rounded bg-violet-50 text-violet-500">
                              <Workflow size={11} />
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => { setEditingModelo(m); setFormOpen(true); }}>
                            <Edit size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteId(m.id)}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded detail panel */}
                      {isExpanded && <ModeloDetalhePanel modeloId={m.id} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modelo form */}
      <ModeloFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingModelo(null); }}
        produto={produto}
        editando={editingModelo}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Modelo</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={excluirModelo.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white">
              {excluirModelo.isPending && <Loader2 className="animate-spin mr-1" size={14} />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────
// ProdutoFormDialog
// ─────────────────────────────────────────────
function ProdutoFormDialog({
  open, onClose, categorias, editando,
}: { open: boolean; onClose: () => void; categorias: CategoriaProduto[]; editando?: Produto | null }) {
  const criarProduto = useCriarProduto();
  const atualizarProduto = useAtualizarProduto();
  const queryClient = useQueryClient();

  const desativar = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("produtos").update({ ativo: false }).eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["produtos"] }); showSuccess("Produto desativado!"); onClose(); },
    onError: (e: Error) => showError(e.message),
  });

  const [form, setForm] = useState({ nome: "", categoria: categorias[0]?.slug ?? "adesivos", unidade_padrao: "m2", descricao: "" });

  React.useEffect(() => {
    setForm({
      nome: editando?.nome ?? "",
      categoria: editando?.categoria ?? (categorias[0]?.slug ?? "adesivos"),
      unidade_padrao: editando?.unidade_padrao ?? "m2",
      descricao: editando?.descricao ?? "",
    });
  }, [editando, categorias, open]);

  const handleSave = () => {
    const dados = { nome: form.nome.trim(), categoria: form.categoria, unidade_padrao: form.unidade_padrao, descricao: form.descricao || null };
    if (!dados.nome) return;
    if (editando) {
      atualizarProduto.mutate({ id: editando.id, dados }, {
        onSuccess: () => { showSuccess("Produto atualizado!"); onClose(); },
        onError: (e) => showError(e.message),
      });
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
            <Input placeholder="Ex: Adesivo Jateado, Banner Lona..." value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="h-11 rounded-xl border-slate-200 bg-slate-50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>{categorias.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-slate-700">Unidade Padrão</Label>
              <Select value={form.unidade_padrao} onValueChange={(v) => setForm((f) => ({ ...f, unidade_padrao: v }))}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>{["m2", "m", "un", "ml", "kg", "l", "hr"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">Descrição (opcional)</Label>
            <Textarea placeholder="Notas internas..." value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              rows={2} className="rounded-xl border-slate-200 bg-slate-50 resize-none" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {editando && (
            <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl mr-auto"
              onClick={() => desativar.mutate(editando.id)} disabled={desativar.isPending}>
              <Trash2 size={14} className="mr-1" /> Desativar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.nome.trim() || criarProduto.isPending || atualizarProduto.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl min-w-[120px]">
            {(criarProduto.isPending || atualizarProduto.isPending) && <Loader2 className="animate-spin mr-2" size={14} />}
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

  const [modelsOpen, setModelsOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editandoProduto, setEditandoProduto] = useState<Produto | null>(null);

  const isLoading = loadingCats || loadingProdutos;

  const filtered = useMemo(() => {
    let list = produtos;
    if (filterCat !== "all") list = list.filter((p) => p.categoria === filterCat);
    const term = searchTerm.toLowerCase().trim();
    if (term) list = list.filter((p) => p.nome.toLowerCase().includes(term) || p.categoria.toLowerCase().includes(term));
    return list;
  }, [produtos, filterCat, searchTerm]);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: produtos.length };
    categorias.forEach((c) => { counts[c.slug] = produtos.filter((p) => p.categoria === c.slug).length; });
    return counts;
  }, [produtos, categorias]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Produtos</h1>
          <p className="text-slate-500 mt-1">
            {isLoading ? "Carregando..." : `${produtos.length} produto${produtos.length !== 1 ? "s" : ""} — clique em "Modelos" para ver variantes, materiais e processos`}
          </p>
        </div>
        <Button onClick={() => { setEditandoProduto(null); setFormOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto">
          <Plus size={20} className="mr-2" /> Novo Produto
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input placeholder="Buscar por nome ou categoria..." value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 rounded-xl border-slate-200 bg-white h-12 shadow-sm" />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterCat("all")}
          className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
            filterCat === "all" ? "bg-slate-800 text-white border-slate-800 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
          Todos ({catCounts.all})
        </button>
        {categorias.map((cat) => {
          const style = getCatStyle(cat.slug);
          const count = catCounts[cat.slug] ?? 0;
          if (count === 0) return null;
          return (
            <button key={cat.slug} onClick={() => setFilterCat(cat.slug)}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterCat === cat.slug ? style.color + " ring-2 ring-offset-1 ring-blue-400 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
              {style.icon} {cat.nome} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Results info */}
      {(searchTerm || filterCat !== "all") && (
        <p className="text-sm text-slate-500 px-1">
          {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          <button onClick={() => { setSearchTerm(""); setFilterCat("all"); }} className="ml-2 text-blue-500 hover:text-blue-700 underline">
            Limpar filtros
          </button>
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">Nenhum produto encontrado</h3>
          <p className="text-slate-500 mt-1 text-sm">Tente ajustar a busca ou os filtros.</p>
          {!searchTerm && filterCat === "all" && (
            <Button onClick={() => { setEditandoProduto(null); setFormOpen(true); }}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
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
              <Card key={produto.id} className="border-none shadow-sm rounded-2xl bg-white hover:shadow-md transition-all group cursor-pointer"
                onClick={() => { setSelectedProduto(produto); setModelsOpen(true); }}>
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  {/* Top: icon + category */}
                  <div className="flex items-start justify-between gap-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bgIcon}`}>
                      <Package size={20} />
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border flex-shrink-0 max-w-[140px] truncate ${style.color}`}
                      title={cat?.nome ?? produto.categoria}>
                      {cat?.nome ?? produto.categoria}
                    </span>
                  </div>

                  {/* Name */}
                  <h3 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-blue-700 transition-colors line-clamp-2">
                    {produto.nome}
                  </h3>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Ruler size={11} className="text-slate-400" /> {produto.unidade_padrao}</span>
                    {produto.descricao && <span className="text-slate-400 italic truncate max-w-[150px]">{produto.descricao}</span>}
                  </div>

                  <Separator />

                  {/* CTA */}
                  <div className="mt-auto">
                    <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-blue-500 transition-colors">
                      <List size={12} /> <span>Ver modelos, materiais e processos</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedProduto(produto); setModelsOpen(true); }}
                      className="flex-1 rounded-lg h-8 text-xs font-medium border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50">
                      <List size={13} className="mr-1" /> Modelos
                    </Button>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg h-8 w-8 flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); setEditandoProduto(produto); setFormOpen(true); }}>
                      <Edit size={13} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      {selectedProduto && (
        <ModelsDialog produto={selectedProduto} categorias={categorias} open={modelsOpen}
          onClose={() => { setModelsOpen(false); setSelectedProduto(null); }} />
      )}
      <ProdutoFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditandoProduto(null); }}
        categorias={categorias} editando={editandoProduto} />
    </div>
  );
}

// ============================================================================
// ADMIN MATERIAIS PAGE — Croma Print ERP/CRM
// CRUD completo de Matéria Prima com NCM, Plano de Contas e Venda Direta
// ============================================================================

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { brl } from "@/shared/utils/format";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Save,
  FilterX,
  ShieldCheck,
  Tag,
  BookOpen,
  TrendingUp,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Material {
  id: string;
  codigo: string | null;
  nome: string;
  tipo: string | null;
  categoria: string | null;
  unidade: string;
  preco_medio: number | null;
  estoque_atual: number;
  estoque_minimo: number | null;
  estoque_ideal: number | null;
  fornecedor_principal: string | null;
  ncm: string | null;
  venda_direta: boolean | null;
  plano_contas_entrada: string | null;
  plano_contas_saida: string | null;
  data_referencia_preco: string | null;
  ativo: boolean;
}

const CATEGORIAS = [
  "lona", "vinil", "acm", "tinta", "ferragem", "acabamento",
  "papel", "plástico", "madeira", "tecido", "outro",
];

const UNIDADES = ["m²", "m", "un", "kg", "L", "ml", "g", "pç", "rolo", "cx", "ft"];

const EMPTY_FORM: Omit<Material, "id" | "estoque_atual"> = {
  codigo: "",
  nome: "",
  tipo: null,
  categoria: null,
  unidade: "m²",
  preco_medio: null,
  estoque_minimo: null,
  estoque_ideal: null,
  fornecedor_principal: null,
  ncm: null,
  venda_direta: false,
  plano_contas_entrada: null,
  plano_contas_saida: null,
  data_referencia_preco: null,
  ativo: true,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminMateriaisPage() {
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("todas");
  const [showAtivos, setShowAtivos] = useState<"todos" | "ativos" | "inativos">("ativos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // ── Query ──────────────────────────────────────────────────────────────

  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ["admin-materiais"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("materiais")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Material[];
    },
  });

  // ── Filtered list ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = materiais;
    if (showAtivos === "ativos") list = list.filter((m) => m.ativo !== false);
    if (showAtivos === "inativos") list = list.filter((m) => m.ativo === false);
    if (catFilter !== "todas") list = list.filter((m) => m.categoria === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.nome.toLowerCase().includes(q) ||
          (m.codigo ?? "").toLowerCase().includes(q) ||
          (m.ncm ?? "").includes(q) ||
          (m.tipo ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [materiais, search, catFilter, showAtivos]);

  // ── Mutations ──────────────────────────────────────────────────────────

  const upsertMutation = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM & { id?: string }) => {
      const payload = {
        codigo: data.codigo || null,
        nome: data.nome.trim(),
        tipo: data.tipo || null,
        categoria: data.categoria || null,
        unidade: data.unidade,
        preco_medio: data.preco_medio || null,
        estoque_minimo: data.estoque_minimo || null,
        estoque_ideal: data.estoque_ideal || null,
        fornecedor_principal: data.fornecedor_principal || null,
        ncm: data.ncm || null,
        venda_direta: data.venda_direta ?? false,
        plano_contas_entrada: data.plano_contas_entrada || null,
        plano_contas_saida: data.plano_contas_saida || null,
        data_referencia_preco: data.data_referencia_preco || null,
        ativo: data.ativo,
      };

      if (data.id) {
        const { error } = await (supabase as any)
          .from("materiais")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("materiais")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-materiais"] });
      queryClient.invalidateQueries({ queryKey: ["materiais-lista"] });
      showSuccess(editingId ? "Material atualizado!" : "Material criado!");
      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
    },
    onError: (err) => {
      showError(err instanceof Error ? err.message : "Erro ao salvar material.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("materiais")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-materiais"] });
      showSuccess("Material desativado.");
      setDeleteTarget(null);
    },
    onError: () => showError("Erro ao desativar material."),
  });

  // ── Handlers ──────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(m: Material) {
    setEditingId(m.id);
    setForm({
      codigo: m.codigo ?? "",
      nome: m.nome,
      tipo: m.tipo,
      categoria: m.categoria,
      unidade: m.unidade,
      preco_medio: m.preco_medio,
      estoque_minimo: m.estoque_minimo,
      estoque_ideal: m.estoque_ideal,
      fornecedor_principal: m.fornecedor_principal,
      ncm: m.ncm,
      venda_direta: m.venda_direta ?? false,
      plano_contas_entrada: m.plano_contas_entrada,
      plano_contas_saida: m.plano_contas_saida,
      data_referencia_preco: m.data_referencia_preco,
      ativo: m.ativo,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      showError("Nome do material é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      await upsertMutation.mutateAsync({ ...form, id: editingId ?? undefined });
    } finally {
      setSaving(false);
    }
  }

  function field<K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Semáforo de estoque ────────────────────────────────────────────────

  function stockColor(m: Material): string {
    if (!m.estoque_minimo) return "bg-slate-200";
    if (m.estoque_atual <= m.estoque_minimo) return "bg-red-500";
    if (m.estoque_ideal && m.estoque_atual < m.estoque_ideal) return "bg-yellow-400";
    return "bg-green-500";
  }

  // ── Stats ─────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: materiais.filter((m) => m.ativo !== false).length,
    semPreco: materiais.filter((m) => m.ativo !== false && !m.preco_medio).length,
    comNcm: materiais.filter((m) => m.ativo !== false && m.ncm).length,
    vendaDireta: materiais.filter((m) => m.ativo !== false && m.venda_direta).length,
  }), [materiais]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package size={22} className="text-blue-600" />
            Matéria Prima
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cadastro e gestão de materiais, NCM e classificação fiscal
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus size={15} />
          Novo Material
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 bg-blue-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Package size={20} className="text-blue-600 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Total Ativos</p>
              <p className="text-xl font-bold text-blue-700">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp size={20} className="text-amber-600 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Sem Preço</p>
              <p className="text-xl font-bold text-amber-700">{stats.semPreco}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Tag size={20} className="text-green-600 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Com NCM</p>
              <p className="text-xl font-bold text-green-700">{stats.comNcm}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-purple-50">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck size={20} className="text-purple-600 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Venda Direta</p>
              <p className="text-xl font-bold text-purple-700">{stats.vendaDireta}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-60">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nome, código ou NCM…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={showAtivos} onValueChange={(v) => setShowAtivos(v as typeof showAtivos)}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Só ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>

        {(search || catFilter !== "todas") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setCatFilter("todas"); }}
            className="gap-1.5 text-slate-500"
          >
            <FilterX size={14} />
            Limpar
          </Button>
        )}

        <span className="text-sm text-slate-400 ml-auto">
          {filtered.length} material{filtered.length !== 1 ? "is" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[36px_80px_1fr_80px_70px_110px_120px_100px_60px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
          <span />
          <span>Código</span>
          <span>Nome</span>
          <span>Unid.</span>
          <span className="text-right">Preço/Un.</span>
          <span>NCM</span>
          <span>Plano Saída</span>
          <span className="text-center">V. Direta</span>
          <span />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            Nenhum material encontrado
          </div>
        )}

        {/* Rows */}
        {!isLoading && (
          <div className="divide-y divide-slate-100">
            {filtered.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[36px_80px_1fr_80px_70px_110px_120px_100px_60px] gap-2 items-center px-4 py-2.5 hover:bg-slate-50/80 transition-colors"
              >
                {/* Semáforo */}
                <div className="flex justify-center">
                  <span className={`w-2.5 h-2.5 rounded-full ${stockColor(m)}`} title="Nível de estoque" />
                </div>

                {/* Código */}
                <span className="text-xs font-mono text-slate-500 truncate">{m.codigo ?? "—"}</span>

                {/* Nome + categoria */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{m.nome}</p>
                  {m.categoria && (
                    <p className="text-xs text-slate-400 truncate capitalize">{m.categoria}</p>
                  )}
                </div>

                {/* Unidade */}
                <Badge variant="outline" className="text-xs w-fit font-normal">{m.unidade}</Badge>

                {/* Preço */}
                <span className="text-sm text-right tabular-nums text-slate-700">
                  {m.preco_medio != null ? brl(m.preco_medio) : <span className="text-amber-500 text-xs">S/ preço</span>}
                </span>

                {/* NCM */}
                <span className="text-xs font-mono text-slate-600 truncate">{m.ncm ?? "—"}</span>

                {/* Plano saída */}
                <span className="text-xs text-slate-500 truncate" title={m.plano_contas_saida ?? ""}>
                  {m.plano_contas_saida ? m.plano_contas_saida.slice(0, 18) + (m.plano_contas_saida.length > 18 ? "…" : "") : "—"}
                </span>

                {/* Venda direta */}
                <div className="flex justify-center">
                  {m.venda_direta ? (
                    <Badge className="text-xs bg-purple-100 text-purple-700 border-0 font-normal">Sim</Badge>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={() => openEdit(m)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Desativar"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Dialog Criar / Editar ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package size={16} className="text-blue-600" />
              {editingId ? "Editar Material" : "Novo Material"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 pt-2">

            {/* ── Dados básicos ───────────────────────────────────────── */}
            <div className="col-span-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Dados Básicos</p>
            </div>

            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input
                value={form.codigo ?? ""}
                onChange={(e) => field("codigo", e.target.value)}
                placeholder="MP-0001"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Nome <span className="text-red-500">*</span></Label>
              <Input
                value={form.nome}
                onChange={(e) => field("nome", e.target.value)}
                placeholder="Lona Frontlit 440g"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoria ?? "__none"} onValueChange={(v) => field("categoria", v === "__none" ? null : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Nenhuma —</SelectItem>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo / Subtipo</Label>
              <Input
                value={form.tipo ?? ""}
                onChange={(e) => field("tipo", e.target.value || null)}
                placeholder="ex: Frontlit, Backlit…"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={form.unidade} onValueChange={(v) => field("unidade", v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Preço Médio (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.preco_medio ?? ""}
                onChange={(e) => field("preco_medio", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="0,00"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Fornecedor Principal</Label>
              <Input
                value={form.fornecedor_principal ?? ""}
                onChange={(e) => field("fornecedor_principal", e.target.value || null)}
                placeholder="Nome do fornecedor"
                className="h-9"
              />
            </div>

            {/* ── Estoque ─────────────────────────────────────────────── */}
            <div className="col-span-2 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Controle de Estoque</p>
            </div>

            <div className="space-y-1.5">
              <Label>Estoque Mínimo</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.estoque_minimo ?? ""}
                onChange={(e) => field("estoque_minimo", e.target.value ? parseFloat(e.target.value) : null)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Estoque Ideal</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.estoque_ideal ?? ""}
                onChange={(e) => field("estoque_ideal", e.target.value ? parseFloat(e.target.value) : null)}
                className="h-9"
              />
            </div>

            {/* ── Fiscal / NCM ─────────────────────────────────────────── */}
            <div className="col-span-2 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Tag size={12} />
                Fiscal / NCM
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>NCM</Label>
              <Input
                value={form.ncm ?? ""}
                onChange={(e) => field("ncm", e.target.value || null)}
                placeholder="0000.00.00"
                className="h-9 font-mono"
                maxLength={12}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Data Referência do Preço</Label>
              <Input
                type="date"
                value={form.data_referencia_preco ?? ""}
                onChange={(e) => field("data_referencia_preco", e.target.value || null)}
                className="h-9"
              />
            </div>

            {/* ── Plano de Contas ─────────────────────────────────────── */}
            <div className="col-span-2 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BookOpen size={12} />
                Plano de Contas
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Plano Contas Entrada</Label>
              <Input
                value={form.plano_contas_entrada ?? ""}
                onChange={(e) => field("plano_contas_entrada", e.target.value || null)}
                placeholder="1.1.01 — Estoque"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Plano Contas Saída</Label>
              <Input
                value={form.plano_contas_saida ?? ""}
                onChange={(e) => field("plano_contas_saida", e.target.value || null)}
                placeholder="4.1.01 — CMV"
                className="h-9"
              />
            </div>

            {/* ── Flags ───────────────────────────────────────────────── */}
            <div className="col-span-2 pt-2 border-t border-slate-100 flex items-center gap-8">
              <div className="flex items-center gap-3">
                <Switch
                  id="venda_direta"
                  checked={form.venda_direta ?? false}
                  onCheckedChange={(v) => field("venda_direta", v)}
                />
                <Label htmlFor="venda_direta" className="cursor-pointer">
                  Venda Direta
                  <span className="block text-xs text-slate-400 font-normal">Material vendido sem industrialização</span>
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="ativo"
                  checked={form.ativo}
                  onCheckedChange={(v) => field("ativo", v)}
                />
                <Label htmlFor="ativo" className="cursor-pointer">
                  Ativo
                  <span className="block text-xs text-slate-400 font-normal">Visível nos orçamentos</span>
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Confirm Delete ───────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar material?</AlertDialogTitle>
            <AlertDialogDescription>
              O material <strong>{deleteTarget?.nome}</strong> será desativado e não aparecerá em novos orçamentos.
              Pode ser reativado a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

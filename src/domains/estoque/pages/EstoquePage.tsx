// ============================================================================
// ESTOQUE PAGE — Croma Print ERP/CRM
// Materiais, Movimentacoes e Inventario
// ============================================================================

import { useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { brl, formatDateTime, formatNumber } from "@/shared/utils/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Package,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  BookmarkCheck,
  Plus,
  Search,
  ClipboardList,
  ArrowRightLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Warehouse,
  ChevronDown,
  ChevronUp,
  Eye,
  SlidersHorizontal,
  ClipboardCheck,
  Minus,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Categoria = "lona" | "vinil" | "acm" | "tinta" | "ferragem" | "acabamento";
type Unidade = "un" | "m2" | "m" | "ml" | "kg" | "L" | "rolo" | "pct" | "chapa";
type TipoMovimentacao =
  | "entrada"
  | "saida"
  | "reserva"
  | "liberacao_reserva"
  | "ajuste"
  | "devolucao";

interface EstoqueSaldo {
  quantidade_disponivel: number;
  quantidade_reservada: number;
}

interface Material {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: string | null;
  unidade: string;
  estoque_minimo: number;
  preco_medio: number | null;
  localizacao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  estoque_saldos: EstoqueSaldo[] | null;
}

interface Movimentacao {
  id: string;
  material_id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  referencia_tipo: string | null;
  referencia_id: string | null;
  motivo: string | null;
  usuario_id: string | null;
  created_at: string;
  materiais: { nome: string; codigo: string | null; unidade: string } | null;
}

interface InventarioRow {
  material_id: string;
  codigo: string | null;
  nome: string;
  unidade: string;
  saldo_sistema: number;
  saldo_contado: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: "lona", label: "Lona" },
  { value: "vinil", label: "Vinil" },
  { value: "acm", label: "ACM" },
  { value: "tinta", label: "Tinta" },
  { value: "ferragem", label: "Ferragem" },
  { value: "acabamento", label: "Acabamento" },
];

const UNIDADES: { value: Unidade; label: string }[] = [
  { value: "un", label: "un" },
  { value: "m2", label: "m\u00B2" },
  { value: "m", label: "m" },
  { value: "ml", label: "ml" },
  { value: "kg", label: "kg" },
  { value: "L", label: "L" },
  { value: "rolo", label: "rolo" },
  { value: "pct", label: "pct" },
  { value: "chapa", label: "chapa" },
];

const TIPOS_MOV: { value: TipoMovimentacao; label: string }[] = [
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saida" },
  { value: "reserva", label: "Reserva" },
  { value: "liberacao_reserva", label: "Liberacao de Reserva" },
  { value: "ajuste", label: "Ajuste" },
  { value: "devolucao", label: "Devolucao" },
];

const CATEGORIA_COLORS: Record<string, string> = {
  lona: "bg-blue-50 text-blue-700 border-blue-200",
  vinil: "bg-purple-50 text-purple-700 border-purple-200",
  acm: "bg-slate-100 text-slate-700 border-slate-300",
  tinta: "bg-cyan-50 text-cyan-700 border-cyan-200",
  ferragem: "bg-amber-50 text-amber-700 border-amber-200",
  acabamento: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const TIPO_MOV_BADGE: Record<TipoMovimentacao, { label: string; className: string }> = {
  entrada: { label: "Entrada", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  saida: { label: "Saida", className: "bg-red-50 text-red-600 border-red-200" },
  reserva: { label: "Reserva", className: "bg-amber-50 text-amber-700 border-amber-200" },
  liberacao_reserva: { label: "Liberacao", className: "bg-blue-50 text-blue-700 border-blue-200" },
  ajuste: { label: "Ajuste", className: "bg-slate-50 text-slate-700 border-slate-200" },
  devolucao: { label: "Devolucao", className: "bg-purple-50 text-purple-700 border-purple-200" },
};

const CATEGORIA_PREFIXOS: Record<string, string> = {
  lona: "LON",
  vinil: "VIN",
  acm: "ACM",
  tinta: "TIN",
  ferragem: "FER",
  acabamento: "ACA",
};

const MOV_SINAL_POSITIVO: TipoMovimentacao[] = [
  "entrada",
  "devolucao",
  "liberacao_reserva",
];

type SortKey = "nome" | "saldo";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSaldo(m: Material): number {
  if (!m.estoque_saldos || m.estoque_saldos.length === 0) return 0;
  return Number(m.estoque_saldos[0].quantidade_disponivel) || 0;
}

function getReservado(m: Material): number {
  if (!m.estoque_saldos || m.estoque_saldos.length === 0) return 0;
  return Number(m.estoque_saldos[0].quantidade_reservada) || 0;
}

function getStatus(m: Material): "ok" | "baixo" | "critico" {
  const saldo = getSaldo(m);
  const minimo = Number(m.estoque_minimo) || 0;
  if (saldo === 0) return "critico";
  if (saldo < minimo) return "baixo";
  return "ok";
}

function getUnidadeLabel(un: string): string {
  if (un === "m2") return "m\u00B2";
  return un;
}

// ─── KPI Card Sub-component ─────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">
            {label}
          </p>
          <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight font-mono">
            {value}
          </p>
          {sub && (
            <p
              className={`text-xs mt-0.5 font-medium ${subColor ?? "text-slate-400"}`}
            >
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
      <div className="p-6 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function EstoquePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("materiais");

  // ─── Material state ─────────────────────────────────────────────────────
  const [searchMat, setSearchMat] = useState("");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [filterStatus, setFilterStatus] = useState<"todos" | "ok" | "baixo" | "critico">("todos");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortAsc, setSortAsc] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailMaterial, setDetailMaterial] = useState<Material | null>(null);
  const [ajusteDialog, setAjusteDialog] = useState<Material | null>(null);
  const [entradaDialog, setEntradaDialog] = useState<Material | null>(null);

  // Create form
  const [formCodigo, setFormCodigo] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formCategoria, setFormCategoria] = useState<string>("");
  const [formUnidade, setFormUnidade] = useState<string>("un");
  const [formMinimo, setFormMinimo] = useState("");
  const [formPreco, setFormPreco] = useState("");
  const [formLocalizacao, setFormLocalizacao] = useState("");

  // Ajuste/Entrada form
  const [formQuantidade, setFormQuantidade] = useState("");
  const [formMotivo, setFormMotivo] = useState("");

  // ─── Movimentacao state ─────────────────────────────────────────────────
  const [searchMov, setSearchMov] = useState("");
  const [filterTipoMov, setFilterTipoMov] = useState<string>("todos");
  const [novaMovDialogOpen, setNovaMovDialogOpen] = useState(false);
  const [movMaterialId, setMovMaterialId] = useState<string>("");
  const [movTipo, setMovTipo] = useState<string>("entrada");
  const [movQuantidade, setMovQuantidade] = useState("");
  const [movMotivo, setMovMotivo] = useState("");

  // ─── Inventario state ───────────────────────────────────────────────────
  const [inventarioAtivo, setInventarioAtivo] = useState(false);
  const [inventarioRows, setInventarioRows] = useState<InventarioRow[]>([]);

  // ─── Pagination state ───────────────────────────────────────────────────
  const MAT_PAGE_SIZE = 20;
  const [matPage, setMatPage] = useState(0);

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  const {
    data: materiaisResult,
    isLoading: loadingMateriais,
  } = useQuery<{ data: Material[]; total: number }>({
    queryKey: ["estoque-materiais", matPage],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("materiais")
        .select("*, estoque_saldos(quantidade_disponivel, quantidade_reservada)", { count: "exact" })
        .eq("ativo", true)
        .order("nome")
        .range(matPage * MAT_PAGE_SIZE, (matPage + 1) * MAT_PAGE_SIZE - 1);
      if (error) throw error;
      return { data: (data ?? []) as unknown as Material[], total: count ?? 0 };
    },
  });

  const materiais = materiaisResult?.data ?? [];
  const totalMateriais = materiaisResult?.total ?? 0;
  const totalMatPages = Math.ceil(totalMateriais / MAT_PAGE_SIZE);

  const {
    data: movimentacoes = [],
    isLoading: loadingMov,
  } = useQuery<Movimentacao[]>({
    queryKey: ["estoque-movimentacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_movimentacoes")
        .select("*, materiais(nome, codigo, unidade)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Movimentacao[];
    },
  });

  // Movimentacoes for detail dialog
  const {
    data: detailMovs = [],
  } = useQuery<Movimentacao[]>({
    queryKey: ["estoque-detail-movs", detailMaterial?.id],
    enabled: !!detailMaterial,
    queryFn: async () => {
      if (!detailMaterial) return [];
      const { data, error } = await supabase
        .from("estoque_movimentacoes")
        .select("*, materiais(nome, codigo, unidade)")
        .eq("material_id", detailMaterial.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as Movimentacao[];
    },
  });

  // ==========================================================================
  // MUTATIONS
  // ==========================================================================

  const createMaterialMut = useMutation({
    mutationFn: async () => {
      // Create material
      const { data: mat, error: matErr } = await supabase
        .from("materiais")
        .insert({
          codigo: formCodigo || null,
          nome: formNome,
          categoria: formCategoria || null,
          unidade: formUnidade,
          estoque_minimo: formMinimo ? parseFloat(formMinimo) : 0,
          preco_medio: formPreco ? parseFloat(formPreco) : null,
          localizacao: formLocalizacao || null,
          ativo: true,
        })
        .select("id")
        .single();
      if (matErr) throw matErr;
      // Create saldo row
      const { error: saldoErr } = await supabase
        .from("estoque_saldos")
        .insert({
          material_id: mat.id,
          quantidade_disponivel: 0,
          quantidade_reservada: 0,
        });
      if (saldoErr) throw saldoErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais"] });
      showSuccess("Material criado com sucesso");
      resetCreateForm();
      setCreateDialogOpen(false);
    },
    onError: (err: Error) => {
      showError("Erro ao criar material: " + err.message);
    },
  });

  const registrarMovimentacaoMut = useMutation({
    mutationFn: async ({
      materialId,
      tipo,
      quantidade,
      motivo,
      referenciaT,
    }: {
      materialId: string;
      tipo: TipoMovimentacao;
      quantidade: number;
      motivo: string;
      referenciaT?: string;
    }) => {
      // Insert movimentacao
      const { error: movErr } = await supabase
        .from("estoque_movimentacoes")
        .insert({
          material_id: materialId,
          tipo,
          quantidade,
          motivo: motivo || null,
          referencia_tipo: referenciaT || null,
        });
      if (movErr) throw movErr;
      // Update saldo
      const { data: saldoData, error: saldoFetchErr } = await supabase
        .from("estoque_saldos")
        .select("quantidade_disponivel, quantidade_reservada")
        .eq("material_id", materialId)
        .single();
      if (saldoFetchErr) throw saldoFetchErr;

      let novoDisponivel = Number(saldoData.quantidade_disponivel) || 0;
      let novoReservado = Number(saldoData.quantidade_reservada) || 0;

      switch (tipo) {
        case "entrada":
        case "devolucao":
          novoDisponivel += quantidade;
          break;
        case "saida":
          novoDisponivel -= quantidade;
          break;
        case "reserva":
          novoDisponivel -= quantidade;
          novoReservado += quantidade;
          break;
        case "liberacao_reserva":
          novoDisponivel += quantidade;
          novoReservado -= quantidade;
          break;
        case "ajuste":
          novoDisponivel += quantidade; // positive or negative
          break;
      }

      const { error: saldoUpErr } = await supabase
        .from("estoque_saldos")
        .update({
          quantidade_disponivel: novoDisponivel,
          quantidade_reservada: novoReservado,
        })
        .eq("material_id", materialId);
      if (saldoUpErr) throw saldoUpErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-materiais"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-detail-movs"] });
    },
    onError: (err: Error) => {
      showError("Erro na movimentacao: " + err.message);
    },
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  function resetCreateForm() {
    setFormCodigo("");
    setFormNome("");
    setFormCategoria("");
    setFormUnidade("un");
    setFormMinimo("");
    setFormPreco("");
    setFormLocalizacao("");
  }

  function handleAutoCodigoFromCategoria(cat: string) {
    setFormCategoria(cat);
    const prefix = CATEGORIA_PREFIXOS[cat] || "MAT";
    const count = materiais.filter(
      (m) => m.categoria === cat
    ).length;
    setFormCodigo(`${prefix}-${String(count + 1).padStart(3, "0")}`);
  }

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortAsc(!sortAsc);
      } else {
        setSortKey(key);
        setSortAsc(true);
      }
    },
    [sortKey, sortAsc]
  );

  useEffect(() => {
    setMatPage(0);
  }, [searchMat, filterCategoria, filterStatus]);

  // ==========================================================================
  // COMPUTED DATA
  // ==========================================================================

  const filteredMateriais = useMemo(() => {
    let list = [...materiais];
    // Search
    if (searchMat) {
      const s = searchMat.toLowerCase();
      list = list.filter(
        (m) =>
          m.nome.toLowerCase().includes(s) ||
          (m.codigo && m.codigo.toLowerCase().includes(s))
      );
    }
    // Category filter
    if (filterCategoria !== "todas") {
      list = list.filter((m) => m.categoria === filterCategoria);
    }
    // Semáforo filter
    if (filterStatus !== "todos") {
      list = list.filter((m) => getStatus(m) === filterStatus);
    }
    // Sort
    list.sort((a, b) => {
      if (sortKey === "nome") {
        const cmp = a.nome.localeCompare(b.nome, "pt-BR");
        return sortAsc ? cmp : -cmp;
      }
      // saldo
      const cmp = getSaldo(a) - getSaldo(b);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [materiais, searchMat, filterCategoria, filterStatus, sortKey, sortAsc]);

  const filteredMovimentacoes = useMemo(() => {
    let list = [...movimentacoes];
    if (searchMov) {
      const s = searchMov.toLowerCase();
      list = list.filter(
        (m) =>
          (m.materiais?.nome?.toLowerCase().includes(s)) ||
          (m.materiais?.codigo?.toLowerCase().includes(s)) ||
          (m.motivo?.toLowerCase().includes(s))
      );
    }
    if (filterTipoMov !== "todos") {
      list = list.filter((m) => m.tipo === filterTipoMov);
    }
    return list;
  }, [movimentacoes, searchMov, filterTipoMov]);

  // KPIs
  const kpis = useMemo(() => {
    const ativos = materiais.filter((m) => m.ativo);
    const totalMat = totalMateriais;
    const valorTotal = ativos.reduce((acc, m) => {
      const saldo = getSaldo(m);
      const preco = Number(m.preco_medio) || 0;
      return acc + saldo * preco;
    }, 0);
    const criticos = ativos.filter((m) => getStatus(m) === "critico").length;
    const abaixoMinimo = ativos.filter((m) => getStatus(m) === "baixo").length;
    const comReserva = ativos.filter((m) => getReservado(m) > 0).length;
    return { totalMat, valorTotal, criticos, abaixoMinimo, comReserva };
  }, [materiais]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  function handleCreateMaterial() {
    if (!formNome.trim()) {
      showError("Nome do material e obrigatorio");
      return;
    }
    createMaterialMut.mutate();
  }

  function handleRegistrarAjuste(material: Material) {
    const qty = parseFloat(formQuantidade);
    if (isNaN(qty) || qty === 0) {
      showError("Quantidade invalida");
      return;
    }
    registrarMovimentacaoMut.mutate(
      {
        materialId: material.id,
        tipo: "ajuste",
        quantidade: qty,
        motivo: formMotivo || "Ajuste manual de estoque",
        referenciaT: "ajuste_inventario",
      },
      {
        onSuccess: () => {
          showSuccess("Ajuste registrado com sucesso");
          setAjusteDialog(null);
          setFormQuantidade("");
          setFormMotivo("");
        },
      }
    );
  }

  function handleRegistrarEntrada(material: Material) {
    const qty = parseFloat(formQuantidade);
    if (isNaN(qty) || qty <= 0) {
      showError("Quantidade deve ser positiva");
      return;
    }
    registrarMovimentacaoMut.mutate(
      {
        materialId: material.id,
        tipo: "entrada",
        quantidade: qty,
        motivo: formMotivo || "Entrada manual",
      },
      {
        onSuccess: () => {
          showSuccess("Entrada registrada com sucesso");
          setEntradaDialog(null);
          setFormQuantidade("");
          setFormMotivo("");
        },
      }
    );
  }

  function handleNovaMovimentacao() {
    if (!movMaterialId) {
      showError("Selecione um material");
      return;
    }
    const qty = parseFloat(movQuantidade);
    if (isNaN(qty) || qty <= 0) {
      showError("Quantidade deve ser positiva");
      return;
    }
    const tipo = movTipo as TipoMovimentacao;
    // For ajuste, quantity can be negative
    const realQty = tipo === "ajuste" ? qty : qty;
    registrarMovimentacaoMut.mutate(
      {
        materialId: movMaterialId,
        tipo,
        quantidade: realQty,
        motivo: movMotivo,
      },
      {
        onSuccess: () => {
          showSuccess("Movimentacao registrada com sucesso");
          setNovaMovDialogOpen(false);
          setMovMaterialId("");
          setMovTipo("entrada");
          setMovQuantidade("");
          setMovMotivo("");
        },
      }
    );
  }

  function handleIniciarInventario() {
    const rows: InventarioRow[] = materiais
      .filter((m) => m.ativo)
      .map((m) => ({
        material_id: m.id,
        codigo: m.codigo,
        nome: m.nome,
        unidade: m.unidade,
        saldo_sistema: getSaldo(m),
        saldo_contado: "",
      }));
    setInventarioRows(rows);
    setInventarioAtivo(true);
  }

  function handleUpdateContado(idx: number, val: string) {
    setInventarioRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], saldo_contado: val };
      return next;
    });
  }

  async function handleAplicarAjustes() {
    const ajustes = inventarioRows.filter((r) => {
      const contado = parseFloat(r.saldo_contado);
      return !isNaN(contado) && contado !== r.saldo_sistema;
    });

    if (ajustes.length === 0) {
      showError("Nenhum ajuste para aplicar");
      return;
    }

    let successCount = 0;
    for (const row of ajustes) {
      const contado = parseFloat(row.saldo_contado);
      const diff = contado - row.saldo_sistema;
      try {
        await registrarMovimentacaoMut.mutateAsync({
          materialId: row.material_id,
          tipo: "ajuste",
          quantidade: diff,
          motivo: `Inventario: contado ${contado}, sistema ${row.saldo_sistema}, diferenca ${diff > 0 ? "+" : ""}${diff}`,
          referenciaT: "ajuste_inventario",
        });
        successCount++;
      } catch {
        // continues on error, individual errors already shown via onError
      }
    }
    if (successCount > 0) {
      showSuccess(`${successCount} ajuste(s) aplicado(s) com sucesso`);
      setInventarioAtivo(false);
      setInventarioRows([]);
    }
  }

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  function renderSortHeader(label: string, key: SortKey) {
    const isActive = sortKey === key;
    return (
      <button
        onClick={() => handleSort(key)}
        className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-800 transition-colors"
      >
        {label}
        {isActive &&
          (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </button>
    );
  }

  function renderStatusBadge(m: Material) {
    const status = getStatus(m);
    if (status === "critico") {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-300 animate-pulse">
          CRITICO
        </Badge>
      );
    }
    if (status === "baixo") {
      return (
        <Badge className="bg-red-50 text-red-600 border-red-200">BAIXO</Badge>
      );
    }
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
        OK
      </Badge>
    );
  }

  function renderCategoriaBadge(cat: string | null) {
    if (!cat) return <span className="text-slate-300">-</span>;
    const colors = CATEGORIA_COLORS[cat] || "bg-slate-50 text-slate-600 border-slate-200";
    return <Badge className={colors}>{cat.toUpperCase()}</Badge>;
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Warehouse size={28} className="text-blue-600" />
            Estoque
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Materiais, movimentacoes e inventario
          </p>
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border rounded-xl shadow-sm p-1">
          <TabsTrigger value="materiais" className="rounded-lg gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Package size={16} />
            Materiais
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="rounded-lg gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <ArrowRightLeft size={16} />
            Movimentacoes
          </TabsTrigger>
          <TabsTrigger value="inventario" className="rounded-lg gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <ClipboardCheck size={16} />
            Inventario
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* TAB 1 — MATERIAIS                                                */}
        {/* ================================================================ */}
        <TabsContent value="materiais" className="space-y-6 mt-6">
          {/* KPIs */}
          {loadingMateriais ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <KpiSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Total de Materiais"
                value={String(kpis.totalMat)}
                icon={Boxes}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                sub={`${kpis.totalMat} ativo(s)`}
              />
              <KpiCard
                label="Valor Total em Estoque"
                value={brl(kpis.valorTotal)}
                icon={Package}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                sub="custo medio x saldo"
              />
              <KpiCard
                label="Criticos (Sem Estoque)"
                value={String(kpis.criticos)}
                icon={AlertTriangle}
                iconBg={kpis.criticos > 0 ? "bg-red-50" : "bg-slate-50"}
                iconColor={kpis.criticos > 0 ? "text-red-600" : "text-slate-400"}
                sub={kpis.criticos > 0 ? "Sem estoque!" : "Tudo em dia"}
                subColor={kpis.criticos > 0 ? "text-red-600" : "text-emerald-600"}
              />
              <KpiCard
                label="Abaixo do Minimo"
                value={String(kpis.abaixoMinimo)}
                icon={BookmarkCheck}
                iconBg={kpis.abaixoMinimo > 0 ? "bg-amber-50" : "bg-slate-50"}
                iconColor={kpis.abaixoMinimo > 0 ? "text-amber-600" : "text-slate-400"}
                sub={kpis.abaixoMinimo > 0 ? "Repor em breve" : "Acima do minimo"}
                subColor={kpis.abaixoMinimo > 0 ? "text-amber-600" : "text-emerald-600"}
              />
            </div>
          )}

          {/* Toolbar */}
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  placeholder="Buscar por nome ou codigo..."
                  value={searchMat}
                  onChange={(e) => setSearchMat(e.target.value)}
                  className="pl-9 rounded-xl border-slate-200"
                />
              </div>
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger className="w-[160px] rounded-xl border-slate-200">
                  <SlidersHorizontal size={14} className="mr-1.5 text-slate-400" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas categorias</SelectItem>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                <SelectTrigger className="w-[150px] rounded-xl border-slate-200">
                  <SelectValue placeholder="Semaforo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">🔵 Todos</SelectItem>
                  <SelectItem value="critico">🔴 Critico</SelectItem>
                  <SelectItem value="baixo">🟡 Baixo</SelectItem>
                  <SelectItem value="ok">🟢 OK</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  resetCreateForm();
                  setCreateDialogOpen(true);
                }}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 gap-1.5"
              >
                <Plus size={16} />
                Novo Material
              </Button>
            </CardContent>
          </Card>

          {/* Materials Table */}
          {loadingMateriais ? (
            <TableSkeleton rows={6} />
          ) : filteredMateriais.length === 0 ? (
            <Card className="border-none shadow-sm rounded-2xl bg-white">
              <CardContent className="py-16 flex flex-col items-center gap-3 text-slate-400">
                <Package size={48} strokeWidth={1.5} />
                <p className="text-sm">Nenhum material encontrado</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Codigo
                        </span>
                      </th>
                      <th className="text-left px-4 py-3">
                        {renderSortHeader("Nome", "nome")}
                      </th>
                      <th className="text-left px-4 py-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Categoria
                        </span>
                      </th>
                      <th className="text-center px-4 py-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Un.
                        </span>
                      </th>
                      <th className="text-right px-4 py-3">
                        {renderSortHeader("Saldo Disp.", "saldo")}
                      </th>
                      <th className="text-right px-4 py-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Reservado
                        </span>
                      </th>
                      <th className="text-right px-4 py-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Minimo
                        </span>
                      </th>
                      <th className="text-right px-4 py-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Preco Medio
                        </span>
                      </th>
                      <th className="text-right px-4 py-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Valor Total
                        </span>
                      </th>
                      <th className="text-center px-4 py-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Status
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMateriais.map((m) => {
                      const saldo = getSaldo(m);
                      const reservado = getReservado(m);
                      const preco = Number(m.preco_medio) || 0;
                      const valorTotal = saldo * preco;
                      const minimo = Number(m.estoque_minimo) || 0;
                      return (
                        <tr
                          key={m.id}
                          className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer transition-colors"
                          onClick={() => setDetailMaterial(m)}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">
                            {m.codigo || "-"}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {m.nome}
                          </td>
                          <td className="px-4 py-3">
                            {renderCategoriaBadge(m.categoria)}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500">
                            {getUnidadeLabel(m.unidade)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                            {formatNumber(saldo, 3)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">
                            {reservado > 0 ? formatNumber(reservado, 3) : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">
                            {minimo > 0 ? formatNumber(minimo, 3) : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">
                            {preco > 0 ? brl(preco) : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">
                            {valorTotal > 0 ? brl(valorTotal) : "-"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {renderStatusBadge(m)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  {filteredMateriais.length > 0
                    ? `Mostrando ${matPage * MAT_PAGE_SIZE + 1}–${Math.min((matPage + 1) * MAT_PAGE_SIZE, totalMateriais)} de ${totalMateriais} material(is)`
                    : "Nenhum material encontrado"}
                </span>
                {totalMatPages > 1 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm" className="rounded-xl"
                      disabled={matPage === 0}
                      onClick={() => setMatPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline" size="sm" className="rounded-xl"
                      disabled={matPage >= totalMatPages - 1}
                      onClick={() => setMatPage((p) => p + 1)}
                    >
                      Próximo
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 2 — MOVIMENTACOES                                            */}
        {/* ================================================================ */}
        <TabsContent value="movimentacoes" className="space-y-6 mt-6">
          {/* Toolbar */}
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  placeholder="Buscar material ou motivo..."
                  value={searchMov}
                  onChange={(e) => setSearchMov(e.target.value)}
                  className="pl-9 rounded-xl border-slate-200"
                />
              </div>
              <Select value={filterTipoMov} onValueChange={setFilterTipoMov}>
                <SelectTrigger className="w-[180px] rounded-xl border-slate-200">
                  <SlidersHorizontal size={14} className="mr-1.5 text-slate-400" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {TIPOS_MOV.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  setMovMaterialId("");
                  setMovTipo("entrada");
                  setMovQuantidade("");
                  setMovMotivo("");
                  setNovaMovDialogOpen(true);
                }}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 gap-1.5"
              >
                <Plus size={16} />
                Nova Movimentacao
              </Button>
            </CardContent>
          </Card>

          {/* Movimentacoes Table */}
          {loadingMov ? (
            <TableSkeleton rows={8} />
          ) : filteredMovimentacoes.length === 0 ? (
            <Card className="border-none shadow-sm rounded-2xl bg-white">
              <CardContent className="py-16 flex flex-col items-center gap-3 text-slate-400">
                <ArrowRightLeft size={48} strokeWidth={1.5} />
                <p className="text-sm">Nenhuma movimentacao encontrada</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Data", "Material", "Tipo", "Quantidade", "Referencia", "Motivo"].map(
                        (h) => (
                          <th
                            key={h}
                            className={`px-4 py-3 ${h === "Quantidade" ? "text-right" : "text-left"}`}
                          >
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              {h}
                            </span>
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovimentacoes.map((mov) => {
                      const tipoConfig =
                        TIPO_MOV_BADGE[mov.tipo] || TIPO_MOV_BADGE.ajuste;
                      const isPositive = MOV_SINAL_POSITIVO.includes(mov.tipo);
                      const qty = Number(mov.quantidade) || 0;
                      const displayQty =
                        mov.tipo === "ajuste"
                          ? (qty >= 0 ? "+" : "") + formatNumber(qty, 3)
                          : (isPositive ? "+" : "-") + formatNumber(Math.abs(qty), 3);
                      const qtyColor = isPositive || (mov.tipo === "ajuste" && qty >= 0)
                        ? "text-emerald-600"
                        : "text-red-600";
                      return (
                        <tr
                          key={mov.id}
                          className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                            {mov.created_at ? formatDateTime(mov.created_at) : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">
                              {mov.materiais?.nome || "-"}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              {mov.materiais?.codigo || ""}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={tipoConfig.className}>
                              {tipoConfig.label}
                            </Badge>
                          </td>
                          <td className={`px-4 py-3 text-right font-mono font-semibold ${qtyColor}`}>
                            {displayQty}{" "}
                            <span className="text-slate-400 text-xs font-normal">
                              {mov.materiais?.unidade ? getUnidadeLabel(mov.materiais.unidade) : ""}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {mov.referencia_tipo || "-"}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate">
                            {mov.motivo || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
                {filteredMovimentacoes.length} movimentacao(oes) exibida(s)
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 3 — INVENTARIO                                               */}
        {/* ================================================================ */}
        <TabsContent value="inventario" className="space-y-6 mt-6">
          {!inventarioAtivo ? (
            <Card className="border-none shadow-sm rounded-2xl bg-white">
              <CardContent className="py-20 flex flex-col items-center gap-4 text-slate-400">
                <ClipboardList size={56} strokeWidth={1.5} />
                <div className="text-center">
                  <p className="text-base font-medium text-slate-600">
                    Nenhum inventario em andamento
                  </p>
                  <p className="text-sm mt-1">
                    Inicie um inventario para comparar o saldo do sistema com a contagem fisica.
                  </p>
                </div>
                <Button
                  onClick={handleIniciarInventario}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 gap-1.5 mt-2"
                  disabled={loadingMateriais}
                >
                  <ClipboardCheck size={16} />
                  Iniciar Inventario
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-none shadow-sm rounded-2xl bg-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck size={18} className="text-blue-600" />
                    <span className="font-semibold text-slate-800">
                      Inventario em andamento
                    </span>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                      {inventarioRows.length} itens
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setInventarioAtivo(false);
                        setInventarioRows([]);
                      }}
                      className="rounded-xl gap-1.5"
                    >
                      <XCircle size={16} />
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleAplicarAjustes}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 gap-1.5"
                      disabled={registrarMovimentacaoMut.isPending}
                    >
                      <CheckCircle2 size={16} />
                      Aplicar Ajustes
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {["Codigo", "Material", "Un.", "Saldo Sistema", "Saldo Contado", "Diferenca"].map(
                          (h) => (
                            <th
                              key={h}
                              className={`px-4 py-3 ${
                                ["Saldo Sistema", "Saldo Contado", "Diferenca"].includes(h)
                                  ? "text-right"
                                  : "text-left"
                              }`}
                            >
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {h}
                              </span>
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {inventarioRows.map((row, idx) => {
                        const contado = parseFloat(row.saldo_contado);
                        const hasDiff = !isNaN(contado) && contado !== row.saldo_sistema;
                        const diff = !isNaN(contado) ? contado - row.saldo_sistema : 0;
                        return (
                          <tr
                            key={row.material_id}
                            className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                          >
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">
                              {row.codigo || "-"}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {row.nome}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {getUnidadeLabel(row.unidade)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600">
                              {formatNumber(row.saldo_sistema, 3)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Input
                                type="number"
                                step="0.001"
                                value={row.saldo_contado}
                                onChange={(e) =>
                                  handleUpdateContado(idx, e.target.value)
                                }
                                placeholder="0,000"
                                className="w-28 ml-auto text-right rounded-lg border-slate-200 font-mono text-sm"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold">
                              {!isNaN(contado) ? (
                                <span
                                  className={
                                    hasDiff
                                      ? diff > 0
                                        ? "text-emerald-600"
                                        : "text-red-600"
                                      : "text-slate-400"
                                  }
                                >
                                  {hasDiff
                                    ? (diff > 0 ? "+" : "") + formatNumber(diff, 3)
                                    : "0,000"}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ================================================================== */}
      {/* DIALOGS                                                             */}
      {/* ================================================================== */}

      {/* ─── Create Material Dialog ──────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package size={20} className="text-blue-600" />
              Novo Material
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase">
                  Categoria
                </Label>
                <Select
                  value={formCategoria}
                  onValueChange={handleAutoCodigoFromCategoria}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase">
                  Codigo
                </Label>
                <Input
                  value={formCodigo}
                  onChange={(e) => setFormCodigo(e.target.value)}
                  placeholder="LON-001"
                  className="rounded-xl font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase">
                Nome *
              </Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Nome do material"
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase">
                  Unidade
                </Label>
                <Select value={formUnidade} onValueChange={setFormUnidade}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase">
                  Estoque Minimo
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formMinimo}
                  onChange={(e) => setFormMinimo(e.target.value)}
                  placeholder="0"
                  className="rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase">
                  Preco Medio
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formPreco}
                  onChange={(e) => setFormPreco(e.target.value)}
                  placeholder="0,00"
                  className="rounded-xl font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase">
                Localizacao
              </Label>
              <Input
                value={formLocalizacao}
                onChange={(e) => setFormLocalizacao(e.target.value)}
                placeholder="Ex: Prateleira A3, Galpao 2"
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateMaterial}
              disabled={createMaterialMut.isPending}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 gap-1.5"
            >
              {createMaterialMut.isPending ? (
                <RotateCcw size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Criar Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Material Detail Dialog ──────────────────────────────────────── */}
      <Dialog
        open={!!detailMaterial}
        onOpenChange={(open) => !open && setDetailMaterial(null)}
      >
        <DialogContent className="max-w-2xl rounded-2xl">
          {detailMaterial && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye size={20} className="text-blue-600" />
                  {detailMaterial.nome}
                  <span className="text-sm font-mono text-slate-400 font-normal ml-2">
                    {detailMaterial.codigo || "sem codigo"}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-2">
                {/* Info grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase">
                      Categoria
                    </p>
                    <div className="mt-1">
                      {renderCategoriaBadge(detailMaterial.categoria)}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase">
                      Unidade
                    </p>
                    <p className="text-sm font-medium text-slate-700 mt-1">
                      {getUnidadeLabel(detailMaterial.unidade)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase">
                      Preco Medio
                    </p>
                    <p className="text-sm font-mono font-medium text-slate-700 mt-1">
                      {Number(detailMaterial.preco_medio) > 0
                        ? brl(Number(detailMaterial.preco_medio))
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase">
                      Localizacao
                    </p>
                    <p className="text-sm text-slate-700 mt-1">
                      {detailMaterial.localizacao || "-"}
                    </p>
                  </div>
                </div>

                {/* Saldos */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border border-slate-100 rounded-xl">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-slate-400 uppercase">Disponivel</p>
                      <p className="text-lg font-bold text-slate-800 font-mono">
                        {formatNumber(getSaldo(detailMaterial), 3)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-slate-100 rounded-xl">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-slate-400 uppercase">Reservado</p>
                      <p className="text-lg font-bold text-amber-600 font-mono">
                        {formatNumber(getReservado(detailMaterial), 3)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-slate-100 rounded-xl">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-slate-400 uppercase">Minimo</p>
                      <p className="text-lg font-bold text-slate-600 font-mono">
                        {formatNumber(Number(detailMaterial.estoque_minimo) || 0, 3)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 uppercase font-medium">
                    Status:
                  </span>
                  {renderStatusBadge(detailMaterial)}
                </div>

                {/* Recent Movimentacoes */}
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                    Ultimas Movimentacoes
                  </p>
                  {detailMovs.length === 0 ? (
                    <p className="text-sm text-slate-400 py-3">
                      Nenhuma movimentacao registrada
                    </p>
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="text-left px-3 py-2 text-slate-500 uppercase">
                              Data
                            </th>
                            <th className="text-left px-3 py-2 text-slate-500 uppercase">
                              Tipo
                            </th>
                            <th className="text-right px-3 py-2 text-slate-500 uppercase">
                              Qtd
                            </th>
                            <th className="text-left px-3 py-2 text-slate-500 uppercase">
                              Motivo
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailMovs.map((dm) => {
                            const tc =
                              TIPO_MOV_BADGE[dm.tipo] || TIPO_MOV_BADGE.ajuste;
                            const isPos = MOV_SINAL_POSITIVO.includes(dm.tipo);
                            const dq = Number(dm.quantidade) || 0;
                            return (
                              <tr
                                key={dm.id}
                                className="border-b border-slate-50"
                              >
                                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                  {dm.created_at
                                    ? formatDateTime(dm.created_at)
                                    : "-"}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge className={tc.className + " text-[10px] px-1.5 py-0"}>
                                    {tc.label}
                                  </Badge>
                                </td>
                                <td
                                  className={`px-3 py-2 text-right font-mono font-semibold ${
                                    isPos || (dm.tipo === "ajuste" && dq >= 0)
                                      ? "text-emerald-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {dm.tipo === "ajuste"
                                    ? (dq >= 0 ? "+" : "") + formatNumber(dq, 3)
                                    : (isPos ? "+" : "-") + formatNumber(Math.abs(dq), 3)}
                                </td>
                                <td className="px-3 py-2 text-slate-600 truncate max-w-[160px]">
                                  {dm.motivo || "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormQuantidade("");
                    setFormMotivo("");
                    setAjusteDialog(detailMaterial);
                  }}
                  className="rounded-xl gap-1.5"
                >
                  <SlidersHorizontal size={16} />
                  Ajustar Estoque
                </Button>
                <Button
                  onClick={() => {
                    setFormQuantidade("");
                    setFormMotivo("");
                    setEntradaDialog(detailMaterial);
                  }}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                >
                  <ArrowDownToLine size={16} />
                  Registrar Entrada
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Ajustar Estoque Dialog ──────────────────────────────────────── */}
      <Dialog
        open={!!ajusteDialog}
        onOpenChange={(open) => !open && setAjusteDialog(null)}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal size={20} className="text-slate-600" />
              Ajuste de Estoque
            </DialogTitle>
          </DialogHeader>
          {ajusteDialog && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600">
                Material: <strong>{ajusteDialog.nome}</strong>
              </p>
              <p className="text-xs text-slate-400">
                Saldo atual:{" "}
                <span className="font-mono font-semibold text-slate-700">
                  {formatNumber(getSaldo(ajusteDialog), 3)}
                </span>{" "}
                {getUnidadeLabel(ajusteDialog.unidade)}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase">
                  Quantidade (positiva ou negativa)
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formQuantidade}
                  onChange={(e) => setFormQuantidade(e.target.value)}
                  placeholder="Ex: 5 ou -3"
                  className="rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase">
                  Motivo
                </Label>
                <Textarea
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  placeholder="Motivo do ajuste..."
                  className="rounded-xl"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAjusteDialog(null)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => ajusteDialog && handleRegistrarAjuste(ajusteDialog)}
              disabled={registrarMovimentacaoMut.isPending}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 gap-1.5"
            >
              {registrarMovimentacaoMut.isPending ? (
                <RotateCcw size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Confirmar Ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Registrar Entrada Dialog ────────────────────────────────────── */}
      <Dialog
        open={!!entradaDialog}
        onOpenChange={(open) => !open && setEntradaDialog(null)}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine size={20} className="text-emerald-600" />
              Registrar Entrada
            </DialogTitle>
          </DialogHeader>
          {entradaDialog && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600">
                Material: <strong>{entradaDialog.nome}</strong>
              </p>
              <p className="text-xs text-slate-400">
                Saldo atual:{" "}
                <span className="font-mono font-semibold text-slate-700">
                  {formatNumber(getSaldo(entradaDialog), 3)}
                </span>{" "}
                {getUnidadeLabel(entradaDialog.unidade)}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase">
                  Quantidade
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={formQuantidade}
                  onChange={(e) => setFormQuantidade(e.target.value)}
                  placeholder="Quantidade recebida"
                  className="rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase">
                  Motivo / Observacao
                </Label>
                <Textarea
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  placeholder="NF, pedido de compra, etc."
                  className="rounded-xl"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEntradaDialog(null)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => entradaDialog && handleRegistrarEntrada(entradaDialog)}
              disabled={registrarMovimentacaoMut.isPending}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-1.5"
            >
              {registrarMovimentacaoMut.isPending ? (
                <RotateCcw size={16} className="animate-spin" />
              ) : (
                <ArrowDownToLine size={16} />
              )}
              Confirmar Entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Nova Movimentacao Dialog ────────────────────────────────────── */}
      <Dialog open={novaMovDialogOpen} onOpenChange={setNovaMovDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft size={20} className="text-blue-600" />
              Nova Movimentacao
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase">
                Material *
              </Label>
              <Select value={movMaterialId} onValueChange={setMovMaterialId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o material" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {materiais.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.codigo ? `${m.codigo} — ` : ""}
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase">
                  Tipo *
                </Label>
                <Select value={movTipo} onValueChange={setMovTipo}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_MOV.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase">
                  Quantidade *
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={movQuantidade}
                  onChange={(e) => setMovQuantidade(e.target.value)}
                  placeholder="0"
                  className="rounded-xl font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase">
                Motivo
              </Label>
              <Textarea
                value={movMotivo}
                onChange={(e) => setMovMotivo(e.target.value)}
                placeholder="Descrição da movimentação..."
                className="rounded-xl"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNovaMovDialogOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleNovaMovimentacao}
              disabled={registrarMovimentacaoMut.isPending}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 gap-1.5"
            >
              {registrarMovimentacaoMut.isPending ? (
                <RotateCcw size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

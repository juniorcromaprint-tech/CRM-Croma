// ============================================================================
// COMPRAS PAGE — Croma Print ERP/CRM
// Fornecedores, Pedidos de Compra e Recebimento de Materiais
// ============================================================================

import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { brl, formatDate, formatCNPJ } from "@/shared/utils/format";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

import {
  Truck,
  ShoppingCart,
  PackageCheck,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  User,
  Tag,
  Clock,
  FileText,
  Hash,
  Calendar,
  ChevronRight,
  Loader2,
  ArrowRight,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit as EditIcon,
  Package,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type PCStatus =
  | "rascunho"
  | "aprovado"
  | "enviado"
  | "parcial"
  | "recebido"
  | "cancelado";

interface Fornecedor {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  contato_nome: string | null;
  categorias: string[] | null;
  lead_time_dias: number | null;
  condicao_pagamento: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface MaterialOption {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: string | null;
  unidade: string | null;
  preco_medio: number | null;
}

interface PCItemRow {
  id: string;
  pedido_compra_id: string;
  material_id: string;
  quantidade: number;
  valor_unitario: number | null;
  valor_total: number | null;
  quantidade_recebida: number;
  created_at: string;
  materiais: {
    nome: string;
    codigo: string | null;
    unidade: string | null;
  } | null;
}

interface PedidoCompraRow {
  id: string;
  numero: string;
  fornecedor_id: string;
  status: PCStatus;
  valor_total: number;
  previsao_entrega: string | null;
  observacoes: string | null;
  criado_por: string | null;
  aprovado_por: string | null;
  created_at: string;
  updated_at: string;
  fornecedores: {
    nome_fantasia: string | null;
    razao_social: string;
  } | null;
  pedido_compra_itens: PCItemRow[];
}

interface NewPCItem {
  material_id: string;
  quantidade: number;
  valor_unitario: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PC_STATUS_CONFIG: Record<PCStatus, { label: string; className: string }> =
  {
    rascunho: {
      label: "Rascunho",
      className: "bg-slate-50 text-slate-700 border-slate-200",
    },
    aprovado: {
      label: "Aprovado",
      className: "bg-blue-50 text-blue-700 border-blue-200",
    },
    enviado: {
      label: "Enviado",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    },
    parcial: {
      label: "Parcial",
      className: "bg-purple-50 text-purple-700 border-purple-200",
    },
    recebido: {
      label: "Recebido",
      className: "bg-green-50 text-green-700 border-green-200",
    },
    cancelado: {
      label: "Cancelado",
      className: "bg-red-50 text-red-600 border-red-200",
    },
  };

const PC_STATUS_TRANSITIONS: Record<PCStatus, PCStatus[]> = {
  rascunho: ["aprovado", "cancelado"],
  aprovado: ["enviado", "cancelado"],
  enviado: ["recebido"],
  parcial: ["recebido"],
  recebido: [],
  cancelado: [],
};

const CATEGORIAS_FORNECEDOR = [
  { value: "vinil", label: "Vinil", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "lona", label: "Lona", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "acm", label: "ACM", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "tinta", label: "Tinta", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { value: "ferragem", label: "Ferragem", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "acrilico", label: "Acrilico", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { value: "mdf", label: "MDF", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "led", label: "LED", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "outros", label: "Outros", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

function getCategoriaColor(cat: string): string {
  return (
    CATEGORIAS_FORNECEDOR.find((c) => c.value === cat)?.color ??
    "bg-gray-100 text-gray-600 border-gray-200"
  );
}

function getFornecedorName(f: { nome_fantasia: string | null; razao_social: string }): string {
  return f.nome_fantasia || f.razao_social;
}

function generatePCNumero(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `PC-${year}-${seq}`;
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-100 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-32" />
          <div className="h-3 bg-slate-100 rounded w-48" />
          <div className="flex gap-2 mt-1">
            <div className="h-5 bg-slate-100 rounded w-20" />
            <div className="h-5 bg-slate-100 rounded w-16" />
          </div>
        </div>
        <div className="text-right space-y-2">
          <div className="h-5 bg-slate-100 rounded w-24 ml-auto" />
          <div className="h-3 bg-slate-100 rounded w-20 ml-auto" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 1: FORNECEDORES
// ============================================================================

function TabFornecedores() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formRazaoSocial, setFormRazaoSocial] = useState("");
  const [formNomeFantasia, setFormNomeFantasia] = useState("");
  const [formCnpj, setFormCnpj] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formContatoNome, setFormContatoNome] = useState("");
  const [formCategorias, setFormCategorias] = useState<string[]>([]);
  const [formLeadTime, setFormLeadTime] = useState("");
  const [formCondicaoPagamento, setFormCondicaoPagamento] = useState("");
  const [formObservacoes, setFormObservacoes] = useState("");
  const [formAtivo, setFormAtivo] = useState(true);

  // Query
  const {
    data: fornecedores = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("nome_fantasia", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as Fornecedor[];
    },
  });

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        razao_social: formRazaoSocial,
        nome_fantasia: formNomeFantasia || null,
        cnpj: formCnpj || null,
        telefone: formTelefone || null,
        email: formEmail || null,
        contato_nome: formContatoNome || null,
        categorias: formCategorias.length > 0 ? formCategorias : null,
        lead_time_dias: formLeadTime ? parseInt(formLeadTime, 10) : null,
        condicao_pagamento: formCondicaoPagamento || null,
        observacoes: formObservacoes || null,
        ativo: formAtivo,
      };

      if (editingId) {
        const { error } = await supabase
          .from("fornecedores")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      showSuccess(
        editingId
          ? "Fornecedor atualizado com sucesso!"
          : "Fornecedor cadastrado com sucesso!"
      );
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (err: Error) => {
      showError(`Erro ao salvar fornecedor: ${err.message}`);
    },
  });

  // Computed
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return fornecedores;
    return fornecedores.filter(
      (f) =>
        (f.nome_fantasia ?? "").toLowerCase().includes(term) ||
        f.razao_social.toLowerCase().includes(term) ||
        (f.cnpj ?? "").replace(/\D/g, "").includes(term.replace(/\D/g, ""))
    );
  }, [fornecedores, searchTerm]);

  const stats = useMemo(() => {
    const total = fornecedores.length;
    const ativos = fornecedores.filter((f) => f.ativo).length;
    const categoriasSet = new Set<string>();
    fornecedores.forEach((f) =>
      (f.categorias ?? []).forEach((c) => categoriasSet.add(c))
    );
    return { total, ativos, categorias: categoriasSet.size };
  }, [fornecedores]);

  function resetForm() {
    setEditingId(null);
    setFormRazaoSocial("");
    setFormNomeFantasia("");
    setFormCnpj("");
    setFormTelefone("");
    setFormEmail("");
    setFormContatoNome("");
    setFormCategorias([]);
    setFormLeadTime("");
    setFormCondicaoPagamento("");
    setFormObservacoes("");
    setFormAtivo(true);
  }

  function openCreate() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEdit(f: Fornecedor) {
    setEditingId(f.id);
    setFormRazaoSocial(f.razao_social);
    setFormNomeFantasia(f.nome_fantasia ?? "");
    setFormCnpj(f.cnpj ?? "");
    setFormTelefone(f.telefone ?? "");
    setFormEmail(f.email ?? "");
    setFormContatoNome(f.contato_nome ?? "");
    setFormCategorias(f.categorias ?? []);
    setFormLeadTime(f.lead_time_dias ? String(f.lead_time_dias) : "");
    setFormCondicaoPagamento(f.condicao_pagamento ?? "");
    setFormObservacoes(f.observacoes ?? "");
    setFormAtivo(f.ativo);
    setIsDialogOpen(true);
  }

  function toggleCategoria(cat: string) {
    setFormCategorias((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function handleSave() {
    if (!formRazaoSocial.trim()) {
      showError("Razao social e obrigatoria.");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Building2 size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.total}
              </p>
              <p className="text-xs text-slate-500">Total de fornecedores</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.ativos}
              </p>
              <p className="text-xs text-slate-500">Ativos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <Tag size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.categorias}
              </p>
              <p className="text-xs text-slate-500">Categorias atendidas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Button */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 bg-white h-11 shadow-sm"
          />
        </div>
        <Button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm"
        >
          <Plus size={18} className="mr-2" /> Novo Fornecedor
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-red-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Erro ao carregar fornecedores
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            Verifique a conexao com o banco de dados.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Nenhum fornecedor encontrado
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            {fornecedores.length === 0
              ? "Cadastre o primeiro fornecedor para comecar."
              : "Ajuste a busca."}
          </p>
          {fornecedores.length === 0 && (
            <Button
              onClick={openCreate}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              <Plus size={18} className="mr-2" /> Cadastrar fornecedor
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 px-1">
            Mostrando {filtered.length} fornecedor
            {filtered.length !== 1 ? "es" : ""}
          </p>
          <div className="grid gap-3">
            {filtered.map((f) => (
              <div
                key={f.id}
                onClick={() => openEdit(f)}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                      <Building2 size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-800 text-base group-hover:text-blue-700 transition-colors truncate">
                          {f.nome_fantasia || f.razao_social}
                        </h3>
                        {!f.ativo && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md border bg-red-50 text-red-600 border-red-200">
                            Inativo
                          </span>
                        )}
                      </div>
                      {f.nome_fantasia && f.razao_social !== f.nome_fantasia && (
                        <p className="text-sm text-slate-500 truncate">
                          {f.razao_social}
                        </p>
                      )}
                      {f.cnpj && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          CNPJ: {formatCNPJ(f.cnpj)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(f.categorias ?? []).map((cat) => (
                          <span
                            key={cat}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${getCategoriaColor(cat)}`}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        {f.lead_time_dias != null && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={12} />
                            {f.lead_time_dias} dias
                          </span>
                        )}
                        {f.contato_nome && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <User size={12} />
                            {f.contato_nome}
                          </span>
                        )}
                        {f.telefone && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone size={12} />
                            {f.telefone}
                          </span>
                        )}
                        {f.email && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail size={12} />
                            {f.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className="text-slate-300 group-hover:text-blue-600 transition-colors flex-shrink-0"
                    size={20}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Building2 size={22} className="text-blue-600" />
              {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Razao Social + Nome Fantasia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">
                  Razao Social *
                </Label>
                <Input
                  value={formRazaoSocial}
                  onChange={(e) => setFormRazaoSocial(e.target.value)}
                  placeholder="Razao social do fornecedor"
                  className="rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">
                  Nome Fantasia
                </Label>
                <Input
                  value={formNomeFantasia}
                  onChange={(e) => setFormNomeFantasia(e.target.value)}
                  placeholder="Nome fantasia"
                  className="rounded-xl border-slate-200"
                />
              </div>
            </div>

            {/* CNPJ + Telefone + Email */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">CNPJ</Label>
                <Input
                  value={formCnpj}
                  onChange={(e) => setFormCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Telefone</Label>
                <Input
                  value={formTelefone}
                  onChange={(e) => setFormTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">E-mail</Label>
                <Input
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="contato@fornecedor.com"
                  className="rounded-xl border-slate-200"
                  type="email"
                />
              </div>
            </div>

            {/* Contato + Lead Time + Condicao Pagamento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">
                  Nome do Contato
                </Label>
                <Input
                  value={formContatoNome}
                  onChange={(e) => setFormContatoNome(e.target.value)}
                  placeholder="Nome do contato"
                  className="rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">
                  Lead Time (dias)
                </Label>
                <Input
                  value={formLeadTime}
                  onChange={(e) => setFormLeadTime(e.target.value)}
                  placeholder="Ex: 7"
                  type="number"
                  min={0}
                  className="rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">
                  Condicao de Pagamento
                </Label>
                <Input
                  value={formCondicaoPagamento}
                  onChange={(e) => setFormCondicaoPagamento(e.target.value)}
                  placeholder="Ex: 30/60/90 dias"
                  className="rounded-xl border-slate-200"
                />
              </div>
            </div>

            {/* Categorias */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Categorias</Label>
              <div className="flex flex-wrap gap-3">
                {CATEGORIAS_FORNECEDOR.map((cat) => (
                  <label
                    key={cat.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={formCategorias.includes(cat.value)}
                      onCheckedChange={() => toggleCategoria(cat.value)}
                    />
                    <span className="text-sm text-slate-700">{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Ativo */}
            {editingId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formAtivo}
                  onCheckedChange={(checked) =>
                    setFormAtivo(checked === true)
                  }
                />
                <span className="text-sm text-slate-700 font-medium">
                  Fornecedor ativo
                </span>
              </label>
            )}

            {/* Observacoes */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Observacoes</Label>
              <Textarea
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                placeholder="Informacoes adicionais sobre o fornecedor..."
                className="rounded-xl border-slate-200 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !formRazaoSocial.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editingId ? (
                "Salvar Alteracoes"
              ) : (
                <>
                  <Plus size={16} className="mr-2" />
                  Cadastrar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// TAB 2: PEDIDOS DE COMPRA
// ============================================================================

function TabPedidosCompra() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPC, setSelectedPC] = useState<PedidoCompraRow | null>(null);

  // Create form state
  const [formFornecedorId, setFormFornecedorId] = useState("");
  const [formPrevisaoEntrega, setFormPrevisaoEntrega] = useState("");
  const [formObservacoes, setFormObservacoes] = useState("");
  const [formItens, setFormItens] = useState<NewPCItem[]>([]);

  // New item temp state
  const [tempMaterialId, setTempMaterialId] = useState("");
  const [tempQuantidade, setTempQuantidade] = useState("");
  const [tempValorUnitario, setTempValorUnitario] = useState("");

  // Queries
  const {
    data: pedidosCompra = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["pedidos-compra"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_compra")
        .select(
          "*, fornecedores(nome_fantasia, razao_social), pedido_compra_itens(*, materiais(nome, codigo, unidade))"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as PedidoCompraRow[];
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => {
      const { data, error } = await supabase
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
      const { data, error } = await supabase
        .from("materiais")
        .select("id, codigo, nome, categoria, unidade, preco_medio")
        .order("nome", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as MaterialOption[];
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const numero = generatePCNumero();
      const valorTotal = formItens.reduce(
        (sum, item) => sum + item.quantidade * item.valor_unitario,
        0
      );

      // Insert PC
      const { data: pcData, error: pcError } = await supabase
        .from("pedidos_compra")
        .insert({
          numero,
          fornecedor_id: formFornecedorId,
          status: "rascunho" as PCStatus,
          valor_total: valorTotal,
          previsao_entrega: formPrevisaoEntrega || null,
          observacoes: formObservacoes || null,
        })
        .select()
        .single();

      if (pcError) throw pcError;

      // Insert items
      if (formItens.length > 0) {
        const itensPayload = formItens.map((item) => ({
          pedido_compra_id: pcData.id,
          material_id: item.material_id,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.quantidade * item.valor_unitario,
        }));

        const { error: itensError } = await supabase
          .from("pedido_compra_itens")
          .insert(itensPayload);

        if (itensError) throw itensError;
      }

      return pcData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-compra"] });
      showSuccess("Pedido de compra criado com sucesso!");
      resetCreateForm();
      setIsCreateOpen(false);
    },
    onError: (err: Error) => {
      showError(`Erro ao criar pedido de compra: ${err.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      newStatus,
    }: {
      id: string;
      newStatus: PCStatus;
    }) => {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "aprovado") {
        updates.aprovado_por = null; // Would be current user in production
      }
      const { error } = await supabase
        .from("pedidos_compra")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-compra"] });
      const label = PC_STATUS_CONFIG[variables.newStatus]?.label ?? variables.newStatus;
      showSuccess(`Status atualizado para "${label}"`);
      setSelectedPC(null);
    },
    onError: (err: Error) => {
      showError(`Erro ao atualizar status: ${err.message}`);
    },
  });

  // Computed
  const filtered = useMemo(() => {
    let result = pedidosCompra;
    if (statusFilter !== "all") {
      result = result.filter((pc) => pc.status === statusFilter);
    }
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      result = result.filter(
        (pc) =>
          (pc.numero ?? "").toLowerCase().includes(term) ||
          getFornecedorName(
            pc.fornecedores ?? { nome_fantasia: null, razao_social: "" }
          )
            .toLowerCase()
            .includes(term)
      );
    }
    return result;
  }, [pedidosCompra, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    const abertos = pedidosCompra.filter(
      (pc) =>
        pc.status === "rascunho" ||
        pc.status === "aprovado" ||
        pc.status === "enviado"
    ).length;

    const valorCompras = pedidosCompra
      .filter((pc) => pc.status !== "cancelado")
      .reduce((sum, pc) => sum + (pc.valor_total ?? 0), 0);

    const aguardandoRecebimento = pedidosCompra.filter(
      (pc) => pc.status === "enviado" || pc.status === "parcial"
    ).length;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const recebidosMes = pedidosCompra.filter(
      (pc) =>
        pc.status === "recebido" && new Date(pc.updated_at) >= startOfMonth
    ).length;

    return { abertos, valorCompras, aguardandoRecebimento, recebidosMes };
  }, [pedidosCompra]);

  function resetCreateForm() {
    setFormFornecedorId("");
    setFormPrevisaoEntrega("");
    setFormObservacoes("");
    setFormItens([]);
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
      showError("Informe o valor unitario.");
      return;
    }

    setFormItens((prev) => [
      ...prev,
      {
        material_id: tempMaterialId,
        quantidade: qty,
        valor_unitario: unit,
      },
    ]);
    resetTempItem();
  }

  function handleRemoveItem(index: number) {
    setFormItens((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCreate() {
    if (!formFornecedorId) {
      showError("Selecione um fornecedor.");
      return;
    }
    if (formItens.length === 0) {
      showError("Adicione pelo menos um item.");
      return;
    }
    createMutation.mutate();
  }

  function getMaterialName(id: string): string {
    const m = materiais.find((mat) => mat.id === id);
    return m ? `${m.codigo ?? ""} - ${m.nome}` : id;
  }

  const formTotal = formItens.reduce(
    (sum, item) => sum + item.quantidade * item.valor_unitario,
    0
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <ShoppingCart size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.abertos}
              </p>
              <p className="text-xs text-slate-500">Pedidos abertos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : brl(stats.valorCompras)}
              </p>
              <p className="text-xs text-slate-500">Valor em compras</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.aguardandoRecebimento}
              </p>
              <p className="text-xs text-slate-500">Aguardando recebimento</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <PackageCheck size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.recebidosMes}
              </p>
              <p className="text-xs text-slate-500">Recebidos este mes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <Input
            placeholder="Buscar por numero ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 bg-white h-11 shadow-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-52 rounded-xl border-slate-200 bg-white h-11 shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(PC_STATUS_CONFIG) as PCStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {PC_STATUS_CONFIG[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => {
            resetCreateForm();
            setIsCreateOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm"
        >
          <Plus size={18} className="mr-2" /> Novo Pedido de Compra
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-red-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Erro ao carregar pedidos de compra
          </h3>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <ShoppingCart className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Nenhum pedido de compra encontrado
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            {pedidosCompra.length === 0
              ? "Crie o primeiro pedido de compra."
              : "Ajuste os filtros ou a busca."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 px-1">
            Mostrando {filtered.length} pedido{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-3">
            {filtered.map((pc) => {
              const statusCfg = PC_STATUS_CONFIG[pc.status];
              const fornecedorNome = getFornecedorName(
                pc.fornecedores ?? { nome_fantasia: null, razao_social: "---" }
              );

              return (
                <div
                  key={pc.id}
                  onClick={() => setSelectedPC(pc)}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                        <ShoppingCart size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-400 font-semibold">
                            {pc.numero}
                          </span>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${statusCfg.className}`}
                          >
                            {statusCfg.label}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-base mt-1 group-hover:text-blue-700 transition-colors truncate">
                          {fornecedorNome}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          {pc.previsao_entrega && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar size={12} />
                              Entrega: {formatDate(pc.previsao_entrega)}
                            </span>
                          )}
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Hash size={12} />
                            {pc.pedido_compra_itens?.length ?? 0} ite
                            {(pc.pedido_compra_itens?.length ?? 0) !== 1
                              ? "ns"
                              : "m"}
                          </span>
                          <span className="text-xs text-slate-400">
                            Criado em {formatDate(pc.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-slate-800 text-lg">
                          {brl(pc.valor_total ?? 0)}
                        </p>
                      </div>
                      <ChevronRight
                        className="text-slate-300 group-hover:text-blue-600 transition-colors"
                        size={20}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Create PC Dialog ──────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
                Fornecedor *
              </Label>
              <Select
                value={formFornecedorId}
                onValueChange={setFormFornecedorId}
              >
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

            {/* Previsao Entrega */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">
                Previsao de Entrega
              </Label>
              <Input
                type="date"
                value={formPrevisaoEntrega}
                onChange={(e) => setFormPrevisaoEntrega(e.target.value)}
                className="rounded-xl border-slate-200"
              />
            </div>

            {/* Items Section */}
            <div className="space-y-3">
              <Label className="text-slate-700 font-medium">Itens *</Label>

              {/* Add item row */}
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
                        // Auto-fill preco_medio
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
                      placeholder="Valor unitario"
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

              {/* Items list */}
              {formItens.length > 0 && (
                <div className="space-y-2">
                  {formItens.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {getMaterialName(item.material_id)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.quantidade} x{" "}
                          {brl(item.valor_unitario)} ={" "}
                          <span className="font-semibold text-slate-700">
                            {brl(item.quantidade * item.valor_unitario)}
                          </span>
                        </p>
                      </div>
                      <Button
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
                      Total: {brl(formTotal)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Observacoes */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Observacoes</Label>
              <Textarea
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                placeholder="Informacoes adicionais..."
                className="rounded-xl border-slate-200 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createMutation.isPending ||
                !formFornecedorId ||
                formItens.length === 0
              }
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              {createMutation.isPending ? (
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

      {/* ─── Detail PC Dialog ──────────────────────────────────────── */}
      <Dialog
        open={!!selectedPC}
        onOpenChange={(open) => {
          if (!open) setSelectedPC(null);
        }}
      >
        {selectedPC && (
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <ShoppingCart size={22} className="text-blue-600" />
                <span className="font-mono">{selectedPC.numero}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* Status badge */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-lg border ${PC_STATUS_CONFIG[selectedPC.status].className}`}
                >
                  {PC_STATUS_CONFIG[selectedPC.status].label}
                </span>
              </div>

              {/* Fornecedor */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                  Fornecedor
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {getFornecedorName(
                    selectedPC.fornecedores ?? {
                      nome_fantasia: null,
                      razao_social: "---",
                    }
                  )}
                </p>
              </div>

              {/* Value + Dates */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Valor Total
                  </p>
                  <p className="text-xl font-bold text-slate-800">
                    {brl(selectedPC.valor_total ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Previsao Entrega
                  </p>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Calendar size={14} className="text-slate-400" />
                    {selectedPC.previsao_entrega
                      ? formatDate(selectedPC.previsao_entrega)
                      : "---"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Criado em
                  </p>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Clock size={14} className="text-slate-400" />
                    {formatDate(selectedPC.created_at)}
                  </p>
                </div>
              </div>

              {/* Items table */}
              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                  Itens do pedido
                </p>
                {selectedPC.pedido_compra_itens &&
                selectedPC.pedido_compra_itens.length > 0 ? (
                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider">
                              Material
                            </th>
                            <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider">
                              Qtde
                            </th>
                            <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider">
                              Vlr Unit.
                            </th>
                            <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider">
                              Total
                            </th>
                            <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider">
                              Recebido
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedPC.pedido_compra_itens.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-700 font-medium">
                                {item.materiais?.nome ?? "---"}
                                {item.materiais?.codigo && (
                                  <span className="text-xs text-slate-400 ml-1">
                                    ({item.materiais.codigo})
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-700">
                                {item.quantidade}
                                {item.materiais?.unidade && (
                                  <span className="text-xs text-slate-400 ml-1">
                                    {item.materiais.unidade}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-700">
                                {brl(item.valor_unitario ?? 0)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-800">
                                {brl(item.valor_total ?? 0)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={`font-semibold ${
                                    item.quantidade_recebida >= item.quantidade
                                      ? "text-green-600"
                                      : item.quantidade_recebida > 0
                                        ? "text-amber-600"
                                        : "text-slate-400"
                                  }`}
                                >
                                  {item.quantidade_recebida}
                                </span>
                                <span className="text-slate-400">
                                  {" "}
                                  / {item.quantidade}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-6 border border-dashed border-slate-200 text-center">
                    <Package
                      size={32}
                      className="mx-auto text-slate-300 mb-2"
                    />
                    <p className="text-sm text-slate-500">
                      Nenhum item neste pedido de compra.
                    </p>
                  </div>
                )}
              </div>

              {/* Observacoes */}
              {selectedPC.observacoes && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                    Observacoes
                  </p>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {selectedPC.observacoes}
                    </p>
                  </div>
                </div>
              )}

              {/* Status workflow buttons */}
              {PC_STATUS_TRANSITIONS[selectedPC.status]?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                    Avancar status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PC_STATUS_TRANSITIONS[selectedPC.status].map(
                      (nextStatus) => {
                        const nextCfg = PC_STATUS_CONFIG[nextStatus];
                        const isCancelado = nextStatus === "cancelado";
                        return (
                          <Button
                            key={nextStatus}
                            variant={isCancelado ? "outline" : "default"}
                            size="sm"
                            disabled={updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: selectedPC.id,
                                newStatus: nextStatus,
                              })
                            }
                            className={
                              isCancelado
                                ? "rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                                : "rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                            }
                          >
                            {updateStatusMutation.isPending ? (
                              <Loader2
                                size={14}
                                className="mr-1 animate-spin"
                              />
                            ) : isCancelado ? (
                              <XCircle size={14} className="mr-1" />
                            ) : (
                              <ArrowRight size={14} className="mr-1" />
                            )}
                            {nextCfg.label}
                          </Button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedPC(null)}
                className="rounded-xl"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

// ============================================================================
// TAB 3: RECEBIMENTO
// ============================================================================

function TabRecebimento() {
  const queryClient = useQueryClient();

  // Track quantities being received per item
  const [recebimentos, setRecebimentos] = useState<
    Record<string, number>
  >({});

  // Query: only PCs with status 'enviado' or 'parcial'
  const {
    data: pcsParaReceber = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["pcs-para-receber"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_compra")
        .select(
          "*, fornecedores(nome_fantasia, razao_social), pedido_compra_itens(*, materiais(nome, codigo, unidade))"
        )
        .in("status", ["enviado", "parcial"])
        .order("previsao_entrega", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as PedidoCompraRow[];
    },
  });

  // Mutation: receive items
  const receberMutation = useMutation({
    mutationFn: async (pcId: string) => {
      const pc = pcsParaReceber.find((p) => p.id === pcId);
      if (!pc) throw new Error("Pedido de compra nao encontrado.");

      const itensToUpdate = pc.pedido_compra_itens.filter((item) => {
        const newQty = recebimentos[item.id];
        return newQty && newQty > 0;
      });

      if (itensToUpdate.length === 0) {
        throw new Error("Informe a quantidade recebida em pelo menos um item.");
      }

      // Update each item
      for (const item of itensToUpdate) {
        const newQty = recebimentos[item.id] ?? 0;
        const novaQuantidadeRecebida = (item.quantidade_recebida ?? 0) + newQty;

        const { error: itemError } = await supabase
          .from("pedido_compra_itens")
          .update({ quantidade_recebida: novaQuantidadeRecebida })
          .eq("id", item.id);

        if (itemError) throw itemError;

        // Insert estoque_movimentacoes (entrada)
        try {
          await supabase.from("estoque_movimentacoes").insert({
            material_id: item.material_id,
            tipo: "entrada",
            quantidade: newQty,
            referencia_tipo: "pedido_compra",
            referencia_id: pcId,
            observacoes: `Recebimento PC ${pc.numero} - ${item.materiais?.nome ?? "Material"}`,
          });
        } catch {
          // estoque_movimentacoes may not exist yet, silently skip
        }

        // Try to update estoque_saldos
        try {
          const { data: saldo } = await supabase
            .from("estoque_saldos")
            .select("id, quantidade")
            .eq("material_id", item.material_id)
            .maybeSingle();

          if (saldo) {
            await supabase
              .from("estoque_saldos")
              .update({ quantidade: (saldo.quantidade ?? 0) + newQty })
              .eq("id", saldo.id);
          } else {
            await supabase.from("estoque_saldos").insert({
              material_id: item.material_id,
              quantidade: newQty,
            });
          }
        } catch {
          // estoque_saldos may not exist yet, silently skip
        }
      }

      // Check if all items fully received
      const allItems = pc.pedido_compra_itens;
      const allFullyReceived = allItems.every((item) => {
        const newQty = recebimentos[item.id] ?? 0;
        const totalRecebido = (item.quantidade_recebida ?? 0) + newQty;
        return totalRecebido >= item.quantidade;
      });

      const newStatus: PCStatus = allFullyReceived ? "recebido" : "parcial";
      const { error: statusError } = await supabase
        .from("pedidos_compra")
        .update({ status: newStatus })
        .eq("id", pcId);

      if (statusError) throw statusError;

      return { pcId, newStatus };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pcs-para-receber"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-compra"] });
      const statusLabel = PC_STATUS_CONFIG[result.newStatus].label;
      showSuccess(`Recebimento confirmado! Status: ${statusLabel}`);
      setRecebimentos({});
    },
    onError: (err: Error) => {
      showError(`Erro no recebimento: ${err.message}`);
    },
  });

  function setRecebimentoQty(itemId: string, value: number) {
    setRecebimentos((prev) => ({ ...prev, [itemId]: value }));
  }

  function handleConfirmarRecebimento(pcId: string) {
    receberMutation.mutate(pcId);
  }

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Recebimento de Materiais
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Informe as quantidades recebidas para cada item. Ao confirmar, o
              estoque sera atualizado automaticamente. Se todos os itens forem
              totalmente recebidos, o pedido sera marcado como "Recebido".
            </p>
          </div>
        </div>
      </div>

      {/* List of PCs to receive */}
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-red-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Erro ao carregar pedidos
          </h3>
        </div>
      ) : pcsParaReceber.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <PackageCheck className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Nenhum pedido aguardando recebimento
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            Pedidos com status "Enviado" ou "Parcial" aparecerao aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pcsParaReceber.map((pc) => {
            const fornecedorNome = getFornecedorName(
              pc.fornecedores ?? { nome_fantasia: null, razao_social: "---" }
            );
            const statusCfg = PC_STATUS_CONFIG[pc.status];
            const hasRecebimentoValues = pc.pedido_compra_itens.some(
              (item) => (recebimentos[item.id] ?? 0) > 0
            );

            return (
              <div
                key={pc.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
              >
                {/* PC Header */}
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                        <ShoppingCart size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-700">
                            {pc.numero}
                          </span>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${statusCfg.className}`}
                          >
                            {statusCfg.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {fornecedorNome}
                          {pc.previsao_entrega && (
                            <>
                              {" "}
                              &middot; Entrega:{" "}
                              {formatDate(pc.previsao_entrega)}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold text-slate-800">
                      {brl(pc.valor_total ?? 0)}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider">
                          Material
                        </th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider">
                          Pedido
                        </th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider">
                          Ja Recebido
                        </th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider">
                          Pendente
                        </th>
                        <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wider">
                          Receber Agora
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pc.pedido_compra_itens.map((item) => {
                        const pendente =
                          item.quantidade - (item.quantidade_recebida ?? 0);
                        const fullyReceived = pendente <= 0;

                        return (
                          <tr
                            key={item.id}
                            className={
                              fullyReceived
                                ? "bg-green-50/50"
                                : "hover:bg-slate-50"
                            }
                          >
                            <td className="px-4 py-3 text-slate-700 font-medium">
                              {item.materiais?.nome ?? "---"}
                              {item.materiais?.codigo && (
                                <span className="text-xs text-slate-400 ml-1">
                                  ({item.materiais.codigo})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700">
                              {item.quantidade}
                              {item.materiais?.unidade && (
                                <span className="text-xs text-slate-400 ml-1">
                                  {item.materiais.unidade}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`font-semibold ${
                                  fullyReceived
                                    ? "text-green-600"
                                    : item.quantidade_recebida > 0
                                      ? "text-amber-600"
                                      : "text-slate-400"
                                }`}
                              >
                                {item.quantidade_recebida ?? 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {fullyReceived ? (
                                <span className="text-green-600 flex items-center justify-end gap-1">
                                  <CheckCircle2 size={14} /> Completo
                                </span>
                              ) : (
                                <span className="text-amber-600 font-semibold">
                                  {pendente.toFixed(
                                    pendente % 1 !== 0 ? 3 : 0
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {fullyReceived ? (
                                <span className="text-xs text-green-600 font-semibold">
                                  ---
                                </span>
                              ) : (
                                <Input
                                  type="number"
                                  min={0}
                                  max={pendente}
                                  step="0.001"
                                  placeholder="0"
                                  value={recebimentos[item.id] ?? ""}
                                  onChange={(e) =>
                                    setRecebimentoQty(
                                      item.id,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-24 mx-auto rounded-xl border-slate-200 text-center h-9 text-sm"
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Confirm button */}
                <div className="p-4 border-t border-slate-100 flex justify-end">
                  <Button
                    onClick={() => handleConfirmarRecebimento(pc.id)}
                    disabled={
                      receberMutation.isPending || !hasRecebimentoValues
                    }
                    className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                  >
                    {receberMutation.isPending ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <PackageCheck size={16} className="mr-2" />
                        Confirmar Recebimento
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ComprasPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
          Compras
        </h1>
        <p className="text-slate-500 mt-1">
          Fornecedores, pedidos de compra e recebimento de materiais
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="fornecedores" className="space-y-6">
        <TabsList className="bg-white shadow-sm rounded-2xl p-1.5 border border-slate-100 h-auto flex gap-1 w-full md:w-auto">
          {[
            { value: "fornecedores", label: "Fornecedores", icon: Truck },
            { value: "pedidos", label: "Pedidos de Compra", icon: ShoppingCart },
            { value: "recebimento", label: "Recebimento", icon: PackageCheck },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-1 md:flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 transition-all"
            >
              <Icon size={16} className="hidden sm:block" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="fornecedores">
          <TabFornecedores />
        </TabsContent>

        <TabsContent value="pedidos">
          <TabPedidosCompra />
        </TabsContent>

        <TabsContent value="recebimento">
          <TabRecebimento />
        </TabsContent>
      </Tabs>
    </div>
  );
}

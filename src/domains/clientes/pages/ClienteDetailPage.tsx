import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { brl, formatCNPJ, formatPhone, formatDate } from "@/shared/utils/format";
import { formatDateTime } from "@/shared/utils/format";

import { useCliente, useUpdateCliente } from "@/domains/clientes/hooks/useClientes";
import { useUnidades, useCreateUnidade } from "@/domains/clientes/hooks/useUnidades";
import { useContatos, useCreateContato } from "@/domains/clientes/hooks/useContatos";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Plus,
  User,
  FileText,
  DollarSign,
  Clock,
  PhoneCall,
  CalendarDays,
  Video,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLASSIFICACAO_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  bronze: {
    label: "Bronze",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    icon: "\u{1F949}",
  },
  prata: {
    label: "Prata",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: "\u{1F948}",
  },
  ouro: {
    label: "Ouro",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    icon: "\u{1F947}",
  },
  diamante: {
    label: "Diamante",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: "\u{1F48E}",
  },
};

const SEGMENTO_LABELS: Record<string, string> = {
  calcados: "Calcados",
  varejo: "Varejo",
  franquia: "Franquia",
  supermercado: "Supermercado",
  farmacia: "Farmacia",
  academia: "Academia",
  restaurante: "Restaurante",
  concessionaria: "Concessionaria",
  clinica: "Clinica",
  shopping: "Shopping",
  construtora: "Construtora",
  escritorio: "Escritorio",
  outro: "Outro",
};

const PROPOSTA_STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  rascunho: { label: "Rascunho", color: "bg-slate-100 text-slate-600" },
  enviada: { label: "Enviada", color: "bg-blue-100 text-blue-700" },
  em_negociacao: {
    label: "Em Negociacao",
    color: "bg-yellow-100 text-yellow-700",
  },
  aprovada: { label: "Aprovada", color: "bg-green-100 text-green-700" },
  reprovada: { label: "Reprovada", color: "bg-red-100 text-red-700" },
  cancelada: { label: "Cancelada", color: "bg-slate-100 text-slate-500" },
};

const FINANCEIRO_STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  a_vencer: { label: "A Vencer", color: "bg-blue-100 text-blue-700" },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-700" },
  pago: { label: "Pago", color: "bg-green-100 text-green-700" },
  parcial: { label: "Parcial", color: "bg-yellow-100 text-yellow-700" },
};

const ATIVIDADE_ICON: Record<string, typeof Phone> = {
  ligacao: PhoneCall,
  email: Mail,
  reuniao: Video,
  visita: MapPin,
  mensagem: MessageSquare,
  tarefa: CheckCircle,
};

// ---------------------------------------------------------------------------
// Types for inline queries
// ---------------------------------------------------------------------------

interface Proposta {
  id: string;
  numero: string | null;
  titulo: string | null;
  valor_total: number | null;
  status: string;
  created_at: string;
}

interface Lead {
  id: string;
  nome: string | null;
  empresa: string | null;
  status: string;
  origem: string | null;
  created_at: string;
}

interface ContaReceber {
  id: string;
  descricao: string | null;
  valor: number;
  valor_pago: number | null;
  data_vencimento: string;
  status: string;
  numero_documento: string | null;
}

interface AtividadeComercial {
  id: string;
  tipo: string;
  titulo: string | null;
  descricao: string | null;
  data_atividade: string;
  responsavel_id: string | null;
}

// ---------------------------------------------------------------------------
// Skeleton Component
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-8 w-32 bg-slate-200 rounded" />
        <div className="h-6 w-20 bg-slate-200 rounded-full" />
      </div>
      <div className="h-12 bg-slate-200 rounded-xl w-2/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-10 bg-slate-100 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();

  // ---- Data hooks ----
  const {
    data: cliente,
    isLoading: loadingCliente,
    error: errorCliente,
  } = useCliente(id);
  const { data: unidades, isLoading: loadingUnidades } = useUnidades(id);
  const { data: contatos, isLoading: loadingContatos } = useContatos(id);
  const updateCliente = useUpdateCliente();
  const createUnidade = useCreateUnidade();
  const createContato = useCreateContato();

  // ---- Inline queries for tabs without dedicated hooks ----
  const { data: propostas, isLoading: loadingPropostas } = useQuery<
    Proposta[]
  >({
    queryKey: ["propostas", "cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propostas")
        .select("*")
        .eq("cliente_id", id!)
        .is("excluido_em", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Proposta[];
    },
    enabled: !!id,
  });

  const { data: leads, isLoading: loadingLeads } = useQuery<Lead[]>({
    queryKey: ["leads", "cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("cliente_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
    enabled: !!id,
  });

  const { data: contasReceber, isLoading: loadingFinanceiro } = useQuery<
    ContaReceber[]
  >({
    queryKey: ["contas_receber", "cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_receber")
        .select("*")
        .eq("cliente_id", id!)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContaReceber[];
    },
    enabled: !!id,
  });

  const { data: atividades, isLoading: loadingAtividades } = useQuery<
    AtividadeComercial[]
  >({
    queryKey: ["atividades_comerciais", "cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atividades_comerciais")
        .select("*")
        .eq("entidade_tipo", "cliente")
        .eq("entidade_id", id!)
        .order("data_atividade", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AtividadeComercial[];
    },
    enabled: !!id,
  });

  // ---- Local state ----
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | null>>({});

  const [showNewUnidade, setShowNewUnidade] = useState(false);
  const [unidadeForm, setUnidadeForm] = useState({
    nome: "",
    endereco_rua: "",
    endereco_cidade: "",
    endereco_estado: "",
    endereco_cep: "",
    telefone: "",
    responsavel: "",
  });

  const [showNewContato, setShowNewContato] = useState(false);
  const [contatoForm, setContatoForm] = useState({
    nome: "",
    cargo: "",
    telefone: "",
    email: "",
    celular: "",
    decisor: false,
  });

  // ---- Handlers ----
  function startEditing() {
    if (!cliente) return;
    setEditForm({
      razao_social: cliente.razao_social ?? "",
      nome_fantasia: cliente.nome_fantasia ?? "",
      cnpj: cliente.cnpj ?? "",
      segmento: cliente.segmento ?? "",
      classificacao: cliente.classificacao ?? "bronze",
      email: cliente.email ?? "",
      telefone: cliente.telefone ?? "",
      website: cliente.website ?? "",
      endereco_rua: cliente.endereco_rua ?? "",
      endereco_numero: cliente.endereco_numero ?? "",
      endereco_bairro: cliente.endereco_bairro ?? "",
      endereco_cidade: cliente.endereco_cidade ?? "",
      endereco_estado: cliente.endereco_estado ?? "",
      endereco_cep: cliente.endereco_cep ?? "",
      observacoes: cliente.observacoes ?? "",
    });
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditForm({});
  }

  function handleSave() {
    if (!id) return;
    updateCliente.mutate(
      { id, ...editForm },
      { onSuccess: () => setEditing(false) }
    );
  }

  function handleCreateUnidade() {
    if (!id || !unidadeForm.nome) return;
    createUnidade.mutate(
      { cliente_id: id, ...unidadeForm },
      {
        onSuccess: () => {
          setShowNewUnidade(false);
          setUnidadeForm({
            nome: "",
            endereco_rua: "",
            endereco_cidade: "",
            endereco_estado: "",
            endereco_cep: "",
            telefone: "",
            responsavel: "",
          });
        },
      }
    );
  }

  function handleCreateContato() {
    if (!id || !contatoForm.nome) return;
    createContato.mutate(
      { cliente_id: id, ...contatoForm },
      {
        onSuccess: () => {
          setShowNewContato(false);
          setContatoForm({
            nome: "",
            cargo: "",
            telefone: "",
            email: "",
            celular: "",
            decisor: false,
          });
        },
      }
    );
  }

  // ---- Financeiro summaries ----
  const finSummary = {
    total: contasReceber?.reduce((s, c) => s + (c.valor ?? 0), 0) ?? 0,
    vencido:
      contasReceber
        ?.filter((c) => c.status === "vencido")
        .reduce((s, c) => s + (c.valor ?? 0), 0) ?? 0,
    pago:
      contasReceber
        ?.filter((c) => c.status === "pago")
        .reduce((s, c) => s + (c.valor_pago ?? 0), 0) ?? 0,
  };

  // ---- Loading / Error states ----
  if (loadingCliente) {
    return (
      <div className="space-y-6">
        <DetailSkeleton />
      </div>
    );
  }

  if (errorCliente || !cliente) {
    return (
      <div className="space-y-6">
        <Link
          to="/clientes"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} /> Clientes
        </Link>
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
          <h3 className="font-semibold text-slate-700">
            Cliente nao encontrado
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            O cliente solicitado nao existe ou foi removido.
          </p>
        </div>
      </div>
    );
  }

  const displayName = cliente.nome_fantasia || cliente.razao_social;
  const classConfig = CLASSIFICACAO_CONFIG[cliente.classificacao ?? ""] ?? null;
  const segLabel = SEGMENTO_LABELS[cliente.segmento ?? ""] ?? cliente.segmento;

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* HEADER                                                            */}
      {/* ================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            to="/clientes"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={16} /> Clientes
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">
              {displayName}
            </h1>
            {classConfig && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${classConfig.color}`}
              >
                {classConfig.icon} {classConfig.label}
              </span>
            )}
            {segLabel && (
              <Badge variant="outline" className="text-xs font-normal">
                {segLabel}
              </Badge>
            )}
          </div>

          {cliente.cnpj && (
            <p className="text-sm text-slate-400 font-mono">
              {formatCNPJ(cliente.cnpj)}
            </p>
          )}
        </div>

        <Button
          onClick={startEditing}
          variant="outline"
          size="sm"
          className="shrink-0"
        >
          <Edit size={14} className="mr-1.5" /> Editar
        </Button>
      </div>

      {/* ================================================================= */}
      {/* TABS                                                              */}
      {/* ================================================================= */}
      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-slate-50 border border-slate-200 rounded-xl p-1 h-auto">
          <TabsTrigger value="dados" className="text-xs sm:text-sm">
            <Building2 size={14} className="mr-1.5" /> Dados
          </TabsTrigger>
          <TabsTrigger value="unidades" className="text-xs sm:text-sm">
            <MapPin size={14} className="mr-1.5" /> Unidades
          </TabsTrigger>
          <TabsTrigger value="contatos" className="text-xs sm:text-sm">
            <User size={14} className="mr-1.5" /> Contatos
          </TabsTrigger>
          <TabsTrigger value="comercial" className="text-xs sm:text-sm">
            <FileText size={14} className="mr-1.5" /> Comercial
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="text-xs sm:text-sm">
            <DollarSign size={14} className="mr-1.5" /> Financeiro
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs sm:text-sm">
            <Clock size={14} className="mr-1.5" /> Historico
          </TabsTrigger>
        </TabsList>

        {/* ============================================================= */}
        {/* TAB 1: DADOS CADASTRAIS                                       */}
        {/* ============================================================= */}
        <TabsContent value="dados" className="mt-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            {editing ? (
              /* ---- EDIT MODE ---- */
              <div className="space-y-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-slate-700">
                    Editar Dados Cadastrais
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelEditing}
                    >
                      <X size={14} className="mr-1" /> Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={updateCliente.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {updateCliente.isPending ? (
                        <Loader2 size={14} className="mr-1 animate-spin" />
                      ) : (
                        <Save size={14} className="mr-1" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Razao Social *</Label>
                    <Input
                      value={editForm.razao_social ?? ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          razao_social: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Nome Fantasia</Label>
                    <Input
                      value={editForm.nome_fantasia ?? ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          nome_fantasia: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>CNPJ</Label>
                    <Input
                      value={editForm.cnpj ?? ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, cnpj: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Segmento</Label>
                    <Select
                      value={editForm.segmento ?? ""}
                      onValueChange={(v) =>
                        setEditForm({ ...editForm, segmento: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SEGMENTO_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Classificacao</Label>
                    <Select
                      value={editForm.classificacao ?? "bronze"}
                      onValueChange={(v) =>
                        setEditForm({ ...editForm, classificacao: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CLASSIFICACAO_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v.icon} {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editForm.email ?? ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={editForm.telefone ?? ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, telefone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Website</Label>
                    <Input
                      value={editForm.website ?? ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, website: e.target.value })
                      }
                    />
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-slate-500 pt-2">
                  Endereco
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label>Rua</Label>
                    <Input
                      value={editForm.endereco_rua ?? ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          endereco_rua: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Numero</Label>
                    <Input
                      value={editForm.endereco_numero ?? ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          endereco_numero: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input
                      value={editForm.endereco_bairro ?? ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          endereco_bairro: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input
                      value={editForm.endereco_cidade ?? ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          endereco_cidade: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>UF</Label>
                      <Input
                        maxLength={2}
                        value={editForm.endereco_estado ?? ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            endereco_estado: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>CEP</Label>
                      <Input
                        value={editForm.endereco_cep ?? ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            endereco_cep: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Observacoes</Label>
                  <Textarea
                    rows={3}
                    value={editForm.observacoes ?? ""}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        observacoes: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            ) : (
              /* ---- VIEW MODE ---- */
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-700">
                  Dados Cadastrais
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                  <InfoField label="Razao Social" value={cliente.razao_social} />
                  <InfoField
                    label="Nome Fantasia"
                    value={cliente.nome_fantasia}
                  />
                  <InfoField
                    label="CNPJ"
                    value={
                      cliente.cnpj ? formatCNPJ(cliente.cnpj) : undefined
                    }
                  />
                  <InfoField
                    label="Inscricao Estadual"
                    value={cliente.inscricao_estadual}
                  />
                  <InfoField
                    label="Segmento"
                    value={
                      SEGMENTO_LABELS[cliente.segmento ?? ""] ??
                      cliente.segmento
                    }
                  />
                  <InfoField
                    label="Classificacao"
                    value={
                      classConfig
                        ? `${classConfig.icon} ${classConfig.label}`
                        : undefined
                    }
                  />
                  <InfoField
                    label="Email"
                    value={cliente.email}
                    icon={<Mail size={14} className="text-slate-400" />}
                  />
                  <InfoField
                    label="Telefone"
                    value={
                      cliente.telefone
                        ? formatPhone(cliente.telefone)
                        : undefined
                    }
                    icon={<Phone size={14} className="text-slate-400" />}
                  />
                  <InfoField
                    label="Website"
                    value={cliente.website}
                    icon={<Globe size={14} className="text-slate-400" />}
                  />
                  <InfoField
                    label="Status"
                    value={cliente.ativo ? "Ativo" : "Inativo"}
                  />
                </div>

                {/* Address block */}
                {(cliente.endereco_rua ||
                  cliente.endereco_cidade ||
                  cliente.endereco_estado) && (
                  <div className="border-t border-slate-100 pt-4">
                    <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
                      <MapPin size={14} /> Endereco
                    </h3>
                    <p className="text-sm text-slate-700">
                      {[
                        cliente.endereco_rua,
                        cliente.endereco_numero
                          ? `n ${cliente.endereco_numero}`
                          : null,
                        cliente.endereco_complemento,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="text-sm text-slate-500">
                      {[
                        cliente.endereco_bairro,
                        cliente.endereco_cidade,
                        cliente.endereco_estado,
                        cliente.endereco_cep,
                      ]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                  </div>
                )}

                {/* Observacoes */}
                {cliente.observacoes && (
                  <div className="border-t border-slate-100 pt-4">
                    <h3 className="text-sm font-semibold text-slate-500 mb-2">
                      Observacoes
                    </h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">
                      {cliente.observacoes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ============================================================= */}
        {/* TAB 2: UNIDADES                                               */}
        {/* ============================================================= */}
        <TabsContent value="unidades" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-700">
              Unidades ({unidades?.length ?? 0})
            </h2>
            <Button
              size="sm"
              onClick={() => setShowNewUnidade(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus size={14} className="mr-1.5" /> Nova Unidade
            </Button>
          </div>

          {loadingUnidades ? (
            <LoadingCards count={2} />
          ) : unidades && unidades.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unidades.map((u: any) => (
                <div
                  key={u.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-800">
                      {u.nome}
                    </h3>
                    <Badge
                      variant={u.ativo !== false ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {u.ativo !== false ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-sm text-slate-500">
                    {(u.endereco_cidade || u.endereco_estado) && (
                      <p className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-slate-400" />
                        {[u.endereco_cidade, u.endereco_estado]
                          .filter(Boolean)
                          .join(" / ")}
                      </p>
                    )}
                    {u.endereco_rua && (
                      <p className="text-xs text-slate-400 pl-5">
                        {u.endereco_rua}
                        {u.endereco_numero ? `, ${u.endereco_numero}` : ""}
                      </p>
                    )}
                    {u.telefone && (
                      <p className="flex items-center gap-1.5">
                        <Phone size={13} className="text-slate-400" />
                        {formatPhone(u.telefone)}
                      </p>
                    )}
                    {u.responsavel && (
                      <p className="flex items-center gap-1.5">
                        <User size={13} className="text-slate-400" />
                        {u.responsavel}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<MapPin size={36} className="text-slate-300" />}
              title="Nenhuma unidade cadastrada"
              description="Clique em Nova Unidade para adicionar"
            />
          )}

          {/* New Unidade Dialog */}
          <Dialog open={showNewUnidade} onOpenChange={setShowNewUnidade}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Unidade</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={unidadeForm.nome}
                    onChange={(e) =>
                      setUnidadeForm({
                        ...unidadeForm,
                        nome: e.target.value,
                      })
                    }
                    placeholder="Ex: Filial Porto Alegre"
                  />
                </div>
                <div>
                  <Label>Endereco</Label>
                  <Input
                    value={unidadeForm.endereco_rua}
                    onChange={(e) =>
                      setUnidadeForm({
                        ...unidadeForm,
                        endereco_rua: e.target.value,
                      })
                    }
                    placeholder="Rua, numero"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Cidade</Label>
                    <Input
                      value={unidadeForm.endereco_cidade}
                      onChange={(e) =>
                        setUnidadeForm({
                          ...unidadeForm,
                          endereco_cidade: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Input
                      maxLength={2}
                      value={unidadeForm.endereco_estado}
                      onChange={(e) =>
                        setUnidadeForm({
                          ...unidadeForm,
                          endereco_estado: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>CEP</Label>
                    <Input
                      value={unidadeForm.endereco_cep}
                      onChange={(e) =>
                        setUnidadeForm({
                          ...unidadeForm,
                          endereco_cep: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={unidadeForm.telefone}
                      onChange={(e) =>
                        setUnidadeForm({
                          ...unidadeForm,
                          telefone: e.target.value,
                        })
                      }
                      placeholder="(51) 3333-3333"
                    />
                  </div>
                  <div>
                    <Label>Responsavel Local</Label>
                    <Input
                      value={unidadeForm.responsavel}
                      onChange={(e) =>
                        setUnidadeForm({
                          ...unidadeForm,
                          responsavel: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowNewUnidade(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateUnidade}
                  disabled={!unidadeForm.nome || createUnidade.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createUnidade.isPending ? "Salvando..." : "Criar Unidade"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================= */}
        {/* TAB 3: CONTATOS                                               */}
        {/* ============================================================= */}
        <TabsContent value="contatos" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-700">
              Contatos ({contatos?.length ?? 0})
            </h2>
            <Button
              size="sm"
              onClick={() => setShowNewContato(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus size={14} className="mr-1.5" /> Novo Contato
            </Button>
          </div>

          {loadingContatos ? (
            <LoadingCards count={2} />
          ) : contatos && contatos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contatos.map((c: any) => (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        {c.nome}
                      </h3>
                      {c.cargo && (
                        <p className="text-xs text-slate-400">{c.cargo}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {c.decisor && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                          Decisor
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-slate-500">
                    {c.telefone && (
                      <p className="flex items-center gap-1.5">
                        <Phone size={13} className="text-slate-400" />
                        {formatPhone(c.telefone)}
                      </p>
                    )}
                    {c.celular && (
                      <p className="flex items-center gap-1.5">
                        <MessageSquare
                          size={13}
                          className="text-green-500"
                        />
                        {formatPhone(c.celular)}
                      </p>
                    )}
                    {c.email && (
                      <p className="flex items-center gap-1.5">
                        <Mail size={13} className="text-slate-400" />
                        {c.email}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<User size={36} className="text-slate-300" />}
              title="Nenhum contato cadastrado"
              description="Clique em Novo Contato para adicionar"
            />
          )}

          {/* New Contato Dialog */}
          <Dialog open={showNewContato} onOpenChange={setShowNewContato}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Contato</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={contatoForm.nome}
                    onChange={(e) =>
                      setContatoForm({
                        ...contatoForm,
                        nome: e.target.value,
                      })
                    }
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label>Cargo</Label>
                  <Input
                    value={contatoForm.cargo}
                    onChange={(e) =>
                      setContatoForm({
                        ...contatoForm,
                        cargo: e.target.value,
                      })
                    }
                    placeholder="Ex: Gerente de Marketing"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={contatoForm.telefone}
                      onChange={(e) =>
                        setContatoForm({
                          ...contatoForm,
                          telefone: e.target.value,
                        })
                      }
                      placeholder="(51) 3333-3333"
                    />
                  </div>
                  <div>
                    <Label>Celular / WhatsApp</Label>
                    <Input
                      value={contatoForm.celular}
                      onChange={(e) =>
                        setContatoForm({
                          ...contatoForm,
                          celular: e.target.value,
                        })
                      }
                      placeholder="(51) 99999-9999"
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={contatoForm.email}
                    onChange={(e) =>
                      setContatoForm({
                        ...contatoForm,
                        email: e.target.value,
                      })
                    }
                    placeholder="contato@empresa.com"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="decisor"
                    checked={contatoForm.decisor}
                    onCheckedChange={(v) =>
                      setContatoForm({
                        ...contatoForm,
                        decisor: v === true,
                      })
                    }
                  />
                  <Label htmlFor="decisor" className="text-sm cursor-pointer">
                    Este contato e um decisor
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowNewContato(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateContato}
                  disabled={!contatoForm.nome || createContato.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createContato.isPending ? "Salvando..." : "Criar Contato"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============================================================= */}
        {/* TAB 4: COMERCIAL                                              */}
        {/* ============================================================= */}
        <TabsContent value="comercial" className="mt-4 space-y-6">
          {/* Propostas */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-700">
              Propostas ({propostas?.length ?? 0})
            </h2>

            {loadingPropostas ? (
              <LoadingCards count={2} />
            ) : propostas && propostas.length > 0 ? (
              <div className="space-y-3">
                {propostas.map((p) => {
                  const sConf =
                    PROPOSTA_STATUS_CONFIG[p.status] ??
                    PROPOSTA_STATUS_CONFIG.rascunho;
                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {p.numero && (
                              <span className="text-xs font-mono text-slate-400">
                                #{p.numero}
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sConf.color}`}
                            >
                              {sConf.label}
                            </span>
                          </div>
                          <h3 className="font-medium text-slate-700">
                            {p.titulo ?? "Proposta sem titulo"}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                            Criada em {formatDate(p.created_at)}
                          </p>
                        </div>
                        {p.valor_total != null && (
                          <span className="font-semibold text-slate-800">
                            {brl(p.valor_total)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<FileText size={36} className="text-slate-300" />}
                title="Nenhuma proposta encontrada"
                description="As propostas deste cliente aparecerao aqui"
              />
            )}
          </div>

          {/* Leads */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-700">
              Leads Relacionados ({leads?.length ?? 0})
            </h2>

            {loadingLeads ? (
              <LoadingCards count={1} />
            ) : leads && leads.length > 0 ? (
              <div className="space-y-3">
                {leads.map((l) => (
                  <div
                    key={l.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-medium text-slate-700">
                        {l.nome ?? l.empresa ?? "Lead sem nome"}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        {l.origem && <span>Origem: {l.origem}</span>}
                        <span>{formatDate(l.created_at)}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {l.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<User size={36} className="text-slate-300" />}
                title="Nenhum lead relacionado"
                description="Leads vinculados a este cliente aparecerao aqui"
              />
            )}
          </div>
        </TabsContent>

        {/* ============================================================= */}
        {/* TAB 5: FINANCEIRO                                             */}
        {/* ============================================================= */}
        <TabsContent value="financeiro" className="mt-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              label="Total a Receber"
              value={brl(finSummary.total)}
              color="text-slate-800"
            />
            <SummaryCard
              label="Vencido"
              value={brl(finSummary.vencido)}
              color="text-red-600"
            />
            <SummaryCard
              label="Pago"
              value={brl(finSummary.pago)}
              color="text-green-600"
            />
          </div>

          <h2 className="text-lg font-semibold text-slate-700">
            Titulos ({contasReceber?.length ?? 0})
          </h2>

          {loadingFinanceiro ? (
            <LoadingCards count={3} />
          ) : contasReceber && contasReceber.length > 0 ? (
            <div className="space-y-3">
              {contasReceber.map((cr) => {
                const fConf =
                  FINANCEIRO_STATUS_CONFIG[cr.status] ??
                  FINANCEIRO_STATUS_CONFIG.a_vencer;
                return (
                  <div
                    key={cr.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {cr.numero_documento && (
                          <span className="text-xs font-mono text-slate-400">
                            Doc: {cr.numero_documento}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${fConf.color}`}
                        >
                          {fConf.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 truncate">
                        {cr.descricao ?? "Sem descricao"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Vencimento: {formatDate(cr.data_vencimento)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-slate-800">
                        {brl(cr.valor)}
                      </p>
                      {cr.valor_pago != null && cr.valor_pago > 0 && (
                        <p className="text-xs text-green-600">
                          Pago: {brl(cr.valor_pago)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<DollarSign size={36} className="text-slate-300" />}
              title="Nenhum titulo financeiro"
              description="Contas a receber deste cliente aparecerao aqui"
            />
          )}
        </TabsContent>

        {/* ============================================================= */}
        {/* TAB 6: HISTORICO                                              */}
        {/* ============================================================= */}
        <TabsContent value="historico" className="mt-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-700">
            Historico de Atividades ({atividades?.length ?? 0})
          </h2>

          {loadingAtividades ? (
            <LoadingCards count={3} />
          ) : atividades && atividades.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

              <div className="space-y-4">
                {atividades.map((a) => {
                  const IconComp = ATIVIDADE_ICON[a.tipo] ?? Clock;
                  return (
                    <div key={a.id} className="relative flex gap-4 pl-2">
                      <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-slate-200 shrink-0">
                        <IconComp size={14} className="text-blue-600" />
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex-1 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-medium text-slate-700 text-sm">
                              {a.titulo ?? a.tipo}
                            </h3>
                            {a.descricao && (
                              <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">
                                {a.descricao}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
                            {formatDateTime(a.data_atividade)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Clock size={36} className="text-slate-300" />}
              title="Nenhuma atividade registrada"
              description="O historico de interacoes com este cliente aparecera aqui"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoField({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 flex items-center gap-1.5">
        {icon}
        {value || <span className="text-slate-300">--</span>}
      </p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <div className="mx-auto mb-3 w-fit">{icon}</div>
      <h3 className="font-semibold text-slate-600">{title}</h3>
      <p className="text-sm text-slate-400 mt-1">{description}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function LoadingCards({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse"
        >
          <div className="h-5 bg-slate-100 rounded w-1/3 mb-3" />
          <div className="h-4 bg-slate-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

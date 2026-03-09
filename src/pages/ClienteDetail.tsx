import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  ArrowLeft,
  Edit,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Plus,
  Trash2,
  FileText,
  ExternalLink,
  CheckCircle,
  Package,
  UserPlus,
  MessageCircle,
  TrendingUp,
  Receipt,
  BarChart2,
  Star,
} from "lucide-react";
import ClienteFormSheet from "@/components/ClienteFormSheet";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_DB: Record<string, any> = {
  "demo-1": {
    razao_social: "Calçados Beira Rio S/A",
    nome_fantasia: "Beira Rio",
    cnpj: "94.868.906/0001-56",
    telefone: "(51) 3594-3200",
    email: "marketing@beiraio.com.br",
    site: "www.beirario.com.br",
    tipo_cliente: "cliente_final",
    origem: "prospeccao",
    tipo_atendimento: "ativo",
    endereco: "Av. Industrial Beira Rio, 1000",
    cidade: "Novo Hamburgo",
    estado: "RS",
    cep: "93534-000",
    observacoes:
      "Demanda recorrente de material PDV para lojistas. Pedidos grandes com antecedência mínima de 15 dias. Cliente estratégico - priorizar atendimento.",
    ativo: true,
    created_at: "2025-06-10T10:00:00Z",
    updated_at: "2026-02-18T10:00:00Z",
    profiles: { first_name: "Edmar", last_name: "Júnior" },
    contatos: [
      {
        id: "c1",
        nome: "Marcos Silva",
        cargo: "Gerente de Trade Marketing",
        telefone: "(51) 3594-3201",
        email: "marcos@beiraio.com.br",
        whatsapp: "(51) 99123-4567",
        principal: true,
      },
      {
        id: "c2",
        nome: "Ana Costa",
        cargo: "Coordenadora de Compras",
        telefone: "(51) 3594-3205",
        email: "ana.costa@beiraio.com.br",
        whatsapp: "",
        principal: false,
      },
    ],
    orcamentos: [
      {
        id: "orc-1",
        numero: "ORC-2026-001",
        titulo: "Fachada ACM + Letras Caixa - Loja Centro",
        status: "aprovado",
        total: 18500,
        created_at: "2026-02-15T10:00:00Z",
      },
      {
        id: "orc-x",
        numero: "ORC-2025-045",
        titulo: "Kit PDV Verão 2025 - 120 Lojas",
        status: "convertido",
        total: 42000,
        created_at: "2025-10-20T14:00:00Z",
      },
    ],
    historico: [
      {
        id: "h1",
        tipo: "orcamento_aprovado",
        descricao: "Orçamento ORC-2026-001 aprovado — R$ 18.500,00",
        data: "2026-02-18T10:00:00Z",
        usuario: "Edmar",
      },
      {
        id: "h2",
        tipo: "orcamento_criado",
        descricao: "Orçamento ORC-2026-001 criado: Fachada ACM + Letras Caixa",
        data: "2026-02-15T10:00:00Z",
        usuario: "Edmar",
      },
      {
        id: "h3",
        tipo: "contato_adicionado",
        descricao: "Contato Ana Costa (Coord. de Compras) adicionado",
        data: "2026-01-05T14:30:00Z",
        usuario: "Edmar",
      },
      {
        id: "h4",
        tipo: "orcamento_convertido",
        descricao: "ORC-2025-045 convertido em OS — Kit PDV Verão 2025",
        data: "2025-11-02T08:00:00Z",
        usuario: "Edmar",
      },
      {
        id: "h5",
        tipo: "cliente_criado",
        descricao: "Cliente cadastrado no sistema",
        data: "2025-06-10T10:00:00Z",
        usuario: "Edmar",
      },
    ],
  },
  "demo-2": {
    razao_social: "Lojas Renner S.A.",
    nome_fantasia: "Renner",
    cnpj: "92.754.738/0001-62",
    telefone: "(51) 2121-7000",
    email: "visual@lojasrenner.com.br",
    site: "www.lojasrenner.com.br",
    tipo_cliente: "cliente_final",
    origem: "indicacao",
    tipo_atendimento: "receptivo",
    endereco: "Av. Joaquim Porto Villanova, 401",
    cidade: "Porto Alegre",
    estado: "RS",
    cep: "91410-400",
    observacoes:
      "Grande conta nacional. Decisões passam por matriz em São Paulo.",
    ativo: true,
    created_at: "2025-03-15T08:00:00Z",
    updated_at: "2026-02-28T14:30:00Z",
    profiles: { first_name: "Regiane", last_name: "Penninck" },
    contatos: [
      {
        id: "c3",
        nome: "Julia Santos",
        cargo: "Diretora de Visual Merchandising",
        telefone: "(51) 2121-7010",
        email: "julia.santos@renner.com.br",
        whatsapp: "(51) 99876-5432",
        principal: true,
      },
    ],
    orcamentos: [
      {
        id: "orc-2",
        numero: "ORC-2026-002",
        titulo: "Campanha Verão 2026 - 45 Lojas",
        status: "enviado",
        total: 32800,
        created_at: "2026-02-28T14:30:00Z",
      },
    ],
    historico: [
      {
        id: "h6",
        tipo: "orcamento_criado",
        descricao: "Orçamento ORC-2026-002 criado: Campanha Verão 2026",
        data: "2026-02-28T14:30:00Z",
        usuario: "Regiane",
      },
      {
        id: "h7",
        tipo: "cliente_criado",
        descricao: "Cliente cadastrado no sistema",
        data: "2025-03-15T08:00:00Z",
        usuario: "Admin",
      },
    ],
  },
};

const FALLBACK: any = {
  razao_social: "Empresa Demo",
  nome_fantasia: "",
  cnpj: "00.000.000/0001-00",
  telefone: "(00) 0000-0000",
  email: "demo@empresa.com.br",
  tipo_cliente: "cliente_final",
  origem: "prospeccao",
  tipo_atendimento: "ativo",
  cidade: "São Paulo",
  estado: "SP",
  ativo: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  profiles: { first_name: "Admin", last_name: "" },
  contatos: [],
  orcamentos: [],
  historico: [],
};

// ---------------------------------------------------------------------------
// Config maps
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-slate-100 text-slate-600" },
  enviado: { label: "Enviado", className: "bg-blue-100 text-blue-700" },
  aprovado: { label: "Aprovado", className: "bg-emerald-100 text-emerald-700" },
  recusado: { label: "Recusado", className: "bg-red-100 text-red-600" },
  convertido: { label: "OS Gerada", className: "bg-purple-100 text-purple-700" },
};

const TIPO_CLIENTE_MAP: Record<string, string> = {
  agencia: "Agência",
  cliente_final: "Cliente Final",
  revenda: "Revenda",
};

const ORIGEM_MAP: Record<string, string> = {
  prospeccao: "Prospecção",
  indicacao: "Indicação",
  internet: "Internet",
  carteira: "Carteira",
  email: "E-mail",
};

// ---------------------------------------------------------------------------
// History icon config
// ---------------------------------------------------------------------------

interface HistoricoConfig {
  icon: React.ReactNode;
  dotColor: string;
  bgColor: string;
}

function getHistoricoConfig(tipo: string): HistoricoConfig {
  switch (tipo) {
    case "orcamento_criado":
      return {
        icon: <FileText size={14} />,
        dotColor: "text-blue-600",
        bgColor: "bg-blue-100",
      };
    case "orcamento_aprovado":
      return {
        icon: <CheckCircle size={14} />,
        dotColor: "text-emerald-600",
        bgColor: "bg-emerald-100",
      };
    case "orcamento_convertido":
      return {
        icon: <Package size={14} />,
        dotColor: "text-purple-600",
        bgColor: "bg-purple-100",
      };
    case "contato_adicionado":
      return {
        icon: <UserPlus size={14} />,
        dotColor: "text-blue-600",
        bgColor: "bg-blue-100",
      };
    case "cliente_criado":
    default:
      return {
        icon: <Building2 size={14} />,
        dotColor: "text-slate-500",
        bgColor: "bg-slate-100",
      };
  }
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1">
      <div className="w-28 text-xs text-slate-400 pt-0.5 flex-shrink-0 font-medium uppercase tracking-wide">
        {label}
      </div>
      <p className="text-sm text-slate-700 flex items-center gap-1.5 flex-1">
        {icon && <span className="text-slate-400">{icon}</span>}
        {value}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-none shadow-sm rounded-2xl">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2 text-slate-700">
          <span className="text-blue-500">{icon}</span>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-base font-bold text-slate-800 leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add/Edit contact dialog
// ---------------------------------------------------------------------------

interface ContatoForm {
  nome: string;
  cargo: string;
  telefone: string;
  email: string;
  whatsapp: string;
  principal: boolean;
}

const CONTATO_EMPTY: ContatoForm = {
  nome: "",
  cargo: "",
  telefone: "",
  email: "",
  whatsapp: "",
  principal: false,
};

function ContatoDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: ContatoForm) => void;
  initial?: ContatoForm;
}) {
  const [form, setForm] = useState<ContatoForm>(initial ?? CONTATO_EMPTY);

  React.useEffect(() => {
    setForm(initial ?? CONTATO_EMPTY);
  }, [open, initial]);

  const set = (field: keyof ContatoForm) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Contato" : "Adicionar Contato"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={set("nome")}
              placeholder="Nome completo"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label>Cargo</Label>
            <Input
              value={form.cargo}
              onChange={set("cargo")}
              placeholder="Ex: Gerente de Marketing"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={set("telefone")}
                placeholder="(00) 0000-0000"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={set("whatsapp")}
                placeholder="(00) 00000-0000"
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input
              value={form.email}
              onChange={set("email")}
              placeholder="contato@empresa.com"
              className="rounded-xl"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({ ...prev, principal: !prev.principal }))
              }
              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                form.principal ? "bg-blue-500" : "bg-slate-200"
              } relative`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  form.principal ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            <Label className="cursor-pointer" onClick={() =>
              setForm((prev) => ({ ...prev, principal: !prev.principal }))
            }>
              Contato principal
            </Label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (form.nome.trim()) {
                onSave(form);
                onClose();
              }
            }}
            className="rounded-xl bg-blue-600 hover:bg-blue-700"
          >
            {initial ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ClienteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [contatos, setContatos] = useState<any[]>(
    () => (MOCK_DB[id || ""] || FALLBACK).contatos ?? []
  );
  const [contatoDialogOpen, setContatoDialogOpen] = useState(false);
  const [contatoEdit, setContatoEdit] = useState<any | null>(null);

  const rawCliente = MOCK_DB[id || ""] || { ...FALLBACK, razao_social: `Cliente ${id}` };
  const cliente = { ...rawCliente, contatos };

  const orcamentos: any[] = rawCliente.orcamentos ?? [];
  const historico: any[] = rawCliente.historico ?? [];
  const vendedorNome = rawCliente.profiles
    ? `${rawCliente.profiles.first_name} ${rawCliente.profiles.last_name || ""}`.trim()
    : "—";

  // KPI computations
  const totalOrcamentos = orcamentos.length;
  const totalAprovado = orcamentos
    .filter((o) => o.status === "aprovado" || o.status === "convertido")
    .reduce((acc, o) => acc + (o.total ?? 0), 0);
  const ticketMedio =
    totalOrcamentos > 0
      ? orcamentos.reduce((acc, o) => acc + (o.total ?? 0), 0) / totalOrcamentos
      : 0;

  // Contato handlers
  function handleAddContato(form: ContatoForm) {
    const newContato = { ...form, id: `c-${Date.now()}` };
    setContatos((prev) => [...prev, newContato]);
  }

  function handleEditContato(form: ContatoForm) {
    setContatos((prev) =>
      prev.map((c) => (c.id === contatoEdit?.id ? { ...c, ...form } : c))
    );
  }

  function handleDeleteContato(cId: string) {
    setContatos((prev) => prev.filter((c) => c.id !== cId));
  }

  const clienteInitials = getInitials(rawCliente.razao_social);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      {/* ---------------------------------------------------------------- */}
      {/* Top nav bar                                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/clientes")}
          className="rounded-xl text-slate-500 hover:text-slate-800 px-2"
        >
          <ArrowLeft size={16} className="mr-1" />
          Clientes
        </Button>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-500 truncate max-w-xs">
          {rawCliente.razao_social}
        </span>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Hero header                                                        */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-md">
            {clienteInitials}
          </div>

          {/* Name block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800 leading-tight truncate">
                {rawCliente.razao_social}
              </h1>
              <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100 font-semibold tracking-wide">
                DEMO
              </span>
              <Badge
                className={
                  rawCliente.ativo
                    ? "bg-emerald-100 text-emerald-700 border-0 rounded-full"
                    : "bg-slate-100 text-slate-500 border-0 rounded-full"
                }
              >
                {rawCliente.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            {rawCliente.nome_fantasia && (
              <p className="text-slate-400 text-sm mt-0.5">
                {rawCliente.nome_fantasia}
                {rawCliente.cidade && rawCliente.estado
                  ? ` · ${rawCliente.cidade}, ${rawCliente.estado}`
                  : ""}
              </p>
            )}
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
              {rawCliente.telefone && (
                <span className="flex items-center gap-1">
                  <Phone size={12} className="text-slate-400" />
                  {rawCliente.telefone}
                </span>
              )}
              {rawCliente.email && (
                <span className="flex items-center gap-1">
                  <Mail size={12} className="text-slate-400" />
                  {rawCliente.email}
                </span>
              )}
              {rawCliente.site && (
                <span className="flex items-center gap-1">
                  <Globe size={12} className="text-slate-400" />
                  {rawCliente.site}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(true)}
              className="rounded-xl border-slate-200 text-slate-600"
            >
              <Edit size={15} className="mr-1.5" />
              Editar
            </Button>
            <Button
              onClick={() => navigate(`/orcamentos/novo?cliente_id=${id}`)}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus size={15} className="mr-1.5" />
              Novo Orçamento
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <KpiCard
            label="Total de Orçamentos"
            value={String(totalOrcamentos)}
            icon={<Receipt size={18} className="text-blue-600" />}
            color="bg-blue-50"
          />
          <KpiCard
            label="Total Aprovado"
            value={formatCurrency(totalAprovado)}
            icon={<CheckCircle size={18} className="text-emerald-600" />}
            color="bg-emerald-50"
          />
          <KpiCard
            label="Ticket Médio"
            value={totalOrcamentos > 0 ? formatCurrency(ticketMedio) : "—"}
            icon={<BarChart2 size={18} className="text-violet-600" />}
            color="bg-violet-50"
          />
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Tabs                                                              */}
      {/* ---------------------------------------------------------------- */}
      <Tabs defaultValue="dados">
        <TabsList className="bg-white rounded-2xl shadow-sm border-none p-1 h-auto gap-1">
          <TabsTrigger
            value="dados"
            className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 text-sm"
          >
            Dados
          </TabsTrigger>
          <TabsTrigger
            value="contatos"
            className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 text-sm"
          >
            Contatos{" "}
            {contatos.length > 0 && (
              <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                {contatos.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="orcamentos"
            className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 text-sm"
          >
            Orçamentos{" "}
            {orcamentos.length > 0 && (
              <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                {orcamentos.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-4 py-2 text-sm"
          >
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* Tab 1: Dados                                                    */}
        {/* ============================================================== */}
        <TabsContent value="dados" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Identificação */}
            <SectionCard
              title="Identificação"
              icon={<Building2 size={16} />}
            >
              <div className="space-y-0.5">
                <InfoRow label="Razão Social" value={rawCliente.razao_social} />
                <InfoRow label="Fantasia" value={rawCliente.nome_fantasia} />
                <InfoRow label="CNPJ" value={rawCliente.cnpj} />
                <InfoRow
                  label="Site"
                  value={rawCliente.site}
                  icon={<Globe size={13} />}
                />
              </div>
            </SectionCard>

            {/* Contato principal */}
            <SectionCard
              title="Contato Principal"
              icon={<Phone size={16} />}
            >
              <div className="space-y-0.5">
                <InfoRow
                  label="Telefone"
                  value={rawCliente.telefone}
                  icon={<Phone size={13} />}
                />
                <InfoRow
                  label="E-mail"
                  value={rawCliente.email}
                  icon={<Mail size={13} />}
                />
              </div>
            </SectionCard>

            {/* Endereço */}
            <SectionCard
              title="Endereço"
              icon={<MapPin size={16} />}
            >
              <div className="space-y-0.5">
                <InfoRow label="Logradouro" value={rawCliente.endereco ?? ""} />
                <InfoRow label="Cidade" value={rawCliente.cidade ?? ""} />
                <InfoRow label="Estado" value={rawCliente.estado ?? ""} />
                <InfoRow label="CEP" value={rawCliente.cep ?? ""} />
              </div>
            </SectionCard>

            {/* Comercial */}
            <SectionCard
              title="Comercial"
              icon={<TrendingUp size={16} />}
            >
              <div className="space-y-0.5">
                <InfoRow
                  label="Tipo"
                  value={TIPO_CLIENTE_MAP[rawCliente.tipo_cliente] ?? rawCliente.tipo_cliente}
                />
                <InfoRow
                  label="Origem"
                  value={ORIGEM_MAP[rawCliente.origem] ?? rawCliente.origem}
                />
                <InfoRow
                  label="Atendimento"
                  value={rawCliente.tipo_atendimento === "ativo" ? "Ativo" : "Receptivo"}
                />
                <InfoRow label="Vendedor" value={vendedorNome} />
              </div>
            </SectionCard>

            {/* Observações — full width */}
            {rawCliente.observacoes && (
              <div className="md:col-span-2">
                <SectionCard
                  title="Observações"
                  icon={<FileText size={16} />}
                >
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4 leading-relaxed">
                    {rawCliente.observacoes}
                  </p>
                </SectionCard>
              </div>
            )}

            {/* Dados internos — full width */}
            <div className="md:col-span-2">
              <SectionCard
                title="Dados Internos"
                icon={<Receipt size={16} />}
              >
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">
                      Cadastrado em
                    </p>
                    <p className="text-slate-700 font-medium">
                      {formatDate(rawCliente.created_at)}
                    </p>
                  </div>
                  {rawCliente.updated_at && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">
                        Última atualização
                      </p>
                      <p className="text-slate-700 font-medium">
                        {formatDate(rawCliente.updated_at)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">
                      Vendedor responsável
                    </p>
                    <p className="text-slate-700 font-medium">{vendedorNome}</p>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* Tab 2: Contatos                                                 */}
        {/* ============================================================== */}
        <TabsContent value="contatos" className="mt-4">
          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base text-slate-700">
                Contatos da empresa
              </CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setContatoEdit(null);
                  setContatoDialogOpen(true);
                }}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
              >
                <Plus size={14} className="mr-1" />
                Adicionar Contato
              </Button>
            </CardHeader>
            <CardContent>
              {contatos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <UserPlus size={22} className="text-slate-400" />
                  </div>
                  <p className="text-slate-400 font-medium">
                    Nenhum contato cadastrado
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Adicione os contatos desta empresa para facilitar o atendimento.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contatos.map((c: any) => (
                    <div
                      key={c.id}
                      className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors ${
                        c.principal
                          ? "bg-blue-50 border-blue-100"
                          : "bg-slate-50 border-transparent hover:bg-white hover:border-slate-100"
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          c.principal
                            ? "bg-blue-600 text-white"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {getInitials(c.nome)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-800">
                            {c.nome}
                          </span>
                          {c.principal && (
                            <Badge className="bg-blue-100 text-blue-700 border-0 text-xs rounded-full h-5 px-2 gap-0.5">
                              <Star size={9} className="fill-blue-600" />
                              Principal
                            </Badge>
                          )}
                        </div>
                        {c.cargo && (
                          <p className="text-xs text-slate-500 mt-0.5">{c.cargo}</p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-2">
                          {c.telefone && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Phone size={11} className="text-slate-400" />
                              {c.telefone}
                            </span>
                          )}
                          {c.email && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Mail size={11} className="text-slate-400" />
                              {c.email}
                            </span>
                          )}
                          {c.whatsapp && (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <MessageCircle size={11} />
                              {c.whatsapp}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl flex-shrink-0"
                        onClick={() => handleDeleteContato(c.id)}
                        title="Remover contato"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* Tab 3: Orçamentos                                               */}
        {/* ============================================================== */}
        <TabsContent value="orcamentos" className="mt-4 space-y-4">
          {/* Summary row */}
          {orcamentos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard
                label="Total de orçamentos"
                value={String(totalOrcamentos)}
                icon={<FileText size={16} className="text-blue-600" />}
                color="bg-blue-50"
              />
              <KpiCard
                label="Volume aprovado"
                value={formatCurrency(totalAprovado)}
                icon={<CheckCircle size={16} className="text-emerald-600" />}
                color="bg-emerald-50"
              />
            </div>
          )}

          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base text-slate-700">
                Histórico de orçamentos
              </CardTitle>
              <Button
                size="sm"
                onClick={() =>
                  navigate(`/orcamentos/novo?cliente_id=${id}`)
                }
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
              >
                <Plus size={14} className="mr-1" />
                Novo Orçamento
              </Button>
            </CardHeader>
            <CardContent>
              {orcamentos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <FileText size={22} className="text-slate-400" />
                  </div>
                  <p className="text-slate-400 font-medium">
                    Nenhum orçamento ainda
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Crie o primeiro orçamento para este cliente.
                  </p>
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(`/orcamentos/novo?cliente_id=${id}`)
                    }
                    className="mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus size={14} className="mr-1" />
                    Criar Orçamento
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {orcamentos.map((o: any) => {
                    const s =
                      STATUS_CONFIG[o.status] ?? {
                        label: o.status,
                        className: "bg-slate-100 text-slate-600",
                      };
                    return (
                      <div
                        key={o.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/orcamentos/${o.id}`)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && navigate(`/orcamentos/${o.id}`)
                        }
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-blue-50 cursor-pointer transition-colors group border border-transparent hover:border-blue-100"
                      >
                        <div className="min-w-0 flex-1 mr-4">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {o.numero}
                            <span className="font-normal text-slate-500 ml-1">
                              — {o.titulo}
                            </span>
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatDate(o.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.className}`}
                          >
                            {s.label}
                          </span>
                          <span className="text-sm font-bold text-slate-700 min-w-[90px] text-right">
                            {formatCurrency(o.total)}
                          </span>
                          <ExternalLink
                            size={14}
                            className="text-slate-300 group-hover:text-blue-400 transition-colors"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* Tab 4: Histórico                                                */}
        {/* ============================================================== */}
        <TabsContent value="historico" className="mt-4">
          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-700">
                Linha do tempo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historico.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400">Sem registros de atividade.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-slate-100" />

                  <div className="space-y-6">
                    {historico.map((h: any, idx: number) => {
                      const cfg = getHistoricoConfig(h.tipo);
                      return (
                        <div key={h.id} className="flex gap-4 relative">
                          {/* Icon dot */}
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 z-10 shadow-sm ${cfg.bgColor} ${cfg.dotColor}`}
                          >
                            {cfg.icon}
                          </div>

                          {/* Content */}
                          <div className="flex-1 pt-1.5 pb-1">
                            <p className="text-sm text-slate-700 leading-snug">
                              {h.descricao}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                              <span>{formatDateTime(h.data)}</span>
                              {h.usuario && (
                                <>
                                  <span className="text-slate-200">·</span>
                                  <span>{h.usuario}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---------------------------------------------------------------- */}
      {/* Contact dialog                                                    */}
      {/* ---------------------------------------------------------------- */}
      <ContatoDialog
        open={contatoDialogOpen}
        onClose={() => {
          setContatoDialogOpen(false);
          setContatoEdit(null);
        }}
        onSave={contatoEdit ? handleEditContato : handleAddContato}
        initial={
          contatoEdit
            ? {
                nome: contatoEdit.nome,
                cargo: contatoEdit.cargo ?? "",
                telefone: contatoEdit.telefone ?? "",
                email: contatoEdit.email ?? "",
                whatsapp: contatoEdit.whatsapp ?? "",
                principal: contatoEdit.principal ?? false,
              }
            : undefined
        }
      />

      {/* ---------------------------------------------------------------- */}
      {/* Edit client sheet                                                 */}
      {/* ---------------------------------------------------------------- */}
      <ClienteFormSheet
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        clienteToEdit={rawCliente}
      />
    </div>
  );
}

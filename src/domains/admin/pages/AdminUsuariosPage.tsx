// ============================================================================
// ADMIN USUARIOS PAGE — Croma Print ERP/CRM
// Gestao de Usuarios, Perfis/Permissoes e Auditoria
// ============================================================================

import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { formatDateTime, formatDateRelative } from "@/shared/utils/format";
import { ilikeTerm } from "@/shared/utils/searchUtils";
import { MODULES, ACTIONS } from "@/shared/constants/permissions";
import type { Module, Action } from "@/shared/constants/permissions";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  Users,
  Shield,
  ClipboardList,
  Search,
  Filter,
  Plus,
  Pencil,
  Mail,
  Building2,
  UserCheck,
  UserX,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
  Lock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileEdit,
  Trash2,
  ArrowRightLeft,
  ThumbsUp,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  departamento: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface Role {
  id: string;
  nome: string;
  descricao: string | null;
  created_at: string;
}

interface Permission {
  id: string;
  modulo: string;
  acao: string;
  descricao: string | null;
}

interface RolePermission {
  role_id: string;
  permission_id: string;
}

interface AuditRecord {
  id: string;
  user_id: string | null;
  tabela: string;
  registro_id: string;
  acao: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string } | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  diretor: "bg-purple-100 text-purple-700 border-purple-200",
  comercial: "bg-blue-100 text-blue-700 border-blue-200",
  comercial_senior: "bg-blue-100 text-blue-700 border-blue-200",
  financeiro: "bg-green-100 text-green-700 border-green-200",
  producao: "bg-orange-100 text-orange-700 border-orange-200",
  compras: "bg-amber-100 text-amber-700 border-amber-200",
  logistica: "bg-cyan-100 text-cyan-700 border-cyan-200",
  instalador: "bg-slate-100 text-slate-600 border-slate-200",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  diretor: "Diretor",
  comercial: "Comercial",
  comercial_senior: "Comercial Sr.",
  financeiro: "Financeiro",
  producao: "Produção",
  compras: "Compras",
  logistica: "Logística",
  instalador: "Instalador",
};

const DEPARTAMENTOS = [
  "Diretoria",
  "Comercial",
  "Financeiro",
  "Produção",
  "Compras",
  "Logística",
  "Instalação",
  "Qualidade",
  "TI",
  "RH",
];

const ACAO_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  INSERT: { label: "Inserção", color: "bg-green-100 text-green-700 border-green-200", icon: Plus },
  UPDATE: { label: "Atualização", color: "bg-blue-100 text-blue-700 border-blue-200", icon: FileEdit },
  DELETE: { label: "Exclusão", color: "bg-red-100 text-red-700 border-red-200", icon: Trash2 },
  STATUS_CHANGE: { label: "Status", color: "bg-amber-100 text-amber-700 border-amber-200", icon: ArrowRightLeft },
  APPROVAL: { label: "Aprovação", color: "bg-purple-100 text-purple-700 border-purple-200", icon: ThumbsUp },
};

const MODULE_LABELS: Record<string, string> = {
  comercial: "Comercial",
  clientes: "Clientes",
  pedidos: "Pedidos",
  producao: "Produção",
  estoque: "Estoque",
  compras: "Compras",
  financeiro: "Financeiro",
  instalacao: "Instalação",
  qualidade: "Qualidade",
  admin: "Admin",
};

const ACTION_LABELS: Record<string, string> = {
  ver: "Ver",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
  aprovar: "Aprovar",
  exportar: "Exportar",
};

const ALL_ROLES = Object.keys(ROLE_LABELS);

// ─── Reusable KPI Card ─────────────────────────────────────────────────────

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
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">
            {label}
          </p>
          <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight">
            {value}
          </p>
          {sub && (
            <p className={`text-xs mt-0.5 font-medium ${subColor ?? "text-slate-400"}`}>
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TAB 1: USUARIOS
// ============================================================================

function TabUsuarios() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    role: "",
    departamento: "",
    ativo: true,
  });

  // ─── Fetch Users ────────────────────────────────────────────────────────

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search, roleFilter, deptFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (roleFilter && roleFilter !== "all") {
        query = query.eq("role", roleFilter);
      }
      if (deptFilter && deptFilter !== "all") {
        query = query.eq("departamento", deptFilter);
      }
      if (statusFilter === "ativo") {
        query = query.eq("ativo", true);
      } else if (statusFilter === "inativo") {
        query = query.eq("ativo", false);
      }
      if (search) {
        const t = ilikeTerm(search);
        query = query.or(
          `full_name.ilike.${t},email.ilike.${t}`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Profile[];
    },
  });

  // ─── Stats ──────────────────────────────────────────────────────────────

  const { data: stats } = useQuery({
    queryKey: ["admin-users", "stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("ativo, departamento, role, created_at");
      if (error) throw error;

      const total = data?.length ?? 0;
      const ativos = data?.filter((u) => u.ativo).length ?? 0;

      // Departamento mais comum
      const deptCount: Record<string, number> = {};
      data?.forEach((u) => {
        if (u.departamento) {
          deptCount[u.departamento] = (deptCount[u.departamento] || 0) + 1;
        }
      });
      const topDept = Object.entries(deptCount).sort(
        (a, b) => b[1] - a[1]
      )[0];

      // Novos este mes
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const novos =
        data?.filter((u) => new Date(u.created_at) >= startOfMonth).length ?? 0;

      return {
        total,
        ativos,
        topDept: topDept ? `${topDept[0]} (${topDept[1]})` : "---",
        novos,
      };
    },
  });

  // ─── Update User ────────────────────────────────────────────────────────

  const updateUser = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { role: string; departamento: string | null; ativo: boolean };
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          role: data.role,
          departamento: data.departamento || null,
          ativo: data.ativo,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      showSuccess("Usuário atualizado com sucesso!");
      setEditUser(null);
    },
    onError: (err: any) => showError(err.message || "Erro ao atualizar usuário"),
  });

  const handleEditOpen = (user: Profile) => {
    setEditUser(user);
    setEditForm({
      role: user.role,
      departamento: user.departamento || "",
      ativo: user.ativo,
    });
  };

  const handleEditSave = () => {
    if (!editUser) return;
    updateUser.mutate({
      id: editUser.id,
      data: {
        role: editForm.role,
        departamento: editForm.departamento || null,
        ativo: editForm.ativo,
      },
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Usuários"
          value={stats?.total ?? 0}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KpiCard
          label="Ativos"
          value={stats?.ativos ?? 0}
          icon={UserCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          sub={
            stats
              ? `${Math.round(((stats.ativos ?? 0) / Math.max(stats.total, 1)) * 100)}% do total`
              : undefined
          }
          subColor="text-emerald-600"
        />
        <KpiCard
          label="Por Departamento"
          value={stats?.topDept ?? "---"}
          icon={Building2}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          sub="mais frequente"
        />
        <KpiCard
          label="Novos este Mês"
          value={stats?.novos ?? 0}
          icon={Calendar}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter size={14} className="mr-2 text-slate-400" />
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            {ALL_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos departamentos</SelectItem>
            {DEPARTAMENTOS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-slate-100 rounded w-1/3" />
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : users && users.length > 0 ? (
          users.map((user) => {
            const initials = (user.full_name || user.email)
              .split(/\s+/)
              .map((w) => w[0]?.toUpperCase())
              .slice(0, 2)
              .join("");

            return (
              <div
                key={user.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        user.ativo
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.full_name || ""}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3
                          className={`font-semibold truncate ${
                            user.ativo ? "text-slate-800" : "text-slate-400"
                          }`}
                        >
                          {user.full_name || "Sem nome"}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            ROLE_COLORS[user.role] || "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                        {user.ativo ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-500 border border-red-200">
                            Inativo
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Mail size={13} /> {user.email}
                        </span>
                        {user.departamento && (
                          <span className="flex items-center gap-1">
                            <Building2 size={13} /> {user.departamento}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar size={12} /> {formatDateRelative(user.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditOpen(user)}
                    className="h-9 rounded-xl text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <Pencil size={13} /> Editar
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">
              Nenhum usuário encontrado
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Ajuste os filtros para visualizar usuários
            </p>
          </div>
        )}
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="grid gap-4 py-4">
              {/* Read-only info */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-sm text-slate-500">
                  <span className="font-medium text-slate-700">Nome:</span>{" "}
                  {editUser.full_name || "---"}
                </p>
                <p className="text-sm text-slate-500">
                  <span className="font-medium text-slate-700">Email:</span>{" "}
                  {editUser.email}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Nome e email são gerenciados pelo Auth e não podem ser alterados aqui.
                </p>
              </div>

              <div>
                <Label>Perfil (Role)</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm({ ...editForm, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Departamento</Label>
                <Select
                  value={editForm.departamento || "none"}
                  onValueChange={(v) =>
                    setEditForm({
                      ...editForm,
                      departamento: v === "none" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {DEPARTAMENTOS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-sm font-medium">Ativo</Label>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Usuários inativos não podem acessar o sistema
                  </p>
                </div>
                <Switch
                  checked={editForm.ativo}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, ativo: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={updateUser.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateUser.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// TAB 2: PERFIS E PERMISSOES
// ============================================================================

function TabPerfis() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({ nome: "", descricao: "" });

  // ─── Fetch Roles ────────────────────────────────────────────────────────

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data as Role[];
    },
  });

  // ─── Fetch Permissions ──────────────────────────────────────────────────

  const { data: permissions } = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .order("modulo", { ascending: true });
      if (error) throw error;
      return data as Permission[];
    },
  });

  // ─── Fetch Role Permissions ─────────────────────────────────────────────

  const { data: rolePermissions } = useQuery({
    queryKey: ["admin-role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*");
      if (error) throw error;
      return data as RolePermission[];
    },
  });

  // ─── Permission counts per role ─────────────────────────────────────────

  const permCountByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    rolePermissions?.forEach((rp) => {
      counts[rp.role_id] = (counts[rp.role_id] || 0) + 1;
    });
    return counts;
  }, [rolePermissions]);

  // ─── Compute which permissions the selected role has ────────────────────

  const selectedRolePermIds = useMemo(() => {
    if (!selectedRole) return new Set<string>();
    return new Set(
      rolePermissions
        ?.filter((rp) => rp.role_id === selectedRole.id)
        .map((rp) => rp.permission_id) ?? []
    );
  }, [selectedRole, rolePermissions]);

  // ─── Group permissions by module ────────────────────────────────────────

  const permsByModule = useMemo(() => {
    const map: Record<string, Permission[]> = {};
    permissions?.forEach((p) => {
      if (!map[p.modulo]) map[p.modulo] = [];
      map[p.modulo].push(p);
    });
    return map;
  }, [permissions]);

  // ─── Toggle Permission ──────────────────────────────────────────────────

  const togglePermission = useMutation({
    mutationFn: async ({
      roleId,
      permissionId,
      grant,
    }: {
      roleId: string;
      permissionId: string;
      grant: boolean;
    }) => {
      if (grant) {
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role_id: roleId, permission_id: permissionId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId)
          .eq("permission_id", permissionId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-role-permissions"] });
    },
    onError: (err: any) => showError(err.message || "Erro ao alterar permissão"),
  });

  // ─── Create Role ───────────────────────────────────────────────────────

  const createRole = useMutation({
    mutationFn: async (form: { nome: string; descricao: string }) => {
      const { error } = await supabase.from("roles").insert({
        nome: form.nome,
        descricao: form.descricao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      showSuccess("Perfil criado com sucesso!");
      setShowNewRole(false);
      setNewRoleForm({ nome: "", descricao: "" });
    },
    onError: (err: any) => showError(err.message || "Erro ao criar perfil"),
  });

  // ─── Handle permission toggle ──────────────────────────────────────────

  const handleToggle = (permissionId: string) => {
    if (!selectedRole) return;
    const isGranted = selectedRolePermIds.has(permissionId);
    togglePermission.mutate({
      roleId: selectedRole.id,
      permissionId,
      grant: !isGranted,
    });
  };

  // ─── Find permission by module+action ──────────────────────────────────

  const findPermission = (modulo: string, acao: string) => {
    return permissions?.find((p) => p.modulo === modulo && p.acao === acao);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Selecione um perfil para gerenciar suas permissões
        </p>
        <Button
          onClick={() => setShowNewRole(true)}
          className="bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          <Plus size={14} className="mr-1.5" /> Novo Perfil
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Roles list */}
        <div className="lg:col-span-4 space-y-3">
          {rolesLoading ? (
            [1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))
          ) : roles && roles.length > 0 ? (
            roles.map((role) => {
              const isSelected = selectedRole?.id === role.id;
              const count = permCountByRole[role.id] || 0;

              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? "bg-blue-50 border-blue-300 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3
                      className={`font-semibold text-sm ${
                        isSelected ? "text-blue-700" : "text-slate-800"
                      }`}
                    >
                      {role.nome}
                    </h3>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-blue-100 text-blue-600"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {count} perm.
                    </span>
                  </div>
                  {role.descricao && (
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {role.descricao}
                    </p>
                  )}

                  {/* Coverage bar */}
                  {permissions && permissions.length > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isSelected ? "bg-blue-500" : "bg-slate-300"
                          }`}
                          style={{
                            width: `${Math.round(
                              (count / permissions.length) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {Math.round((count / permissions.length) * 100)}% de
                        cobertura
                      </p>
                    </div>
                  )}
                </button>
              );
            })
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <Shield size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">
                Nenhum perfil cadastrado
              </p>
            </div>
          )}
        </div>

        {/* Permission Matrix */}
        <div className="lg:col-span-8">
          {selectedRole ? (
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Permissões: {selectedRole.nome}
                  </h3>
                  {selectedRole.descricao && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedRole.descricao}
                    </p>
                  )}
                </div>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                  {selectedRolePermIds.size} permissões ativas
                </span>
              </div>

              <ScrollArea className="max-h-[560px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide sticky left-0 bg-slate-50 min-w-[140px]">
                          Módulo
                        </th>
                        {(ACTIONS as readonly string[]).map((action) => (
                          <th
                            key={action}
                            className="text-center px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide min-w-[70px]"
                          >
                            {ACTION_LABELS[action] || action}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(MODULES as readonly string[]).map((modulo) => (
                        <tr
                          key={modulo}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="px-6 py-3 font-medium text-slate-700 sticky left-0 bg-white">
                            {MODULE_LABELS[modulo] || modulo}
                          </td>
                          {(ACTIONS as readonly string[]).map((action) => {
                            const perm = findPermission(modulo, action);
                            if (!perm) {
                              return (
                                <td key={action} className="text-center px-3 py-3">
                                  <span className="text-slate-200">--</span>
                                </td>
                              );
                            }
                            const isChecked = selectedRolePermIds.has(perm.id);
                            return (
                              <td key={action} className="text-center px-3 py-3">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => handleToggle(perm.id)}
                                  disabled={togglePermission.isPending}
                                  className={
                                    isChecked
                                      ? "border-blue-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                      : ""
                                  }
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </Card>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center">
              <Lock size={40} className="mx-auto text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-600">
                Selecione um perfil
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Escolha um perfil na lista ao lado para gerenciar suas
                permissões
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Role Dialog */}
      <Dialog open={showNewRole} onOpenChange={setShowNewRole}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Perfil</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={newRoleForm.nome}
                onChange={(e) =>
                  setNewRoleForm({ ...newRoleForm, nome: e.target.value })
                }
                placeholder="Ex: supervisor_producao"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={newRoleForm.descricao}
                onChange={(e) =>
                  setNewRoleForm({ ...newRoleForm, descricao: e.target.value })
                }
                placeholder="Descreva as responsabilidades deste perfil..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRole(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createRole.mutate(newRoleForm)}
              disabled={!newRoleForm.nome || createRole.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createRole.isPending ? "Criando..." : "Criar Perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// TAB 3: AUDITORIA
// ============================================================================

function TabAuditoria() {
  const [search, setSearch] = useState("");
  const [tabelaFilter, setTabelaFilter] = useState<string>("all");
  const [acaoFilter, setAcaoFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditRecord | null>(null);
  const pageSize = 20;

  // ─── Fetch Audit Stats ──────────────────────────────────────────────────

  const { data: auditStats } = useQuery({
    queryKey: ["admin-audit", "stats"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data, error } = await supabase
        .from("registros_auditoria")
        .select("acao, tabela")
        .gte("created_at", startOfMonth);
      if (error) throw error;

      const totalMes = data?.length ?? 0;

      // Acao mais comum
      const acaoCounts: Record<string, number> = {};
      data?.forEach((r) => {
        acaoCounts[r.acao] = (acaoCounts[r.acao] || 0) + 1;
      });
      const topAcao = Object.entries(acaoCounts).sort(
        (a, b) => b[1] - a[1]
      )[0];

      // Tabela mais alterada
      const tabelaCounts: Record<string, number> = {};
      data?.forEach((r) => {
        tabelaCounts[r.tabela] = (tabelaCounts[r.tabela] || 0) + 1;
      });
      const topTabela = Object.entries(tabelaCounts).sort(
        (a, b) => b[1] - a[1]
      )[0];

      return {
        totalMes,
        topAcao: topAcao
          ? `${ACAO_CONFIG[topAcao[0]]?.label || topAcao[0]} (${topAcao[1]})`
          : "---",
        topTabela: topTabela ? `${topTabela[0]} (${topTabela[1]})` : "---",
      };
    },
  });

  // ─── Fetch distinct tabelas for filter ──────────────────────────────────

  const { data: tabelasList } = useQuery({
    queryKey: ["admin-audit", "tabelas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_auditoria")
        .select("tabela")
        .order("tabela", { ascending: true });
      if (error) throw error;
      const unique = [...new Set(data?.map((r) => r.tabela) ?? [])];
      return unique;
    },
  });

  // ─── Fetch Audit Logs (paginated) ──────────────────────────────────────

  const { data: auditData, isLoading } = useQuery({
    queryKey: ["admin-audit", "logs", page, tabelaFilter, acaoFilter, search],
    queryFn: async () => {
      let query = supabase
        .from("registros_auditoria")
        .select(
          "*, profiles:user_id(full_name, email)",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (tabelaFilter && tabelaFilter !== "all") {
        query = query.eq("tabela", tabelaFilter);
      }
      if (acaoFilter && acaoFilter !== "all") {
        query = query.eq("acao", acaoFilter);
      }
      if (search) {
        const t = ilikeTerm(search);
        query = query.or(
          `tabela.ilike.${t},acao.ilike.${t}`
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { logs: data as AuditRecord[], total: count ?? 0 };
    },
  });

  const logs = auditData?.logs ?? [];
  const total = auditData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Registros (Mês)"
          value={auditStats?.totalMes ?? 0}
          icon={Activity}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KpiCard
          label="Ação Mais Comum"
          value={auditStats?.topAcao ?? "---"}
          icon={ClipboardList}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KpiCard
          label="Tabela Mais Alterada"
          value={auditStats?.topTabela ?? "---"}
          icon={FileEdit}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            placeholder="Buscar por tabela ou ação..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={tabelaFilter}
          onValueChange={(v) => {
            setTabelaFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tabela" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tabelas</SelectItem>
            {tabelasList?.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={acaoFilter}
          onValueChange={(v) => {
            setAcaoFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {Object.entries(ACAO_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Audit Log Table */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Data/Hora
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Usuário
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Tabela
                </th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Ação
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                  Registro ID
                </th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Detalhes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6 py-4">
                      <Skeleton className="h-5 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : logs.length > 0 ? (
                logs.map((log) => {
                  const acaoCfg =
                    ACAO_CONFIG[log.acao] || {
                      label: log.acao,
                      color: "bg-slate-100 text-slate-600 border-slate-200",
                      icon: Activity,
                    };
                  const AcaoIcon = acaoCfg.icon;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <div>
                          <span className="text-slate-700 font-medium text-xs">
                            {formatDateTime(log.created_at)}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {formatDateRelative(log.created_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="min-w-0">
                          <span className="text-slate-700 font-medium text-xs truncate block">
                            {log.profiles?.full_name || "---"}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate block">
                            {log.profiles?.email || log.user_id?.slice(0, 8) || "Sistema"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                          {log.tabela}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${acaoCfg.color}`}
                        >
                          <AcaoIcon size={11} />
                          {acaoCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="font-mono text-[10px] text-slate-400">
                          {log.registro_id?.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedLog(log)}
                          className="h-8 text-xs rounded-xl gap-1"
                        >
                          <Eye size={12} /> Ver
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    <ClipboardList
                      size={32}
                      className="mx-auto text-slate-300 mb-2"
                    />
                    <p className="text-sm font-medium">
                      Nenhum registro de auditoria encontrado
                    </p>
                    <p className="text-xs mt-0.5">
                      Ajuste os filtros ou aguarde novas ações no sistema
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Mostrando {page * pageSize + 1}–
              {Math.min((page + 1) * pageSize, total)} de {total} registros
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="h-8 rounded-xl"
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs text-slate-500 font-medium">
                {page + 1} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 rounded-xl"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Audit Detail Dialog */}
      <Dialog
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalhes da Auditoria
              {selectedLog && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    ACAO_CONFIG[selectedLog.acao]?.color || "bg-slate-100"
                  }`}
                >
                  {ACAO_CONFIG[selectedLog.acao]?.label || selectedLog.acao}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 py-2">
              {/* Metadata */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Data/Hora
                  </span>
                  <p className="text-slate-700 font-medium mt-0.5">
                    {formatDateTime(selectedLog.created_at)}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Usuário
                  </span>
                  <p className="text-slate-700 font-medium mt-0.5">
                    {selectedLog.profiles?.full_name || "---"}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {selectedLog.profiles?.email || selectedLog.user_id || "Sistema"}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Tabela
                  </span>
                  <p className="text-slate-700 font-mono text-xs mt-0.5">
                    {selectedLog.tabela}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Registro ID
                  </span>
                  <p className="text-slate-700 font-mono text-xs mt-0.5 break-all">
                    {selectedLog.registro_id}
                  </p>
                </div>
                {selectedLog.ip_address && (
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      IP
                    </span>
                    <p className="text-slate-700 font-mono text-xs mt-0.5">
                      {selectedLog.ip_address}
                    </p>
                  </div>
                )}
              </div>

              {/* JSON Diffs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dados Anteriores */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle size={14} className="text-red-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Dados Anteriores
                    </span>
                  </div>
                  <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 max-h-72 overflow-auto">
                    {selectedLog.dados_anteriores ? (
                      <pre className="text-xs text-red-800 font-mono whitespace-pre-wrap break-words leading-relaxed">
                        {JSON.stringify(selectedLog.dados_anteriores, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Nenhum dado anterior (registro novo)
                      </p>
                    )}
                  </div>
                </div>

                {/* Dados Novos */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Dados Novos
                    </span>
                  </div>
                  <div className="bg-green-50/50 border border-green-100 rounded-xl p-3 max-h-72 overflow-auto">
                    {selectedLog.dados_novos ? (
                      <pre className="text-xs text-green-800 font-mono whitespace-pre-wrap break-words leading-relaxed">
                        {JSON.stringify(selectedLog.dados_novos, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Nenhum dado novo (registro excluído)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AdminUsuariosPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <ShieldCheck size={20} className="text-blue-600" />
            </div>
            Usuários e Permissões
          </h1>
          <p className="text-slate-500 mt-1 ml-1">
            Gerenciamento de usuários, perfis de acesso e auditoria do sistema
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="usuarios" className="space-y-6">
        <TabsList className="bg-white shadow-sm rounded-2xl p-1.5 border border-slate-100 h-auto flex gap-1 w-full md:w-auto">
          {[
            { value: "usuarios", label: "Usuários", icon: Users },
            { value: "perfis", label: "Perfis e Permissões", icon: Shield },
            { value: "auditoria", label: "Auditoria", icon: ClipboardList },
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

        <TabsContent value="usuarios">
          <TabUsuarios />
        </TabsContent>

        <TabsContent value="perfis">
          <TabPerfis />
        </TabsContent>

        <TabsContent value="auditoria">
          <TabAuditoria />
        </TabsContent>
      </Tabs>
    </div>
  );
}

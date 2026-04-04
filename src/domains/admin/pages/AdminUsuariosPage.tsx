// ============================================================================
// ADMIN USUARIOS PAGE — Croma Print ERP/CRM
// Gestão de Usuários, Perfis/Permissões e Auditoria
// ============================================================================

import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { formatDateTime, formatDateRelative } from "@/shared/utils/format";
import { ilikeTerm } from "@/shared/utils/searchUtils";
import { ROLES, type RoleName } from "@/shared/constants/permissions";
import { useAuth } from "@/contexts/AuthContext";

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
import { Checkbox } from "@/components/ui/checkbox";

import {
  Users,
  Search,
  Filter,
  Plus,
  Pencil,
  Mail,
  Building2,
  UserCheck,
  UserX,
  Calendar,
  Eye,
  Lock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import PermissionGuard from "@/shared/components/PermissionGuard";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: RoleName | null;
  departamento: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<RoleName, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  diretor: "bg-purple-100 text-purple-700 border-purple-200",
  comercial: "bg-green-100 text-green-700 border-green-200",
  comercial_senior: "bg-emerald-100 text-emerald-700 border-emerald-200",
  financeiro: "bg-yellow-100 text-yellow-700 border-yellow-200",
  producao: "bg-orange-100 text-orange-700 border-orange-200",
  compras: "bg-cyan-100 text-cyan-700 border-cyan-200",
  logistica: "bg-indigo-100 text-indigo-700 border-indigo-200",
  instalador: "bg-slate-100 text-slate-600 border-slate-200",
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

// ─── Reusable KPI Card ─────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
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
      </div>
    </div>
  );
}

// ============================================================================
// TAB 1: USUARIOS
// ============================================================================

function TabUsuarios() {
  const queryClient = useQueryClient();
  const { profile: currentProfile } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [editForm, setEditForm] = useState({
    role: "",
    departamento: "",
    telefone: "",
    ativo: true,
  });
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    role: "",
    departamento: "",
    telefone: "",
  });

  // ─── Fetch Users ────────────────────────────────────────────────────────

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search, roleFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (roleFilter && roleFilter !== "all") {
        query = query.eq("role", roleFilter);
      }
      if (statusFilter === "ativo") {
        query = query.eq("ativo", true);
      } else if (statusFilter === "inativo") {
        query = query.eq("ativo", false);
      }
      if (statusFilter === "pending") {
        query = query.is("role", null);
      }
      if (search) {
        const t = ilikeTerm(search);
        query = query.or(`full_name.ilike.${t},email.ilike.${t}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Profile[];
    },
  });

  // ─── Stats ──────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!users) return { total: 0, ativos: 0, pending: 0 };
    return {
      total: users.length,
      ativos: users.filter((u) => u.ativo).length,
      pending: users.filter((u) => u.role === null).length,
    };
  }, [users]);

  // ─── Update User ────────────────────────────────────────────────────────

  const updateUserMutation = useMutation({
    mutationFn: async (user: Partial<Profile> & { id: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          role: user.role || null,
          departamento: user.departamento || null,
          telefone: user.telefone || null,
          ativo: user.ativo,
        })
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      showSuccess("Usuário atualizado com sucesso!");
      setEditUser(null);
    },
    onError: (err: any) => showError(err.message || "Erro ao atualizar usuário"),
  });

  // ─── Toggle Active ──────────────────────────────────────────────────────

  const toggleActiveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const user = users?.find((u) => u.id === userId);
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ ativo: !user.ativo })
        .eq("id", userId)
        .select()
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      showSuccess("Status do usuário atualizado!");
    },
    onError: (err: any) => showError(err.message || "Erro ao atualizar status"),
  });

  // ─── Approve User ──────────────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const user = users?.find((u) => u.id === userId);
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ role: "comercial", ativo: true })
        .eq("id", userId)
        .select()
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      showSuccess("Usuário aprovado com sucesso!");
    },
    onError: (err: any) => showError(err.message || "Erro ao aprovar usuário"),
  });

  // ─── Create User ────────────────────────────────────────────────────────

  const createUserMutation = useMutation({
    mutationFn: async () => {
      // Edge Function para criar usuário
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            action: "create_user",
            email: createForm.email,
            full_name: createForm.full_name,
            role: createForm.role || null,
            departamento: createForm.departamento || null,
            telefone: createForm.telefone || null,
            password: Math.random().toString(36).slice(-12),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar usuário");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      showSuccess("Usuário criado com sucesso!");
      setCreateMode(false);
      setCreateForm({ full_name: "", email: "", role: "", departamento: "", telefone: "" });
    },
    onError: (err: any) => showError(err.message || "Erro ao criar usuário"),
  });

  const handleEditOpen = (user: Profile) => {
    setEditUser(user);
    setEditForm({
      role: user.role || "",
      departamento: user.departamento || "",
      telefone: user.telefone || "",
      ativo: user.ativo,
    });
  };

  const handleEditSave = () => {
    if (!editUser) return;
    updateUserMutation.mutate({
      id: editUser.id,
      ...editForm,
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Total Usuários"
          value={stats.total}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KpiCard
          label="Ativos"
          value={stats.ativos}
          icon={UserCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <KpiCard
          label="Aguardando Aprovação"
          value={stats.pending}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Filters + Create Button */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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
          <SelectTrigger className="w-full sm:w-48">
            <Filter size={14} className="mr-2 text-slate-400" />
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            {Object.entries(ROLES).map(([key]) => (
              <SelectItem key={key} value={key}>
                {ROLES[key as RoleName].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
            <SelectItem value="pending">Aguardando Aprovação</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateMode(true)} className="w-full sm:w-auto">
          <Plus size={16} className="mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Create User Dialog */}
      <Dialog open={createMode} onOpenChange={setCreateMode}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name">Nome Completo</Label>
              <Input
                id="create-name"
                value={createForm.full_name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, full_name: e.target.value })
                }
                placeholder="João Silva"
              />
            </div>
            <div>
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
                placeholder="joao@cromaprint.com.br"
              />
            </div>
            <div>
              <Label htmlFor="create-role">Perfil</Label>
              <Select
                value={createForm.role}
                onValueChange={(role) =>
                  setCreateForm({ ...createForm, role })
                }
              >
                <SelectTrigger id="create-role">
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-dept">Departamento</Label>
              <Select
                value={createForm.departamento}
                onValueChange={(dept) =>
                  setCreateForm({ ...createForm, departamento: dept })
                }
              >
                <SelectTrigger id="create-dept">
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTAMENTOS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-phone">Telefone</Label>
              <Input
                id="create-phone"
                value={createForm.telefone}
                onChange={(e) =>
                  setCreateForm({ ...createForm, telefone: e.target.value })
                }
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateMode(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createUserMutation.mutate()}
              disabled={!createForm.email || !createForm.full_name}
            >
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  {editUser.full_name || "Usuário"}
                </p>
                <p className="text-xs text-slate-500">{editUser.email}</p>
              </div>

              <div>
                <Label htmlFor="edit-role">Perfil</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(role) =>
                    setEditForm({ ...editForm, role })
                  }
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-dept">Departamento</Label>
                <Select
                  value={editForm.departamento}
                  onValueChange={(dept) =>
                    setEditForm({ ...editForm, departamento: dept })
                  }
                >
                  <SelectTrigger id="edit-dept">
                    <SelectValue placeholder="Selecione um departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTAMENTOS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.telefone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, telefone: e.target.value })
                  }
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-ativo"
                  checked={editForm.ativo}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, ativo: !!checked })
                  }
                />
                <Label htmlFor="edit-ativo" className="font-normal cursor-pointer">
                  Usuário ativo
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditUser(null)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={updateUserMutation.isPending}
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users List */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse"
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
          users.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 flex-col">
                  <span className="text-blue-600 font-bold text-xs">
                    {(user.full_name || user.email)
                      .split(/\s+/)
                      .map((w) => w[0]?.toUpperCase())
                      .slice(0, 2)
                      .join("")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 truncate">
                    {user.full_name || "Usuário"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {user.role ? (
                  <Badge
                    className={`${ROLE_COLORS[user.role] || "bg-slate-100 text-slate-600"} border`}
                  >
                    {ROLES[user.role].label}
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border border-amber-200">
                    Aguardando aprovação
                  </Badge>
                )}

                {user.ativo ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 size={14} />
                    Ativo
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <XCircle size={14} />
                    Inativo
                  </span>
                )}

                {user.role === null && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      approveMutation.mutate(user.id);
                    }}
                    disabled={approveMutation.isPending}
                    className="text-emerald-600 hover:bg-emerald-50"
                  >
                    <CheckCircle2 size={14} className="mr-1" />
                    Aprovar
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEditOpen(user)}
                  className="text-slate-600 hover:bg-slate-100"
                >
                  <Pencil size={14} />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleActiveMutation.mutate(user.id);
                  }}
                  disabled={toggleActiveMutation.isPending}
                  className={user.ativo ? "text-red-600 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"}
                >
                  {user.ativo ? <UserX size={14} /> : <UserCheck size={14} />}
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Nenhum usuário encontrado</h3>
            <p className="text-sm text-slate-400 mt-1">Crie um novo usuário para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AdminUsuariosPage() {
  return (
    <PermissionGuard module="admin" action="ver">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Usuários</h1>
          <p className="text-slate-500 mt-1">
            Gerencie usuários, perfis, permissões e auditoria de acesso
          </p>
        </div>

        <Tabs defaultValue="usuarios" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-1">
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="mt-6">
            <TabUsuarios />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}

// Import Clock icon
import { Clock } from "lucide-react";

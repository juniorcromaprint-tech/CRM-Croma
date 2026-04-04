// ============================================================================
// PERMISSIONS & ROLES — Croma Print ERP/CRM
// Controle de acesso por módulo e ação
// ============================================================================

export const MODULES = [
  'dashboard',
  'comercial',
  'clientes',
  'pedidos',
  'producao',
  'estoque',
  'compras',
  'financeiro',
  'fiscal',
  'instalacao',
  'qualidade',
  'relatorios',
  'admin',
] as const;

export type Module = (typeof MODULES)[number];

export const ACTIONS = [
  'ver',
  'criar',
  'editar',
  'excluir',
  'aprovar',
  'exportar',
] as const;

export type Action = (typeof ACTIONS)[number];

// ---------------------------------------------------------------------------
// ROLES
// ---------------------------------------------------------------------------

export interface RoleConfig {
  label: string;
  description: string;
  modules: Module[] | 'all' | 'all_read';
}

export const ROLES = {
  admin: {
    label: 'Administrador',
    description: 'Acesso total a todos os módulos e ações',
    modules: 'all' as const,
  },
  diretor: {
    label: 'Diretor',
    description: 'Visualização e exportação de todos os módulos, aprovações seletivas',
    modules: 'all_read' as const,
  },
  comercial: {
    label: 'Comercial',
    description: 'Gestão de leads, oportunidades e clientes',
    modules: ['comercial', 'clientes'] as Module[],
  },
  comercial_senior: {
    label: 'Comercial Sênior',
    description: 'Comercial com acesso a pedidos e aprovação de propostas',
    modules: ['comercial', 'clientes', 'pedidos'] as Module[],
  },
  financeiro: {
    label: 'Financeiro',
    description: 'Gestão financeira, contas a pagar/receber e comissões',
    modules: ['financeiro', 'clientes'] as Module[],
  },
  producao: {
    label: 'Produção',
    description: 'Gestão de ordens de produção, estoque e pedidos (leitura)',
    modules: ['producao', 'estoque', 'pedidos'] as Module[],
  },
  compras: {
    label: 'Compras',
    description: 'Gestão de compras e estoque',
    modules: ['compras', 'estoque'] as Module[],
  },
  logistica: {
    label: 'Logística',
    description: 'Gestão de instalações e acompanhamento de pedidos',
    modules: ['instalacao', 'pedidos'] as Module[],
  },
  instalador: {
    label: 'Instalador',
    description: 'Acesso ao app de campo para registrar instalações',
    modules: ['instalacao'] as Module[],
  },
} as const;

export type RoleName = keyof typeof ROLES;

// ---------------------------------------------------------------------------
// PERMISSION MATRIX
// ---------------------------------------------------------------------------

const ALL_ACTIONS: Action[] = ['ver', 'criar', 'editar', 'excluir', 'aprovar', 'exportar'];
const READ_ACTIONS: Action[] = ['ver', 'exportar'];
const CRUD_ACTIONS: Action[] = ['ver', 'criar', 'editar'];
const CRUD_FULL: Action[] = ['ver', 'criar', 'editar', 'excluir'];

/**
 * Matriz de permissões: Role → Module → Actions permitidas
 */
export const ROLE_PERMISSIONS: Record<RoleName, Partial<Record<Module, Action[]>>> = {
  admin: {
    dashboard: ALL_ACTIONS,
    comercial: ALL_ACTIONS,
    clientes: ALL_ACTIONS,
    pedidos: ALL_ACTIONS,
    producao: ALL_ACTIONS,
    estoque: ALL_ACTIONS,
    compras: ALL_ACTIONS,
    financeiro: ALL_ACTIONS,
    fiscal: ALL_ACTIONS,
    instalacao: ALL_ACTIONS,
    qualidade: ALL_ACTIONS,
    relatorios: ALL_ACTIONS,
    admin: ALL_ACTIONS,
  },
  diretor: {
    dashboard: READ_ACTIONS,
    comercial: [...READ_ACTIONS, 'aprovar'],
    clientes: READ_ACTIONS,
    pedidos: [...READ_ACTIONS, 'aprovar'],
    producao: READ_ACTIONS,
    estoque: READ_ACTIONS,
    compras: [...READ_ACTIONS, 'aprovar'],
    financeiro: [...READ_ACTIONS, 'aprovar'],
    fiscal: READ_ACTIONS,
    instalacao: READ_ACTIONS,
    qualidade: READ_ACTIONS,
    relatorios: READ_ACTIONS,
    admin: READ_ACTIONS,
  },
  comercial: {
    dashboard: ['ver'],
    comercial: CRUD_ACTIONS,
    clientes: CRUD_ACTIONS,
    pedidos: ['ver'],
  },
  comercial_senior: {
    dashboard: ['ver'],
    comercial: [...CRUD_ACTIONS, 'aprovar'],
    clientes: CRUD_FULL,
    pedidos: CRUD_ACTIONS,
    financeiro: ['ver'],
    relatorios: ['ver', 'exportar'],
  },
  financeiro: {
    dashboard: ['ver'],
    financeiro: [...CRUD_FULL, 'aprovar', 'exportar'],
    fiscal: CRUD_ACTIONS,
    clientes: ['ver'],
    pedidos: ['ver'],
    comercial: ['ver'],
    relatorios: ['ver', 'exportar'],
  },
  producao: {
    dashboard: ['ver'],
    producao: CRUD_ACTIONS,
    estoque: CRUD_ACTIONS,
    pedidos: ['ver'],
    qualidade: CRUD_ACTIONS,
  },
  compras: {
    dashboard: ['ver'],
    compras: CRUD_FULL,
    estoque: CRUD_ACTIONS,
    financeiro: ['ver'],
  },
  logistica: {
    dashboard: ['ver'],
    instalacao: CRUD_ACTIONS,
    pedidos: ['ver'],
    producao: ['ver'],
  },
  instalador: {
    dashboard: ['ver'],
    instalacao: ['ver', 'editar'],
  },
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Verifica se um role tem permissão para executar uma ação em um módulo.
 */
export function hasPermission(
  role: RoleName,
  module: Module,
  action: Action,
): boolean {
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) return false;

  const modulePerms = rolePerms[module];
  if (!modulePerms) return false;

  return modulePerms.includes(action);
}

/**
 * Retorna todos os módulos que um role pode acessar (com pelo menos 'ver').
 */
export function getAccessibleModules(role: RoleName): Module[] {
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) return [];

  return (Object.keys(rolePerms) as Module[]).filter(
    (mod) => rolePerms[mod]?.includes('ver'),
  );
}

/**
 * Retorna todas as ações permitidas para um role em um módulo.
 */
export function getModuleActions(role: RoleName, module: Module): Action[] {
  return ROLE_PERMISSIONS[role]?.[module] ?? [];
}

// ============================================================================
// NAVIGATION — Croma Print ERP/CRM
// Definição centralizada do menu lateral e navegação
// ============================================================================

export interface NavItem {
  name: string;
  path: string;
  icon: string; // nome do ícone lucide-react
  module: string; // módulo de permissão
  badgeKey?: string; // optional key for notification badge counts
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'PAINEL',
    items: [
      { name: 'Dashboard', path: '/', icon: 'LayoutDashboard', module: 'dashboard' },
    ],
  },
  {
    label: 'COMERCIAL',
    items: [
      { name: 'Leads', path: '/leads', icon: 'UserPlus', module: 'comercial' },
      { name: 'Pipeline', path: '/pipeline', icon: 'Kanban', module: 'comercial' },
      { name: 'Propostas', path: '/propostas', icon: 'FileText', module: 'comercial' },
      { name: 'Clientes', path: '/clientes', icon: 'Building2', module: 'clientes' },
      { name: 'Orçamentos', path: '/orcamentos', icon: 'Calculator', module: 'comercial', badgeKey: 'orcamentos_pendentes' },
      { name: 'Templates', path: '/orcamentos/templates', icon: 'BookOpen', module: 'comercial' },
    ],
  },
  {
    label: 'OPERACIONAL',
    items: [
      { name: 'Pedidos', path: '/pedidos', icon: 'ClipboardList', module: 'pedidos' },
      { name: 'Produção', path: '/producao', icon: 'Factory', module: 'producao' },
      { name: 'Instalações', path: '/instalacoes', icon: 'Wrench', module: 'instalacao' },
    ],
  },
  {
    label: 'SUPRIMENTOS',
    items: [
      { name: 'Estoque', path: '/estoque', icon: 'Warehouse', module: 'estoque' },
      { name: 'Compras', path: '/compras', icon: 'ShoppingCart', module: 'compras' },
      { name: 'Produtos', path: '/produtos', icon: 'Package', module: 'producao' },
    ],
  },
  {
    label: 'FINANCEIRO',
    items: [
      { name: 'Financeiro', path: '/financeiro', icon: 'Wallet', module: 'financeiro' },
      { name: 'DRE', path: '/dre', icon: 'BarChart3', module: 'financeiro' },
      { name: 'Comissões', path: '/comissoes', icon: 'BadgeDollarSign', module: 'financeiro' },
    ],
  },
  {
    label: 'QUALIDADE',
    items: [
      { name: 'Ocorrências', path: '/ocorrencias', icon: 'AlertTriangle', module: 'qualidade' },
    ],
  },
  {
    label: 'FISCAL',
    items: [
      { name: 'NF-e Dashboard', path: '/fiscal', icon: 'Receipt', module: 'fiscal' },
      { name: 'Documentos', path: '/fiscal/documentos', icon: 'FileCheck', module: 'fiscal' },
      { name: 'Fila de Emissão', path: '/fiscal/fila', icon: 'List', module: 'fiscal' },
      { name: 'Configuração Fiscal', path: '/fiscal/configuracao', icon: 'SlidersHorizontal', module: 'fiscal' },
      { name: 'Certificado Digital', path: '/fiscal/certificado', icon: 'Key', module: 'fiscal' },
      { name: 'Auditoria Fiscal', path: '/fiscal/auditoria', icon: 'BookOpen', module: 'fiscal' },
    ],
  },
  {
    label: 'ADMINISTRAÇÃO',
    items: [
      { name: 'Usuários', path: '/admin/usuarios', icon: 'Users', module: 'admin' },
      { name: 'Configurações', path: '/admin/config', icon: 'Settings', module: 'admin' },
      { name: 'Auditoria', path: '/admin/auditoria', icon: 'Shield', module: 'admin' },
      { name: 'Precificação', path: '/admin/precificacao', icon: 'SlidersHorizontal', module: 'admin' },
      { name: 'Produtos', path: '/admin/produtos', icon: 'Package', module: 'admin' },
    ],
  },
];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Retorna todos os items de navegação em uma lista plana.
 */
export function getAllNavItems(): NavItem[] {
  return NAV_GROUPS.flatMap((group) => group.items);
}

/**
 * Filtra os grupos de navegação com base nos módulos acessíveis do usuário.
 * Se accessibleModules for null/undefined, retorna todos (admin).
 */
export function filterNavByModules(
  accessibleModules?: string[] | null,
): NavGroup[] {
  if (!accessibleModules) return NAV_GROUPS;

  // Dashboard é sempre visível
  const allowed = new Set([...accessibleModules, 'dashboard']);

  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowed.has(item.module)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Encontra o NavItem correspondente a um path.
 */
export function findNavItemByPath(path: string): NavItem | undefined {
  return getAllNavItems().find((item) => item.path === path);
}

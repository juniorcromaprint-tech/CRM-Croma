import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/shared/constants/permissions";
import {
  NAV_GROUPS,
  filterNavByModules,
  type NavItem,
  type NavGroup,
} from "@/shared/constants/navigation";
import CommandPalette from "@/shared/components/CommandPalette";
import Breadcrumbs from "@/shared/components/Breadcrumbs";
import AvisosBanner from "@/shared/components/AvisosBanner";
import { NotificationBadge } from "@/components/NotificationBadge";
import AIAlertsBadge from '@/domains/ai/components/AIAlertsBadge';
import EstoqueAlertaBadge from '@/domains/admin/components/EstoqueAlertaBadge';
import { useEmpresaPrincipal } from "@/shared/hooks/useEmpresaPrincipal";
import ChatERP from "@/shared/components/ChatERP";

// ---------------------------------------------------------------------------
// Lucide Icons — mapped by string name from navigation.ts
// ---------------------------------------------------------------------------
import {
  LayoutDashboard, UserPlus, Kanban, FileText, Building2,
  ClipboardList, Factory, Wrench, Warehouse, ShoppingCart,
  Package, Wallet, BarChart3, BadgeDollarSign, AlertTriangle,
  Users, Settings, Shield, Menu, Receipt, FileCheck, List,
  SlidersHorizontal, Key, BookOpen, LogOut, Calculator, Cog, Database,
  PanelLeftClose, PanelLeftOpen, Search, Truck,
  Calendar, Megaphone, Package2, ArrowLeftRight, Building, Layers, BarChart2, GanttChart,
  TrendingUp, FileInput, Bot, Clock, RefreshCw,
  ChevronDown, ChevronRight, Crown, Brain, Gauge, Zap, Webhook,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, UserPlus, Kanban, FileText, Building2,
  ClipboardList, Factory, Wrench, Warehouse, ShoppingCart,
  Package, Wallet, BarChart3, BadgeDollarSign, AlertTriangle,
  Users, Settings, Shield, Receipt, FileCheck, List,
  SlidersHorizontal, Key, BookOpen, Calculator, Cog, Database, Truck,
  Calendar, Megaphone, Package2, ArrowLeftRight, Building, Layers, BarChart2, Gantt: GanttChart,
  TrendingUp, FileInput, Bot, Clock, RefreshCw, Crown, Brain, Gauge, Zap, Webhook,
};

// ---------------------------------------------------------------------------
// Logo Components
// ---------------------------------------------------------------------------

export const CromaLogo = ({ className = "" }: { className?: string }) => (
  <img
    src="/logo_croma.png"
    alt="Cromaprint Logo"
    className={`h-10 object-contain ${className}`}
    onError={(e) => {
      e.currentTarget.style.display = "none";
      const next = e.currentTarget.nextElementSibling as HTMLElement | null;
      if (next) next.classList.remove("hidden");
    }}
  />
);

export const CromaLogoFallback = ({ className = "", name = "Cromaprint" }: { className?: string; name?: string }) => (
  <div className={`hidden flex items-center gap-1.5 ${className}`}>
    <div className="flex -space-x-1.5">
      <div className="w-4 h-4 rounded-full bg-cyan-500 mix-blend-multiply opacity-90" />
      <div className="w-4 h-4 rounded-full bg-fuchsia-500 mix-blend-multiply opacity-90" />
      <div className="w-4 h-4 rounded-full bg-yellow-400 mix-blend-multiply opacity-90" />
    </div>
    <span className="font-black text-slate-800 tracking-tight text-xl">{name}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? LayoutDashboard;
}

function isActivePath(currentPath: string, itemPath: string): boolean {
  if (itemPath === "/") return currentPath === "/";
  return currentPath === itemPath || currentPath.startsWith(itemPath + "/");
}

// ---------------------------------------------------------------------------
// Nav Link (full mode)
// ---------------------------------------------------------------------------

interface SidebarNavLinkProps {
  item: NavItem;
  isActive: boolean;
}

function SidebarNavLink({ item, isActive }: SidebarNavLinkProps) {
  const Icon = resolveIcon(item.icon);
  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-200 ${
        isActive
          ? "bg-blue-600 text-white shadow-md"
          : "text-slate-600 hover:bg-blue-50 hover:text-blue-600"
      }`}
    >
      <span className="relative">
        <Icon size={20} className={isActive ? "text-white" : "text-slate-400"} />
        {item.path === '/orcamentos' && <NotificationBadge />}
      </span>
      <span className="font-medium text-sm">{item.name}</span>
      {item.path === '/estoque' && <EstoqueAlertaBadge />}
    </Link>
  );
}

// Nav Link (collapsed/icon-only mode)
function SidebarNavLinkCollapsed({ item, isActive }: SidebarNavLinkProps) {
  const Icon = resolveIcon(item.icon);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={item.path}
          className={`relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-200 mx-auto ${
            isActive
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
          }`}
        >
          <Icon size={20} />
          {item.path === '/estoque' && <EstoqueAlertaBadge collapsed />}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="ml-1">
        {item.name}
      </TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Nav Groups (full or collapsed) — accordion behavior
// ---------------------------------------------------------------------------

const SIDEBAR_EXPANDED_KEY = "croma-sidebar-expanded-group";
const ALWAYS_VISIBLE_GROUP = "PAINEL";

/** Find which group label contains a given path */
function findGroupForPath(groups: NavGroup[], path: string): string | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (isActivePath(path, item.path)) return group.label;
    }
  }
  return null;
}

interface SidebarNavGroupsProps {
  groups: NavGroup[];
  currentPath: string;
  collapsed?: boolean;
  expandedGroup: string | null;
  onToggleGroup: (label: string) => void;
}

function SidebarNavGroups({
  groups,
  currentPath,
  collapsed = false,
  expandedGroup,
  onToggleGroup,
}: SidebarNavGroupsProps) {
  return (
    <>
      {groups.map((group, groupIdx) => {
        const isAlwaysVisible = group.label === ALWAYS_VISIBLE_GROUP;
        const isExpanded = isAlwaysVisible || expandedGroup === group.label;

        // In collapsed (icon-only) mode, render all items flat — no accordion
        if (collapsed) {
          return (
            <div key={group.label}>
              {groupIdx > 0 && (
                <div className="border-t border-slate-100 my-2 mx-2" />
              )}
              <div className="space-y-1 mt-1">
                {group.items.map((item) => (
                  <SidebarNavLinkCollapsed
                    key={item.path}
                    item={item}
                    isActive={isActivePath(currentPath, item.path)}
                  />
                ))}
              </div>
            </div>
          );
        }

        return (
          <div key={group.label}>
            {/* Group header — clickable for non-PAINEL groups */}
            <div className={groupIdx === 0 ? "pb-1" : "pt-4 pb-1"}>
              {isAlwaysVisible ? (
                <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {group.label}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggleGroup(group.label)}
                  className="flex items-center justify-between w-full px-4 py-0.5 group cursor-pointer"
                >
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">
                    {group.label}
                  </p>
                  {isExpanded ? (
                    <ChevronDown size={12} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                  ) : (
                    <ChevronRight size={12} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                  )}
                </button>
              )}
            </div>

            {/* Items container with CSS transition */}
            <div
              className="overflow-hidden transition-all duration-200 ease-in-out"
              style={{
                maxHeight: isExpanded ? `${group.items.length * 44}px` : "0px",
                opacity: isExpanded ? 1 : 0,
              }}
            >
              <div className="space-y-1">
                {group.items.map((item) => (
                  <SidebarNavLink
                    key={item.path}
                    item={item}
                    isActive={isActivePath(currentPath, item.path)}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// User Section
// ---------------------------------------------------------------------------

interface UserSectionProps {
  collapsed?: boolean;
}

function UserSection({ collapsed = false }: UserSectionProps) {
  const { profile, signOut } = useAuth();

  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Usuário"
    : "Demo";

  const roleLabel = profile?.role
    ? (ROLES[profile.role as keyof typeof ROLES]?.label ?? profile.role)
    : "Modo Demo";

  const initials = displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  const handleSignOut = async () => {
    await signOut();
  };

  if (collapsed) {
    return (
      <div className="pt-3 border-t border-slate-100 space-y-1 flex flex-col items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center cursor-default">
              <span className="text-blue-600 font-bold text-xs">{initials}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-semibold">{displayName}</p>
            <p className="text-xs text-slate-400">{roleLabel}</p>
          </TooltipContent>
        </Tooltip>
        {profile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair da conta</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className="pt-3 border-t border-slate-100 space-y-2">
      <div className="flex items-center gap-3 px-2 py-1">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <span className="text-blue-600 font-bold text-xs">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
          <p className="text-xs text-slate-500 truncate">{roleLabel}</p>
        </div>
      </div>
      <Link
        to="/settings"
        className="flex items-center gap-3 px-4 py-2 w-full rounded-2xl transition-colors text-slate-600 hover:bg-slate-100"
      >
        <Settings size={16} className="text-slate-400" />
        <span className="font-medium text-sm">Configurações</span>
      </Link>
      {profile && (
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-2 w-full rounded-2xl transition-colors text-slate-500 hover:bg-red-50 hover:text-red-600 text-sm font-medium"
        >
          <LogOut size={16} className="text-slate-400" />
          Sair da conta
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Layout
// ---------------------------------------------------------------------------

export default function Layout() {
  const location = useLocation();
  const { accessibleModules } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { data: empresa } = useEmpresaPrincipal();
  const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Cromaprint';

  const navGroups = useMemo(
    () => filterNavByModules(accessibleModules),
    [accessibleModules],
  );

  // --- Accordion sidebar state ---
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SIDEBAR_EXPANDED_KEY) || null;
    } catch {
      return null;
    }
  });

  // Auto-expand the group containing the current active route
  useEffect(() => {
    const activeGroup = findGroupForPath(navGroups, location.pathname);
    if (activeGroup && activeGroup !== ALWAYS_VISIBLE_GROUP) {
      setExpandedGroup(activeGroup);
      try { localStorage.setItem(SIDEBAR_EXPANDED_KEY, activeGroup); } catch { /* noop */ }
    }
  }, [location.pathname, navGroups]);

  const handleToggleGroup = useCallback((label: string) => {
    setExpandedGroup((prev) => {
      const next = prev === label ? null : label;
      try { localStorage.setItem(SIDEBAR_EXPANDED_KEY, next || ""); } catch { /* noop */ }
      return next;
    });
  }, []);

  const mobileNavItems = useMemo(() => {
    const dashboard = NAV_GROUPS[0]?.items[0];
    const comercialGroup = navGroups.find((g) => g.label === "COMERCIAL");
    const comercialItems = comercialGroup?.items.slice(0, 3) ?? [];
    return dashboard ? [dashboard, ...comercialItems] : comercialItems;
  }, [navGroups]);

  // Global keyboard shortcut for Command Palette: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sidebarWidth = collapsed ? "w-16" : "w-64";

  return (
    <div className="h-[100dvh] print:h-auto print:min-h-screen overflow-hidden print:overflow-visible bg-slate-50 flex flex-col md:flex-row print:block font-sans">
      {/* CommandPalette (global, rendered once) */}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      {/* --------------------------------------------------------------- */}
      {/* Desktop Sidebar                                                   */}
      {/* --------------------------------------------------------------- */}
      <aside
        className={`hidden md:flex flex-col ${sidebarWidth} bg-white border-r border-slate-200 p-3 print:hidden z-20 shrink-0 transition-all duration-300`}
      >
        {/* Brand + collapse toggle */}
        <div className="flex items-center justify-between px-1 py-3 mb-3 min-h-[60px]">
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <CromaLogo />
              <CromaLogoFallback name={nomeEmpresa} />
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed((c) => !c)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
                aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
              >
                {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expandir" : "Recolher"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Search / Command button */}
        {!collapsed ? (
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-sm hover:bg-white hover:border-blue-300 hover:text-slate-600 transition-colors mb-3"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCmdOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors mx-auto mb-2"
              >
                <Search size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Buscar (⌘K)</TooltipContent>
          </Tooltip>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto pr-1 -mr-1 scrollbar-thin">
          <SidebarNavGroups
            groups={navGroups}
            currentPath={location.pathname}
            collapsed={collapsed}
            expandedGroup={expandedGroup}
            onToggleGroup={handleToggleGroup}
          />
        </nav>

        {/* User Info + Settings + Logout */}
        <div className="mt-auto pt-4">
          <UserSection collapsed={collapsed} />
        </div>
      </aside>

      {/* --------------------------------------------------------------- */}
      {/* Mobile Header                                                     */}
      {/* --------------------------------------------------------------- */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 print:hidden">
        <div>
          <CromaLogo className="h-8" />
          <CromaLogoFallback name={nomeEmpresa} />
        </div>
        <div className="flex items-center gap-2">
          <AIAlertsBadge onClick={() => window.location.href = '/dashboard'} />
          <button
            onClick={() => setCmdOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Buscar"
          >
            <Search size={20} />
          </button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-600">
                <Menu size={24} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-4 flex flex-col">
              <nav className="flex flex-col mt-8 flex-1 overflow-y-auto">
                <SidebarNavGroups
                  groups={navGroups}
                  currentPath={location.pathname}
                  expandedGroup={expandedGroup}
                  onToggleGroup={handleToggleGroup}
                />
              </nav>
              <div className="mt-auto pt-4">
                <UserSection />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* --------------------------------------------------------------- */}
      {/* Main Content                                                      */}
      {/* --------------------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto print:overflow-visible p-4 md:p-8 pb-24 md:pb-8 print:p-0 relative print:block print:h-auto">
        <div className="max-w-6xl mx-auto print:max-w-none h-full print:h-auto print:block">
          <Breadcrumbs />
          <AvisosBanner />
          <Outlet />
        </div>
      </main>

      {/* --------------------------------------------------------------- */}
      {/* Chat ERP — Floating AI Assistant                                  */}
      {/* --------------------------------------------------------------- */}
      <ChatERP />

      {/* --------------------------------------------------------------- */}
      {/* Mobile Bottom Nav                                                 */}
      {/* --------------------------------------------------------------- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 pb-safe z-20 print:hidden">
        {mobileNavItems.map((item) => {
          const Icon = resolveIcon(item.icon);
          const isActive = isActivePath(location.pathname, item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center p-2 rounded-xl min-w-[4rem] ${
                isActive ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <Icon size={24} className="mb-1" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
        <Link
          to="/settings"
          className={`flex flex-col items-center p-2 rounded-xl min-w-[4rem] ${
            location.pathname === "/settings" ? "text-blue-600" : "text-slate-400"
          }`}
        >
          <Settings size={24} className="mb-1" />
          <span className="text-xs font-medium">Ajustes</span>
        </Link>
      </nav>
    </div>
  );
}

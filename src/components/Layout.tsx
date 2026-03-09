import React, { useMemo } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  NAV_GROUPS,
  filterNavByModules,
  type NavItem,
  type NavGroup,
} from "@/shared/constants/navigation";

// ---------------------------------------------------------------------------
// Lucide Icons — mapped by string name from navigation.ts
// ---------------------------------------------------------------------------
import {
  LayoutDashboard,
  UserPlus,
  Kanban,
  FileText,
  Building2,
  ClipboardList,
  Factory,
  Wrench,
  Warehouse,
  ShoppingCart,
  Package,
  Wallet,
  BarChart3,
  BadgeDollarSign,
  AlertTriangle,
  Users,
  Settings,
  Shield,
  Menu,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  UserPlus,
  Kanban,
  FileText,
  Building2,
  ClipboardList,
  Factory,
  Wrench,
  Warehouse,
  ShoppingCart,
  Package,
  Wallet,
  BarChart3,
  BadgeDollarSign,
  AlertTriangle,
  Users,
  Settings,
  Shield,
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
      e.currentTarget.nextElementSibling?.classList.remove("hidden");
    }}
  />
);

export const CromaLogoFallback = ({ className = "" }: { className?: string }) => (
  <div className={`hidden flex items-center gap-1.5 ${className}`}>
    <div className="flex -space-x-1.5">
      <div className="w-4 h-4 rounded-full bg-cyan-500 mix-blend-multiply opacity-90" />
      <div className="w-4 h-4 rounded-full bg-fuchsia-500 mix-blend-multiply opacity-90" />
      <div className="w-4 h-4 rounded-full bg-yellow-400 mix-blend-multiply opacity-90" />
    </div>
    <span className="font-black text-slate-800 tracking-tight text-xl">
      Cromaprint
    </span>
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
// Sub-components
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
      <Icon
        size={20}
        className={isActive ? "text-white" : "text-slate-400"}
      />
      <span className="font-medium text-sm">{item.name}</span>
    </Link>
  );
}

interface SidebarNavGroupsProps {
  groups: NavGroup[];
  currentPath: string;
}

function SidebarNavGroups({ groups, currentPath }: SidebarNavGroupsProps) {
  return (
    <>
      {groups.map((group, groupIdx) => (
        <div key={group.label}>
          {/* Group label separator */}
          <div className={groupIdx === 0 ? "pb-1" : "pt-4 pb-1"}>
            <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {group.label}
            </p>
          </div>

          {/* Group items */}
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
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function Layout() {
  const location = useLocation();
  const { profile } = useAuth();

  // Demo mode: pass null to show all modules; in production, pass user modules
  const navGroups = useMemo(() => filterNavByModules(null), []);

  // Mobile bottom nav: Dashboard + first 3 items from COMERCIAL group
  const mobileNavItems = useMemo(() => {
    const dashboard = NAV_GROUPS[0]?.items[0];
    const comercialGroup = NAV_GROUPS.find((g) => g.label === "COMERCIAL");
    const comercialItems = comercialGroup?.items.slice(0, 3) ?? [];
    return dashboard ? [dashboard, ...comercialItems] : comercialItems;
  }, []);

  return (
    <div className="h-[100dvh] print:h-auto print:min-h-screen overflow-hidden print:overflow-visible bg-slate-50 flex flex-col md:flex-row print:block font-sans">
      {/* ----------------------------------------------------------------- */}
      {/* Desktop Sidebar                                                    */}
      {/* ----------------------------------------------------------------- */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-4 print:hidden z-20 shrink-0">
        {/* Brand */}
        <div className="px-2 py-4 mb-4">
          <CromaLogo />
          <CromaLogoFallback />
          <p className="text-xs text-slate-500 mt-2 ml-1">
            Gestão Empresarial
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto pr-1 -mr-1 scrollbar-thin">
          <SidebarNavGroups groups={navGroups} currentPath={location.pathname} />
        </nav>

        {/* Settings — always at bottom */}
        <div className="mt-auto pt-4 border-t border-slate-100">
          <Link
            to="/settings"
            className={`flex items-center gap-3 px-4 py-2.5 w-full rounded-2xl transition-colors ${
              location.pathname === "/settings"
                ? "bg-blue-50 text-blue-600"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Settings size={20} />
            <span className="font-medium text-sm">Configurações</span>
          </Link>
        </div>
      </aside>

      {/* ----------------------------------------------------------------- */}
      {/* Mobile Header                                                      */}
      {/* ----------------------------------------------------------------- */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-20 print:hidden">
        <div>
          <CromaLogo className="h-8" />
          <CromaLogoFallback />
        </div>
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
              />
            </nav>
            <div className="mt-auto pt-4 border-t border-slate-100">
              <Link
                to="/settings"
                className={`flex items-center gap-3 px-4 py-2.5 w-full rounded-2xl transition-colors ${
                  location.pathname === "/settings"
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Settings size={20} />
                <span className="font-medium text-sm">Configurações</span>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Main Content                                                       */}
      {/* ----------------------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto print:overflow-visible p-4 md:p-8 pb-24 md:pb-8 print:p-0 relative print:block print:h-auto">
        <div className="max-w-6xl mx-auto print:max-w-none h-full print:h-auto print:block">
          <Outlet />
        </div>
      </main>

      {/* ----------------------------------------------------------------- */}
      {/* Mobile Bottom Nav                                                  */}
      {/* ----------------------------------------------------------------- */}
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
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
        <Link
          to="/settings"
          className={`flex flex-col items-center p-2 rounded-xl min-w-[4rem] ${
            location.pathname === "/settings"
              ? "text-blue-600"
              : "text-slate-400"
          }`}
        >
          <Settings size={24} className="mb-1" />
          <span className="text-[10px] font-medium">Ajustes</span>
        </Link>
      </nav>
    </div>
  );
}

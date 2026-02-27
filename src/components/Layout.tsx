import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Home, ClipboardList, Store, Users, Settings as SettingsIcon, Menu, ShieldCheck, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";

export const CromaLogo = ({ className = "" }: { className?: string }) => (
  <img 
    src="/logo_croma.png" 
    alt="Cromaprint Logo" 
    className={`h-10 object-contain ${className}`}
    onError={(e) => {
      e.currentTarget.style.display = 'none';
      e.currentTarget.nextElementSibling?.classList.remove('hidden');
    }}
  />
);

export const CromaLogoFallback = ({ className = "" }: { className?: string }) => (
  <div className={`hidden flex items-center gap-1.5 ${className}`}>
    <div className="flex -space-x-1.5">
      <div className="w-4 h-4 rounded-full bg-cyan-500 mix-blend-multiply opacity-90"></div>
      <div className="w-4 h-4 rounded-full bg-fuchsia-500 mix-blend-multiply opacity-90"></div>
      <div className="w-4 h-4 rounded-full bg-yellow-400 mix-blend-multiply opacity-90"></div>
    </div>
    <span className="font-black text-slate-800 tracking-tight text-xl">Cromaprint</span>
  </div>
);

export default function Layout() {
  const location = useLocation();
  const { profile } = useAuth();

  const navItems = [
    { name: "Início", path: "/", icon: Home },
    { name: "Instalações", path: "/jobs", icon: ClipboardList },
    { name: "Lojas", path: "/stores", icon: Store },
    { name: "Mapa", path: "/map", icon: MapIcon },
    { name: "Clientes", path: "/clients", icon: Users },
  ];

  if (profile?.role === 'admin') {
    navItems.push({ name: "Equipe", path: "/team", icon: ShieldCheck });
  }

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
        return (
          <Link
            key={item.name}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
              isActive
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 hover:bg-blue-50 hover:text-blue-600"
            }`}
          >
            <Icon size={20} className={isActive ? "text-white" : "text-slate-400"} />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="h-[100dvh] print:h-auto print:min-h-screen overflow-hidden print:overflow-visible bg-slate-50 flex flex-col md:flex-row print:block font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-4 print:hidden z-20">
        <div className="px-2 py-4 mb-6">
          <CromaLogo />
          <CromaLogoFallback />
          <p className="text-xs text-slate-500 mt-2 ml-1">Gestão de Instalações</p>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto pr-2">
          <NavLinks />
        </nav>
        <div className="mt-auto pt-4 border-t border-slate-100">
          <Link 
            to="/settings" 
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-2xl transition-colors ${
              location.pathname === "/settings" 
                ? "bg-blue-50 text-blue-600" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <SettingsIcon size={20} />
            <span className="font-medium">Configurações</span>
          </Link>
        </div>
      </aside>

      {/* Mobile Header */}
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
          <SheetContent side="right" className="w-64 p-4 flex flex-col">
            <nav className="flex flex-col space-y-2 mt-8 flex-1">
              <NavLinks />
            </nav>
            <div className="mt-auto pt-4 border-t border-slate-100">
              <Link 
                to="/settings" 
                className={`flex items-center gap-3 px-4 py-3 w-full rounded-2xl transition-colors ${
                  location.pathname === "/settings" 
                    ? "bg-blue-50 text-blue-600" 
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <SettingsIcon size={20} />
                <span className="font-medium">Configurações</span>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto print:overflow-visible p-4 md:p-8 pb-24 md:pb-8 print:p-0 relative print:block print:h-auto">
        <div className="max-w-5xl mx-auto print:max-w-none h-full print:h-auto print:block">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 pb-safe z-20 print:hidden">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.name}
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
            location.pathname === "/settings" ? "text-blue-600" : "text-slate-400"
          }`}
        >
          <SettingsIcon size={24} className="mb-1" />
          <span className="text-[10px] font-medium">Ajustes</span>
        </Link>
      </nav>
    </div>
  );
}
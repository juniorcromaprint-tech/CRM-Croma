import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Home, ClipboardList, Store, Users, Settings, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { name: "Início", path: "/", icon: Home },
  { name: "Instalações", path: "/jobs", icon: ClipboardList },
  { name: "Lojas", path: "/stores", icon: Store },
  { name: "Clientes", path: "/clients", icon: Users },
];

export default function Layout() {
  const location = useLocation();

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
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
            }`}
          >
            <Icon size={20} className={isActive ? "text-white" : "text-gray-500"} />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-4 print:hidden">
        <div className="flex items-center gap-3 px-2 py-4 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-xl">G</span>
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-800 leading-tight">GráficaApp</h1>
            <p className="text-xs text-slate-500">Gestão de Instalações</p>
          </div>
        </div>
        <nav className="flex-1 space-y-2">
          <NavLinks />
        </nav>
        <div className="mt-auto pt-4 border-t border-slate-100">
          <button className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-gray-600 hover:bg-slate-100 transition-colors">
            <Settings size={20} />
            <span className="font-medium">Configurações</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-10 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">G</span>
          </div>
          <h1 className="font-bold text-slate-800">GráficaApp</h1>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-600">
              <Menu size={24} />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 p-4">
            <nav className="flex flex-col space-y-2 mt-8">
              <NavLinks />
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav (Quick Access for Field Team) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 pb-safe z-10 print:hidden">
        {navItems.slice(0, 3).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center p-2 rounded-xl min-w-[4rem] ${
                isActive ? "text-indigo-600" : "text-slate-500"
              }`}
            >
              <Icon size={24} className="mb-1" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
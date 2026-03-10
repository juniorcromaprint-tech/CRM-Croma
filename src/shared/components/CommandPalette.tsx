import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard, UserPlus, Kanban, FileText, Calculator,
  Building2, ClipboardList, Factory, Wrench, Warehouse,
  ShoppingCart, Package, Wallet, BarChart3, BadgeDollarSign,
  AlertTriangle, Users, Settings, Shield, Receipt,
} from "lucide-react";

interface CommandEntry {
  label: string;
  path: string;
  group: string;
  icon: React.ReactNode;
  shortcut?: string;
}

const COMMANDS: CommandEntry[] = [
  // Painel
  { label: "Dashboard", path: "/", group: "Painel", icon: <LayoutDashboard size={16} />, shortcut: "D" },
  // Comercial
  { label: "Leads", path: "/leads", group: "Comercial", icon: <UserPlus size={16} /> },
  { label: "Pipeline", path: "/pipeline", group: "Comercial", icon: <Kanban size={16} /> },
  { label: "Propostas", path: "/propostas", group: "Comercial", icon: <FileText size={16} /> },
  { label: "Orçamentos", path: "/orcamentos", group: "Comercial", icon: <Calculator size={16} /> },
  { label: "Clientes", path: "/clientes", group: "Comercial", icon: <Building2 size={16} /> },
  // Operacional
  { label: "Pedidos", path: "/pedidos", group: "Operacional", icon: <ClipboardList size={16} /> },
  { label: "Produção", path: "/producao", group: "Operacional", icon: <Factory size={16} /> },
  { label: "Instalações", path: "/instalacoes", group: "Operacional", icon: <Wrench size={16} /> },
  // Suprimentos
  { label: "Estoque", path: "/estoque", group: "Suprimentos", icon: <Warehouse size={16} /> },
  { label: "Compras", path: "/compras", group: "Suprimentos", icon: <ShoppingCart size={16} /> },
  { label: "Produtos", path: "/produtos", group: "Suprimentos", icon: <Package size={16} /> },
  // Financeiro
  { label: "Financeiro", path: "/financeiro", group: "Financeiro", icon: <Wallet size={16} /> },
  { label: "DRE", path: "/dre", group: "Financeiro", icon: <BarChart3 size={16} /> },
  { label: "Comissões", path: "/comissoes", group: "Financeiro", icon: <BadgeDollarSign size={16} /> },
  // Qualidade & Admin
  { label: "Ocorrências", path: "/ocorrencias", group: "Qualidade", icon: <AlertTriangle size={16} /> },
  { label: "Usuários", path: "/admin/usuarios", group: "Admin", icon: <Users size={16} /> },
  { label: "Precificação", path: "/admin/precificacao", group: "Admin", icon: <Settings size={16} /> },
  { label: "Auditoria", path: "/admin/auditoria", group: "Admin", icon: <Shield size={16} /> },
  { label: "Fiscal", path: "/fiscal", group: "Fiscal", icon: <Receipt size={16} /> },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  const handleSelect = useCallback((path: string) => {
    navigate(path);
    onOpenChange(false);
  }, [navigate, onOpenChange]);

  // Group commands
  const groups = Array.from(new Set(COMMANDS.map((c) => c.group)));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar módulo, cliente, pedido..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {groups.map((group, idx) => (
          <React.Fragment key={group}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {COMMANDS.filter((c) => c.group === group).map((cmd) => (
                <CommandItem
                  key={cmd.path}
                  onSelect={() => handleSelect(cmd.path)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <span className="text-slate-400">{cmd.icon}</span>
                  {cmd.label}
                  {cmd.shortcut && (
                    <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

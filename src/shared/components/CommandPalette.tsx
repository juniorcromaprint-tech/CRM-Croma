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
  type LucideProps,
  LayoutDashboard, UserPlus, Kanban, FileText, Calculator,
  Building2, ClipboardList, Factory, Wrench, Warehouse,
  ShoppingCart, Package, Wallet, BarChart3, BadgeDollarSign,
  AlertTriangle, Users, Settings, Shield, Receipt, BookOpen,
} from "lucide-react";

// Use component references (not JSX) at module level to avoid
// "_jsxDEV is not a function" crash from module-init-order issues.
interface CommandEntry {
  label: string;
  path: string;
  group: string;
  Icon: React.ComponentType<LucideProps>;
  shortcut?: string;
}

const COMMANDS: CommandEntry[] = [
  // Painel
  { label: "Dashboard", path: "/", group: "Painel", Icon: LayoutDashboard, shortcut: "D" },
  // Comercial
  { label: "Leads", path: "/leads", group: "Comercial", Icon: UserPlus },
  { label: "Pipeline", path: "/pipeline", group: "Comercial", Icon: Kanban },
  { label: "Propostas", path: "/propostas", group: "Comercial", Icon: FileText },
  { label: "Orçamentos", path: "/orcamentos", group: "Comercial", Icon: Calculator },
  { label: "Novo Orçamento", path: "/orcamentos/novo", group: "Comercial", Icon: Calculator },
  { label: "Templates", path: "/orcamentos/templates", group: "Comercial", Icon: BookOpen },
  { label: "Clientes", path: "/clientes", group: "Comercial", Icon: Building2 },
  // Operacional
  { label: "Pedidos", path: "/pedidos", group: "Operacional", Icon: ClipboardList },
  { label: "Produção", path: "/producao", group: "Operacional", Icon: Factory },
  { label: "Instalações", path: "/instalacoes", group: "Operacional", Icon: Wrench },
  // Suprimentos
  { label: "Estoque", path: "/estoque", group: "Suprimentos", Icon: Warehouse },
  { label: "Compras", path: "/compras", group: "Suprimentos", Icon: ShoppingCart },
  { label: "Produtos", path: "/produtos", group: "Suprimentos", Icon: Package },
  // Financeiro
  { label: "Financeiro", path: "/financeiro", group: "Financeiro", Icon: Wallet },
  { label: "DRE", path: "/dre", group: "Financeiro", Icon: BarChart3 },
  { label: "Comissões", path: "/comissoes", group: "Financeiro", Icon: BadgeDollarSign },
  // Qualidade & Admin
  { label: "Ocorrências", path: "/ocorrencias", group: "Qualidade", Icon: AlertTriangle },
  { label: "Usuários", path: "/admin/usuarios", group: "Admin", Icon: Users },
  { label: "Precificação", path: "/admin/precificacao", group: "Admin", Icon: Settings },
  { label: "Auditoria", path: "/admin/auditoria", group: "Admin", Icon: Shield },
  { label: "Fiscal", path: "/fiscal", group: "Fiscal", Icon: Receipt },
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
                  <span className="text-slate-400"><cmd.Icon size={16} /></span>
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

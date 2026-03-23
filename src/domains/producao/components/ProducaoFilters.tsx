import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRODUCAO_STATUS,
  PRODUCAO_STATUS_CONFIG,
} from "@/shared/constants/status";

interface ProducaoFiltersProps {
  viewMode: "kanban" | "lista";
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  prioridadeFilter: string;
  onPrioridadeFilterChange: (value: string) => void;
}

export default function ProducaoFilters({
  viewMode,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  prioridadeFilter,
  onPrioridadeFilterChange,
}: ProducaoFiltersProps) {
  if (viewMode === "kanban") {
    return (
      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <Input
          placeholder="Buscar por OP ou cliente..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 rounded-xl border-slate-200 bg-white h-11 shadow-sm"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <Input
          placeholder="Buscar por OP, cliente ou item..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 rounded-xl border-slate-200 bg-white h-11 shadow-sm"
        />
      </div>

      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full md:w-52 rounded-xl border-slate-200 bg-white h-11 shadow-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          {Object.entries(PRODUCAO_STATUS).map(([, value]) => (
            <SelectItem key={value} value={value}>
              {PRODUCAO_STATUS_CONFIG[value].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={prioridadeFilter} onValueChange={onPrioridadeFilterChange}>
        <SelectTrigger className="w-full md:w-44 rounded-xl border-slate-200 bg-white h-11 shadow-sm">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas prioridades</SelectItem>
          <SelectItem value="0">Normal</SelectItem>
          <SelectItem value="1">Alta</SelectItem>
          <SelectItem value="2">Urgente</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

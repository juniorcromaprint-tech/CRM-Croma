import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ClienteComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface ClienteOption {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
}

export default function ClienteCombobox({
  value,
  onValueChange,
  placeholder = "Selecionar cliente",
  disabled = false,
  className,
}: ClienteComboboxProps) {
  const [open, setOpen] = useState(false);

  const { data: clientes = [] } = useQuery<ClienteOption[]>({
    queryKey: ["clientes-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social, nome_fantasia")
        .eq("ativo", true)
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as ClienteOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const selected = clientes.find((c) => c.id === value);
  const displayName = selected
    ? selected.nome_fantasia || selected.razao_social
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between rounded-xl font-normal text-left",
            !displayName && "text-slate-400",
            className
          )}
        >
          <span className="truncate">{displayName ?? placeholder}</span>
          <ChevronsUpDown size={14} className="ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {clientes.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.nome_fantasia ?? ""} ${c.razao_social}`}
                  onSelect={() => {
                    onValueChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    size={14}
                    className={cn("mr-2 shrink-0", value === c.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">
                    {c.nome_fantasia || c.razao_social}
                    {c.nome_fantasia && (
                      <span className="ml-1 text-xs text-slate-400">{c.razao_social}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

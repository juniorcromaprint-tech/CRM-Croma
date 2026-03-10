import React, { useState, useCallback, useMemo } from "react";
import { Wrench, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useServicos, type Servico } from "../hooks/useProdutosModelos";
import { brl } from "@/shared/utils/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrcamentoServicoItem {
  servico_id: string | null;
  descricao: string;
  horas: number;
  valor_unitario: number;
  valor_total: number;
}

interface ServicoSelectorProps {
  servicos: OrcamentoServicoItem[];
  onChange: (servicos: OrcamentoServicoItem[]) => void;
  readonly?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOM_SERVICE_KEY = "__custom__";

function buildItemFromServico(s: Servico): OrcamentoServicoItem {
  if (s.preco_fixo != null) {
    return {
      servico_id: s.id,
      descricao: s.nome,
      horas: 0,
      valor_unitario: s.preco_fixo,
      valor_total: s.preco_fixo,
    };
  }
  return {
    servico_id: s.id,
    descricao: s.nome,
    horas: s.horas_estimadas,
    valor_unitario: s.custo_hora,
    valor_total: s.horas_estimadas * s.custo_hora,
  };
}

function buildCustomItem(): OrcamentoServicoItem {
  return {
    servico_id: null,
    descricao: "",
    horas: 1,
    valor_unitario: 0,
    valor_total: 0,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ServicoSelector({
  servicos,
  onChange,
  readonly = false,
}: ServicoSelectorProps) {
  const { data: servicosDb = [], isLoading, isError } = useServicos();
  const [selectValue, setSelectValue] = useState<string>("");

  // Total across all added services
  const total = useMemo(
    () => servicos.reduce((sum, s) => sum + s.valor_total, 0),
    [servicos],
  );

  // ---- Handlers ----

  const handleAdd = useCallback(
    (key: string) => {
      if (!key) return;

      if (key === CUSTOM_SERVICE_KEY) {
        onChange([...servicos, buildCustomItem()]);
      } else {
        const found = servicosDb.find((s) => s.id === key);
        if (found) {
          onChange([...servicos, buildItemFromServico(found)]);
        }
      }

      setSelectValue("");
    },
    [servicos, servicosDb, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(servicos.filter((_, i) => i !== index));
    },
    [servicos, onChange],
  );

  const handleUpdate = useCallback(
    (index: number, patch: Partial<OrcamentoServicoItem>) => {
      onChange(
        servicos.map((item, i) => {
          if (i !== index) return item;
          const updated = { ...item, ...patch };
          // Recalculate total when horas or valor_unitario change
          if ("horas" in patch || "valor_unitario" in patch) {
            updated.valor_total = updated.horas * updated.valor_unitario;
          }
          return updated;
        }),
      );
    },
    [servicos, onChange],
  );

  // ---- Render ----

  // If migration not yet run and DB returns nothing / errors
  if (!isLoading && (isError || servicosDb.length === 0) && servicos.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl p-4 text-center text-sm text-slate-400">
        <Wrench size={16} className="inline-block mr-1.5 -mt-0.5" />
        Servicos serao carregados quando disponiveis
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-50 px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Wrench size={14} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Servicos</span>
          {servicos.length > 0 && (
            <span className="text-xs text-slate-400">
              ({servicos.length})
            </span>
          )}
        </div>
        {servicos.length > 0 && (
          <span className="text-sm font-bold text-slate-800 tabular-nums">
            Total: {brl(total)}
          </span>
        )}
      </div>

      {/* Service rows */}
      {servicos.length > 0 && (
        <div className="divide-y divide-slate-100">
          {servicos.map((item, index) => (
            <div
              key={`${item.servico_id ?? "custom"}-${index}`}
              className="flex items-center gap-2 px-4 py-2.5 group hover:bg-slate-50 transition-colors"
            >
              {/* Description — editable for custom services */}
              <div className="flex-1 min-w-0">
                {item.servico_id === null && !readonly ? (
                  <Input
                    value={item.descricao}
                    onChange={(e) =>
                      handleUpdate(index, { descricao: e.target.value })
                    }
                    placeholder="Descricao do servico"
                    className="h-7 rounded-lg text-sm border-slate-200"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-800 truncate block">
                    {item.descricao}
                  </span>
                )}
              </div>

              {/* Hours */}
              {!readonly ? (
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={item.horas}
                  onChange={(e) =>
                    handleUpdate(index, { horas: Number(e.target.value) || 0 })
                  }
                  className="w-16 h-7 rounded-lg text-sm text-right tabular-nums border-slate-200"
                />
              ) : (
                <span className="text-sm text-slate-600 tabular-nums w-10 text-right">
                  {item.horas}h
                </span>
              )}

              <span className="text-xs text-slate-400">x</span>

              {/* Unit value */}
              {!readonly ? (
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={item.valor_unitario}
                  onChange={(e) =>
                    handleUpdate(index, {
                      valor_unitario: Number(e.target.value) || 0,
                    })
                  }
                  className="w-24 h-7 rounded-lg text-sm text-right tabular-nums border-slate-200"
                />
              ) : (
                <span className="text-sm text-slate-600 tabular-nums w-24 text-right">
                  {brl(item.valor_unitario)}
                </span>
              )}

              <span className="text-xs text-slate-400">=</span>

              {/* Total */}
              <span className="text-sm font-semibold text-slate-800 tabular-nums w-28 text-right">
                {brl(item.valor_total)}
              </span>

              {/* Remove button */}
              {!readonly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={() => handleRemove(index)}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add service dropdown */}
      {!readonly && (
        <div className="px-4 py-3 border-t border-slate-100">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              Carregando servicos...
            </div>
          ) : (
            <Select value={selectValue} onValueChange={handleAdd}>
              <SelectTrigger className="w-full rounded-xl h-9 text-sm border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                <div className="flex items-center gap-2">
                  <Plus size={14} />
                  <SelectValue placeholder="Adicionar servico" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {servicosDb.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{s.nome}</span>
                      <span className="text-xs text-slate-400 tabular-nums ml-auto">
                        {s.preco_fixo != null
                          ? brl(s.preco_fixo)
                          : `${s.horas_estimadas}h x ${brl(s.custo_hora)}`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_SERVICE_KEY}>
                  <span className="text-blue-600 font-medium">
                    + Servico personalizado
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Footer total */}
      {servicos.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
          <span className="text-sm font-semibold text-slate-600">
            Total Servicos
          </span>
          <span className="text-base font-bold text-slate-800 tabular-nums">
            {brl(total)}
          </span>
        </div>
      )}
    </div>
  );
}

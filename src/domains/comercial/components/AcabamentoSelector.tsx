import React from "react";
import { Scissors, Loader2, Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAcabamentos, type Acabamento } from "../hooks/useProdutosModelos";
import type { OrcamentoAcabamento } from "@/shared/services/orcamento-pricing.service";
import { brl } from "@/shared/utils/format";

// ─── Props ──────────────────────────────────────────────────────────────────

interface AcabamentoSelectorProps {
  selected: OrcamentoAcabamento[];
  onChange: (acabamentos: OrcamentoAcabamento[]) => void;
  readonly?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AcabamentoSelector({
  selected,
  onChange,
  readonly = false,
}: AcabamentoSelectorProps) {
  const { data: acabamentos = [], isLoading, isError } = useAcabamentos();

  // ── Helpers ────────────────────────────────────────────────────────────────

  const isSelected = (acabamentoId: string) =>
    selected.some((s) => s.acabamento_id === acabamentoId);

  const findSelected = (acabamentoId: string) =>
    selected.find((s) => s.acabamento_id === acabamentoId);

  const totalAcabamentos = selected.reduce(
    (sum, a) => sum + a.quantidade * a.custo_unitario,
    0,
  );

  // ── Toggle an acabamento from the DB list ─────────────────────────────────

  function handleToggle(acabamento: Acabamento, checked: boolean) {
    if (readonly) return;

    if (checked) {
      onChange([
        ...selected,
        {
          acabamento_id: acabamento.id,
          descricao: acabamento.nome,
          quantidade: 1,
          custo_unitario: acabamento.custo_unitario,
        },
      ]);
    } else {
      onChange(selected.filter((s) => s.acabamento_id !== acabamento.id));
    }
  }

  // ── Update quantity for a selected acabamento ─────────────────────────────

  function handleQuantityChange(acabamentoId: string | null, index: number, qty: number) {
    const value = Math.max(1, qty);
    const next = selected.map((s, i) => {
      if (acabamentoId && s.acabamento_id === acabamentoId) {
        return { ...s, quantidade: value };
      }
      if (!acabamentoId && !s.acabamento_id && i === index) {
        return { ...s, quantidade: value };
      }
      return s;
    });
    onChange(next);
  }

  // ── Manual entry helpers ──────────────────────────────────────────────────

  function handleAddManual() {
    onChange([
      ...selected,
      {
        acabamento_id: null,
        descricao: "",
        quantidade: 1,
        custo_unitario: 0,
      },
    ]);
  }

  function handleManualFieldChange(
    index: number,
    field: "descricao" | "custo_unitario",
    value: string | number,
  ) {
    const next = selected.map((s, i) => {
      if (i === index) {
        return { ...s, [field]: value };
      }
      return s;
    });
    onChange(next);
  }

  function handleRemoveManual(index: number) {
    onChange(selected.filter((_, i) => i !== index));
  }

  // ── Determine manual entries (those without acabamento_id that don't match DB) ──

  const dbIds = new Set(acabamentos.map((a) => a.id));
  const manualEntries = selected
    .map((s, i) => ({ ...s, _index: i }))
    .filter((s) => !s.acabamento_id || !dbIds.has(s.acabamento_id));

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="bg-slate-50 rounded-xl p-6 flex items-center justify-center gap-2">
        <Loader2 size={16} className="animate-spin text-slate-400" />
        <span className="text-sm text-slate-400">Carregando acabamentos...</span>
      </div>
    );
  }

  // ── Empty DB state (migration 006 not executed) ───────────────────────────

  const hasDbAcabamentos = acabamentos.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Scissors size={14} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Acabamentos</span>
        </div>
        <span className="text-sm font-bold text-slate-800 tabular-nums">
          Total: {brl(totalAcabamentos)}
        </span>
      </div>

      {/* Body */}
      <div className="divide-y divide-slate-100">
        {/* DB-loaded acabamentos */}
        {hasDbAcabamentos ? (
          acabamentos.map((acabamento) => {
            const checked = isSelected(acabamento.id);
            const sel = findSelected(acabamento.id);
            const selIndex = sel
              ? selected.findIndex((s) => s.acabamento_id === acabamento.id)
              : -1;
            const rowTotal = sel ? sel.quantidade * sel.custo_unitario : 0;

            return (
              <div
                key={acabamento.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
              >
                {/* Checkbox */}
                <Checkbox
                  id={`acab-${acabamento.id}`}
                  checked={checked}
                  onCheckedChange={(v) => handleToggle(acabamento, !!v)}
                  disabled={readonly}
                  className="shrink-0"
                />

                {/* Label + description */}
                <Label
                  htmlFor={`acab-${acabamento.id}`}
                  className="flex-1 min-w-0 cursor-pointer select-none"
                >
                  <span className="text-sm font-medium text-slate-700 block truncate">
                    {acabamento.nome}
                  </span>
                  {acabamento.descricao && (
                    <span className="text-xs text-slate-500 block truncate">
                      {acabamento.descricao}
                    </span>
                  )}
                </Label>

                {/* Quantity + pricing — only visible when checked */}
                {checked && sel && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-500">Qtd:</span>
                    <Input
                      type="number"
                      min={1}
                      value={sel.quantidade}
                      onChange={(e) =>
                        handleQuantityChange(
                          acabamento.id,
                          selIndex,
                          parseInt(e.target.value, 10) || 1,
                        )
                      }
                      disabled={readonly}
                      className="h-8 w-20 text-sm rounded-lg text-right tabular-nums"
                    />
                    <span className="text-xs text-slate-500 w-20 text-right tabular-nums">
                      {brl(acabamento.custo_unitario)}
                    </span>
                    <span className="text-xs text-slate-400 mx-0.5">=</span>
                    <span className="text-sm font-medium text-slate-700 w-24 text-right tabular-nums">
                      {brl(rowTotal)}
                    </span>
                  </div>
                )}

                {/* Unit info when not checked */}
                {!checked && (
                  <span className="text-xs text-slate-400 shrink-0">
                    {brl(acabamento.custo_unitario)}/{acabamento.unidade}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="px-4 py-4 text-sm text-slate-400 text-center">
            {isError
              ? "Acabamentos indispon\u00edveis no momento"
              : "Acabamentos ser\u00e3o carregados quando dispon\u00edveis"}
          </div>
        )}

        {/* Manual entries */}
        {manualEntries.map((entry) => (
          <div
            key={`manual-${entry._index}`}
            className="flex items-center gap-3 px-4 py-2.5 bg-amber-50/50"
          >
            <div className="w-4 shrink-0" />

            {/* Editable name */}
            <Input
              type="text"
              placeholder="Nome do acabamento"
              value={entry.descricao}
              onChange={(e) =>
                handleManualFieldChange(entry._index, "descricao", e.target.value)
              }
              disabled={readonly}
              className="h-8 text-sm rounded-lg flex-1 min-w-0"
            />

            {/* Quantity */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500">Qtd:</span>
              <Input
                type="number"
                min={1}
                value={entry.quantidade}
                onChange={(e) =>
                  handleQuantityChange(
                    null,
                    entry._index,
                    parseInt(e.target.value, 10) || 1,
                  )
                }
                disabled={readonly}
                className="h-8 w-20 text-sm rounded-lg text-right tabular-nums"
              />

              {/* Editable unit cost */}
              <span className="text-xs text-slate-500">R$</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={entry.custo_unitario}
                onChange={(e) =>
                  handleManualFieldChange(
                    entry._index,
                    "custo_unitario",
                    parseFloat(e.target.value) || 0,
                  )
                }
                disabled={readonly}
                className="h-8 w-24 text-sm rounded-lg text-right tabular-nums"
              />

              <span className="text-xs text-slate-400 mx-0.5">=</span>
              <span className="text-sm font-medium text-slate-700 w-24 text-right tabular-nums">
                {brl(entry.quantidade * entry.custo_unitario)}
              </span>

              {/* Remove button */}
              {!readonly && (
                <button
                  type="button"
                  onClick={() => handleRemoveManual(entry._index)}
                  className="text-red-400 hover:text-red-600 transition-colors p-1"
                  title="Remover acabamento manual"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: add manual + total */}
      <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50">
        {!readonly && (
          <button
            type="button"
            onClick={handleAddManual}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Plus size={14} />
            Adicionar acabamento manual
          </button>
        )}
        {readonly && <div />}

        <div className="text-sm font-semibold text-slate-700 tabular-nums">
          Total Acabamentos: {brl(totalAcabamentos)}
        </div>
      </div>
    </div>
  );
}

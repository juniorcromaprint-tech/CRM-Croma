import React, { useCallback, useRef } from "react";
import { Plus, Trash2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { brl } from "@/shared/utils/format";
import type { OrcamentoMaterial } from "@/shared/services/orcamento-pricing.service";

// ─── Props ──────────────────────────────────────────────────────────────────

interface MaterialEditorProps {
  materiais: OrcamentoMaterial[];
  onChange: (materiais: OrcamentoMaterial[]) => void;
  readonly?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MaterialEditor({
  materiais,
  onChange,
  readonly = false,
}: MaterialEditorProps) {
  const newRowRef = useRef<HTMLInputElement>(null);

  // Total geral de materia prima
  const totalMP = materiais.reduce(
    (sum, m) => sum + m.quantidade * m.custo_unitario,
    0,
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleFieldChange = useCallback(
    (index: number, field: keyof OrcamentoMaterial, value: string | number) => {
      const updated = materiais.map((m, i) => {
        if (i !== index) return m;
        return { ...m, [field]: value };
      });
      onChange(updated);
    },
    [materiais, onChange],
  );

  const handleAddMaterial = useCallback(() => {
    const novo: OrcamentoMaterial = {
      material_id: null,
      descricao: "",
      quantidade: 1,
      unidade: "un",
      custo_unitario: 0,
    };
    onChange([...materiais, novo]);
    // Focus the descricao input of the new row after React renders it
    requestAnimationFrame(() => {
      newRowRef.current?.focus();
    });
  }, [materiais, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(materiais.filter((_, i) => i !== index));
    },
    [materiais, onChange],
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">
            Materiais
          </span>
          <span className="text-xs text-slate-400">
            ({materiais.length})
          </span>
        </div>
        <span className="text-sm font-semibold text-slate-800 tabular-nums">
          Total: {brl(totalMP)}
        </span>
      </div>

      {/* Table header */}
      {materiais.length > 0 && (
        <div className="grid grid-cols-[1fr_90px_70px_100px_90px_36px] gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">Descrição</span>
          <span className="text-xs text-slate-500 text-right">Qtd</span>
          <span className="text-xs text-slate-500">Unid.</span>
          <span className="text-xs text-slate-500 text-right">Custo Un.</span>
          <span className="text-xs text-slate-500 text-right">Subtotal</span>
          <span />
        </div>
      )}

      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {materiais.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-slate-400">
            Nenhum material adicionado
          </div>
        )}

        {materiais.map((mat, index) => {
          const subtotal = mat.quantidade * mat.custo_unitario;
          const isLast = index === materiais.length - 1;

          return (
            <div
              key={index}
              className="grid grid-cols-[1fr_90px_70px_100px_90px_36px] gap-2 items-center px-4 py-2"
            >
              {/* Descricao */}
              <Input
                ref={isLast ? newRowRef : undefined}
                type="text"
                value={mat.descricao}
                placeholder="Nome do material"
                disabled={readonly}
                onChange={(e) =>
                  handleFieldChange(index, "descricao", e.target.value)
                }
                className="h-8 text-sm rounded-lg"
              />

              {/* Quantidade */}
              <Input
                type="number"
                value={mat.quantidade}
                min={0}
                step={0.01}
                disabled={readonly}
                onChange={(e) =>
                  handleFieldChange(
                    index,
                    "quantidade",
                    parseFloat(e.target.value) || 0,
                  )
                }
                className="h-8 text-sm rounded-lg text-right tabular-nums"
              />

              {/* Unidade */}
              <Input
                type="text"
                value={mat.unidade}
                disabled={readonly}
                onChange={(e) =>
                  handleFieldChange(index, "unidade", e.target.value)
                }
                className="h-8 text-sm rounded-lg"
              />

              {/* Custo unitario */}
              <Input
                type="number"
                value={mat.custo_unitario}
                min={0}
                step={0.01}
                disabled={readonly}
                onChange={(e) =>
                  handleFieldChange(
                    index,
                    "custo_unitario",
                    parseFloat(e.target.value) || 0,
                  )
                }
                className="h-8 text-sm rounded-lg text-right tabular-nums"
              />

              {/* Subtotal (read-only) */}
              <span className="text-sm text-slate-700 text-right tabular-nums pr-1">
                {brl(subtotal)}
              </span>

              {/* Delete */}
              {!readonly ? (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Remover material"
                >
                  <Trash2 size={14} />
                </button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>

      {/* Add button */}
      {!readonly && (
        <div className="px-4 py-2 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddMaterial}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
          >
            <Plus size={14} />
            Adicionar material
          </Button>
        </div>
      )}

      {/* Footer total */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
        <span className="text-sm font-semibold text-slate-700">
          Total Materia Prima
        </span>
        <span className="text-sm font-bold text-slate-900 tabular-nums">
          {brl(totalMP)}
        </span>
      </div>
    </div>
  );
}

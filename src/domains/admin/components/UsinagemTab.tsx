// ============================================================================
// USINAGEM TAB — Gerenciamento de tempos CNC por máquina
// Exibe DataTable de usinagem_tempos com add/edit/delete
// ============================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/shared/utils/format";
import {
  useUsinagemTempos,
  useInsertUsinagemTempo,
  useUpdateUsinagemTempo,
  useDeleteUsinagemTempo,
  type UsinagemTempo,
  type UsinagemTempoInsert,
  type TipoOperacao,
} from "../hooks/useUsinagemTempos";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit2, Trash2, Wrench } from "lucide-react";

// ----------------------------------------------------------------------------
// CONSTANTES
// ----------------------------------------------------------------------------

const TIPOS_OPERACAO: { value: TipoOperacao; label: string; color: string }[] = [
  { value: "corte", label: "Corte", color: "bg-red-50 text-red-700" },
  { value: "vinco", label: "Vinco", color: "bg-yellow-50 text-yellow-700" },
  { value: "rebaixo", label: "Rebaixo", color: "bg-blue-50 text-blue-700" },
  { value: "gravacao", label: "Gravação", color: "bg-purple-50 text-purple-700" },
];

function tipoLabel(tipo: TipoOperacao): string {
  return TIPOS_OPERACAO.find((t) => t.value === tipo)?.label ?? tipo;
}

function tipoColor(tipo: TipoOperacao): string {
  return TIPOS_OPERACAO.find((t) => t.value === tipo)?.color ?? "bg-slate-100 text-slate-600";
}

// ----------------------------------------------------------------------------
// FORM DIALOG
// ----------------------------------------------------------------------------

interface FormData {
  material_id: string;
  tipo_operacao: TipoOperacao;
  tempo_metro_linear_min: string;
  custo_hora_operacao: string;
}

function emptyForm(): FormData {
  return {
    material_id: "",
    tipo_operacao: "corte",
    tempo_metro_linear_min: "",
    custo_hora_operacao: "",
  };
}

interface UsinagemFormDialogProps {
  open: boolean;
  maquinaId: string;
  editing: UsinagemTempo | null;
  onClose: () => void;
}

function UsinagemFormDialog({
  open,
  maquinaId,
  editing,
  onClose,
}: UsinagemFormDialogProps) {
  const [form, setForm] = useState<FormData>(() =>
    editing
      ? {
          material_id: editing.material_id ?? "",
          tipo_operacao: editing.tipo_operacao,
          tempo_metro_linear_min: String(editing.tempo_metro_linear_min),
          custo_hora_operacao: String(editing.custo_hora_operacao),
        }
      : emptyForm()
  );

  const insertMutation = useInsertUsinagemTempo();
  const updateMutation = useUpdateUsinagemTempo();
  const isSaving = insertMutation.isPending || updateMutation.isPending;

  // Lookup de materiais para o select
  const { data: materiais = [] } = useQuery({
    queryKey: ["materiais-select"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("materiais")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
  });

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    const payload: UsinagemTempoInsert = {
      maquina_id: maquinaId,
      material_id: form.material_id || null,
      tipo_operacao: form.tipo_operacao,
      tempo_metro_linear_min: parseFloat(form.tempo_metro_linear_min) || 0,
      custo_hora_operacao: parseFloat(form.custo_hora_operacao) || 0,
    };

    if (editing) {
      updateMutation.mutate({ ...payload, id: editing.id }, { onSuccess: onClose });
    } else {
      insertMutation.mutate(payload, { onSuccess: onClose });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Wrench className="h-4 w-4 text-orange-600" />
            {editing ? "Editar tempo de usinagem" : "Novo tempo de usinagem"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="material">Material</Label>
            <select
              id="material"
              value={form.material_id}
              onChange={(e) => set("material_id", e.target.value)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Qualquer material —</option>
              {materiais.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">
              Deixe em branco para aplicar como padrão geral desta máquina.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipo_operacao">Tipo de operação</Label>
            <select
              id="tipo_operacao"
              value={form.tipo_operacao}
              onChange={(e) => set("tipo_operacao", e.target.value as TipoOperacao)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {TIPOS_OPERACAO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tempo">Tempo/metro linear (min)</Label>
              <Input
                id="tempo"
                type="number"
                step="0.01"
                min="0"
                value={form.tempo_metro_linear_min}
                onChange={(e) => set("tempo_metro_linear_min", e.target.value)}
                placeholder="Ex: 2.5"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="custo_hora">Custo/hora (R$)</Label>
              <Input
                id="custo_hora"
                type="number"
                step="0.01"
                min="0"
                value={form.custo_hora_operacao}
                onChange={(e) => set("custo_hora_operacao", e.target.value)}
                placeholder="Ex: 85.00"
                className="rounded-xl"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editing ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------------

interface UsinagemTabProps {
  maquinaId: string;
}

export function UsinagemTab({ maquinaId }: UsinagemTabProps) {
  const { data: tempos = [], isLoading } = useUsinagemTempos(maquinaId);
  const deleteMutation = useDeleteUsinagemTempo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTempo, setEditingTempo] = useState<UsinagemTempo | null>(null);

  function openNew() {
    setEditingTempo(null);
    setDialogOpen(true);
  }

  function openEdit(tempo: UsinagemTempo) {
    setEditingTempo(tempo);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingTempo(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 justify-center py-8 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando tempos de usinagem...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">Tempos de Usinagem CNC</p>
          <p className="text-xs text-slate-400">
            Configure tempo por metro linear e custo por hora para cada operação
          </p>
        </div>
        <Button
          size="sm"
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar
        </Button>
      </div>

      {/* Table */}
      {tempos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Wrench size={32} className="mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-600 text-sm">
            Nenhum tempo de usinagem cadastrado
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Adicione os parâmetros de corte, vinco, rebaixo e gravação para esta máquina.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                  Material
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                  Operação
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">
                  Tempo/m linear
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">
                  Custo/hora
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {tempos.map((tempo) => (
                <tr
                  key={tempo.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <span className="text-slate-700">
                      {tempo.material_nome ?? (
                        <span className="text-slate-400 italic">Qualquer material</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary" className={tipoColor(tempo.tipo_operacao)}>
                      {tipoLabel(tempo.tipo_operacao)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-mono text-xs text-slate-700 tabular-nums">
                      {tempo.tempo_metro_linear_min.toFixed(2)} min/m
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-mono text-xs text-slate-700 tabular-nums">
                      {brl(tempo.custo_hora_operacao)}/h
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(tempo)}
                        className="h-7 w-7 p-0"
                        title="Editar"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          deleteMutation.mutate({ id: tempo.id, maquina_id: maquinaId })
                        }
                        disabled={deleteMutation.isPending}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:border-red-300"
                        title="Remover"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <UsinagemFormDialog
          open={dialogOpen}
          maquinaId={maquinaId}
          editing={editingTempo}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}

export default UsinagemTab;

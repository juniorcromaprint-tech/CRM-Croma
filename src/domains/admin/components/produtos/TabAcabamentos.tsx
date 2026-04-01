// ============================================================================
// ABA 4 — ACABAMENTOS (inclui DialogAcabamento)
// ============================================================================

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { brl } from "@/shared/utils/format";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  AlertTriangle,
  Loader2,
  Save,
  Plus,
  Pencil,
  PowerOff,
  Scissors,
} from "lucide-react";

import type { Acabamento } from "./types";
import { UNIDADES_PADRAO } from "./constants";

// ----------------------------------------------------------------------------
// DIALOG — ACABAMENTO
// ----------------------------------------------------------------------------

interface DialogAcabamentoProps {
  open: boolean;
  onClose: () => void;
  acabamento?: Acabamento | null;
}

function DialogAcabamento({ open, onClose, acabamento }: DialogAcabamentoProps) {
  const queryClient = useQueryClient();
  const isEdit = !!acabamento;

  const [form, setForm] = useState({
    nome: "",
    custo_unitario: "",
    unidade: "un",
    descricao: "",
    ativo: true,
  });

  useEffect(() => {
    if (open) {
      if (acabamento) {
        setForm({
          nome: acabamento.nome,
          custo_unitario: String(acabamento.custo_unitario),
          unidade: acabamento.unidade,
          descricao: acabamento.descricao ?? "",
          ativo: acabamento.ativo,
        });
      } else {
        setForm({ nome: "", custo_unitario: "", unidade: "un", descricao: "", ativo: true });
      }
    }
  }, [open, acabamento]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");
      const custo = parseFloat(form.custo_unitario);
      if (isNaN(custo) || custo < 0) throw new Error("Custo unitário inválido");
      const payload = {
        nome: form.nome.trim(),
        custo_unitario: custo,
        unidade: form.unidade,
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
      };
      if (isEdit && acabamento) {
        const { error } = await (supabase as unknown as any)
          .from("acabamentos")
          .update(payload)
          .eq("id", acabamento.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as unknown as any)
          .from("acabamentos")
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-acabamentos"] });
      queryClient.invalidateQueries({ queryKey: ["acabamentos"] });
    },
  });

  function handleSave() {
    mutation.mutate(undefined, {
      onSuccess: () => {
        showSuccess(isEdit ? "Acabamento atualizado!" : "Acabamento criado!");
        onClose();
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao salvar acabamento.";
        showError(msg);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Acabamento" : "Novo Acabamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Laminação Fosca"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Custo Unitário (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.custo_unitario}
                onChange={(e) => setForm((f) => ({ ...f, custo_unitario: e.target.value }))}
                placeholder="0,00"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Select
                value={form.unidade}
                onValueChange={(v) => setForm((f) => ({ ...f, unidade: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_PADRAO.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição (opcional)</Label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo-acabamento"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="ativo-acabamento">Acabamento ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// TAB ACABAMENTOS
// ----------------------------------------------------------------------------

export function TabAcabamentos() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAcabamento, setEditingAcabamento] = useState<Acabamento | null>(null);
  const [tableExists, setTableExists] = useState<boolean | null>(null);

  const { data: acabamentos = [], isLoading } = useQuery({
    queryKey: ["admin-acabamentos"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as unknown as any)
          .from("acabamentos")
          .select("*")
          .order("nome");
        if (error) {
          if (
            error.message?.includes("does not exist") ||
            error.code === "42P01"
          ) {
            setTableExists(false);
            return [];
          }
          throw error;
        }
        setTableExists(true);
        return (data ?? []) as Acabamento[];
      } catch {
        setTableExists(false);
        return [];
      }
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as unknown as any)
        .from("acabamentos")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-acabamentos"] });
      queryClient.invalidateQueries({ queryKey: ["acabamentos"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Verificando tabela de acabamentos...</span>
      </div>
    );
  }

  if (tableExists === false) {
    return (
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-amber-800">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Execute a migration 006 primeiro</p>
          <p className="text-sm mt-1 text-amber-700">
            A tabela <code className="bg-amber-100 px-1 rounded">acabamentos</code> não existe no
            banco de dados. Execute a migration{" "}
            <code className="bg-amber-100 px-1 rounded">006_orcamento_module.sql</code> para
            habilitar esta funcionalidade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          onClick={() => {
            setEditingAcabamento(null);
            setDialogOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Acabamento
        </Button>
      </div>

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Acabamentos</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {acabamentos.length} acabamento{acabamentos.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <CardDescription>Opções de acabamento disponíveis para orçamentos</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {acabamentos.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Scissors className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum acabamento cadastrado.</p>
              <p className="text-xs mt-1">Adicione opções de acabamento clicando em "Novo Acabamento".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Custo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Unidade</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {acabamentos.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">{a.nome}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {brl(a.custo_unitario)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{a.unidade}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={
                            a.ativo
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }
                        >
                          {a.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => {
                              setEditingAcabamento(a);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 w-7 p-0 hover:bg-slate-100 ${
                              a.ativo
                                ? "text-slate-400 hover:text-amber-600"
                                : "text-slate-300 hover:text-green-600"
                            }`}
                            onClick={() =>
                              toggleAtivo.mutate(
                                { id: a.id, ativo: !a.ativo },
                                {
                                  onSuccess: () =>
                                    showSuccess(a.ativo ? "Desativado" : "Ativado"),
                                  onError: () => showError("Erro ao alterar status"),
                                }
                              )
                            }
                            disabled={toggleAtivo.isPending}
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <DialogAcabamento
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        acabamento={editingAcabamento}
      />
    </div>
  );
}

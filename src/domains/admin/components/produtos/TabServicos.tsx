// ============================================================================
// ABA 5 — SERVIÇOS (inclui DialogServico)
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
  Wrench,
} from "lucide-react";

import type { Servico } from "./types";
import { categoriaBadgeColor, CATEGORIAS_SERVICO } from "./constants";

// ----------------------------------------------------------------------------
// DIALOG — SERVIÇO
// ----------------------------------------------------------------------------

interface DialogServicoProps {
  open: boolean;
  onClose: () => void;
  servico?: Servico | null;
}

function DialogServico({ open, onClose, servico }: DialogServicoProps) {
  const queryClient = useQueryClient();
  const isEdit = !!servico;

  const [form, setForm] = useState({
    nome: "",
    categoria: "instalacao",
    custo_hora: "",
    preco_fixo: "",
    descricao: "",
    ativo: true,
  });

  useEffect(() => {
    if (open) {
      if (servico) {
        setForm({
          nome: servico.nome,
          categoria: servico.categoria,
          custo_hora: String(servico.custo_hora),
          preco_fixo: servico.preco_fixo != null ? String(servico.preco_fixo) : "",
          descricao: servico.descricao ?? "",
          ativo: servico.ativo,
        });
      } else {
        setForm({
          nome: "",
          categoria: "instalacao",
          custo_hora: "",
          preco_fixo: "",
          descricao: "",
          ativo: true,
        });
      }
    }
  }, [open, servico]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");
      const payload: Record<string, unknown> = {
        nome: form.nome.trim(),
        categoria: form.categoria,
        custo_hora: parseFloat(form.custo_hora) || 0,
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
      };
      if (form.preco_fixo) payload.preco_fixo = parseFloat(form.preco_fixo);
      if (isEdit && servico) {
        const { error } = await (supabase as unknown as any)
          .from("servicos")
          .update(payload)
          .eq("id", servico.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as unknown as any)
          .from("servicos")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-servicos"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
    },
  });

  function handleSave() {
    mutation.mutate(undefined, {
      onSuccess: () => {
        showSuccess(isEdit ? "Serviço atualizado!" : "Serviço criado!");
        onClose();
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao salvar serviço.";
        showError(msg);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Instalação de Fachada"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_SERVICO.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Custo/hora (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.custo_hora}
                onChange={(e) => setForm((f) => ({ ...f, custo_hora: e.target.value }))}
                placeholder="0,00"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Preço Fixo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.preco_fixo}
                onChange={(e) => setForm((f) => ({ ...f, preco_fixo: e.target.value }))}
                placeholder="Opcional"
                className="rounded-xl"
              />
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
              id="ativo-servico"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="ativo-servico">Serviço ativo</Label>
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
// TAB SERVIÇOS
// ----------------------------------------------------------------------------

export function TabServicos() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [tableExists, setTableExists] = useState<boolean | null>(null);

  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ["admin-servicos"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as unknown as any)
          .from("servicos")
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
        return (data ?? []) as Servico[];
      } catch {
        setTableExists(false);
        return [];
      }
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as unknown as any)
        .from("servicos")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-servicos"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Verificando tabela de serviços...</span>
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
            A tabela <code className="bg-amber-100 px-1 rounded">servicos</code> não existe no
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
            setEditingServico(null);
            setDialogOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Serviços</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {servicos.length} serviço{servicos.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <CardDescription>Serviços disponíveis para inclusão nos orçamentos</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {servicos.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum serviço cadastrado.</p>
              <p className="text-xs mt-1">Adicione serviços clicando em "Novo Serviço".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoria</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Custo/hora</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Preço Fixo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">{s.nome}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${categoriaBadgeColor(s.categoria)}`}
                        >
                          {s.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {brl(s.custo_hora)}/h
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                        {s.preco_fixo != null ? brl(s.preco_fixo) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={
                            s.ativo
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }
                        >
                          {s.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => {
                              setEditingServico(s);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 w-7 p-0 hover:bg-slate-100 ${
                              s.ativo
                                ? "text-slate-400 hover:text-amber-600"
                                : "text-slate-300 hover:text-green-600"
                            }`}
                            onClick={() =>
                              toggleAtivo.mutate(
                                { id: s.id, ativo: !s.ativo },
                                {
                                  onSuccess: () =>
                                    showSuccess(s.ativo ? "Desativado" : "Ativado"),
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

      <DialogServico
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        servico={editingServico}
      />
    </div>
  );
}

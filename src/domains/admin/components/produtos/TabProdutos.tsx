// ============================================================================
// ABA 1 — PRODUTOS
// ============================================================================

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

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
  Package,
  Loader2,
  Save,
  Search,
  Plus,
  Pencil,
  PowerOff,
  Trash2,
} from "lucide-react";

import type { Produto } from "./types";
import { categoriaBadgeColor, CATEGORIAS_PRODUTO, UNIDADES_PADRAO } from "./constants";

// ----------------------------------------------------------------------------
// DIALOG — PRODUTO
// ----------------------------------------------------------------------------

interface DialogProdutoProps {
  open: boolean;
  onClose: () => void;
  produto?: Produto | null;
}

function DialogProduto({ open, onClose, produto }: DialogProdutoProps) {
  const queryClient = useQueryClient();
  const isEdit = !!produto;

  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    categoria: "fachadas",
    descricao: "",
    unidade_padrao: "m²",
    ativo: true,
  });

  useEffect(() => {
    if (open) {
      if (produto) {
        setForm({
          codigo: produto.codigo ?? "",
          nome: produto.nome,
          categoria: produto.categoria,
          descricao: produto.descricao ?? "",
          unidade_padrao: produto.unidade_padrao,
          ativo: produto.ativo,
        });
      } else {
        setForm({
          codigo: "",
          nome: "",
          categoria: "fachadas",
          descricao: "",
          unidade_padrao: "m²",
          ativo: true,
        });
      }
    }
  }, [open, produto]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");
      if (!form.categoria) throw new Error("Categoria é obrigatória");
      const payload = {
        codigo: form.codigo.trim() || null,
        nome: form.nome.trim(),
        categoria: form.categoria,
        descricao: form.descricao.trim() || null,
        unidade_padrao: form.unidade_padrao,
        ativo: form.ativo,
      };
      if (isEdit && produto) {
        const { error } = await (supabase as unknown as any)
          .from("produtos")
          .update(payload)
          .eq("id", produto.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as unknown as any)
          .from("produtos")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
  });

  function handleSave() {
    mutation.mutate(undefined, {
      onSuccess: () => {
        showSuccess(isEdit ? "Produto atualizado!" : "Produto criado!");
        onClose();
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Erro ao salvar produto.";
        showError(msg);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código (opcional)</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="PRD-001"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>Unidade Padrão</Label>
              <Select
                value={form.unidade_padrao}
                onValueChange={(v) => setForm((f) => ({ ...f, unidade_padrao: v }))}
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
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Banner Roll-up"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label>Categoria *</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_PRODUTO.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Descrição (opcional)</Label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Descrição detalhada do produto..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo-produto"
              checked={form.ativo}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="ativo-produto">Produto ativo</Label>
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
// TAB PRODUTOS
// ----------------------------------------------------------------------------

export function TabProdutos() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["admin-produtos"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("produtos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as unknown as any)
        .from("produtos")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
  });

  const deleteProdutoMut = useMutation({
    mutationFn: async (id: string) => {
      // Verificar vínculos antes de deletar
      const db = supabase as unknown as any;
      const { count: propostaCount } = await db
        .from("proposta_itens")
        .select("id", { count: "exact", head: true })
        .eq("produto_id", id);
      const { count: pedidoCount } = await db
        .from("pedido_itens")
        .select("id", { count: "exact", head: true })
        .eq("produto_id", id);

      if ((propostaCount ?? 0) > 0 || (pedidoCount ?? 0) > 0) {
        throw new Error(
          `Produto vinculado a ${propostaCount ?? 0} proposta(s) e ${pedidoCount ?? 0} pedido(s). Desative em vez de excluir.`
        );
      }

      const { error } = await db.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccess("Produto excluído permanentemente!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const filtered = produtos.filter((p) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      p.nome.toLowerCase().includes(q) ||
      (p.codigo ?? "").toLowerCase().includes(q) ||
      p.categoria.toLowerCase().includes(q)
    );
  });

  function openNew() {
    setEditingProduto(null);
    setDialogOpen(true);
  }

  function openEdit(produto: Produto) {
    setEditingProduto(produto);
    setDialogOpen(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando produtos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome, código ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl border-slate-200 bg-white"
          />
        </div>
        <Button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-slate-800 text-base">Produtos Cadastrados</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <CardDescription>Catálogo completo de produtos do sistema</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Código</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoria</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Unidade</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((produto) => (
                    <tr
                      key={produto.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                        {produto.codigo ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{produto.nome}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${categoriaBadgeColor(produto.categoria)}`}
                        >
                          {produto.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {produto.unidade_padrao}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={
                            produto.ativo
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }
                        >
                          {produto.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => openEdit(produto)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 w-7 p-0 hover:bg-slate-100 ${
                              produto.ativo
                                ? "text-slate-400 hover:text-amber-600"
                                : "text-slate-300 hover:text-green-600"
                            }`}
                            onClick={() =>
                              toggleAtivo.mutate(
                                { id: produto.id, ativo: !produto.ativo },
                                {
                                  onSuccess: () =>
                                    showSuccess(
                                      produto.ativo ? "Produto desativado" : "Produto ativado"
                                    ),
                                  onError: () => showError("Erro ao alterar status"),
                                }
                              )
                            }
                            disabled={toggleAtivo.isPending}
                            title={produto.ativo ? "Desativar" : "Ativar"}
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-300 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Excluir "${produto.nome}" permanentemente?\n\nIsso apagará todos os modelos, materiais e processos vinculados.\n\nSe o produto estiver em propostas/pedidos, será necessário desativá-lo em vez de excluir.`
                                )
                              ) {
                                deleteProdutoMut.mutate(produto.id);
                              }
                            }}
                            disabled={deleteProdutoMut.isPending}
                            title="Excluir permanentemente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      <DialogProduto
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        produto={editingProduto}
      />
    </div>
  );
}

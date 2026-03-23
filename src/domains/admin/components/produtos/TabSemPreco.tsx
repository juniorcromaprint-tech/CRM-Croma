// ============================================================================
// ABA 3 — MATERIAIS SEM PREÇO
// ============================================================================

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import {
  AlertTriangle,
  Loader2,
  Save,
  Search,
} from "lucide-react";

import type { MaterialSemPreco } from "./types";

// ----------------------------------------------------------------------------
// ROW — MATERIAL SEM PREÇO
// ----------------------------------------------------------------------------

interface MaterialRowProps {
  material: MaterialSemPreco;
  onSave: (id: string, novoPreco: number) => void;
  isSaving: boolean;
}

function MaterialSemPrecoRow({ material, onSave, isSaving }: MaterialRowProps) {
  const [preco, setPreco] = useState("");

  function handleSave() {
    const valor = parseFloat(preco.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      showError("Informe um preço válido maior que zero.");
      return;
    }
    onSave(material.id, valor);
    setPreco("");
  }

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
      <td className="px-4 py-3 font-mono text-slate-400 text-xs">
        {material.codigo ?? "—"}
      </td>
      <td className="px-4 py-3 font-medium text-slate-800">{material.nome}</td>
      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{material.unidade}</td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          Sem preço
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 items-center">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
              R$
            </span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="h-8 w-28 pl-8 text-sm"
              placeholder="0,00"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !preco}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Save className="h-3 w-3 mr-1" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// TAB SEM PREÇO
// ----------------------------------------------------------------------------

interface TabSemPrecoProps {
  onCountChange?: (count: number) => void;
}

export function TabSemPreco({ onCountChange }: TabSemPrecoProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: materiaisSemPreco = [], isLoading } = useQuery({
    queryKey: ["materiais-sem-preco"],
    queryFn: async () => {
      const { data } = await (supabase as unknown as any)
        .from("materiais")
        .select("id, codigo, nome, unidade, preco_medio")
        .or("preco_medio.is.null,preco_medio.eq.0")
        .eq("ativo", true)
        .order("nome")
        .limit(200);
      return (data ?? []) as MaterialSemPreco[];
    },
  });

  useEffect(() => {
    if (onCountChange) {
      onCountChange(materiaisSemPreco.length);
    }
  }, [materiaisSemPreco.length, onCountChange]);

  const updatePreco = useMutation({
    mutationFn: async ({ id, preco }: { id: string; preco: number }) => {
      const { error } = await (supabase as unknown as any)
        .from("materiais")
        .update({
          preco_medio: preco,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["materiais-sem-preco"] });
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
    },
  });

  const filtered = materiaisSemPreco.filter((m) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      m.nome.toLowerCase().includes(q) ||
      (m.codigo ?? "").toLowerCase().includes(q) ||
      m.unidade.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Verificando materiais...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {materiaisSemPreco.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {materiaisSemPreco.length} material{materiaisSemPreco.length !== 1 ? "is" : ""} sem preço cadastrado
            </p>
            <p className="text-amber-700 mt-0.5 text-xs">
              Materiais sem preço não entram no cálculo automático de orçamentos. Informe o preço médio por unidade.
            </p>
          </div>
        </div>
      )}

      {materiaisSemPreco.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome, código ou unidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl border-slate-200 bg-white"
          />
        </div>
      )}

      <Card className="rounded-2xl border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-slate-800 text-base">Materiais Sem Preço</CardTitle>
            </div>
            {materiaisSemPreco.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                {materiaisSemPreco.length} pendente{materiaisSemPreco.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <CardDescription>
            Informe o preço médio de cada material para que os orçamentos sejam calculados corretamente
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 && materiaisSemPreco.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="text-green-500 font-semibold mb-2">Tudo certo!</div>
              <p className="text-sm">Todos os materiais ativos possuem preço cadastrado.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">Nenhum material encontrado para o termo pesquisado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Código</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Unidade</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Preço Atual</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nova Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((material) => (
                    <MaterialSemPrecoRow
                      key={material.id}
                      material={material}
                      onSave={(id, novoPreco) =>
                        updatePreco.mutate(
                          { id, preco: novoPreco },
                          {
                            onSuccess: () => showSuccess("Preço atualizado!"),
                            onError: () => showError("Erro ao atualizar preço."),
                          }
                        )
                      }
                      isSaving={updatePreco.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

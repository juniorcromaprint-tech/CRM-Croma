// src/domains/estoque/components/InventarioForm.tsx

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAtualizarItemInventario, useFinalizarInventario } from "../hooks/useInventario";
import type { Inventario, InventarioItem } from "../types/estoque.types";

interface InventarioFormProps {
  inventario: Inventario;
}

export function InventarioForm({ inventario }: InventarioFormProps) {
  const atualizar = useAtualizarItemInventario();
  const finalizar = useFinalizarInventario();

  const itens: InventarioItem[] = inventario.itens ?? [];
  const isFinalizado = inventario.status === "finalizado";

  const [contagens, setContagens] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    itens.forEach((item) => {
      if (item.quantidade_contada !== undefined && item.quantidade_contada !== null) {
        inicial[item.id] = String(item.quantidade_contada);
      }
    });
    return inicial;
  });

  const [justificativas, setJustificativas] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    itens.forEach((item) => {
      if (item.justificativa) inicial[item.id] = item.justificativa;
    });
    return inicial;
  });

  function handleContagem(itemId: string, value: string) {
    setContagens((prev) => ({ ...prev, [itemId]: value }));
  }

  function handleJustificativa(itemId: string, value: string) {
    setJustificativas((prev) => ({ ...prev, [itemId]: value }));
  }

  function handleBlurContagem(item: InventarioItem) {
    const raw = contagens[item.id];
    if (raw === undefined || raw === "") return;
    const val = parseFloat(raw.replace(",", "."));
    if (isNaN(val)) return;
    atualizar.mutate({
      id: item.id,
      quantidade_contada: val,
      justificativa: justificativas[item.id],
    });
  }

  function handleFinalizar() {
    finalizar.mutate(inventario.id);
  }

  if (itens.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <CheckCircle2 size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Inventário sem itens</h3>
        <p className="text-sm text-slate-400 mt-1">
          Nenhum material encontrado para este inventário.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                  Material
                </th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide w-32">
                  Qtd Sistema
                </th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide w-36">
                  Qtd Contada
                </th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide w-28">
                  Diferença
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide w-56">
                  Justificativa
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itens.map((item) => {
                const unidade = item.material?.unidade ?? "";
                const contadaRaw = contagens[item.id];
                const contadaNum =
                  contadaRaw !== undefined
                    ? parseFloat(contadaRaw.replace(",", "."))
                    : item.quantidade_contada;

                const diferenca =
                  contadaNum !== undefined && !isNaN(contadaNum)
                    ? contadaNum - item.quantidade_sistema
                    : undefined;

                const hasDiferenca =
                  diferenca !== undefined && diferenca !== 0;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50 transition-colors ${hasDiferenca ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.material?.nome ?? item.material_id}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {item.quantidade_sistema.toLocaleString("pt-BR")}{" "}
                      <span className="text-xs text-slate-400">{unidade}</span>
                    </td>
                    <td className="px-4 py-3">
                      {isFinalizado ? (
                        <p className="text-right font-mono text-slate-700">
                          {item.quantidade_contada?.toLocaleString("pt-BR") ?? "—"}{" "}
                          <span className="text-xs text-slate-400">{unidade}</span>
                        </p>
                      ) : (
                        <Input
                          type="number"
                          step="any"
                          value={contagens[item.id] ?? ""}
                          onChange={(e) => handleContagem(item.id, e.target.value)}
                          onBlur={() => handleBlurContagem(item)}
                          placeholder="0"
                          className="rounded-xl text-right w-full"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {diferenca !== undefined ? (
                        <span
                          className={
                            diferenca > 0
                              ? "text-green-600 font-semibold"
                              : diferenca < 0
                              ? "text-red-600 font-semibold"
                              : "text-slate-400"
                          }
                        >
                          {diferenca > 0 ? "+" : ""}
                          {diferenca.toLocaleString("pt-BR")}{" "}
                          <span className="text-xs font-normal">{unidade}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isFinalizado ? (
                        <p className="text-xs text-slate-500">
                          {item.justificativa ?? "—"}
                        </p>
                      ) : (
                        <Input
                          type="text"
                          value={justificativas[item.id] ?? ""}
                          onChange={(e) =>
                            handleJustificativa(item.id, e.target.value)
                          }
                          onBlur={() => handleBlurContagem(item)}
                          placeholder="Motivo da diferença..."
                          className="rounded-xl text-sm w-full"
                          disabled={!hasDiferenca}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!isFinalizado && (
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="bg-blue-600 hover:bg-blue-700 rounded-xl"
                disabled={finalizar.isPending}
              >
                {finalizar.isPending ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 size={16} className="mr-2" />
                )}
                Finalizar Inventário
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Finalizar inventário?</AlertDialogTitle>
                <AlertDialogDescription>
                  Após finalizar, o inventário não poderá mais ser editado. As
                  diferenças encontradas serão registradas no histórico.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleFinalizar}
                  className="bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

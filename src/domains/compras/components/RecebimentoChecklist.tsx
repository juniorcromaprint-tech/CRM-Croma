// src/domains/compras/components/RecebimentoChecklist.tsx

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PackageCheck } from "lucide-react";
import { useAtualizarStatusPedido } from "../hooks/usePedidosCompra";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ItemRecebimento {
  id: string;
  material?: { nome: string; unidade?: string } | null;
  quantidade: number;
}

interface RecebimentoChecklistProps {
  pedido: {
    id: string;
    itens?: ItemRecebimento[];
  };
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function RecebimentoChecklist({ pedido }: RecebimentoChecklistProps) {
  const atualizarStatus = useAtualizarStatusPedido();
  const itens = pedido.itens ?? [];

  const [checados, setChecados] = useState<Record<string, boolean>>({});

  function toggleItem(id: string) {
    setChecados((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const todosChecados = itens.length > 0 && itens.every((item) => checados[item.id]);

  function handleConfirmar() {
    atualizarStatus.mutate({ id: pedido.id, status: "recebido" });
  }

  if (itens.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <PackageCheck size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Nenhum item para conferir</h3>
        <p className="text-sm text-slate-400 mt-1">Este pedido não possui itens cadastrados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
        Conferência de recebimento — marque todos os itens recebidos
      </p>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {itens.map((item) => {
            const nome = item.material?.nome ?? "Material";
            const unidade = item.material?.unidade;
            const isChecked = checados[item.id] ?? false;

            return (
              <label
                key={item.id}
                className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${
                  isChecked ? "bg-green-50" : "hover:bg-slate-50"
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggleItem(item.id)}
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isChecked ? "text-green-700 line-through" : "text-slate-700"}`}>
                    {nome}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Quantidade esperada:{" "}
                    <span className="font-semibold text-slate-600">
                      {item.quantidade}
                      {unidade ? ` ${unidade}` : ""}
                    </span>
                  </p>
                </div>
                {isChecked && (
                  <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-md flex-shrink-0">
                    Conferido
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {Object.values(checados).filter(Boolean).length} de {itens.length} itens conferidos
        </p>
        <Button
          onClick={handleConfirmar}
          disabled={!todosChecados || atualizarStatus.isPending}
          className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
        >
          {atualizarStatus.isPending ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Confirmando...
            </>
          ) : (
            <>
              <PackageCheck size={16} className="mr-2" />
              Confirmar Recebimento
            </>
          )}
        </Button>
      </div>

      {!todosChecados && itens.length > 0 && (
        <p className="text-xs text-amber-600 text-center">
          Marque todos os itens para confirmar o recebimento
        </p>
      )}
    </div>
  );
}

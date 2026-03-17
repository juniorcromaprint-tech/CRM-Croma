// src/domains/estoque/pages/MovimentacoesPage.tsx

import { useState } from "react";
import { ArrowRightLeft, Search, Loader2, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/shared/utils/format";
import { useMovimentacoes } from "../hooks/useMovimentacoes";
import type { EstoqueMovimentacao } from "../types/estoque.types";

type TipoMovimentacao = EstoqueMovimentacao["tipo"];

const TIPO_BADGE: Record<
  TipoMovimentacao,
  { label: string; className: string }
> = {
  entrada: {
    label: "Entrada",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  saida: {
    label: "Saída",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

const TIPOS_FILTRO = [
  { value: "todos", label: "Todos os tipos" },
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saída" },
];

const PAGE_SIZE = 20;

export default function MovimentacoesPage() {
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [buscaMaterial, setBuscaMaterial] = useState("");
  const [pagina, setPagina] = useState(1);

  const { data: movimentacoes = [], isLoading } = useMovimentacoes({
    tipo: filtroTipo !== "todos" ? filtroTipo : undefined,
    limit: 500,
  });

  // Filtro local por nome do material
  const filtered = buscaMaterial
    ? (movimentacoes as EstoqueMovimentacao[]).filter((m) =>
        m.material?.nome
          ?.toLowerCase()
          .includes(buscaMaterial.toLowerCase())
      )
    : (movimentacoes as EstoqueMovimentacao[]);

  const totalPaginas = Math.ceil(filtered.length / PAGE_SIZE);
  const paginado = filtered.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  function handleFiltroTipo(value: string) {
    setFiltroTipo(value);
    setPagina(1);
  }

  function handleBusca(value: string) {
    setBuscaMaterial(value);
    setPagina(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Movimentações</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Histórico de entradas, saídas e ajustes de estoque
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            placeholder="Buscar por material..."
            value={buscaMaterial}
            onChange={(e) => handleBusca(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Select value={filtroTipo} onValueChange={handleFiltroTipo}>
          <SelectTrigger className="rounded-xl w-full sm:w-48">
            <Filter size={14} className="mr-2 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_FILTRO.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          <span>Carregando movimentações...</span>
        </div>
      ) : paginado.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ArrowRightLeft
            size={40}
            className="mx-auto text-slate-300 mb-3"
          />
          <h3 className="font-semibold text-slate-600">
            Nenhuma movimentação encontrada
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {buscaMaterial || filtroTipo !== "todos"
              ? "Tente ajustar os filtros."
              : "As movimentações de estoque aparecerão aqui."}
          </p>
        </div>
      ) : (
        <Card className="rounded-2xl border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                    Data
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                    Material
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                    Tipo
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                    Quantidade
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden md:table-cell">
                    Referência
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden lg:table-cell">
                    Observação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginado.map((mov) => {
                  const tipoBadge =
                    TIPO_BADGE[mov.tipo] ?? { label: mov.tipo, className: "bg-slate-50 text-slate-700 border-slate-200" };
                  const unidade = mov.material?.unidade ?? "";

                  return (
                    <tr
                      key={mov.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(mov.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {mov.material?.nome ?? mov.material_id}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${tipoBadge.className}`}
                        >
                          {tipoBadge.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {mov.quantidade.toLocaleString("pt-BR")}{" "}
                        <span className="text-xs text-slate-400">
                          {unidade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                        {mov.referencia_tipo && mov.referencia_id ? (
                          <span className="font-mono">
                            {mov.referencia_tipo} #{mov.referencia_id.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell max-w-xs truncate">
                        {mov.observacao ?? (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400">
                Mostrando {(pagina - 1) * PAGE_SIZE + 1}–
                {Math.min(pagina * PAGE_SIZE, filtered.length)} de{" "}
                {filtered.length} movimentações
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="rounded-xl text-xs"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagina((p) => Math.min(totalPaginas, p + 1))
                  }
                  disabled={pagina === totalPaginas}
                  className="rounded-xl text-xs"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

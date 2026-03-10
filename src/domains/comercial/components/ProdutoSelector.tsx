import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Ruler, Package, Cog, Percent } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProdutos,
  useProdutoModelos,
  type Produto,
  type ProdutoModelo,
} from "../hooks/useProdutosModelos";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProdutoSelectorProps {
  produtoId: string | null;
  modeloId: string | null;
  onProdutoChange: (produto: Produto | null) => void;
  onModeloChange: (modelo: ProdutoModelo | null) => void;
}

// ─── Inline search input for SelectContent ──────────────────────────────────
// Radix Select captures keyboard events, so we stop propagation on the wrapper
// to allow normal typing inside the filter input.

function SelectSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div
      className="px-2 pb-1.5 pt-1"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
        autoFocus
      />
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProdutoSelector({
  produtoId,
  modeloId,
  onProdutoChange,
  onModeloChange,
}: ProdutoSelectorProps) {
  const { data: produtos = [], isLoading: produtosLoading } = useProdutos();
  const { data: modelos = [], isLoading: modelosLoading } = useProdutoModelos(
    produtoId ?? undefined,
  );

  const [produtoFilter, setProdutoFilter] = useState("");
  const [modeloFilter, setModeloFilter] = useState("");

  // Reset modelo when produto changes
  useEffect(() => {
    onModeloChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoId]);

  // Clear filters when selects close (new selection)
  const handleProdutoOpenChange = (open: boolean) => {
    if (!open) setProdutoFilter("");
  };
  const handleModeloOpenChange = (open: boolean) => {
    if (!open) setModeloFilter("");
  };

  // ─── Filtered lists ─────────────────────────────────────────────────────

  const filteredProdutos = useMemo(() => {
    if (!produtoFilter.trim()) return produtos;
    const term = produtoFilter.toLowerCase();
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(term) ||
        p.categoria.toLowerCase().includes(term) ||
        (p.codigo && p.codigo.toLowerCase().includes(term)),
    );
  }, [produtos, produtoFilter]);

  const filteredModelos = useMemo(() => {
    if (!modeloFilter.trim()) return modelos;
    const term = modeloFilter.toLowerCase();
    return modelos.filter((m) => m.nome.toLowerCase().includes(term));
  }, [modelos, modeloFilter]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleProdutoChange = (value: string) => {
    const produto = produtos.find((p) => p.id === value) ?? null;
    onProdutoChange(produto);
  };

  const handleModeloChange = (value: string) => {
    const modelo = modelos.find((m) => m.id === value) ?? null;
    onModeloChange(modelo);
  };

  // ─── Selected modelo for metadata display ───────────────────────────────

  const selectedModelo = modeloId
    ? modelos.find((m) => m.id === modeloId) ?? null
    : null;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Produto select */}
      <div>
        <Label className="text-xs text-slate-500">Produto *</Label>
        <Select
          value={produtoId ?? ""}
          onValueChange={handleProdutoChange}
          onOpenChange={handleProdutoOpenChange}
        >
          <SelectTrigger className="mt-1.5 rounded-xl" disabled={produtosLoading}>
            {produtosLoading ? (
              <span className="flex items-center gap-2 text-slate-400">
                <Loader2 className="animate-spin" size={14} />
                Carregando...
              </span>
            ) : (
              <SelectValue placeholder="Selecionar produto" />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectSearchInput
              value={produtoFilter}
              onChange={setProdutoFilter}
              placeholder="Buscar produto..."
            />
            {filteredProdutos.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400">
                Nenhum produto encontrado
              </div>
            ) : (
              filteredProdutos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <span>{p.nome}</span>
                    <span className="text-xs text-slate-400">
                      {p.categoria}
                    </span>
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Modelo select */}
      <div>
        <Label className="text-xs text-slate-500">Modelo *</Label>
        <Select
          value={modeloId ?? ""}
          onValueChange={handleModeloChange}
          onOpenChange={handleModeloOpenChange}
          disabled={!produtoId || modelosLoading}
        >
          <SelectTrigger className="mt-1.5 rounded-xl" disabled={!produtoId}>
            {modelosLoading ? (
              <span className="flex items-center gap-2 text-slate-400">
                <Loader2 className="animate-spin" size={14} />
                Carregando...
              </span>
            ) : (
              <SelectValue
                placeholder={
                  !produtoId
                    ? "Selecione um produto primeiro"
                    : "Selecionar modelo"
                }
              />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectSearchInput
              value={modeloFilter}
              onChange={setModeloFilter}
              placeholder="Buscar modelo..."
            />
            {filteredModelos.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400">
                {modelos.length === 0
                  ? "Nenhum modelo cadastrado"
                  : "Nenhum modelo encontrado"}
              </div>
            ) : (
              filteredModelos.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Modelo metadata badges */}
      {selectedModelo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Dimensions */}
            {selectedModelo.largura_cm != null &&
              selectedModelo.altura_cm != null && (
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-700 border-blue-200 rounded-lg gap-1.5 font-medium"
                >
                  <Ruler size={12} />
                  {selectedModelo.largura_cm}x{selectedModelo.altura_cm}cm
                </Badge>
              )}

            {/* Materiais count */}
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-700 border-blue-200 rounded-lg gap-1.5 font-medium"
            >
              <Package size={12} />
              {selectedModelo.materiais?.length ?? 0}{" "}
              {(selectedModelo.materiais?.length ?? 0) === 1
                ? "material"
                : "materiais"}
            </Badge>

            {/* Processos count */}
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-700 border-blue-200 rounded-lg gap-1.5 font-medium"
            >
              <Cog size={12} />
              {selectedModelo.processos?.length ?? 0}{" "}
              {(selectedModelo.processos?.length ?? 0) === 1
                ? "processo"
                : "processos"}
            </Badge>

            {/* Markup */}
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-700 border-blue-200 rounded-lg gap-1.5 font-medium"
            >
              <Percent size={12} />
              Markup: {selectedModelo.markup_padrao}%
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}

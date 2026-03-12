import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Ruler, Package, Cog, Percent, ShieldCheck, Star } from "lucide-react";
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
  useCategorias,
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
  const { data: categorias = [], isLoading: categoriasLoading } = useCategorias();
  const { data: produtos = [], isLoading: produtosLoading } = useProdutos();
  const { data: modelos = [], isLoading: modelosLoading } = useProdutoModelos(
    produtoId ?? undefined,
  );

  const [categoriaId, setCategoriaId] = useState<string>("");
  const [produtoFilter, setProdutoFilter] = useState("");
  const [modeloFilter, setModeloFilter] = useState("");

  // Reset produto + modelo when categoria changes
  // "__all__" is the sentinel for "Todas as categorias" — Radix does not allow value=""
  const handleCategoriaChange = (value: string) => {
    setCategoriaId(value === "__all__" ? "" : value);
    onProdutoChange(null);
    onModeloChange(null);
  };

  // Reset modelo when produto changes
  useEffect(() => {
    onModeloChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoId]);

  // Clear filters when selects close
  const handleProdutoOpenChange = (open: boolean) => {
    if (!open) setProdutoFilter("");
  };
  const handleModeloOpenChange = (open: boolean) => {
    if (!open) setModeloFilter("");
  };

  // ─── Filtered lists ─────────────────────────────────────────────────────

  const produtosPorCategoria = useMemo(() => {
    if (!categoriaId) return produtos;
    return produtos.filter((p) => p.categoria_id === categoriaId);
  }, [produtos, categoriaId]);

  const filteredProdutos = useMemo(() => {
    if (!produtoFilter.trim()) return produtosPorCategoria;
    const term = produtoFilter.toLowerCase();
    return produtosPorCategoria.filter(
      (p) =>
        p.nome.toLowerCase().includes(term) ||
        p.categoria.toLowerCase().includes(term) ||
        (p.codigo && p.codigo.toLowerCase().includes(term)),
    );
  }, [produtosPorCategoria, produtoFilter]);

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

  const isLoading = categoriasLoading || produtosLoading;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Categoria select */}
      <div>
        <Label className="text-xs text-slate-500">Categoria</Label>
        <Select
          value={categoriaId || "__all__"}
          onValueChange={handleCategoriaChange}
          disabled={isLoading}
        >
          <SelectTrigger className="mt-1.5 rounded-xl">
            {isLoading ? (
              <span className="flex items-center gap-2 text-slate-400">
                <Loader2 className="animate-spin" size={14} />
                Carregando...
              </span>
            ) : (
              <SelectValue placeholder="Todas as categorias" />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  {c.icone && <span>{c.icone}</span>}
                  {c.nome}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Produto select */}
      <div>
        <Label className="text-xs text-slate-500">Produto *</Label>
        <Select
          value={produtoId ?? ""}
          onValueChange={handleProdutoChange}
          onOpenChange={handleProdutoOpenChange}
          disabled={isLoading}
        >
          <SelectTrigger className="mt-1.5 rounded-xl">
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
                    {!categoriaId && (
                      <span className="text-xs text-slate-400">{p.categoria}</span>
                    )}
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
                  <span className="flex items-center gap-2">
                    <span>{m.nome}</span>
                    {m.linha_qualidade === 'primeira' && (
                      <span className="text-[10px] text-amber-600 font-medium">★ 1ª linha</span>
                    )}
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Modelo metadata badges + descritivo */}
      {selectedModelo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Linha de qualidade */}
            {selectedModelo.linha_qualidade === 'primeira' && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 rounded-lg gap-1.5 font-medium">
                <Star size={11} />
                1ª Linha
              </Badge>
            )}
            {selectedModelo.linha_qualidade === 'segunda' && (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 rounded-lg gap-1.5 font-medium">
                2ª Linha
              </Badge>
            )}

            {/* Garantia */}
            {selectedModelo.garantia_meses != null && (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 border-emerald-200 rounded-lg gap-1.5 font-medium"
              >
                <ShieldCheck size={11} />
                {selectedModelo.garantia_meses < 12
                  ? `${selectedModelo.garantia_meses} meses`
                  : `${selectedModelo.garantia_meses / 12} ano${selectedModelo.garantia_meses >= 24 ? 's' : ''}`}
              </Badge>
            )}

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

          {/* Descritivo técnico */}
          {selectedModelo.descritivo_tecnico && (
            <div className="border-t border-blue-200 pt-2">
              <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-1">
                Descritivo Técnico
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">
                {selectedModelo.descritivo_tecnico}
              </p>
            </div>
          )}

          {/* Garantia descrição */}
          {selectedModelo.garantia_descricao && (
            <div className="border-t border-blue-200 pt-2">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">
                Garantia
              </p>
              <p className="text-xs text-slate-600">
                {selectedModelo.garantia_descricao}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

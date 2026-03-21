import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, Loader2, LayoutTemplate } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateItem {
  descricao: string;
  especificacao: string | null;
  quantidade: number;
  largura_cm: number | null;
  altura_cm: number | null;
  markup_percentual: number;
}

export interface OrcamentoTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  itens: TemplateItem[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: OrcamentoTemplate) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplateSelector({
  open,
  onClose,
  onSelect,
}: TemplateSelectorProps) {
  const [search, setSearch] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  // ---- Data fetching -------------------------------------------------------

  const {
    data: templates = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["templates_orcamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates_orcamento" as any)
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return (data ?? []) as unknown as OrcamentoTemplate[];
    },
    retry: false, // Don't retry if table doesn't exist
    enabled: open,
  });

  // ---- Derived state -------------------------------------------------------

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const term = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.nome.toLowerCase().includes(term) ||
        t.descricao?.toLowerCase().includes(term) ||
        t.categoria?.toLowerCase().includes(term),
    );
  }, [templates, search]);

  const previewTemplate = useMemo(
    () => (previewId ? templates.find((t) => t.id === previewId) ?? null : null),
    [templates, previewId],
  );

  // ---- Handlers ------------------------------------------------------------

  function handleSelect(template: OrcamentoTemplate) {
    onSelect(template);
    onClose();
    setSearch("");
    setPreviewId(null);
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      onClose();
      setSearch("");
      setPreviewId(null);
    }
  }

  // ---- Render helpers ------------------------------------------------------

  function renderLoading() {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <p className="text-sm text-slate-400">Carregando templates...</p>
      </div>
    );
  }

  function renderError() {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
        <LayoutTemplate className="h-10 w-10 text-slate-300" />
        <p className="text-sm text-slate-500">
          Templates serao disponibilizados em breve.
        </p>
        <p className="text-xs text-slate-400">
          Voce pode criar orcamentos manualmente.
        </p>
      </div>
    );
  }

  function renderEmpty() {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
        <FileText className="h-10 w-10 text-slate-300" />
        {search.trim() ? (
          <>
            <p className="text-sm text-slate-500">
              Nenhum template encontrado para &ldquo;{search}&rdquo;
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600"
              onClick={() => setSearch("")}
            >
              Limpar busca
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Nenhum template cadastrado.
            </p>
            <p className="text-xs text-slate-400">
              Crie seu primeiro orcamento e salve como template.
            </p>
          </>
        )}
      </div>
    );
  }

  function renderPreview(template: OrcamentoTemplate) {
    return (
      <div className="space-y-3">
        {/* Back + header */}
        <button
          type="button"
          onClick={() => setPreviewId(null)}
          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          &larr; Voltar para lista
        </button>

        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            {template.nome}
          </h3>
          {template.descricao && (
            <p className="text-xs text-slate-500 mt-0.5">
              {template.descricao}
            </p>
          )}
        </div>

        {/* Items table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Item</span>
            <span className="text-right">Qtd</span>
            <span className="text-right">Dimensoes</span>
          </div>

          <ScrollArea className="max-h-48">
            {template.itens.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-t border-slate-100 text-xs"
              >
                <div>
                  <p className="text-slate-700 font-medium">{item.descricao}</p>
                  {item.especificacao && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.especificacao}
                    </p>
                  )}
                </div>
                <span className="text-right text-slate-600 tabular-nums">
                  {item.quantidade}
                </span>
                <span className="text-right text-slate-500 tabular-nums">
                  {item.largura_cm && item.altura_cm
                    ? `${item.largura_cm} x ${item.altura_cm} cm`
                    : "\u2014"}
                </span>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Apply button */}
        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => handleSelect(template)}
          >
            Usar Template
          </Button>
        </div>
      </div>
    );
  }

  function renderList() {
    return (
      <ScrollArea className="max-h-[400px]">
        <div className="space-y-2">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="group border border-slate-200 rounded-xl p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-colors cursor-pointer"
              onClick={() => setPreviewId(template.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPreviewId(template.id);
                }
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <FileText className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {template.nome}
                    </p>
                    {template.descricao && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {template.descricao}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-slate-400">
                        {template.itens.length}{" "}
                        {template.itens.length === 1 ? "item" : "itens"}
                      </span>
                      {template.categoria && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-1.5 py-0 h-4 bg-slate-100 text-slate-500 font-normal"
                        >
                          {template.categoria}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(template);
                  }}
                >
                  Usar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  // ---- Main render ---------------------------------------------------------

  const showList = !isLoading && !isError && filtered.length > 0;
  const showEmpty = !isLoading && !isError && filtered.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <LayoutTemplate className="h-5 w-5 text-blue-600" />
            Usar Template
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        {!isError && !isLoading && templates.length > 0 && (
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar template..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-xl text-sm"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-5 pb-5">
          {isLoading && renderLoading()}
          {isError && renderError()}
          {showEmpty && renderEmpty()}
          {showList && !previewTemplate && renderList()}
          {showList && previewTemplate && renderPreview(previewTemplate)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

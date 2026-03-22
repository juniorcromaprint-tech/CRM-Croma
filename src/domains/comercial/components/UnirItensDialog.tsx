// ============================================================================
// UNIR ITENS DIALOG — União de Itens do Orçamento
// Permite agrupar múltiplos itens sob um nome de exibição único para o cliente.
// Internamente cada item mantém seus custos individuais.
// ============================================================================

import React, { useState } from "react";
import { Layers, X, Check, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/shared/utils/format";
import { showSuccess, showError } from "@/utils/toast";
import { orcamentoService } from "../services/orcamento.service";
import type { OrcamentoItem } from "../services/orcamento.service";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UnirItensDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propostaId: string;
  itens: OrcamentoItem[];
  onSuccess: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UnirItensDialog({
  open,
  onOpenChange,
  propostaId: _propostaId,
  itens,
  onSuccess,
}: UnirItensDialogProps) {
  const [nomeExibicao, setNomeExibicao] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Derive itens que já pertencem a algum grupo para destacá-los
  const itensSemGrupo = itens.filter((i) => !i.grupo_uniao);
  const itensComGrupo = itens.filter((i) => i.grupo_uniao);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalSelecionado = itens
    .filter((i) => selectedIds.has(i.id))
    .reduce((sum, i) => sum + i.valor_total, 0);

  const handleSubmit = async () => {
    if (selectedIds.size < 2) {
      showError("Selecione pelo menos 2 itens para agrupar");
      return;
    }
    if (!nomeExibicao.trim()) {
      showError("Informe o nome de exibição para o grupo");
      return;
    }

    setIsSaving(true);
    try {
      await orcamentoService.agruparItens(Array.from(selectedIds), nomeExibicao.trim());
      showSuccess(`Itens agrupados como "${nomeExibicao.trim()}"`);
      setNomeExibicao("");
      setSelectedIds(new Set());
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Erro ao agrupar itens");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setNomeExibicao("");
    setSelectedIds(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Layers size={16} className="text-blue-600" />
            </div>
            Agrupar Itens
          </DialogTitle>
          <DialogDescription>
            Os itens selecionados aparecerão como um único produto para o cliente,
            com o nome e valor total combinados. Os custos internos permanecem individuais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Nome de exibição */}
          <div>
            <Label className="text-sm font-medium">
              Nome de exibição para o cliente *
            </Label>
            <Input
              value={nomeExibicao}
              onChange={(e) => setNomeExibicao(e.target.value)}
              placeholder="Ex: Fachada Completa ACM + Letras Caixa"
              className="mt-1.5 rounded-xl"
              maxLength={200}
            />
            <p className="text-xs text-slate-400 mt-1">
              Este nome substitui os nomes individuais no portal e no PDF
            </p>
          </div>

          {/* Itens disponíveis */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">
                Selecione os itens a agrupar
              </Label>
              {selectedIds.size > 0 && (
                <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""} · {brl(totalSelecionado)}
                </Badge>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {/* Itens sem grupo */}
              {itensSemGrupo.map((item) => (
                <ItemCheckboxRow
                  key={item.id}
                  item={item}
                  checked={selectedIds.has(item.id)}
                  onToggle={toggleItem}
                />
              ))}

              {/* Itens já agrupados — exibidos mas não selecionáveis */}
              {itensComGrupo.length > 0 && (
                <>
                  <div className="flex items-center gap-2 py-1">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-xs text-slate-400">Já agrupados</span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  {itensComGrupo.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
                    >
                      <div className="w-4 h-4 rounded border border-slate-200 bg-slate-100 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-500 truncate">{item.descricao}</p>
                        {item.nome_exibicao && (
                          <p className="text-xs text-slate-400 truncate">
                            Grupo: {item.nome_exibicao}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 tabular-nums flex-shrink-0">
                        {brl(item.valor_total)}
                      </span>
                    </div>
                  ))}
                </>
              )}

              {itensSemGrupo.length === 0 && itensComGrupo.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm">
                  Nenhum item disponível
                </div>
              )}

              {itensSemGrupo.length === 0 && itensComGrupo.length > 0 && (
                <div className="text-center py-4 text-slate-400 text-sm">
                  Todos os itens já estão agrupados
                </div>
              )}
            </div>
          </div>

          {/* Aviso mínimo */}
          {selectedIds.size === 1 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="flex-shrink-0" />
              Selecione pelo menos 2 itens para criar um grupo
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="rounded-xl"
            disabled={isSaving}
          >
            <X size={14} className="mr-1.5" />
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedIds.size < 2 || !nomeExibicao.trim() || isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Agrupando...
              </span>
            ) : (
              <>
                <Check size={14} className="mr-1.5" />
                Agrupar {selectedIds.size > 0 ? `${selectedIds.size} itens` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ItemCheckboxRow ─────────────────────────────────────────────────────────

interface ItemCheckboxRowProps {
  item: OrcamentoItem;
  checked: boolean;
  onToggle: (id: string) => void;
}

function ItemCheckboxRow({ item, checked, onToggle }: ItemCheckboxRowProps) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
        checked
          ? "border-blue-300 bg-blue-50"
          : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
      }`}
      onClick={() => onToggle(item.id)}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(item.id)}
        className="flex-shrink-0"
        id={`item-check-${item.id}`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${checked ? "text-blue-800" : "text-slate-700"}`}>
          {item.descricao}
        </p>
        {item.especificacao && (
          <p className="text-xs text-slate-400 truncate mt-0.5">{item.especificacao}</p>
        )}
        {item.largura_cm != null && item.altura_cm != null && (
          <p className="text-xs text-slate-400 mt-0.5">
            {item.largura_cm}x{item.altura_cm}cm
          </p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-semibold tabular-nums ${checked ? "text-blue-700" : "text-slate-700"}`}>
          {brl(item.valor_total)}
        </p>
        <p className="text-xs text-slate-400 tabular-nums">Qtd: {item.quantidade}</p>
      </div>
    </div>
  );
}

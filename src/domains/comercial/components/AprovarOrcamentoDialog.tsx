// ============================================================================
// AprovarOrcamentoDialog — confirmação para aprovar e enviar orçamento SHADOW
// MVP BLOCO 0.5 — Beira Rio
//
// Regras obrigatórias:
// - .claude/rules/alert-dialog-async.md → e.preventDefault() antes de await
// - .claude/rules/supabase-mutations.md  → mutation usa .select().single()
// ============================================================================

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/shared/utils/format";
import { useAprovarPendente } from "../hooks/useOrcamentosPendentes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propostaId: string | null;
  numero?: string;
  total?: number;
}

export default function AprovarOrcamentoDialog({
  open,
  onOpenChange,
  propostaId,
  numero,
  total,
}: Props) {
  const [comentario, setComentario] = useState("");
  const aprovar = useAprovarPendente();

  useEffect(() => {
    if (!open) setComentario("");
  }, [open]);

  const handleConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Regra obrigatória: AlertDialogAction com async precisa de preventDefault
    e.preventDefault();
    if (!propostaId) return;
    await aprovar.mutateAsync({
      propostaId,
      comentario: comentario.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl max-w-md mx-4">
        <AlertDialogHeader>
          <AlertDialogTitle>Aprovar e enviar orçamento</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                Tem certeza que deseja aprovar{" "}
                <strong className="text-slate-800">{numero ?? "este orçamento"}</strong>
                {total !== undefined && (
                  <>
                    {" "}no valor de{" "}
                    <strong className="text-slate-800">{brl(total)}</strong>
                  </>
                )}
                ? Ele será marcado como enviado.
              </p>
              <p className="text-xs text-slate-400">
                Esta ação não envia automaticamente para o cliente — apenas marca
                a proposta como aprovada internamente no ERP.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-2">
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Comentário (opcional)
          </label>
          <Textarea
            placeholder="Ex.: preço dentro da faixa histórica, prazo ok."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="rounded-xl resize-none border-slate-200"
            rows={3}
            maxLength={500}
          />
          <p className="text-[10px] text-slate-400 mt-1 text-right">
            {comentario.length}/500
          </p>
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl" disabled={aprovar.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={aprovar.isPending}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {aprovar.isPending ? (
              <>
                <Loader2 className="animate-spin mr-2" size={16} />
                Aprovando...
              </>
            ) : (
              "Aprovar e enviar"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

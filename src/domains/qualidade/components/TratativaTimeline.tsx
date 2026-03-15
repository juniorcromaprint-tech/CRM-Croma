// src/domains/qualidade/components/TratativaTimeline.tsx

import { useState } from "react";
import { useAdicionarTratativa } from "../hooks/useTratativas";
import { Tratativa } from "../types/qualidade.types";
import { formatDate } from "@/shared/utils/format";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  MessageSquarePlus,
  Loader2,
  ClipboardList,
} from "lucide-react";

// ─── Props ───────────────────────────────────────────────────────────────────

interface TratativaTimelineProps {
  tratativas: Tratativa[];
  ocorrencia_id: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TratativaTimeline({
  tratativas,
  ocorrencia_id,
}: TratativaTimelineProps) {
  const adicionarTratativa = useAdicionarTratativa();

  const [acaoCorretiva, setAcaoCorretiva] = useState("");
  const [prazo, setPrazo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acaoCorretiva.trim()) return;

    await adicionarTratativa.mutateAsync({
      ocorrencia_id,
      acao_corretiva: acaoCorretiva.trim(),
      prazo: prazo || undefined,
      observacoes: observacoes.trim() || undefined,
    });

    setAcaoCorretiva("");
    setPrazo("");
    setObservacoes("");
  }

  return (
    <div className="space-y-6">
      {/* Timeline */}
      {tratativas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <ClipboardList size={36} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhuma tratativa ainda</h3>
          <p className="text-sm text-slate-400 mt-1">
            Adicione a primeira tratativa abaixo
          </p>
        </div>
      ) : (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-slate-200" />

          <div className="space-y-5">
            {tratativas.map((t) => (
              <div key={t.id} className="relative">
                {/* Dot */}
                <div className="absolute -left-4 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 ml-2">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-medium text-slate-500">
                      Ação Corretiva
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(t.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {t.acao_corretiva ?? "—"}
                  </p>
                  {(t.prazo || t.data_conclusao || t.observacoes) && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-500">
                      {t.prazo && (
                        <p>
                          <span className="font-medium">Prazo:</span>{" "}
                          {formatDate(t.prazo)}
                        </p>
                      )}
                      {t.data_conclusao && (
                        <p className="flex items-center gap-1">
                          <CheckCircle2 size={10} className="text-green-500" />
                          <span className="font-medium">Concluída em:</span>{" "}
                          {formatDate(t.data_conclusao)}
                        </p>
                      )}
                      {t.observacoes && (
                        <p>
                          <span className="font-medium">Obs:</span>{" "}
                          {t.observacoes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add tratativa form */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <MessageSquarePlus size={15} className="text-blue-500" />
          Adicionar Tratativa
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>
              Ação Corretiva <span className="text-red-500">*</span>
            </Label>
            <Textarea
              className="rounded-xl bg-white resize-none"
              rows={3}
              placeholder="Descreva a ação corretiva realizada ou planejada..."
              value={acaoCorretiva}
              onChange={(e) => setAcaoCorretiva(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Prazo (opcional)</Label>
            <Input
              type="date"
              className="rounded-xl bg-white"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Observações (opcional)</Label>
            <Textarea
              className="rounded-xl bg-white resize-none"
              rows={2}
              placeholder="Observações adicionais..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700"
            disabled={adicionarTratativa.isPending || !acaoCorretiva.trim()}
          >
            {adicionarTratativa.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Registrar Tratativa
          </Button>
        </form>
      </div>
    </div>
  );
}

export default TratativaTimeline;

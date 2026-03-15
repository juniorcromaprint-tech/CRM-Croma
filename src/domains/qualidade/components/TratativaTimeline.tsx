// src/domains/qualidade/components/TratativaTimeline.tsx

import { useState } from "react";
import { useAdicionarTratativa } from "../hooks/useTratativas";
import { Tratativa } from "../types/qualidade.types";
import { formatDate } from "@/shared/utils/format";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  MessageSquarePlus,
  Loader2,
  ClipboardList,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const TIPO_OPTIONS = [
  { value: "analise", label: "Análise" },
  { value: "acao_corretiva", label: "Ação Corretiva" },
  { value: "acao_preventiva", label: "Ação Preventiva" },
  { value: "verificacao", label: "Verificação" },
];

const TIPO_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  analise: {
    label: "Análise",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Search,
  },
  acao_corretiva: {
    label: "Ação Corretiva",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    icon: Wrench,
  },
  acao_preventiva: {
    label: "Ação Preventiva",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: ShieldCheck,
  },
  verificacao: {
    label: "Verificação",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: CheckCircle2,
  },
};

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

  const [tipo, setTipo] = useState("");
  const [descricao, setDescricao] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo || !descricao.trim()) return;

    await adicionarTratativa.mutateAsync({
      ocorrencia_id,
      tipo: tipo as Tratativa["tipo"],
      descricao: descricao.trim(),
    });

    setTipo("");
    setDescricao("");
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
            {tratativas.map((t, idx) => {
              const cfg = TIPO_CONFIG[t.tipo] ?? TIPO_CONFIG.analise;
              const Icon = cfg.icon;

              return (
                <div key={t.id} className="relative">
                  {/* Dot */}
                  <div className="absolute -left-4 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4 ml-2">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${cfg.color} flex items-center gap-1`}
                      >
                        <Icon size={10} />
                        {cfg.label}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {formatDate(t.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {t.descricao}
                    </p>
                  </div>
                </div>
              );
            })}
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
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="rounded-xl bg-white">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              className="rounded-xl bg-white resize-none"
              rows={3}
              placeholder="Descreva a ação realizada ou a análise feita..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700"
            disabled={adicionarTratativa.isPending || !tipo || !descricao.trim()}
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

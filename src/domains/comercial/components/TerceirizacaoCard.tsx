import React, { useState } from "react";
import { Truck, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl } from "@/shared/utils/format";
import type { TerceirizacaoSugestao } from "../hooks/useTerceirizacaoSugestao";

interface TerceirizacaoCardProps {
  sugestoes: TerceirizacaoSugestao[];
  precoInternoTotal: number | null;
  isLoading?: boolean;
  onSelecionar: (sugestao: TerceirizacaoSugestao) => void;
  selecionado?: string | null; // catalogo_id selecionado
}

export default function TerceirizacaoCard({
  sugestoes,
  precoInternoTotal,
  isLoading,
  onSelecionar,
  selecionado,
}: TerceirizacaoCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading || sugestoes.length === 0) return null;

  const maquinaParada = sugestoes[0]?.maquina_em_manutencao;
  const melhor = sugestoes[0];
  const demais = sugestoes.slice(1, 5);

  const economia =
    precoInternoTotal && melhor.preco_total_estimado < precoInternoTotal
      ? precoInternoTotal - melhor.preco_total_estimado
      : null;

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-colors ${
        maquinaParada
          ? "border-blue-400 bg-blue-50"
          : "border-amber-300 bg-amber-50"
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={16} className={maquinaParada ? "text-blue-600" : "text-amber-600"} />
          <span className={`text-sm font-semibold ${maquinaParada ? "text-blue-800" : "text-amber-800"}`}>
            Alternativa de Fornecimento
          </span>
        </div>
        <div className="flex items-center gap-2">
          {maquinaParada && (
            <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0.5">
              <AlertTriangle size={10} className="mr-1" />
              Máquina parada
            </Badge>
          )}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className={`${maquinaParada ? "text-blue-500 hover:text-blue-700" : "text-amber-500 hover:text-amber-700"} transition-colors`}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Melhor opção — sempre visível */}
      <div className="px-4 pb-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{melhor.nome}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {melhor.fornecedor_nome} • {melhor.prazo || "Prazo não informado"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-blue-700 tabular-nums">{brl(melhor.preco_total_estimado)}</p>
              <p className="text-[10px] text-slate-400 tabular-nums">
                {brl(melhor.preco_unitario_venda)}/{melhor.preco_unidade}
              </p>
            </div>
          </div>

          {economia && economia > 0 && (
            <p className="text-xs text-emerald-600 font-medium mt-1.5">
              Economia de {brl(economia)} vs produção interna
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <Button
              type="button"
              size="sm"
              variant={selecionado === melhor.catalogo_id ? "default" : "outline"}
              className={`rounded-lg text-xs h-7 ${
                selecionado === melhor.catalogo_id
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : ""
              }`}
              onClick={() => onSelecionar(melhor)}
            >
              {selecionado === melhor.catalogo_id ? (
                <>
                  <Check size={12} className="mr-1" /> Selecionado
                </>
              ) : (
                "Usar este fornecedor"
              )}
            </Button>
            {melhor.url && (
              <a
                href={melhor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-0.5"
              >
                <ExternalLink size={10} /> Ver no site
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Demais opções — colapsável */}
      {expanded && demais.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-xs font-medium text-slate-500">Outras opções</p>
          {demais.map((s) => (
            <div
              key={s.catalogo_id}
              className={`bg-white rounded-xl border p-3 ${
                selecionado === s.catalogo_id ? "border-emerald-400" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{s.nome}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.fornecedor_nome}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-700 tabular-nums">{brl(s.preco_total_estimado)}</p>
                  <p className="text-[10px] text-slate-400 tabular-nums">
                    {brl(s.preco_unitario_venda)}/{s.preco_unidade}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant={selecionado === s.catalogo_id ? "default" : "ghost"}
                  className={`rounded-lg text-xs h-7 ${
                    selecionado === s.catalogo_id
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : ""
                  }`}
                  onClick={() => onSelecionar(s)}
                >
                  {selecionado === s.catalogo_id ? (
                    <>
                      <Check size={12} className="mr-1" /> Selecionado
                    </>
                  ) : (
                    "Selecionar"
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

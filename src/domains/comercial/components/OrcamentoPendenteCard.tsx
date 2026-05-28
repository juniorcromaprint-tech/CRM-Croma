// ============================================================================
// OrcamentoPendenteCard — card rico para revisão de orçamentos SHADOW
// MVP BLOCO 0.5 — Beira Rio
//
// Mostra: número, status, total, loja, briefing original, dados extraídos,
// faixa histórica, endereço/GPS, botões de ação.
// ============================================================================

import React from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Pencil,
  Bell,
  XCircle,
  MapPin,
  Sparkles,
  Quote,
  Wrench,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { brl, formatDateRelative, formatArea } from "@/shared/utils/format";
import type { PropostaPendente } from "../hooks/useOrcamentosPendentes";
import { usePingarViviane } from "../hooks/useOrcamentosPendentes";

interface Props {
  proposta: PropostaPendente;
  onAprovar: (p: PropostaPendente) => void;
  onRecusar?: (p: PropostaPendente) => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  rascunho: {
    label: "RASCUNHO",
    cls: "bg-slate-100 text-slate-600 border-slate-200",
  },
  enviada: {
    label: "MARCADA COMO ENVIADA",
    cls: "bg-amber-100 text-amber-700 border-amber-200",
  },
};

export default function OrcamentoPendenteCard({
  proposta,
  onAprovar,
  onRecusar,
}: Props) {
  const pingar = usePingarViviane();
  const ctx = proposta.ai_request?.contexto;
  const parsed = ctx?.parsed;
  const store = ctx?.store;
  const senderNome = ctx?.sender?.profile_name;
  const briefingRaw = ctx?.briefing;
  const lookupTier = ctx?.lookup_tier;
  const instalacao = ctx?.instalacao;

  const storeName = store?.name ?? ctx?.store_name ?? "Loja desconhecida";
  const storeCode = store?.code ?? ctx?.store_code ?? null;
  const cidade = store?.city ?? null;
  const estado = store?.state ?? null;
  const endereco = store?.address ?? null;
  const lat = store?.lat;
  const lng = store?.lng;
  const gpsLink =
    lat && lng
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`
      : null;

  const statusInfo = STATUS_BADGE[proposta.status] ?? STATUS_BADGE.rascunho;

  // Resumo extraído
  const extracaoLabel = parsed
    ? [
        parsed.material,
        parsed.largura_cm && parsed.altura_cm
          ? `${parsed.largura_cm}x${parsed.altura_cm}cm`
          : null,
        parsed.quantidade ? `${parsed.quantidade}un` : null,
        parsed.code ? `code=${parsed.code}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  // Faixa histórica
  const faixa = proposta.faixa;

  const areaTotal = (proposta.itens ?? []).reduce(
    (s, i) => s + ((i.area_m2 ?? 0) * (i.quantidade ?? 1)),
    0,
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header — número, badge SHADOW, total */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="text-sm font-mono font-semibold text-slate-700">
              {proposta.numero}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.cls}`}
              title="Gerado por IA — aguardando revisão humana"
            >
              <Sparkles size={10} />
              SHADOW · {statusInfo.label}
            </span>
            {instalacao && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                <Wrench size={10} />
                COM INSTALAÇÃO
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            <strong className="text-slate-700">{storeName}</strong>
            {storeCode && (
              <span className="text-slate-400"> · {storeCode}</span>
            )}
            {(cidade || estado) && (
              <span className="text-slate-400">
                {" "}
                · {[cidade, estado].filter(Boolean).join("/")}
              </span>
            )}
          </p>
          {senderNome && (
            <p className="text-xs text-slate-400 mt-0.5">
              via WhatsApp · {senderNome}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-1">
            Recebido {formatDateRelative(proposta.created_at)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold tabular-nums text-slate-800">
            {brl(proposta.total ?? 0)}
          </p>
          {areaTotal > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              {formatArea(areaTotal)}
              {faixa?.preco_m2_atual !== undefined && faixa.preco_m2_atual > 0 && (
                <> · {brl(faixa.preco_m2_atual)}/m²</>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Briefing original */}
      {briefingRaw && (
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-start gap-2">
            <Quote
              size={14}
              className="text-slate-400 shrink-0 mt-0.5"
            />
            <p className="text-sm text-slate-600 italic whitespace-pre-line">
              {briefingRaw}
            </p>
          </div>
        </div>
      )}

      {/* Extração + Lookup */}
      <div className="px-5 py-3 space-y-2">
        {extracaoLabel && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[80px] mt-0.5">
              Extraído:
            </span>
            <span className="text-slate-700">{extracaoLabel}</span>
          </div>
        )}
        {lookupTier && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[80px] mt-0.5">
              Lookup:
            </span>
            <span className="text-slate-700 font-mono text-xs">
              {lookupTier}
            </span>
            {lookupTier !== "code_exact" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle size={12} className="text-amber-500 mt-1" />
                </TooltipTrigger>
                <TooltipContent>
                  Loja não foi resolvida por código exato — confira se está
                  certa antes de aprovar.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* Faixa histórica */}
        <div className="flex items-start gap-2 text-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[80px] mt-0.5">
            Faixa 180d:
          </span>
          {faixa?.status === "ok" ? (
            <span className="text-slate-700 flex items-center gap-2 flex-wrap">
              <span>
                {brl(faixa.min ?? 0)}–{brl(faixa.max ?? 0)}/m²
              </span>
              <span className="text-xs text-slate-400">
                (mediana {brl(faixa.mediana ?? 0)} · n={faixa.amostras})
              </span>
              {faixa.dentro ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  DENTRO
                </span>
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  FORA
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-slate-400 italic">
              amostra insuficiente ({faixa?.amostras ?? 0} props)
            </span>
          )}
        </div>

        {/* Endereço / GPS */}
        {(endereco || gpsLink) && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[80px] mt-0.5">
              Endereço:
            </span>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              {endereco && (
                <span className="text-slate-700 truncate">{endereco}</span>
              )}
              {gpsLink && (
                <a
                  href={gpsLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <MapPin size={11} />
                  GPS: {lat?.toFixed(4)}, {lng?.toFixed(4)}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2 justify-end">
        {onRecusar && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl h-9 text-slate-500 hover:bg-red-50 hover:text-red-600"
            onClick={() => onRecusar(proposta)}
          >
            <XCircle size={14} className="mr-1.5" />
            Recusar
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl h-9 border-slate-200"
          onClick={() => pingar.mutate(proposta.id)}
          disabled={pingar.isPending}
        >
          {pingar.isPending ? (
            <Loader2 className="animate-spin mr-1.5" size={14} />
          ) : (
            <Bell size={14} className="mr-1.5" />
          )}
          Pingar Vivi
        </Button>
        <Link to={`/orcamentos/${proposta.id}/editar`}>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-9 border-slate-200"
          >
            <Pencil size={14} className="mr-1.5" />
            Editar
          </Button>
        </Link>
        <Button
          size="sm"
          className="rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => onAprovar(proposta)}
        >
          <CheckCircle2 size={14} className="mr-1.5" />
          Aprovar e enviar
        </Button>
      </div>
    </div>
  );
}

import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Loader2, Printer, CheckCircle, XCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useOrcamento, useAtualizarOrcamento, useConverterParaPedido } from "../hooks/useOrcamentos";
import { brl } from "@/shared/utils/format";
import type { OrcamentoStatus } from "../services/orcamento.service";

const STATUS_CONFIG: Record<OrcamentoStatus, { label: string; cls: string }> = {
  rascunho:    { label: "Rascunho",     cls: "bg-slate-100 text-slate-600" },
  enviada:     { label: "Enviada",      cls: "bg-blue-100 text-blue-700" },
  em_revisao:  { label: "Em Revisão",   cls: "bg-amber-100 text-amber-700" },
  aprovada:    { label: "Aprovada",     cls: "bg-emerald-100 text-emerald-700" },
  recusada:    { label: "Recusada",     cls: "bg-red-100 text-red-700" },
  expirada:    { label: "Expirada",     cls: "bg-slate-100 text-slate-500" },
};

export default function OrcamentoViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: orc, isLoading } = useOrcamento(id);
  const atualizar = useAtualizarOrcamento();
  const converter = useConverterParaPedido();

  const handleEnviar = () => {
    if (!id) return;
    atualizar.mutate({ id, updates: { status: "enviada" } });
  };

  const handleAprovar = () => {
    if (!id) return;
    atualizar.mutate({ id, updates: { status: "aprovada", aprovado_em: new Date().toISOString() } });
  };

  const handleRecusar = () => {
    if (!id) return;
    atualizar.mutate({ id, updates: { status: "recusada" } });
  };

  const handleConverterParaPedido = async () => {
    if (!id) return;
    await converter.mutateAsync(id);
    navigate("/pedidos");
  };

  if (isLoading || !orc) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const sc = STATUS_CONFIG[orc.status] ?? STATUS_CONFIG.rascunho;

  // Access itens via type assertion
  const orcamentoItens = (orc as {
    itens?: Array<{
      id: string;
      descricao: string;
      especificacao: string | null;
      quantidade: number;
      largura_cm: number | null;
      altura_cm: number | null;
      area_m2: number | null;
      valor_unitario: number;
      valor_total: number;
    }>;
  }).itens ?? [];

  return (
    <div className="max-w-4xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center gap-4 print:hidden">
        <Link to="/orcamentos">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{orc.numero}</h1>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sc.cls}`}>{sc.label}</span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">{orc.titulo}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            variant="outline" size="sm" className="rounded-xl gap-1.5"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Imprimir
          </Button>
          <Link to={`/orcamentos/${id}/editar`}>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
              <Edit size={14} /> Editar
            </Button>
          </Link>
          {orc.status === "rascunho" && (
            <Button
              size="sm"
              className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 gap-1.5"
              onClick={handleEnviar}
              disabled={atualizar.isPending}
            >
              <Send size={14} /> Enviar
            </Button>
          )}
          {(orc.status === "enviada" || orc.status === "em_revisao") && (
            <>
              <Button
                size="sm"
                className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5"
                onClick={handleAprovar}
                disabled={atualizar.isPending}
              >
                <CheckCircle size={14} /> Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                onClick={handleRecusar}
                disabled={atualizar.isPending}
              >
                <XCircle size={14} /> Recusar
              </Button>
            </>
          )}
          {orc.status === "aprovada" && (
            <Button
              size="sm"
              className="rounded-xl bg-purple-600 text-white hover:bg-purple-700 gap-1.5"
              onClick={handleConverterParaPedido}
              disabled={converter.isPending}
            >
              {converter.isPending ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
              Gerar Pedido
            </Button>
          )}
        </div>
      </div>

      {/* Main content (printable) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 print:border-none print:rounded-none print:p-0 print:shadow-none">
        {/* Document header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-800">PROPOSTA COMERCIAL</h2>
            <p className="text-sm text-slate-500 mt-1">{orc.numero}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-slate-800">Croma Print</p>
            <p className="text-sm text-slate-500">Comunicação Visual</p>
          </div>
        </div>

        {/* Cliente + info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-slate-50 rounded-xl p-5">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cliente</p>
            <p className="font-semibold text-slate-800">
              {orc.cliente?.nome_fantasia || orc.cliente?.razao_social || "—"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Data</p>
              <p className="text-sm text-slate-700">{new Date(orc.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Validade</p>
              <p className="text-sm text-slate-700">{orc.validade_dias} dias</p>
            </div>
            {orc.condicoes_pagamento && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Condições de Pagamento</p>
                <p className="text-sm text-slate-700">{orc.condicoes_pagamento}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Itens</p>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500">#</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500">Descrição</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-slate-500">Qtd</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-slate-500">Unit</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orcamentoItens.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="py-3 px-4 text-slate-400 tabular-nums">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-800">{item.descricao}</p>
                      {item.especificacao && <p className="text-xs text-slate-400 mt-0.5">{item.especificacao}</p>}
                      {item.largura_cm && item.altura_cm && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.largura_cm}×{item.altura_cm}cm
                          {item.area_m2 ? ` · ${item.area_m2.toFixed(4)} m²` : ""}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-600">{item.quantidade}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-600">{brl(item.valor_unitario)}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-800">{brl(item.valor_total)}</td>
                  </tr>
                ))}
                {orcamentoItens.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">Nenhum item</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium tabular-nums">{brl(orc.subtotal)}</span>
            </div>
            {orc.desconto_percentual > 0 && (
              <div className="flex justify-between">
                <span className="text-red-500">Desconto ({orc.desconto_percentual}%)</span>
                <span className="font-medium text-red-600 tabular-nums">-{brl(orc.desconto_valor)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="font-bold text-slate-800 text-base">Total</span>
              <span className="font-bold text-blue-700 text-base tabular-nums">{brl(orc.total)}</span>
            </div>
          </div>
        </div>

        {/* Observações */}
        {orc.observacoes && (
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Observações</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{orc.observacoes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

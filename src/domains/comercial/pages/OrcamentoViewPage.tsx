// ============================================================================
// ORÇAMENTO VIEW PAGE — v2.0
// Visualização completa com breakdown de custos por item,
// materiais, acabamentos, serviços e PDF profissional
// ============================================================================

import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Edit, Loader2, Printer, CheckCircle, XCircle,
  Send, ChevronDown, ChevronUp, Package, Scissors, Copy, FileDown,
} from "lucide-react";
import OrcamentoPDF from "../components/OrcamentoPDF";
import OrcamentoPDFMulti, { type ModoPDF } from "../components/OrcamentoPDFMulti";
import { enriquecerOrcamentoParaPDF } from "../services/orcamento-pdf-enrich.service";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useOrcamento,
  useAtualizarOrcamento,
  useConverterParaPedido,
  useDuplicarOrcamento,
} from "../hooks/useOrcamentos";
import { brl } from "@/shared/utils/format";
import { showError } from "@/utils/toast";
import type { OrcamentoStatus } from "../services/orcamento.service";
import { TrackingPanel } from '../components/TrackingPanel';
import { SharePropostaModal } from '../components/SharePropostaModal';
import { CondicoesPagamentoView } from '../components/CondicoesPagamentoView';
import { useEmpresaPrincipal } from "@/shared/hooks/useEmpresaPrincipal";
import { PropostaAttachmentsSection } from "../components/PropostaAttachmentsSection";

const STATUS_CONFIG: Record<OrcamentoStatus, { label: string; cls: string }> = {
  rascunho:   { label: "Rascunho",   cls: "bg-slate-100 text-slate-600" },
  enviada:    { label: "Enviada",    cls: "bg-blue-100 text-blue-700" },
  em_revisao: { label: "Em Revisão", cls: "bg-amber-100 text-amber-700" },
  aprovada:   { label: "Aprovada",   cls: "bg-emerald-100 text-emerald-700" },
  recusada:   { label: "Recusada",   cls: "bg-red-100 text-red-700" },
  expirada:   { label: "Expirada",   cls: "bg-slate-100 text-slate-500" },
};

export default function OrcamentoViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: orc, isLoading } = useOrcamento(id);
  const { data: empresa } = useEmpresaPrincipal();
  const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Croma Print';
  const atualizar = useAtualizarOrcamento();
  const converter = useConverterParaPedido();
  const duplicar = useDuplicarOrcamento();

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [approveOpen, setApproveOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleEnviar = () => {
    if (!id || !orc) return;
    const itens = (orc as any).itens ?? [];
    if (itens.length === 0) {
      showError("Orçamento precisa de pelo menos 1 item para ser enviado.");
      return;
    }
    const valorEfetivo = orc.total || orc.subtotal || 0;
    if (valorEfetivo <= 0) {
      showError("Orçamento precisa ter valor maior que R$ 0,00.");
      return;
    }
    atualizar.mutate({ id, updates: { status: "enviada" } });
  };

  const handleAprovar = () => {
    if (!id || !orc) return;
    const itens = (orc as any).itens ?? [];
    if (itens.length === 0) {
      showError("Orçamento precisa de pelo menos 1 item para ser aprovado.");
      setApproveOpen(false);
      return;
    }
    const valorEfetivo = orc.total || orc.subtotal || 0;
    if (valorEfetivo <= 0) {
      showError("Orçamento precisa ter valor maior que R$ 0,00 para ser aprovado.");
      setApproveOpen(false);
      return;
    }
    atualizar.mutate(
      { id, updates: { status: "aprovada", aprovado_em: new Date().toISOString() } },
      { onSettled: () => setApproveOpen(false) }
    );
  };

  const handleRecusar = () => {
    if (!id) return;
    atualizar.mutate({ id, updates: { status: "recusada" } });
  };

  const handleConverterParaPedido = async () => {
    if (!id || !orc) return;
    const itens = (orc as any).itens ?? [];
    if (itens.length === 0) {
      showError("Orçamento precisa de itens para gerar pedido.");
      setConvertOpen(false);
      return;
    }
    const valorEfetivo = orc.total || orc.subtotal || 0;
    if (valorEfetivo <= 0) {
      showError("Orçamento com valor R$ 0,00 não pode gerar pedido.");
      setConvertOpen(false);
      return;
    }
    try {
      const result = await converter.mutateAsync(id);
      setConvertOpen(false);
      navigate(`/pedidos/${result.pedido_id}`);
    } catch {
      setConvertOpen(false);
    }
  };

  const handleDuplicar = async () => {
    if (!id) return;
    const novo = await duplicar.mutateAsync(id);
    navigate(`/orcamentos/${novo.id}/editar`);
  };

  const [pdfLoading, setPdfLoading] = useState(false);

  // Gera PDF classico (layout original completo) - mantido para compatibilidade
  const handleGerarPDF = async () => {
    if (!orc) return;
    setPdfLoading(true);
    try {
      const container = document.createElement("div");
      container.style.cssText = "position:absolute;left:-9999px;top:0;width:210mm;background:white;";
      document.body.appendChild(container);

      const orcamentoCompleto = orc as Parameters<typeof OrcamentoPDF>[0]["orcamento"];
      const root = createRoot(container);
      root.render(<OrcamentoPDF orcamento={orcamentoCompleto} nomeEmpresa={nomeEmpresa} />);

      await new Promise((r) => setTimeout(r, 300));

      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf()
        .set({
          margin: [15, 12, 15, 12],
          filename: `Proposta-${orc.numero}.pdf`,
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(container.firstElementChild as HTMLElement)
        .save();

      root.unmount();
      document.body.removeChild(container);
    } catch (err) {
      // PDF generation failed - loading state handles UX
    } finally {
      setPdfLoading(false);
    }
  };

  // Gera PDF multi-modo (cliente / producao / tecnico)
  const handleGerarPDFMulti = async (modo: ModoPDF) => {
    if (!orc) return;
    setPdfLoading(true);
    try {
      const container = document.createElement("div");
      container.style.cssText = "position:absolute;left:-9999px;top:0;width:210mm;background:white;";
      document.body.appendChild(container);

      const orcamentoMulti = orc as Parameters<typeof OrcamentoPDFMulti>[0]["orcamento"];
      // Enriquece apenas para modos que precisam dos dados extras (producao/tecnico)
      const enriched = modo !== "cliente"
        ? await enriquecerOrcamentoParaPDF({
            id: orc.id,
            vendedor_id: (orc as any).vendedor_id ?? null,
            total: orc.total ?? 0,
            itens: orc.itens.map((i: any) => ({ id: i.id })),
          }).catch(() => null)
        : null;
      const root = createRoot(container);
      root.render(
        <OrcamentoPDFMulti
          orcamento={orcamentoMulti}
          modo={modo}
          nomeEmpresa={nomeEmpresa}
          enriched={enriched}
        />,
      );

      await new Promise((r) => setTimeout(r, 300));

      const html2pdf = (await import("html2pdf.js")).default;
      const filenameMap: Record<ModoPDF, string> = {
        cliente: `Proposta-${orc.numero}-cliente.pdf`,
        producao: `OS-${orc.numero}-producao.pdf`,
        tecnico: `Ficha-${orc.numero}-tecnica.pdf`,
      };
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: filenameMap[modo],
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(container.firstElementChild as HTMLElement)
        .save();

      root.unmount();
      document.body.removeChild(container);
    } catch (err) {
      // silent
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading || !orc) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const sc = STATUS_CONFIG[orc.status] ?? STATUS_CONFIG.rascunho;

  // Access itens with nested materiais/acabamentos
  const orcamentoItens = (orc as {
    itens?: Array<{
      id: string;
      descricao: string;
      especificacao: string | null;
      quantidade: number;
      largura_cm: number | null;
      altura_cm: number | null;
      area_m2: number | null;
      custo_mp: number;
      custo_mo: number;
      custo_fixo: number;
      markup_percentual: number;
      valor_unitario: number;
      valor_total: number;
      materiais?: Array<{ descricao: string; quantidade: number; unidade: string; custo_unitario: number; custo_total: number }>;
      acabamentos?: Array<{ descricao: string; quantidade: number; custo_unitario: number; custo_total: number }>;
    }>;
  }).itens ?? [];

  const orcamentoServicos = (orc as {
    servicos?: Array<{
      id: string;
      descricao: string;
      horas: number;
      valor_unitario: number;
      valor_total: number;
    }>;
  }).servicos ?? [];

  const totalServicos = orcamentoServicos.reduce((sum, s) => sum + s.valor_total, 0);

  return (
    <div className="max-w-4xl space-y-6 pb-16">
      {/* ══════════ HEADER (hidden on print) ══════════ */}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline" size="sm" className="rounded-xl gap-1.5"
                disabled={pdfLoading}
              >
                {pdfLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <FileDown size={14} />}
                {pdfLoading ? "Gerando..." : "Baixar PDF"}
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel>Escolha o modo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleGerarPDFMulti("cliente")}>
                👥 Modo Cliente
                <span className="ml-auto text-[10px] text-slate-400">Comercial</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleGerarPDFMulti("producao")}>
                🏭 Modo Produção
                <span className="ml-auto text-[10px] text-slate-400">Chão de fábrica</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleGerarPDFMulti("tecnico")}>
                🔧 Modo Técnico
                <span className="ml-auto text-[10px] text-slate-400">Interno</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleGerarPDF}>
                📄 Layout clássico completo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline" size="sm" className="rounded-xl gap-1.5"
            onClick={handleDuplicar}
            disabled={duplicar.isPending}
          >
            <Copy size={14} /> Duplicar
          </Button>
          <Link to={`/orcamentos/${id}/editar`}>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
              <Edit size={14} /> Editar
            </Button>
          </Link>
          <Button
            size="sm"
            className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 gap-1.5"
            onClick={() => setShareOpen(true)}
          >
            <Send size={14} /> Enviar Proposta
          </Button>
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
              <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5"
                    disabled={atualizar.isPending}
                  >
                    <CheckCircle size={14} /> Aprovar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar aprovação</AlertDialogTitle>
                    <AlertDialogDescription>
                      Deseja aprovar o orçamento <strong>{orc.numero}</strong> no valor de{" "}
                      <strong>{brl(orc.total || orc.subtotal || 0)}</strong>? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={atualizar.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        handleAprovar();
                      }}
                    >
                      {atualizar.isPending ? (
                        <><Loader2 size={14} className="animate-spin mr-1.5" /> Aprovando...</>
                      ) : (
                        "Aprovar"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
            <AlertDialog open={convertOpen} onOpenChange={setConvertOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="rounded-xl bg-purple-600 text-white hover:bg-purple-700 gap-1.5"
                  disabled={converter.isPending}
                >
                  <Package size={14} /> Gerar Pedido
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Converter em pedido</AlertDialogTitle>
                  <AlertDialogDescription>
                    Será criado um pedido a partir do orçamento <strong>{orc.numero}</strong> no valor de{" "}
                    <strong>{brl(orc.total || orc.subtotal || 0)}</strong> com{" "}
                    {((orc as any).itens ?? []).length} iten(s). Todos os itens, materiais e custos serão copiados para o pedido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={converter.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      handleConverterParaPedido();
                    }}
                  >
                    {converter.isPending ? (
                      <><Loader2 size={14} className="animate-spin mr-1.5" /> Gerando pedido...</>
                    ) : (
                      "Gerar Pedido"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* ══════════ MAIN CONTENT (printable) ══════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 print:border-none print:rounded-none print:p-0 print:shadow-none">
        {/* Document header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-800">PROPOSTA COMERCIAL</h2>
            <p className="text-sm text-slate-500 mt-1">{orc.numero}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-slate-800">{nomeEmpresa}</p>
            <p className="text-sm text-slate-500">Comunicação Visual</p>
          </div>
        </div>

        {/* Cliente + info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-slate-50 rounded-xl p-5 print:bg-gray-50">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cliente</p>
            <p className="font-semibold text-slate-800">
              {orc.cliente?.nome_fantasia || orc.cliente?.razao_social || "---"}
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

        {/* ──── Items with expandable breakdown ──── */}
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
                {orcamentoItens.map((item, idx) => {
                  const hasDetails = (item.materiais && item.materiais.length > 0) || (item.acabamentos && item.acabamentos.length > 0);
                  const isExpanded = expandedItems.has(item.id);

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={`${hasDetails ? "cursor-pointer hover:bg-slate-50" : ""} print:break-inside-avoid`}
                        onClick={() => hasDetails && toggleItem(item.id)}
                      >
                        <td className="py-3 px-4 text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-slate-800">{item.descricao}</p>
                              {item.especificacao && <p className="text-xs text-slate-400 mt-0.5">{item.especificacao}</p>}
                              {item.largura_cm && item.altura_cm && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {item.largura_cm}x{item.altura_cm}cm
                                  {item.area_m2 ? ` · ${item.area_m2.toFixed(4)} m2` : ""}
                                </p>
                              )}
                            </div>
                            {hasDetails && (
                              <span className="text-slate-300 print:hidden">
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-600">{item.quantidade}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-600">{brl(item.valor_unitario)}</td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-800">{brl(item.valor_total)}</td>
                      </tr>

                      {/* Expanded detail row */}
                      {(isExpanded || false) && ( // Use isExpanded for screen, always show for print via CSS
                        <tr className={`bg-slate-50/50 ${isExpanded ? "" : "hidden print:table-row"}`}>
                          <td></td>
                          <td colSpan={4} className="py-3 px-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {/* Materiais */}
                              {item.materiais && item.materiais.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Package size={12} className="text-blue-500" />
                                    <span className="font-semibold text-blue-700">Materiais</span>
                                  </div>
                                  <div className="space-y-1">
                                    {item.materiais.map((m, mi) => (
                                      <div key={mi} className="flex justify-between">
                                        <span className="text-slate-600">{m.descricao} ({m.quantidade} {m.unidade || "un"})</span>
                                        <span className="text-slate-700 tabular-nums font-medium">{brl(m.custo_total)}</span>
                                      </div>
                                    ))}
                                    <div className="flex justify-between pt-1 border-t border-slate-200">
                                      <span className="font-medium text-slate-600">Total MP</span>
                                      <span className="font-semibold text-slate-800 tabular-nums">
                                        {brl(item.materiais.reduce((s, m) => s + m.custo_total, 0))}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Acabamentos */}
                              {item.acabamentos && item.acabamentos.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Scissors size={12} className="text-amber-500" />
                                    <span className="font-semibold text-amber-700">Acabamentos</span>
                                  </div>
                                  <div className="space-y-1">
                                    {item.acabamentos.map((a, ai) => (
                                      <div key={ai} className="flex justify-between">
                                        <span className="text-slate-600">{a.descricao} (x{a.quantidade})</span>
                                        <span className="text-slate-700 tabular-nums font-medium">{brl(a.custo_total)}</span>
                                      </div>
                                    ))}
                                    <div className="flex justify-between pt-1 border-t border-slate-200">
                                      <span className="font-medium text-slate-600">Total Acabamentos</span>
                                      <span className="font-semibold text-slate-800 tabular-nums">
                                        {brl(item.acabamentos.reduce((s, a) => s + a.custo_total, 0))}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Cost breakdown bar */}
                              <div className="md:col-span-2">
                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                  <span>MP: {brl(item.custo_mp ?? 0)}</span>
                                  <span>MO: {brl(item.custo_mo ?? 0)}</span>
                                  <span>Fixo: {brl(item.custo_fixo ?? 0)}</span>
                                  <span>Markup: {item.markup_percentual ?? 0}%</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {orcamentoItens.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">Nenhum item</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ──── Servicos ──── */}
        {orcamentoServicos.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Serviços</p>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500">Serviço</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-slate-500">Horas</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-slate-500">Valor/h</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orcamentoServicos.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 px-4 text-slate-700">{s.descricao}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-600">{s.horas}h</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-600">{brl(s.valor_unitario)}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-800">{brl(s.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ──── Totals ──── */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal Itens</span>
              <span className="font-medium tabular-nums">{brl(orc.subtotal - totalServicos)}</span>
            </div>
            {totalServicos > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Serviços</span>
                <span className="font-medium tabular-nums">{brl(totalServicos)}</span>
              </div>
            )}
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
              <span className="font-bold text-blue-700 text-base tabular-nums">{brl(orc.total || orc.subtotal || 0)}</span>
            </div>
          </div>
        </div>

        {/* ──── Observacoes ──── */}
        {orc.observacoes && (
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Observações</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{orc.observacoes}</p>
          </div>
        )}

        {/* ──── Print footer ──── */}
        <div className="hidden print:block mt-12 pt-6 border-t border-slate-300 text-center text-xs text-slate-400">
          <p>{nomeEmpresa}</p>
          <p>Proposta valida por {orc.validade_dias} dias a partir de {new Date(orc.created_at).toLocaleDateString("pt-BR")}</p>
        </div>
      </div>

      {/* ══════════ TRACKING + PAYMENT (hidden on print) ══════════ */}
      <div className="print:hidden space-y-4">
        {/* Arquivos da arte */}
        {id && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <PropostaAttachmentsSection propostaId={id} readOnly />
          </div>
        )}
        {(orc as any).forma_pagamento && (
          <CondicoesPagamentoView
            conditions={{
              forma_pagamento: (orc as any).forma_pagamento,
              parcelas_count: (orc as any).parcelas_count ?? 1,
              entrada_percentual: (orc as any).entrada_percentual ?? 0,
              prazo_dias: (orc as any).prazo_dias ?? [],
            }}
            valorTotal={orc.total}
          />
        )}
        <TrackingPanel propostaId={orc.id} />
      </div>

      <SharePropostaModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        propostaId={orc.id}
        propostaNumero={orc.numero}
        shareToken={(orc as any).share_token ?? ''}
        clienteTelefone={(orc.cliente as any)?.telefone}
        clienteEmail={(orc.cliente as any)?.email}
      />
    </div>
  );
}

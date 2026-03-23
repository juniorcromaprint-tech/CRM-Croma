// ============================================================================
// ORDEM DE SERVIÇO PAGE — Visualização completa do pedido com PDF
// ============================================================================

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrdemServico } from '../hooks/useOrdemServico';
import { OSHeader } from '../components/os/OSHeader';
import { OSClienteInfo } from '../components/os/OSClienteInfo';
import { OSResumoOperacional } from '../components/os/OSResumoOperacional';
import { OSEtapasTimeline } from '../components/os/OSEtapasTimeline';
import { OSItemCard } from '../components/os/OSItemCard';
import { OSLogistica } from '../components/os/OSLogistica';
import { OSQRCode } from '../components/os/OSQRCode';
import { OSActions } from '../components/os/OSActions';
import { OSPrintLayout } from '../components/os/OSPrintLayout';
import { useEmpresaPrincipal } from "@/shared/hooks/useEmpresaPrincipal";
import AIButton from '@/domains/ai/components/AIButton';
import ProducaoBriefing from '@/domains/ai/components/ProducaoBriefing';
import { useBriefingProducao } from '@/domains/ai/hooks/useBriefingProducao';
import type { AIResponse } from '@/domains/ai/types/ai.types';

export default function OrdemServicoPage() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const navigate = useNavigate();
  const { data: os, isLoading, isError } = useOrdemServico(pedidoId);
  const { data: empresa } = useEmpresaPrincipal();
  const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Croma Print Comunicação Visual';
  const [pdfLoading, setPdfLoading] = useState(false);
  const [briefingResult, setBriefingResult] = useState<AIResponse | null>(null);
  const briefingProducao = useBriefingProducao();

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!os) return;
    setPdfLoading(true);
    try {
      // Cria container temporário fora da tela
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:210mm;background:white;';
      document.body.appendChild(container);

      const qrUrl = window.location.href;
      const root = createRoot(container);
      root.render(<OSPrintLayout data={os} mode="pedido" qrUrl={qrUrl} nomeEmpresa={nomeEmpresa} />);

      // Aguarda render completo
      await new Promise((r) => setTimeout(r, 400));

      // html2pdf.js via import dinâmico
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: [12, 10, 12, 10],
          filename: `OS-${os.numero}.pdf`,
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(container.firstElementChild as HTMLElement)
        .save();

      // Limpa container
      root.unmount();
      document.body.removeChild(container);
    } catch (err) {
      // PDF generation failed — loading state handles UX
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  // ── Error / Not found ──
  if (isError || !os) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Ordem de Serviço não encontrada</h3>
        <p className="text-sm text-slate-400 mt-1">Verifique se o pedido existe e tente novamente.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-xl"
          onClick={() => navigate('/pedidos')}
        >
          Voltar para Pedidos
        </Button>
      </div>
    );
  }

  const qrUrl = window.location.href;

  return (
    <div className="max-w-4xl space-y-4 pb-16">
      {/* ══ Screen version ══ */}
      <div className="print:hidden">
        {/* Top bar */}
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="flex-1" />
          <AIButton
            label="Gerar Briefing"
            onClick={(model) => {
              briefingProducao.mutate({ pedidoId: pedidoId!, model }, {
                onSuccess: (data) => setBriefingResult(data),
              });
            }}
            isLoading={briefingProducao.isPending}
          />
          <OSActions
            numero={os.numero}
            onPrint={handlePrint}
            onExportPDF={handleExportPDF}
          />
          {pdfLoading && (
            <Loader2 size={16} className="animate-spin text-blue-600" />
          )}
        </div>

        {/* OS Header */}
        <OSHeader
          numero={os.numero}
          status={os.status}
          prioridade={os.prioridade}
          dataPrometida={os.data_prometida}
          aprovadoEm={os.aprovado_em ?? null}
          createdAt={os.created_at}
          mode="pedido"
        />

        {/* Cliente */}
        <div className="mt-4">
          <OSClienteInfo cliente={os.cliente} />
        </div>

        {/* Resumo operacional */}
        <div className="mt-4">
          <OSResumoOperacional
            vendedorNome={os.vendedor_nome}
            pedidoNumero={os.numero}
            observacoes={os.observacoes ?? null}
            prioridade={os.prioridade}
          />
        </div>

        {/* Etapas */}
        {os.etapas.length > 0 && (
          <div className="mt-4">
            <OSEtapasTimeline etapas={os.etapas} />
          </div>
        )}

        {/* Items */}
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide px-1">
            Itens ({os.itens.length})
          </h3>
          {os.itens.map((item, idx) => (
            <OSItemCard key={item.id} item={item} index={idx} />
          ))}
        </div>

        {/* Logística */}
        <div className="mt-4">
          <OSLogistica
            dataPrometida={os.data_prometida}
            cliente={os.cliente}
            observacoes={os.observacoes ?? null}
          />
        </div>

        {/* QR Code */}
        <div className="mt-4 flex justify-center">
          <OSQRCode url={qrUrl} size={80} />
        </div>

        {/* Footer autorização */}
        <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
          {os.vendedor_nome && os.aprovado_em
            ? `Autorizado por: ${os.vendedor_nome} em ${new Date(os.aprovado_em).toLocaleDateString('pt-BR')}`
            : os.vendedor_nome
              ? `Responsável: ${os.vendedor_nome}`
              : `Emitido em: ${new Date().toLocaleDateString('pt-BR')}`}
          <span className="mx-2">·</span>
          {nomeEmpresa}
        </div>
      </div>

      {/* ══ AI Briefing Result ══ */}
      {briefingResult && (
        <div className="mb-4 print:hidden">
          <ProducaoBriefing
            result={briefingResult}
            onClose={() => setBriefingResult(null)}
          />
        </div>
      )}

      {/* ══ Print version ══ */}
      <div className="hidden print:block">
        <OSPrintLayout data={os} mode="pedido" qrUrl={qrUrl} nomeEmpresa={nomeEmpresa} />
      </div>
    </div>
  );
}

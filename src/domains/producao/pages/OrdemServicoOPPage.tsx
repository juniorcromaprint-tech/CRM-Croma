// ============================================================================
// ORDEM DE SERVIÇO — OP PAGE — Visualização individual de Ordem de Produção
// ============================================================================

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrdemServicoOP } from '../hooks/useOrdemServicoOP';
import { OSHeader } from '../components/os/OSHeader';
import { OSClienteInfo } from '../components/os/OSClienteInfo';
import { OSResumoOperacional } from '../components/os/OSResumoOperacional';
import { OSEtapasTimeline } from '../components/os/OSEtapasTimeline';
import { OSItemCard } from '../components/os/OSItemCard';
import { OSLogistica } from '../components/os/OSLogistica';
import { OSQRCode } from '../components/os/OSQRCode';
import { OSActions } from '../components/os/OSActions';
import { OSPrintLayout } from '../components/os/OSPrintLayout';
import { OSArquivoProducao } from '../components/os/OSArquivoProducao';
import { useEmpresaPrincipal } from "@/shared/hooks/useEmpresaPrincipal";

export default function OrdemServicoOPPage() {
  const { opId } = useParams<{ opId: string }>();
  const navigate = useNavigate();
  const { data: op, isLoading, isError } = useOrdemServicoOP(opId);
  const { data: empresa } = useEmpresaPrincipal();
  const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Croma Print Comunicação Visual';
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!op) return;
    setPdfLoading(true);
    try {
      // Cria container temporário fora da tela
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:210mm;background:white;';
      document.body.appendChild(container);

      const qrUrl = window.location.href;
      const root = createRoot(container);
      root.render(<OSPrintLayout data={op} mode="op" qrUrl={qrUrl} nomeEmpresa={nomeEmpresa} />);

      // Aguarda render completo
      await new Promise((r) => setTimeout(r, 400));

      // html2pdf.js via import dinâmico
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: [12, 10, 12, 10],
          filename: `OS-${op.op_numero}.pdf`,
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
  if (isError || !op) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Ordem de Serviço não encontrada</h3>
        <p className="text-sm text-slate-400 mt-1">Verifique se a ordem de produção existe e tente novamente.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-xl"
          onClick={() => navigate(-1)}
        >
          Voltar
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
          <OSActions
            numero={op.op_numero}
            onPrint={handlePrint}
            onExportPDF={handleExportPDF}
          />
          {pdfLoading && (
            <Loader2 size={16} className="animate-spin text-blue-600" />
          )}
        </div>

        {/* OS Header */}
        <OSHeader
          numero={op.op_numero}
          status={op.op_status}
          prioridade={op.op_prioridade}
          dataPrometida={op.data_prometida}
          aprovadoEm={null}
          mode="op"
          pedidoNumero={op.pedido_numero}
        />

        {/* Cliente */}
        <div className="mt-4">
          <OSClienteInfo cliente={op.cliente} />
        </div>

        {/* Resumo operacional */}
        <div className="mt-4">
          <OSResumoOperacional
            vendedorNome={op.vendedor_nome}
            pedidoNumero={op.pedido_numero}
            observacoes={op.observacoes ?? null}
            prioridade={op.op_prioridade}
          />
        </div>

        {/* Etapas */}
        {op.etapas.length > 0 && (
          <div className="mt-4">
            <OSEtapasTimeline etapas={op.etapas} />
          </div>
        )}

        {/* Single item */}
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide px-1">
            Item da Produção
          </h3>
          <OSItemCard item={op.item} index={0} />
        </div>

        {/* Logística */}
        <div className="mt-4">
          <OSLogistica
            dataPrometida={op.data_prometida}
            cliente={op.cliente}
            observacoes={op.observacoes ?? null}
          />
        </div>

        {/* Arquivo para Produção */}
        <div className="mt-4">
          <OSArquivoProducao
            opId={op.op_id}
            arteUrl={op.item.arte_url}
            instrucoes={op.item.instrucoes}
          />
        </div>

        {/* QR Code */}
        <div className="mt-4 flex justify-center">
          <OSQRCode url={qrUrl} size={80} />
        </div>

        {/* Footer autorização */}
        <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
          {op.vendedor_nome
            ? `Responsável: ${op.vendedor_nome}`
            : `Emitido em: ${new Date().toLocaleDateString('pt-BR')}`}
          <span className="mx-2">·</span>
          {nomeEmpresa}
        </div>
      </div>

      {/* ══ Print version ══ */}
      <div className="hidden print:block">
        <OSPrintLayout data={op} mode="op" qrUrl={qrUrl} nomeEmpresa={nomeEmpresa} />
      </div>
    </div>
  );
}

/**
 * DanfePreview — Componente React para preview e impressao do DANFE
 * Renderiza o DANFE profissional em um iframe para preview,
 * com opcoes de imprimir e gerar PDF.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileDown, X, Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { gerarDanfeHTML, fiscalDocumentoToDanfeData } from '../utils/danfe-template';

interface DanfePreviewProps {
  documentoId: string;
  open: boolean;
  onClose: () => void;
}

export function DanfePreview({ documentoId, open, onClose }: DanfePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(false);
  const [danfeHtml, setDanfeHtml] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const carregarDanfe = useCallback(async () => {
    if (!documentoId || !open) return;
    setLoading(true);
    try {
      // Buscar documento completo
      const { data: doc, error } = await supabase
        .from('fiscal_documentos')
        .select(`*, fiscal_documentos_itens(*), clientes(*), fiscal_ambientes(nome, tipo), fiscal_series(serie)`)
        .eq('id', documentoId)
        .single();

      if (error || !doc) {
        showError('Erro ao carregar documento fiscal');
        return;
      }

      // Buscar empresa emitente
      let empresa: any = null;
      if (doc.ambiente_id) {
        const { data: amb } = await supabase
          .from('fiscal_ambientes')
          .select('empresa_id, empresas(*)')
          .eq('id', doc.ambiente_id)
          .single();
        empresa = amb?.empresas;
      }

      // Gerar DANFE HTML
      const danfeData = fiscalDocumentoToDanfeData(doc, empresa);
      const html = gerarDanfeHTML(danfeData);
      setDanfeHtml(html);
    } catch (err) {
      showError('Erro ao gerar preview do DANFE');
      console.error('[DanfePreview]', err);
    } finally {
      setLoading(false);
    }
  }, [documentoId, open]);

  useEffect(() => {
    if (open) carregarDanfe();
    else setDanfeHtml(null);
  }, [open, carregarDanfe]);

  // Escrever HTML no iframe quando disponivel
  useEffect(() => {
    if (danfeHtml && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(danfeHtml);
        doc.close();
      }
    }
  }, [danfeHtml]);

  const handleImprimir = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleGerarPdf = async () => {
    if (!danfeHtml) return;
    setGerando(true);
    try {
      // Usar html2pdf.js para gerar PDF a partir do HTML
      const html2pdf = (await import('html2pdf.js')).default;

      // Criar um container temporario com o HTML do DANFE
      const container = document.createElement('div');
      container.innerHTML = danfeHtml;
      // Extrair apenas o body
      const bodyMatch = danfeHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        container.innerHTML = bodyMatch[1];
      }
      // Injetar CSS inline
      const styleMatch = danfeHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      if (styleMatch) {
        const style = document.createElement('style');
        style.textContent = styleMatch[1];
        container.prepend(style);
      }

      document.body.appendChild(container);

      await html2pdf()
        .set({
          margin: [5, 5, 5, 5],
          filename: `danfe_${documentoId}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], before: '.danfe-page' },
        })
        .from(container)
        .save();

      document.body.removeChild(container);
      showSuccess('PDF do DANFE gerado com sucesso!');
    } catch (err) {
      console.error('[DanfePreview] Erro PDF:', err);
      showError('Erro ao gerar PDF. Tente usar a opção Imprimir.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[900px] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-slate-800">
              Preview DANFE
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleImprimir}
                disabled={!danfeHtml || loading}
              >
                <Printer className="w-4 h-4 mr-1" />
                Imprimir
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleGerarPdf}
                disabled={!danfeHtml || loading || gerando}
              >
                {gerando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
                Gerar PDF
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden bg-slate-100 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              <span className="ml-3 text-slate-500">Gerando preview do DANFE...</span>
            </div>
          ) : danfeHtml ? (
            <iframe
              ref={iframeRef}
              className="w-full h-full bg-white shadow-lg border border-slate-200"
              title="DANFE Preview"
              sandbox="allow-same-origin allow-scripts"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              Nenhum DANFE disponível
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

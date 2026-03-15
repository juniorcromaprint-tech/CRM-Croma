import { Printer, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess } from '@/utils/toast';

interface OSActionsProps {
  numero: string;
  onPrint: () => void;
  onExportPDF: () => void;
}

export function OSActions({ numero, onPrint, onExportPDF }: OSActionsProps) {
  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      showSuccess('Link copiado para a área de transferência');
    } catch {
      // Fallback para navegadores sem suporte a clipboard API
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showSuccess('Link copiado');
    }
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={onPrint} className="gap-2">
        <Printer size={16} /> Imprimir
      </Button>
      <Button variant="outline" size="sm" onClick={onExportPDF} className="gap-2">
        <Download size={16} /> PDF
      </Button>
      <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
        <Share2 size={16} /> Compartilhar
      </Button>
    </div>
  );
}

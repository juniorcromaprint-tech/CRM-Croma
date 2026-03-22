// ============================================================================
// AvisosBanner — Croma Print ERP/CRM
// Banner de avisos internos exibido acima do conteúdo principal
// ============================================================================

import { useState, useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { useAvisosVigentes, type AvisoVigente } from '@/shared/hooks/useAvisosVigentes';

const DISMISSED_KEY = 'croma-avisos-dismissed';

function getDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function addDismissed(id: string): void {
  try {
    const current = getDismissed();
    if (!current.includes(id)) {
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...current, id]));
    }
  } catch {
    // noop
  }
}

interface AvisoBannerItemProps {
  aviso: AvisoVigente;
  onDismiss: (id: string) => void;
}

function AvisoBannerItem({ aviso, onDismiss }: AvisoBannerItemProps) {
  const isAlerta = aviso.tipo === 'alerta';

  const containerClass = isAlerta
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-blue-50 border-blue-200 text-blue-800';

  const iconClass = isAlerta ? 'text-red-500' : 'text-blue-500';
  const buttonClass = isAlerta
    ? 'text-red-400 hover:text-red-600 hover:bg-red-100'
    : 'text-blue-400 hover:text-blue-600 hover:bg-blue-100';

  const Icon = isAlerta ? AlertTriangle : Info;

  return (
    <div className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${containerClass}`}>
      <Icon size={18} className={`shrink-0 mt-0.5 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug">{aviso.titulo}</p>
        <p className="text-sm mt-0.5 leading-snug opacity-90">{aviso.mensagem}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(aviso.id)}
        className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${buttonClass}`}
        aria-label="Fechar aviso"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function AvisosBanner() {
  const { data: avisos = [] } = useAvisosVigentes();
  const [dismissed, setDismissed] = useState<string[]>(() => getDismissed());

  // Re-sync if sessionStorage changes (e.g. during HMR)
  useEffect(() => {
    setDismissed(getDismissed());
  }, []);

  const visible = avisos.filter((a) => !dismissed.includes(a.id));

  if (visible.length === 0) return null;

  const handleDismiss = (id: string) => {
    addDismissed(id);
    setDismissed((prev) => [...prev, id]);
  };

  return (
    <div className="mb-4 space-y-2 print:hidden">
      {visible.map((aviso) => (
        <AvisoBannerItem key={aviso.id} aviso={aviso} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}

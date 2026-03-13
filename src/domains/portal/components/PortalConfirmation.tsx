// src/domains/portal/components/PortalConfirmation.tsx
import { CheckCircle2 } from 'lucide-react';

export function PortalConfirmation() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CheckCircle2 size={64} className="text-green-500 mb-4" />
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Orçamento Aprovado!</h2>
      <p className="text-slate-500 max-w-md">
        Sua aprovação foi registrada com sucesso. Nosso time comercial entrará em contato em breve para dar continuidade ao processo.
      </p>
    </div>
  );
}

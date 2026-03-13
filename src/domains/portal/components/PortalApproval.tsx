// src/domains/portal/components/PortalApproval.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Loader2 } from 'lucide-react';

interface Props {
  onApprove: (comentario?: string) => void;
  isLoading: boolean;
  disabled: boolean;
}

export function PortalApproval({ onApprove, isLoading, disabled }: Props) {
  const [comentario, setComentario] = useState('');

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-800">Aprovar Orçamento</h3>
      <Textarea
        placeholder="Comentários ou observações (opcional)"
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        className="rounded-xl"
        rows={3}
      />
      <Button
        onClick={() => onApprove(comentario || undefined)}
        disabled={disabled || isLoading}
        className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 text-base font-semibold"
      >
        {isLoading ? (
          <><Loader2 className="animate-spin mr-2" size={18} /> Aprovando...</>
        ) : (
          <><Check size={18} className="mr-2" /> Aprovar Orçamento</>
        )}
      </Button>
    </div>
  );
}

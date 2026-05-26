// src/domains/portal/components/PortalItemImagem.tsx
//
// Renderiza thumbnail do item (com fallback elegante quando nao ha imagem) e
// abre um lightbox full-screen ao clicar. Lazy load + onError fallback.

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ImageIcon } from 'lucide-react';

type SizeMode = 'thumb' | 'full';

interface Props {
  imagemUrl: string | null | undefined;
  alt: string;
  sizeMode?: SizeMode;
}

const THUMB_CLS = 'w-16 h-16 sm:w-20 sm:h-20'; // 4rem / 5rem — encaixa na linha
const FULL_CLS  = 'w-full h-full';

export function PortalItemImagem({ imagemUrl, alt, sizeMode = 'thumb' }: Props) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState(false);

  const semImagem = !imagemUrl || erro;
  const sizeCls = sizeMode === 'full' ? FULL_CLS : THUMB_CLS;

  // Placeholder elegante: ícone + label sutil
  if (semImagem) {
    return (
      <div
        className={`${sizeCls} flex flex-col items-center justify-center rounded-lg bg-slate-50 border border-dashed border-slate-200 text-slate-300`}
        title="Sem imagem disponivel"
        aria-label="Sem imagem"
      >
        <ImageIcon size={sizeMode === 'full' ? 48 : 20} strokeWidth={1.5} />
        {sizeMode === 'full' && (
          <span className="text-xs mt-2 text-slate-400">Sem imagem</span>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // evita disparar onItemClick da linha
          setOpen(true);
        }}
        className={`${sizeCls} relative overflow-hidden rounded-lg bg-slate-100 border border-slate-200 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-150`}
        aria-label={`Ampliar imagem: ${alt}`}
      >
        <img
          src={imagemUrl as string}
          alt={alt}
          loading="lazy"
          onError={() => setErro(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-5xl w-[95vw] p-0 bg-transparent border-none shadow-none"
          onClick={() => setOpen(false)}
        >
          <div className="flex items-center justify-center w-full h-full">
            <img
              src={imagemUrl as string}
              alt={alt}
              onError={() => setErro(true)}
              className="max-w-full max-h-[85vh] rounded-lg object-contain bg-white shadow-2xl"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// src/domains/terceirizacao/components/TerceirizacaoEmptyState.tsx

import { Network } from 'lucide-react';

interface TerceirizacaoEmptyStateProps {
  comFiltro?: boolean;
}

export default function TerceirizacaoEmptyState({ comFiltro }: TerceirizacaoEmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <Network size={40} className="mx-auto text-slate-300 mb-3" />
      <h3 className="font-semibold text-slate-600">
        {comFiltro ? 'Nenhum produto encontrado' : 'Catálogo vazio'}
      </h3>
      <p className="text-sm text-slate-400 mt-1">
        {comFiltro
          ? 'Tente ajustar os filtros ou a busca.'
          : 'Nenhum produto de terceirização cadastrado ainda.'}
      </p>
    </div>
  );
}

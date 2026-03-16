// src/domains/portal/components/PortalHeader.tsx
import { FileText } from 'lucide-react';

interface Props {
  numero: string;
  clienteNome?: string;
}

export function PortalHeader({ numero, clienteNome }: Props) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Top bar: Logo + Proposal badge */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo_croma.png"
              alt="Croma Print"
              className="h-10 sm:h-12 w-auto object-contain brightness-0 invert"
            />
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
            <FileText size={14} className="text-blue-300" />
            <span className="text-sm font-medium text-blue-100">Proposta {numero}</span>
          </div>
        </div>

        {/* Welcome message */}
        {clienteNome && (
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Olá, {clienteNome}!
            </h1>
            <p className="text-blue-200 text-sm sm:text-base max-w-lg">
              Preparamos esta proposta comercial especialmente para você.
              Confira os detalhes abaixo e aprove quando estiver pronto.
            </p>
          </div>
        )}
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path d="M0 40L60 35C120 30 240 20 360 17.5C480 15 600 20 720 22.5C840 25 960 25 1080 22.5C1200 20 1320 15 1380 12.5L1440 10V40H0Z" fill="#f8fafc" />
        </svg>
      </div>
    </header>
  );
}

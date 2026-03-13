// src/domains/portal/components/PortalHeader.tsx
interface Props { numero: string }

export function PortalHeader({ numero }: Props) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-semibold text-slate-800">Croma Print</span>
        </div>
        <span className="text-sm text-slate-500">Proposta {numero}</span>
      </div>
    </header>
  );
}

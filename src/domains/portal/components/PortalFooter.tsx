// src/domains/portal/components/PortalFooter.tsx

export function PortalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo_croma.png"
              alt="Croma Print"
              className="h-8 w-auto object-contain opacity-60"
            />
          </div>

          <div className="text-center sm:text-right">
            <p className="text-xs text-slate-400">
              Croma Print Comunicacao Visual &copy; {year}
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Comunicacao visual profissional para varejo e industria
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

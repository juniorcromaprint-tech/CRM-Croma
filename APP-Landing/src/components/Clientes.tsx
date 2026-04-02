const clientes = [
  { name: "Beira Rio", desc: "Rede de calçados" },
  { name: "Renner", desc: "Moda feminina" },
  { name: "Paquetá", desc: "Calçados e moda" },
];

export default function Clientes() {
  return (
    <section className="py-16 bg-slate-50 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-slate-500 text-sm font-medium uppercase tracking-wider mb-10">
          Empresas que confiam na Croma Print
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
          {clientes.map((c) => (
            <div
              key={c.name}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="bg-white border-2 border-slate-200 group-hover:border-blue-300 rounded-2xl px-8 py-4 transition-all">
                <span className="font-black text-xl sm:text-2xl text-slate-700 group-hover:text-blue-700 transition-colors tracking-tight">
                  {c.name}
                </span>
              </div>
              <span className="text-xs text-slate-400">{c.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

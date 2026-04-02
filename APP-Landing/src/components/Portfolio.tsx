const portfolioItems = [
  { gradient: "from-blue-600 to-blue-800", label: "Fachada ACM — Rede de Calçados" },
  { gradient: "from-slate-600 to-slate-800", label: "Banner PDV — Rede de Moda" },
  { gradient: "from-blue-500 to-indigo-700", label: "Letreiro Caixa — Franquia" },
  { gradient: "from-blue-700 to-slate-700", label: "Envelopamento Veicular" },
  { gradient: "from-indigo-600 to-blue-800", label: "Fachada ACM — Varejo" },
  { gradient: "from-slate-500 to-blue-700", label: "Sinalização Corporativa" },
];

export default function Portfolio() {
  return (
    <section id="portfolio" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
            Nossos Trabalhos
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Projetos realizados para as maiores redes do varejo brasileiro.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolioItems.map((item, i) => (
            <div
              key={i}
              className={`relative h-64 rounded-2xl bg-gradient-to-br ${item.gradient} overflow-hidden group cursor-pointer`}
            >
              {/* Decorative SVG pattern */}
              <svg
                className="absolute inset-0 w-full h-full opacity-10"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <pattern id={`p${i}`} width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="1.5" fill="white" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#p${i})`} />
              </svg>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-end">
                <div className="p-4 translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-white font-semibold text-sm">{item.label}</p>
                </div>
              </div>

              {/* Center icon placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white/60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          * Fotos reais do portfólio em breve
        </p>
      </div>
    </section>
  );
}

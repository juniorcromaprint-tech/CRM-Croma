const passos = [
  {
    num: "01",
    title: "WhatsApp",
    desc: "Manda mensagem com o que precisa. Nossa IA ou equipe responde rapidinho.",
    color: "bg-green-500",
  },
  {
    num: "02",
    title: "Orçamento em Minutos",
    desc: "Recebe o orçamento detalhado com preço, prazo e arte prévia.",
    color: "bg-blue-600",
  },
  {
    num: "03",
    title: "Aprovação Online",
    desc: "Aprova pelo portal ou WhatsApp. Arte final enviada para validação.",
    color: "bg-blue-700",
  },
  {
    num: "04",
    title: "Produção e Instalação",
    desc: "Produzimos na nossa fábrica e instalamos em todo o Brasil.",
    color: "bg-blue-900",
  },
];

export default function ComoFunciona() {
  return (
    <section id="como-funciona" className="py-20 bg-blue-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Como funciona
          </h2>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            Do primeiro contato à instalação — processo simples, rápido e transparente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {passos.map((p, i) => (
            <div key={p.num} className="relative">
              {/* Connector line */}
              {i < passos.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-blue-700 z-0 -translate-x-1/2" />
              )}

              <div className="relative z-10 text-center">
                <div
                  className={`w-16 h-16 ${p.color} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}
                >
                  <span className="text-white font-black text-xl">{p.num}</span>
                </div>
                <h3 className="font-bold text-white text-lg mb-2">{p.title}</h3>
                <p className="text-blue-200 text-sm leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

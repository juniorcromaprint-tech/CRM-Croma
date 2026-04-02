import { Factory, MapPin, Users, Zap } from "lucide-react";

const diferenciais = [
  {
    icon: Factory,
    title: "Produção própria",
    desc: "Fábrica em São Paulo com maquinário moderno. Sem terceirização — mais qualidade e prazo.",
  },
  {
    icon: MapPin,
    title: "Atendimento nacional",
    desc: "Instalamos e entregamos em todo o Brasil para redes e franquias com operação nacional.",
  },
  {
    icon: Users,
    title: "Equipe especializada",
    desc: "6 profissionais com experiência em comunicação visual para grandes redes de varejo.",
  },
  {
    icon: Zap,
    title: "Orçamento por IA",
    desc: "Tecnologia própria gera orçamentos precisos em minutos via WhatsApp ou portal online.",
  },
];

export default function Sobre() {
  return (
    <section id="sobre" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-6">
              A Croma Print é especialista em redes de lojas
            </h2>
            <p className="text-lg text-slate-600 mb-6 leading-relaxed">
              Há mais de 15 anos produzindo comunicação visual de alto padrão para os maiores
              varejistas do Brasil. Nossa fábrica em São Paulo garante qualidade, prazo e
              padronização para toda a sua rede.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Do briefing à instalação, cuidamos de todo o processo. Fachadas, banners, PDV,
              sinalização — tudo produzido internamente para garantir consistência visual em
              todas as unidades da sua rede.
            </p>
          </div>

          {/* Right — grid de diferenciais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {diferenciais.map((d) => (
              <div key={d.title} className="bg-slate-50 rounded-2xl p-6">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <d.icon className="w-5 h-5 text-blue-700" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{d.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

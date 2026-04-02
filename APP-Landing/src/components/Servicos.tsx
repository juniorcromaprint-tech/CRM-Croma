import {
  Building2,
  ImageIcon,
  ShoppingBag,
  Car,
  Type,
  Navigation,
} from "lucide-react";

const servicos = [
  {
    icon: Building2,
    title: "Fachadas em ACM",
    desc: "Alumínio composto de alta durabilidade para fachadas de lojas e sedes corporativas com acabamento impecável.",
  },
  {
    icon: ImageIcon,
    title: "Banners e Impressão Digital",
    desc: "Grande formato com cores vibrantes — lona, adesivo, papel fotográfico e tecido para PDV e eventos.",
  },
  {
    icon: ShoppingBag,
    title: "Material PDV",
    desc: "Displays, wobblers, stoppers, banners de vitrine e todo material de ponto de venda para redes de lojas.",
  },
  {
    icon: Car,
    title: "Envelopamento Veicular",
    desc: "Adesivagem total ou parcial para frota corporativa com impressão de alta qualidade e durabilidade.",
  },
  {
    icon: Type,
    title: "Letreiros e Letras Caixa",
    desc: "Letras caixa iluminadas em LED, letras recortadas em ACM, acrílico e MDF para fachadas e interiores.",
  },
  {
    icon: Navigation,
    title: "Sinalização",
    desc: "Totens, placas, painéis e sistemas completos de sinalização para redes de lojas e espaços comerciais.",
  },
];

export default function Servicos() {
  return (
    <section id="servicos" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
            O que a Croma Print faz
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Soluções completas de comunicação visual para redes de lojas, franquias e indústria.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicos.map((s) => (
            <div
              key={s.title}
              className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all group"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <s.icon className="w-6 h-6 text-blue-700" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">{s.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

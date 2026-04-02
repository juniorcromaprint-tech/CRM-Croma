const WHATSAPP_URL =
  "https://wa.me/5511939471862?text=Ol%C3%A1!%20Vim%20pelo%20site%20e%20gostaria%20de%20um%20or%C3%A7amento.";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-lg">C</span>
              </div>
              <span className="font-bold text-white text-lg">Croma Print</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Comunicação Visual Profissional para redes de lojas, franquias e indústria.
            </p>
          </div>

          {/* Contato */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contato</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  WhatsApp (11) 93947-1862
                </a>
              </li>
              <li>
                <a
                  href="mailto:junior@cromaprint.com.br"
                  className="hover:text-white transition-colors"
                >
                  junior@cromaprint.com.br
                </a>
              </li>
              <li className="text-slate-400">São Paulo, SP — Brasil</li>
            </ul>
          </div>

          {/* Serviços */}
          <div>
            <h4 className="font-semibold text-white mb-4">Serviços</h4>
            <ul className="space-y-2 text-sm">
              {[
                "Fachadas em ACM",
                "Banners e Impressão",
                "Material PDV",
                "Envelopamento Veicular",
                "Letreiros e Letras Caixa",
                "Sinalização",
              ].map((s) => (
                <li key={s} className="text-slate-400">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>© 2024 Croma Print Comunicação Visual</p>
          <p>CNPJ 18.923.994/0001-83</p>
        </div>
      </div>
    </footer>
  );
}

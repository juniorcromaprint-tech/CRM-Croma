// src/domains/portal/components/PortalConfirmation.tsx
import { CheckCircle2, ArrowRight, Phone, Mail } from 'lucide-react';

export function PortalConfirmation() {
  return (
    <div className="max-w-lg mx-auto px-4 py-12 sm:py-16">
      {/* Success animation */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 animate-[bounce_1s_ease-in-out]">
          <CheckCircle2 size={48} className="text-green-500" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
          Proposta Aprovada!
        </h2>

        <p className="text-slate-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
          Sua aprovação foi registrada com sucesso. Nosso time comercial já foi notificado e entrará em contato em breve.
        </p>
      </div>

      {/* Next steps */}
      <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Próximos passos</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
            <div>
              <p className="text-sm font-medium text-slate-700">Confirmação por e-mail</p>
              <p className="text-xs text-slate-400">Você receberá um e-mail com o resumo da aprovação</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
            <div>
              <p className="text-sm font-medium text-slate-700">Contato comercial</p>
              <p className="text-xs text-slate-400">Nosso time entrará em contato para alinhar detalhes</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
            <div>
              <p className="text-sm font-medium text-slate-700">Início da produção</p>
              <p className="text-xs text-slate-400">Após alinhamento, sua demanda entra em produção</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <a
          href="tel:+5511999999999"
          className="flex-1 flex items-center justify-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
        >
          <Phone size={16} className="text-blue-600" />
          Ligar para nós
        </a>
        <a
          href="mailto:comercial@cromaprint.com.br"
          className="flex-1 flex items-center justify-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
        >
          <Mail size={16} className="text-blue-600" />
          Enviar e-mail
          <ArrowRight size={14} className="text-slate-400" />
        </a>
      </div>
    </div>
  );
}

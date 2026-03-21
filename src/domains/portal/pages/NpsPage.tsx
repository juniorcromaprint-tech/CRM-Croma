// src/domains/portal/pages/NpsPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Star, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/* ─── helpers ─── */

function getNpsCategory(nota: number): { label: string; color: string; bg: string } {
  if (nota <= 6) return { label: 'Detrator', color: 'text-red-600',    bg: 'bg-red-500'    };
  if (nota <= 8) return { label: 'Neutro',   color: 'text-amber-600',  bg: 'bg-amber-400'  };
  return              { label: 'Promotor',  color: 'text-emerald-600', bg: 'bg-emerald-500' };
}

function getButtonClasses(nota: number, selected: number | null): string {
  const base = 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center border-2';

  if (selected === nota) {
    if (nota <= 6) return `${base} bg-red-500 border-red-500 text-white scale-110 shadow-md`;
    if (nota <= 8) return `${base} bg-amber-400 border-amber-400 text-white scale-110 shadow-md`;
    return              `${base} bg-emerald-500 border-emerald-500 text-white scale-110 shadow-md`;
  }

  // unselected
  if (nota <= 6) return `${base} border-red-200 text-red-400 hover:bg-red-50 hover:border-red-400 bg-white`;
  if (nota <= 8) return `${base} border-amber-200 text-amber-500 hover:bg-amber-50 hover:border-amber-400 bg-white`;
  return              `${base} border-emerald-200 text-emerald-500 hover:bg-emerald-50 hover:border-emerald-400 bg-white`;
}

/* ─── component ─── */

export default function NpsPage() {
  const { token } = useParams<{ token: string }>();
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviado, setEnviado] = useState(false);

  // Valida token e busca registro
  const { data: registro, isLoading, error } = useQuery({
    queryKey: ['nps', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_respostas')
        .select('id, respondido_em, pedido_id')
        .eq('token', token ?? '')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const responder = useMutation({
    mutationFn: async () => {
      if (nota === null) throw new Error('Selecione uma nota');
      const { error } = await supabase
        .from('nps_respostas')
        .update({
          nota,
          comentario: comentario.trim() || null,
          respondido_em: new Date().toISOString(),
        })
        .eq('token', token ?? '');
      if (error) throw error;
    },
    onSuccess: () => setEnviado(true),
  });

  /* ── loading ── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={24} />
        </div>
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }

  /* ── token inválido ── */
  if (error || !registro) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Link inválido</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Esta avaliação não foi encontrada ou o link expirou.
            Entre em contato com a Croma Print para mais informações.
          </p>
        </div>
      </div>
    );
  }

  /* ── já respondeu ── */
  if (registro.respondido_em && !enviado) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Já respondida</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Você já enviou sua avaliação. Obrigado pelo feedback!
          </p>
        </div>
      </div>
    );
  }

  /* ── agradecimento pós-envio ── */
  if (enviado) {
    const cat = nota !== null ? getNpsCategory(nota) : null;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Obrigado!</h2>
          {cat && (
            <p className={`text-sm font-semibold mb-3 ${cat.color}`}>
              Você é um {cat.label}! 🎉
            </p>
          )}
          <p className="text-sm text-slate-500 leading-relaxed">
            Sua avaliação foi registrada com sucesso.
            Ela nos ajuda a melhorar cada vez mais nossos serviços.
          </p>
          <p className="text-xs text-slate-400 mt-4">Croma Print Comunicação Visual</p>
        </div>
      </div>
    );
  }

  /* ── formulário ── */
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo / cabeçalho */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Star size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Como foi a sua experiência?</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Avalie nossa entrega de 0 a 10
          </p>
        </div>

        {/* Card do formulário */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">

          {/* Botões de nota */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-slate-400">Muito insatisfeito</span>
              <span className="text-xs text-slate-400">Muito satisfeito</span>
            </div>
            <div className="flex justify-between gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setNota(i)}
                  className={getButtonClasses(i, nota)}
                  aria-label={`Nota ${i}`}
                >
                  {i}
                </button>
              ))}
            </div>

            {/* Label da categoria selecionada */}
            {nota !== null && (
              <div className="mt-3 text-center">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full text-white ${getNpsCategory(nota).bg}`}>
                  {getNpsCategory(nota).label}
                </span>
              </div>
            )}
          </div>

          {/* Legenda das cores */}
          <div className="flex justify-between text-xs text-slate-400 gap-1">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              Detratores (0–6)
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              Neutros (7–8)
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              Promotores (9–10)
            </div>
          </div>

          {/* Comentário */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Comentário <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <Textarea
              className="rounded-xl resize-none text-sm"
              rows={3}
              placeholder="Conte-nos o que você achou do nosso serviço..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </div>

          {/* Botão enviar */}
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-medium h-11"
            disabled={nota === null || responder.isPending}
            onClick={() => responder.mutate()}
          >
            {responder.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Enviando...
              </span>
            ) : (
              'Enviar avaliação'
            )}
          </Button>

          {responder.isError && (
            <p className="text-xs text-red-500 text-center">
              Erro ao enviar. Tente novamente.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Croma Print Comunicação Visual
        </p>
      </div>
    </div>
  );
}

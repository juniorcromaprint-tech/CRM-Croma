// src/domains/ai/components/ProblemasPanel.tsx

import { AlertTriangle, XCircle, Info, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AIButton from './AIButton';
import { useAlertasAI, type AIAlerta } from '../hooks/useAlertasAI';
import { useDetectarProblemas } from '../hooks/useDetectarProblemas';
import AIResultPanel from './AIResultPanel';
import type { AIResponse } from '../types/ai.types';
import { useState } from 'react';

export default function ProblemasPanel() {
  const { data: alertas = [], isLoading, refetch } = useAlertasAI();
  const detectar = useDetectarProblemas();
  const [manualResult, setManualResult] = useState<AIResponse | null>(null);

  const porSeveridade = {
    alta: alertas.filter((a) => a.severidade === 'alta'),
    media: alertas.filter((a) => a.severidade === 'media'),
    baixa: alertas.filter((a) => a.severidade === 'baixa'),
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Alertas Operacionais</h3>
          <p className="text-xs text-slate-400 mt-0.5">{alertas.length} alertas ativos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="rounded-xl"
          >
            <RefreshCw size={14} />
          </Button>
          <AIButton
            label="Analise Completa"
            onClick={() => {
              detectar.mutate({ mode: 'manual', model: undefined }, {
                onSuccess: (data) => setManualResult(data),
              });
            }}
            isLoading={detectar.isPending}
          />
        </div>
      </div>

      <div className="p-5 space-y-2">
        {isLoading && <p className="text-sm text-slate-400">Carregando alertas...</p>}

        {!isLoading && alertas.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle size={32} className="mx-auto text-green-400 mb-2" />
            <p className="text-sm text-slate-500">Nenhum problema detectado</p>
          </div>
        )}

        {porSeveridade.alta.map((a) => (
          <AlertaItem key={a.id} alerta={a} />
        ))}
        {porSeveridade.media.map((a) => (
          <AlertaItem key={a.id} alerta={a} />
        ))}
        {porSeveridade.baixa.map((a) => (
          <AlertaItem key={a.id} alerta={a} />
        ))}
      </div>

      {manualResult && (
        <div className="p-5 border-t border-slate-100">
          <AIResultPanel
            result={manualResult}
            title="Analise de Problemas"
            onClose={() => setManualResult(null)}
          />
        </div>
      )}
    </div>
  );
}

const SEVERIDADE_CONFIG = {
  alta: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', Icon: XCircle, iconClass: 'text-red-500' },
  media: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', Icon: AlertTriangle, iconClass: 'text-amber-500' },
  baixa: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', Icon: Info, iconClass: 'text-blue-500' },
};

function AlertaItem({ alerta }: { alerta: AIAlerta }) {
  const style = SEVERIDADE_CONFIG[alerta.severidade];

  return (
    <div className={`flex items-start gap-2 ${style.bg} border ${style.border} rounded-xl p-3 text-xs ${style.text}`}>
      <style.Icon size={14} className={`${style.iconClass} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{alerta.titulo}</span>
        <p className="mt-0.5 opacity-80">{alerta.descricao}</p>
      </div>
    </div>
  );
}

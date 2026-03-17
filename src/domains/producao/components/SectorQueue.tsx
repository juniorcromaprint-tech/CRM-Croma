import { useState } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  useIniciarEtapa,
  useConcluirEtapa,
  usePausarEtapa,
  useApontamentoAberto,
} from '../hooks/usePCP';
import type { EtapaComOp } from '../types/pcp.types';

// ─── EtapaCard ───────────────────────────────────────────────
function EtapaCard({ etapa }: { etapa: EtapaComOp }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [obs, setObs] = useState('');

  const { data: apontamento } = useApontamentoAberto(etapa.etapa_id);
  const iniciar = useIniciarEtapa();
  const concluir = useConcluirEtapa();
  const pausar = usePausarEtapa();

  const isPendente = etapa.etapa_status === 'pendente';
  const isEmAndamento = etapa.etapa_status === 'em_andamento';
  const isConcluida = etapa.etapa_status === 'concluida';

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-4 shadow-sm transition-colors',
        etapa.atrasada && 'border-red-300 bg-red-50',
        isEmAndamento && 'border-blue-300 bg-blue-50',
        isConcluida && 'border-emerald-300 bg-emerald-50 opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800 text-lg leading-tight">
              {etapa.op_numero}
            </span>
            {etapa.atrasada && (
              <Badge variant="destructive" className="text-xs">
                ATRASADO
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-0.5">{etapa.cliente_nome}</p>
          <p className="text-xs text-slate-400">{etapa.pedido_numero}</p>
        </div>
        <Badge
          className={cn(
            'text-xs ml-2 flex-shrink-0',
            isPendente && 'bg-slate-100 text-slate-600 hover:bg-slate-100',
            isEmAndamento && 'bg-blue-100 text-blue-700 hover:bg-blue-100',
            isConcluida && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
          )}
        >
          {etapa.etapa_nome}
        </Badge>
      </div>

      {/* Prazo */}
      {etapa.data_prometida && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs mb-3',
            etapa.atrasada ? 'text-red-600 font-medium' : 'text-slate-500'
          )}
        >
          <Clock size={12} />
          <span>
            Entrega:{' '}
            {new Date(etapa.data_prometida).toLocaleDateString('pt-BR')}
          </span>
        </div>
      )}

      {/* Ações — touch targets ≥ 44px */}
      {!isConcluida && (
        <div className="flex gap-2 mt-3">
          {isPendente && (
            <Button
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white gap-2"
              onClick={() =>
                iniciar.mutate({ etapaId: etapa.etapa_id, opId: etapa.op_id })
              }
              disabled={iniciar.isPending}
            >
              <Play size={16} />
              Iniciar Produção
            </Button>
          )}

          {isEmAndamento && (
            <>
              {apontamento && !apontamento.fim && (
                <Button
                  variant="outline"
                  className="flex-1 h-11 gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() =>
                    pausar.mutate({ apontamentoId: apontamento.id })
                  }
                  disabled={pausar.isPending}
                >
                  <Pause size={16} />
                  Pausar
                </Button>
              )}
              <Button
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                onClick={() => setShowConfirm(true)}
              >
                <CheckCircle2 size={16} />
                Concluir
              </Button>
            </>
          )}
        </div>
      )}

      {/* Dialog de confirmação */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir: {etapa.etapa_nome}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-slate-600 mb-3">
              OP <strong>{etapa.op_numero}</strong> — {etapa.cliente_nome}
            </p>
            <Textarea
              placeholder="Observações (opcional)"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={concluir.isPending}
              onClick={() => {
                concluir.mutate(
                  {
                    etapaId: etapa.etapa_id,
                    apontamentoId: apontamento?.id ?? null,
                    observacoes: obs || undefined,
                  },
                  { onSuccess: () => { setShowConfirm(false); setObs(''); } }
                );
              }}
            >
              Confirmar Conclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SectorQueue ─────────────────────────────────────────────
interface SectorQueueProps {
  setorId: string;
  setorNome: string;
  setorCor: string;
  etapas: EtapaComOp[];
  isLoading?: boolean;
}

export default function SectorQueue({
  setorNome,
  setorCor,
  etapas,
  isLoading,
}: SectorQueueProps) {
  const pendentes = etapas.filter((e) => e.etapa_status !== 'concluida');
  const emAndamento = pendentes.filter((e) => e.etapa_status === 'em_andamento');
  const fila = pendentes.filter((e) => e.etapa_status === 'pendente');

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Header do setor */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3">
        <div
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: setorCor }}
        />
        <div>
          <h2 className="font-bold text-slate-800">{setorNome}</h2>
          <p className="text-sm text-slate-500">
            {emAndamento.length} em andamento · {fila.length} na fila
          </p>
        </div>
      </div>

      {/* Em andamento primeiro */}
      {emAndamento.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
            Em andamento
          </p>
          <div className="space-y-3">
            {emAndamento.map((e) => (
              <EtapaCard key={e.etapa_id} etapa={e} />
            ))}
          </div>
        </section>
      )}

      {/* Fila */}
      {fila.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
            Próximos ({fila.length})
          </p>
          <div className="space-y-3">
            {fila.slice(0, 5).map((e) => (
              <EtapaCard key={e.etapa_id} etapa={e} />
            ))}
            {fila.length > 5 && (
              <p className="text-xs text-center text-slate-400 py-2">
                + {fila.length - 5} mais na fila
              </p>
            )}
          </div>
        </section>
      )}

      {pendentes.length === 0 && (
        <div className="text-center py-16">
          <CheckCircle2
            size={40}
            className="mx-auto mb-3 text-emerald-300"
          />
          <p className="font-semibold text-slate-600">Fila limpa!</p>
          <p className="text-sm text-slate-400 mt-1">
            Nenhuma etapa pendente neste setor
          </p>
        </div>
      )}
    </div>
  );
}

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import SectorQueue from '../components/SectorQueue';
import { useSetores, useOpsAtivas } from '../hooks/usePCP';
import type { EtapaComOp } from '../types/pcp.types';

export default function SectorQueuePage() {
  const { sectorId } = useParams<{ sectorId: string }>();
  const navigate = useNavigate();

  const { data: setores = [] } = useSetores();
  const { data: ops = [], isLoading: opsLoading } = useOpsAtivas();

  const setor = setores.find((s) => s.id === sectorId);

  // Buscar etapas do setor via OPs ativas nesse setor
  const { data: etapas = [], isLoading: etapasLoading } = useQuery({
    queryKey: ['pcp', 'etapas-setor', sectorId, ops.map((o) => o.id).join(',')],
    queryFn: async (): Promise<EtapaComOp[]> => {
      const opIds = ops
        .filter((o) => o.setor_atual_id === sectorId)
        .map((o) => o.id);

      if (opIds.length === 0) return [];

      const { data } = await supabase
        .from('producao_etapas')
        .select('id, nome, status, ordem, tempo_estimado_min, ordem_producao_id')
        .in('ordem_producao_id', opIds)
        .neq('status', 'concluida')
        .order('ordem');

      return (data ?? []).map((e) => {
        const op = ops.find((o) => o.id === e.ordem_producao_id);
        return {
          etapa_id: e.id,
          etapa_nome: e.nome,
          etapa_status: e.status,
          etapa_ordem: e.ordem,
          op_id: op?.id ?? '',
          op_numero: op?.numero ?? '',
          pedido_numero: op?.pedido_numero ?? '',
          cliente_nome: op?.cliente_nome ?? '',
          data_prometida: op?.data_prometida ?? null,
          atrasada: op?.atrasada ?? false,
          tempo_estimado_min: e.tempo_estimado_min ?? 60,
        } satisfies EtapaComOp;
      });
    },
    enabled: ops.length > 0 && !!sectorId,
    staleTime: 30 * 1000,
  });

  const isLoading = opsLoading || etapasLoading;

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Voltar */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/producao/pcp')}
          className="mb-4 gap-1 -ml-2"
        >
          <ArrowLeft size={16} />
          Voltar ao PCP
        </Button>

        {isLoading && !setor ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : (
          <SectorQueue
            setorId={sectorId ?? ''}
            setorNome={setor?.nome ?? 'Setor'}
            setorCor={setor?.cor ?? '#3B82F6'}
            etapas={etapas}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}

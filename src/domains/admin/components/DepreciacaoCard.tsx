// ============================================================================
// DEPRECIAÇÃO CARD — Exibe dados de depreciação de uma máquina via RPC
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/shared/utils/format";
import { TrendingDown, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface DepreciacaoData {
  depreciacao_mensal: number;
  depreciacao_acumulada: number;
  valor_residual_atual: number;
  meses_restantes: number;
  percentual_depreciado: number;
}

interface DepreciacaoCardProps {
  maquinaId: string;
  maquinaNome: string;
}

export function DepreciacaoCard({ maquinaId, maquinaNome }: DepreciacaoCardProps) {
  const { data, isLoading, isError } = useQuery<DepreciacaoData>({
    queryKey: ["depreciacao-maquina", maquinaId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any).rpc(
        "get_depreciacao_maquina",
        { p_maquina_id: maquinaId }
      );
      if (error) throw error;
      return data as DepreciacaoData;
    },
    enabled: !!maquinaId,
  });

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-slate-200 shadow-sm">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400 mr-2" />
          <span className="text-sm text-slate-400">Calculando depreciação...</span>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
        <CardContent className="flex items-center gap-2 py-4 px-5">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700">
            Preencha data de compra e valor de compra para ver a depreciação.
          </p>
        </CardContent>
      </Card>
    );
  }

  const percentual = Math.min(100, Math.max(0, data.percentual_depreciado ?? 0));
  const mesesRestantes = data.meses_restantes ?? 0;

  return (
    <Card className="rounded-2xl border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-orange-100 rounded-lg">
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </div>
          <CardTitle className="text-sm font-semibold text-slate-700">
            Depreciação — {maquinaNome}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs em grid 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-0.5">Depreciação mensal</p>
            <p className="text-base font-bold text-slate-800">
              {brl(data.depreciacao_mensal ?? 0)}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-0.5">Depreciação acumulada</p>
            <p className="text-base font-bold text-orange-600">
              {brl(data.depreciacao_acumulada ?? 0)}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-0.5">Valor residual atual</p>
            <p className="text-base font-bold text-green-600">
              {brl(data.valor_residual_atual ?? 0)}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-0.5">Meses restantes</p>
            <p className="text-base font-bold text-slate-800">
              {mesesRestantes > 0 ? `${mesesRestantes} meses` : "Depreciado"}
            </p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Percentual depreciado</span>
            <span className="font-semibold text-slate-700">{percentual.toFixed(1)}%</span>
          </div>
          <Progress value={percentual} className="h-2" />
          <div className="flex justify-between text-xs text-slate-400">
            <span>Início da vida útil</span>
            <span>Fim da vida útil</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DepreciacaoCard;

// src/domains/estoque/components/SaldoCard.tsx

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { SemaforoBadge } from "@/shared/components/SemaforoBadge";
import type { EstoqueSaldo, SemaforoStatus } from "../types/estoque.types";

interface SaldoCardProps {
  saldo: EstoqueSaldo;
}

function getBadgeStatus(
  quantidade: number,
  minimo: number
): { label: string; className: string } {
  if (quantidade < minimo) {
    return {
      label: "Abaixo do mínimo",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }
  if (quantidade < minimo * 2) {
    return {
      label: "Atenção",
      className: "bg-yellow-50 text-yellow-700 border-yellow-200",
    };
  }
  return {
    label: "OK",
    className: "bg-green-50 text-green-700 border-green-200",
  };
}

export function SaldoCard({ saldo }: SaldoCardProps) {
  const nome = saldo.material?.nome ?? "Material";
  const unidade = saldo.material?.unidade ?? "";
  const estoqueMinimo = saldo.material?.estoque_minimo ?? 0;
  const quantidade = (saldo as any).saldo_disponivel ?? saldo.quantidade_disponivel ?? 0;
  const reservado = (saldo as any).saldo_reservado ?? saldo.quantidade_reservada ?? 0;

  const badge = getBadgeStatus(quantidade, estoqueMinimo);

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Package size={18} className="text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-tight truncate">
              {nome}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(saldo as any).semaforo && (
              <SemaforoBadge
                status={(saldo as any).semaforo as SemaforoStatus}
                size="sm"
                label={
                  (saldo as any).semaforo === 'vermelho'
                    ? 'Crítico'
                    : (saldo as any).semaforo === 'amarelo'
                    ? 'Atenção'
                    : 'Normal'
                }
              />
            )}
            <Badge
              variant="outline"
              className={`text-xs ${badge.className}`}
            >
              {badge.label}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-800 font-mono">
              {quantidade.toLocaleString("pt-BR")}
            </span>
            <span className="text-sm text-slate-400">{unidade}</span>
          </div>

          {estoqueMinimo > 0 && (
            <p className="text-xs text-slate-400">
              Mínimo:{" "}
              <span className="font-medium text-slate-600">
                {estoqueMinimo.toLocaleString("pt-BR")} {unidade}
              </span>
            </p>
          )}

          {reservado > 0 && (
            <p className="text-xs text-amber-600 font-medium">
              {reservado.toLocaleString("pt-BR")} reservado{reservado > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

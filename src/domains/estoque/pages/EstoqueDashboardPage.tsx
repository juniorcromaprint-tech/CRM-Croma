// src/domains/estoque/pages/EstoqueDashboardPage.tsx

import { useState } from "react";
import {
  Package,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  SlidersHorizontal,
  Loader2,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SaldoCard } from "../components/SaldoCard";
import { AlertaEstoqueMinimo } from "../components/AlertaEstoqueMinimo";
import { useEstoqueSaldos, useAlertasEstoqueMinimo } from "../hooks/useEstoqueSaldos";
import { useMovimentacoes, useCriarMovimentacao } from "../hooks/useMovimentacoes";
import type { EstoqueMovimentacao } from "../types/estoque.types";

const TIPOS_MOV = [
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saída" },
];

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`rounded-2xl border shadow-sm ${highlight ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">
            {label}
          </p>
          <p
            className={`text-xl font-bold mt-0.5 leading-tight font-mono ${highlight ? "text-red-700" : "text-slate-800"}`}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function EstoqueDashboardPage() {
  const [busca, setBusca] = useState("");
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteForm, setAjusteForm] = useState({
    material_id: "",
    tipo: "entrada" as 'entrada' | 'saida',
    quantidade: "",
    observacao: "",
  });

  const { data: saldos = [], isLoading: loadingSaldos } = useEstoqueSaldos({
    busca: busca || undefined,
  });
  const { data: alertas = [], isLoading: loadingAlertas } =
    useAlertasEstoqueMinimo();

  // Movimentações do mês atual para KPIs
  const { data: movimentacoes = [] } = useMovimentacoes({ limit: 500 });

  const criarMov = useCriarMovimentacao();

  // KPI cálculos
  const totalMateriais = saldos.length;
  const abaixoMinimo = alertas.length;

  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const entradasMes = (movimentacoes as EstoqueMovimentacao[])
    .filter(
      (m) =>
        m.tipo === "entrada" &&
        (m.created_at ?? "").startsWith(mesAtual)
    )
    .reduce((acc, m) => acc + (m.quantidade ?? 0), 0);

  const saidasMes = (movimentacoes as EstoqueMovimentacao[])
    .filter(
      (m) =>
        m.tipo === "saida" &&
        (m.created_at ?? "").startsWith(mesAtual)
    )
    .reduce((acc, m) => acc + (m.quantidade ?? 0), 0);

  function handleAjuste() {
    if (!ajusteForm.material_id || !ajusteForm.quantidade) return;
    criarMov.mutate(
      {
        material_id: ajusteForm.material_id,
        tipo: ajusteForm.tipo,
        quantidade: parseFloat(ajusteForm.quantidade),
        observacao: ajusteForm.observacao || undefined,
      },
      {
        onSuccess: () => {
          setAjusteOpen(false);
          setAjusteForm({
            material_id: "",
            tipo: "entrada",
            quantidade: "",
            observacao: "",
          });
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Estoque</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Saldos, alertas e movimentações de materiais
          </p>
        </div>
        <Button
          onClick={() => setAjusteOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 rounded-xl"
        >
          <Plus size={16} className="mr-2" />
          Ajuste Manual
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingSaldos || loadingAlertas ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              label="Total Materiais"
              value={totalMateriais}
              icon={Package}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <KpiCard
              label="Abaixo do Mínimo"
              value={abaixoMinimo}
              icon={AlertTriangle}
              iconBg={abaixoMinimo > 0 ? "bg-red-100" : "bg-slate-100"}
              iconColor={abaixoMinimo > 0 ? "text-red-600" : "text-slate-400"}
              highlight={abaixoMinimo > 0}
            />
            <KpiCard
              label="Entradas no Mês"
              value={entradasMes.toLocaleString("pt-BR")}
              icon={ArrowDownToLine}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Saídas no Mês"
              value={saidasMes.toLocaleString("pt-BR")}
              icon={ArrowUpFromLine}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
            />
          </>
        )}
      </div>

      {/* Main content: saldos + alertas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Saldos */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                placeholder="Buscar material..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
            <Button variant="outline" size="icon" className="rounded-xl">
              <SlidersHorizontal size={16} className="text-slate-500" />
            </Button>
          </div>

          {loadingSaldos ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="rounded-2xl border-slate-200">
                  <CardContent className="p-5">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : saldos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Package size={40} className="mx-auto text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-600">
                {busca ? "Nenhum material encontrado" : "Sem saldos cadastrados"}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {busca
                  ? `Nenhum material corresponde a "${busca}".`
                  : "Registre movimentações para ver saldos aqui."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {saldos.map((saldo: any) => (
                <SaldoCard key={saldo.id} saldo={saldo} />
              ))}
            </div>
          )}
        </div>

        {/* Alertas */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
            Alertas de Estoque
          </h2>
          <AlertaEstoqueMinimo />
        </div>
      </div>

      {/* Dialog ajuste manual */}
      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste Manual de Estoque</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Material</Label>
              <Select
                value={ajusteForm.material_id}
                onValueChange={(v) =>
                  setAjusteForm((p) => ({ ...p, material_id: v }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o material" />
                </SelectTrigger>
                <SelectContent>
                  {saldos.map((s: any) => (
                    <SelectItem key={s.material_id} value={s.material_id}>
                      {s.material?.nome ?? s.material_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tipo</Label>
              <Select
                value={ajusteForm.tipo}
                onValueChange={(v) =>
                  setAjusteForm((p) => ({ ...p, tipo: v as 'entrada' | 'saida' }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_MOV.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Quantidade</Label>
              <Input
                type="number"
                step="any"
                placeholder="0"
                value={ajusteForm.quantidade}
                onChange={(e) =>
                  setAjusteForm((p) => ({ ...p, quantidade: e.target.value }))
                }
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Observação</Label>
              <Textarea
                placeholder="Motivo do ajuste..."
                value={ajusteForm.observacao}
                onChange={(e) =>
                  setAjusteForm((p) => ({ ...p, observacao: e.target.value }))
                }
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAjusteOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAjuste}
              disabled={
                !ajusteForm.material_id ||
                !ajusteForm.quantidade ||
                criarMov.isPending
              }
              className="bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              {criarMov.isPending ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

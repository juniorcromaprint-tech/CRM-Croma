// src/domains/estoque/pages/InventarioPage.tsx

import { useState } from "react";
import {
  ClipboardList,
  Plus,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { InventarioForm } from "../components/InventarioForm";
import {
  useInventarios,
  useInventario,
  useCriarInventario,
} from "../hooks/useInventario";
import { formatDate } from "@/shared/utils/format";
import type { Inventario } from "../types/estoque.types";

const STATUS_BADGE: Record<
  Inventario["status"],
  { label: string; className: string; icon: React.ElementType }
> = {
  aberto: {
    label: "Em andamento",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
    icon: Clock,
  },
  finalizado: {
    label: "Finalizado",
    className: "bg-green-50 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
};

function InventarioDetailView({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const { data: inventario, isLoading } = useInventario(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!inventario) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Inventário não encontrado</h3>
      </div>
    );
  }

  const statusInfo = STATUS_BADGE[inventario.status];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="rounded-xl text-slate-500"
        >
          <ArrowLeft size={16} className="mr-1.5" />
          Voltar
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-800">
            Inventário — {formatDate(inventario.data_inventario)}
          </h2>
          <Badge
            variant="outline"
            className={`text-xs flex items-center gap-1 ${statusInfo.className}`}
          >
            <StatusIcon size={11} />
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      {inventario.observacoes && (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
          {inventario.observacoes}
        </p>
      )}

      <InventarioForm inventario={inventario} />
    </div>
  );
}

export default function InventarioPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [obs, setObs] = useState("");

  const { data: inventarios = [], isLoading } = useInventarios();
  const criar = useCriarInventario();

  function handleCriar() {
    criar.mutate(
      { observacoes: obs || undefined },
      {
        onSuccess: (inv: any) => {
          setNovoOpen(false);
          setObs("");
          if (inv?.id) setSelectedId(inv.id);
        },
      }
    );
  }

  if (selectedId) {
    return (
      <div className="p-6">
        <InventarioDetailView
          id={selectedId}
          onBack={() => setSelectedId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventários</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Contagem física e conferência de estoque
          </p>
        </div>
        <Button
          onClick={() => setNovoOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 rounded-xl"
        >
          <Plus size={16} className="mr-2" />
          Novo Inventário
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-7 w-24 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : inventarios.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ClipboardList
            size={40}
            className="mx-auto text-slate-300 mb-3"
          />
          <h3 className="font-semibold text-slate-600">
            Nenhum inventário realizado
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Clique em "Novo Inventário" para iniciar a contagem física.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(inventarios as Inventario[]).map((inv) => {
            const statusInfo = STATUS_BADGE[inv.status];
            const StatusIcon = statusInfo.icon;
            const isAberto = inv.status === "aberto";

            return (
              <Card
                key={inv.id}
                className={`rounded-2xl border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                  isAberto ? "border-l-4 border-l-yellow-400" : ""
                }`}
                onClick={() => setSelectedId(inv.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isAberto ? "bg-yellow-50" : "bg-green-50"
                        }`}
                      >
                        <ClipboardList
                          size={18}
                          className={
                            isAberto ? "text-yellow-600" : "text-green-600"
                          }
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          Inventário — {formatDate(inv.data_inventario)}
                        </p>
                        {inv.observacoes && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {inv.observacoes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-xs flex items-center gap-1 ${statusInfo.className}`}
                      >
                        <StatusIcon size={11} />
                        {statusInfo.label}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(inv.id);
                        }}
                      >
                        {isAberto ? "Continuar" : "Visualizar"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog novo inventário */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Inventário</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500">
              Será criado um inventário com todos os saldos atuais do estoque
              para contagem física.
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Observações{" "}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Textarea
                placeholder="Ex: Inventário trimestral, setor de impressão..."
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNovoOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCriar}
              disabled={criar.isPending}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              {criar.isPending ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Plus size={16} className="mr-2" />
              )}
              Criar Inventário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

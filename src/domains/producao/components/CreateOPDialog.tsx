import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Factory, Plus, Loader2 } from "lucide-react";
import type { MaquinaOption, PedidoItemOption } from "../types/producao.types";

interface CreateOPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidoItens: PedidoItemOption[];
  maquinas: MaquinaOption[];
  isPending: boolean;
  onSubmit: () => void;
  // Form state
  formPedidoItemId: string;
  setFormPedidoItemId: (v: string) => void;
  formPrioridade: string;
  setFormPrioridade: (v: string) => void;
  formPrazoInterno: string;
  setFormPrazoInterno: (v: string) => void;
  formTempoEstimado: string;
  setFormTempoEstimado: (v: string) => void;
  formObservacoes: string;
  setFormObservacoes: (v: string) => void;
  formMaquinaId: string;
  setFormMaquinaId: (v: string) => void;
  formDataInicioPrevista: string;
  setFormDataInicioPrevista: (v: string) => void;
  formDataFimPrevista: string;
  setFormDataFimPrevista: (v: string) => void;
}

export default function CreateOPDialog({
  open,
  onOpenChange,
  pedidoItens,
  maquinas,
  isPending,
  onSubmit,
  formPedidoItemId,
  setFormPedidoItemId,
  formPrioridade,
  setFormPrioridade,
  formPrazoInterno,
  setFormPrazoInterno,
  formTempoEstimado,
  setFormTempoEstimado,
  formObservacoes,
  setFormObservacoes,
  formMaquinaId,
  setFormMaquinaId,
  formDataInicioPrevista,
  setFormDataInicioPrevista,
  formDataFimPrevista,
  setFormDataFimPrevista,
}: CreateOPDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Factory size={22} className="text-blue-600" />
            Nova Ordem de Produção
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Item do pedido */}
          <div className="space-y-2">
            <Label htmlFor="create-item" className="text-slate-700 font-medium">
              Item do Pedido
            </Label>
            <Select value={formPedidoItemId} onValueChange={setFormPedidoItemId}>
              <SelectTrigger id="create-item" className="rounded-xl border-slate-200">
                <SelectValue placeholder="Selecione um item do pedido" />
              </SelectTrigger>
              <SelectContent>
                {pedidoItens.filter((pi) => pi.id).map((pi) => {
                  const pedNum = pi.pedidos?.numero ?? "---";
                  const cliente = pi.pedidos?.clientes?.nome_fantasia ?? pi.pedidos?.clientes?.razao_social ?? "";
                  return (
                    <SelectItem key={pi.id} value={pi.id}>
                      {pedNum} - {pi.descricao ?? "Item"} ({cliente})
                    </SelectItem>
                  );
                })}
                {pedidoItens.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400">
                    Nenhum item de pedido disponivel
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label htmlFor="create-prio" className="text-slate-700 font-medium">
              Prioridade
            </Label>
            <Select value={formPrioridade} onValueChange={setFormPrioridade}>
              <SelectTrigger id="create-prio" className="rounded-xl border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Normal</SelectItem>
                <SelectItem value="1">Alta</SelectItem>
                <SelectItem value="2">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prazo interno */}
          <div className="space-y-2">
            <Label htmlFor="create-prazo" className="text-slate-700 font-medium">
              Prazo interno
            </Label>
            <Input
              id="create-prazo"
              type="date"
              value={formPrazoInterno}
              onChange={(e) => setFormPrazoInterno(e.target.value)}
              className="rounded-xl border-slate-200"
            />
          </div>

          {/* Tempo estimado */}
          <div className="space-y-2">
            <Label htmlFor="create-tempo" className="text-slate-700 font-medium">
              Tempo estimado (minutos)
            </Label>
            <Input
              id="create-tempo"
              type="number"
              value={formTempoEstimado}
              onChange={(e) => setFormTempoEstimado(e.target.value)}
              placeholder="Ex: 120"
              className="rounded-xl border-slate-200"
            />
          </div>

          {/* Observacoes */}
          <div className="space-y-2">
            <Label htmlFor="create-obs" className="text-slate-700 font-medium">
              Observações
            </Label>
            <Textarea
              id="create-obs"
              value={formObservacoes}
              onChange={(e) => setFormObservacoes(e.target.value)}
              placeholder="Informações adicionais sobre a OP..."
              className="rounded-xl border-slate-200 min-h-[80px]"
            />
          </div>

          {/* Separador — Agendamento de máquina */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Agendamento de Máquina (opcional)
            </p>

            {/* Máquina */}
            <div className="space-y-2 mb-3">
              <Label htmlFor="create-maquina" className="text-slate-700 font-medium">
                Máquina
              </Label>
              <Select value={formMaquinaId} onValueChange={setFormMaquinaId}>
                <SelectTrigger id="create-maquina" className="rounded-xl border-slate-200">
                  <SelectValue placeholder="Sem máquina alocada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem máquina alocada</SelectItem>
                  {maquinas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                      <span className="ml-1 text-slate-400 text-xs">({m.tipo})</span>
                    </SelectItem>
                  ))}
                  {maquinas.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-400">
                      Nenhuma máquina cadastrada
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Datas previstas — só aparece quando máquina selecionada */}
            {formMaquinaId && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="create-inicio-previsto" className="text-slate-700 font-medium">
                    Início previsto
                  </Label>
                  <Input
                    id="create-inicio-previsto"
                    type="datetime-local"
                    value={formDataInicioPrevista}
                    onChange={(e) => setFormDataInicioPrevista(e.target.value)}
                    className="rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-fim-previsto" className="text-slate-700 font-medium">
                    Fim previsto
                  </Label>
                  <Input
                    id="create-fim-previsto"
                    type="datetime-local"
                    value={formDataFimPrevista}
                    onChange={(e) => setFormDataFimPrevista(e.target.value)}
                    className="rounded-xl border-slate-200"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus size={16} className="mr-2" />
                Criar OP
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

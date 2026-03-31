// src/domains/compras/components/SolicitacaoForm.tsx

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { comprasService } from "../services/comprasService";
import { useCriarSolicitacao } from "../hooks/useCotacoes";
import { solicitacaoCompraCreateSchema, type SolicitacaoCompraCreate } from "@/shared/schemas/estoque-compras.schemas";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SolicitacaoForm({ open, onClose }: Props) {
  const { data: materiais = [] } = useQuery({
    queryKey: ["materiais-select"],
    queryFn: comprasService.listarMateriaisSelect,
  });

  const criarMutation = useCriarSolicitacao();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SolicitacaoCompraCreate>({
    resolver: zodResolver(solicitacaoCompraCreateSchema),
    defaultValues: { urgencia: "normal", origem: "manual", status: "pendente" },
  });

  const onSubmit = (values: SolicitacaoCompraCreate) => {
    criarMutation.mutate(values, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            Nova Solicitação de Cotação
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Material */}
          <div className="space-y-1.5">
            <Label>Material *</Label>
            <select
              {...register("material_id")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione...</option>
              {materiais.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.nome} ({m.unidade})
                </option>
              ))}
            </select>
            {errors.material_id && (
              <p className="text-xs text-red-500">{errors.material_id.message}</p>
            )}
          </div>

          {/* Quantidade */}
          <div className="space-y-1.5">
            <Label>Quantidade *</Label>
            <Input
              type="number"
              step="0.001"
              className="rounded-xl"
              {...register("quantidade", { valueAsNumber: true })}
            />
            {errors.quantidade && (
              <p className="text-xs text-red-500">{errors.quantidade.message}</p>
            )}
          </div>

          {/* Urgência */}
          <div className="space-y-1.5">
            <Label>Urgência</Label>
            <select
              {...register("urgencia")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              className="rounded-xl"
              rows={3}
              {...register("observacoes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={criarMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              {criarMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              Criar Solicitação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

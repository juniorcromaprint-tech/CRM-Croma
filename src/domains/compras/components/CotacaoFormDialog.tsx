// src/domains/compras/components/CotacaoFormDialog.tsx

import { useForm } from "react-hook-form";
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
import { useCriarCotacao } from "../hooks/useCotacoes";

interface Props {
  open: boolean;
  onClose: () => void;
  solicitacao: {
    id: string;
    material_id: string;
    quantidade: number;
    material?: { nome?: string; unidade?: string } | null;
  } | null;
}

export default function CotacaoFormDialog({ open, onClose, solicitacao }: Props) {
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-ativos"],
    queryFn: comprasService.listarFornecedoresAtivos,
  });

  const criarMutation = useCriarCotacao();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fornecedor_id: "",
      valor_unitario: 0,
      prazo_entrega_dias: undefined as number | undefined,
      condicao_pagamento: "",
      validade: "",
      observacoes: "",
    },
  });

  const valorUnitario = watch("valor_unitario");
  const valorTotal = (valorUnitario || 0) * (solicitacao?.quantidade || 0);

  const onSubmit = (values: any) => {
    if (!solicitacao) return;
    criarMutation.mutate(
      {
        solicitacao_id: solicitacao.id,
        fornecedor_id: values.fornecedor_id,
        material_id: solicitacao.material_id,
        quantidade: solicitacao.quantidade,
        valor_unitario: values.valor_unitario,
        valor_total: valorTotal,
        prazo_entrega_dias: values.prazo_entrega_dias || null,
        condicao_pagamento: values.condicao_pagamento || null,
        validade: values.validade || null,
        observacoes: values.observacoes || null,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            Adicionar Cotação
          </DialogTitle>
        </DialogHeader>

        {solicitacao && (
          <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 mb-2">
            <strong>{solicitacao.material?.nome}</strong> — {solicitacao.quantidade}{" "}
            {solicitacao.material?.unidade}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Fornecedor */}
          <div className="space-y-1.5">
            <Label>Fornecedor *</Label>
            <select
              {...register("fornecedor_id", { required: "Selecione um fornecedor" })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione...</option>
              {fornecedores.map((f: any) => (
                <option key={f.id} value={f.id}>
                  {f.nome_fantasia || f.razao_social}
                </option>
              ))}
            </select>
            {errors.fornecedor_id && (
              <p className="text-xs text-red-500">{errors.fornecedor_id.message}</p>
            )}
          </div>

          {/* Valor Unitário */}
          <div className="space-y-1.5">
            <Label>Valor Unitário (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              className="rounded-xl"
              {...register("valor_unitario", {
                required: "Informe o valor",
                valueAsNumber: true,
                min: { value: 0.01, message: "Deve ser maior que zero" },
              })}
            />
            {errors.valor_unitario && (
              <p className="text-xs text-red-500">{errors.valor_unitario.message}</p>
            )}
          </div>

          {/* Total calculado */}
          <div className="bg-blue-50 rounded-xl p-3 text-sm">
            <span className="text-slate-500">Total: </span>
            <span className="font-bold text-blue-700">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorTotal)}
            </span>
          </div>

          {/* Prazo */}
          <div className="space-y-1.5">
            <Label>Prazo de Entrega (dias)</Label>
            <Input
              type="number"
              className="rounded-xl"
              {...register("prazo_entrega_dias", { valueAsNumber: true })}
            />
          </div>

          {/* Condição */}
          <div className="space-y-1.5">
            <Label>Condição de Pagamento</Label>
            <Input className="rounded-xl" {...register("condicao_pagamento")} />
          </div>

          {/* Validade */}
          <div className="space-y-1.5">
            <Label>Validade da Cotação</Label>
            <Input type="date" className="rounded-xl" {...register("validade")} />
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea className="rounded-xl" rows={2} {...register("observacoes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={criarMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              {criarMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              Salvar Cotação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

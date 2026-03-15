// src/domains/compras/hooks/usePedidosCompra.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { comprasService } from "../services/comprasService";
import { showSuccess, showError } from "@/utils/toast";

export function usePedidosCompra(filtros?: { status?: string; fornecedor_id?: string }) {
  return useQuery({
    queryKey: ["pedidos-compra", filtros],
    queryFn: () => comprasService.listarPedidosCompra(filtros),
  });
}

export function usePedidoCompra(id: string) {
  return useQuery({
    queryKey: ["pedido-compra", id],
    queryFn: () => comprasService.buscarPedidoCompra(id),
    enabled: !!id,
  });
}

export function useCriarPedidoCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pedido, itens }: { pedido: any; itens: any[] }) =>
      comprasService.criarPedidoCompra(pedido, itens),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos-compra"] });
      showSuccess("Pedido de compra criado");
    },
    onError: () => showError("Erro ao criar pedido de compra"),
  });
}

export function useAtualizarStatusPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      comprasService.atualizarStatusPedido(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos-compra"] });
      qc.invalidateQueries({ queryKey: ["pedido-compra"] });
      qc.invalidateQueries({ queryKey: ["estoque-saldos"] });
      showSuccess("Status atualizado");
    },
    onError: () => showError("Erro ao atualizar status"),
  });
}

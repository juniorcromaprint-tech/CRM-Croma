import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchImportacoes,
  fetchExtratoItens,
  importarOFX,
  classificarItem,
  ignorarItem,
  gerarLancamentosFromExtrato,
} from '../services/extrato-bancario.service';
import {
  classificarItensAutomatico,
  classificarPorIA,
  salvarClassificacoes,
} from '../services/classificacao.service';
import { showSuccess, showError } from '@/utils/toast';
import type { ExtratoItem } from '../types/contabilidade.types';

export function useImportacoes() {
  return useQuery({
    queryKey: ['extrato-importacoes'],
    queryFn: fetchImportacoes,
  });
}

export function useExtratoItens(importacaoId: string) {
  return useQuery({
    queryKey: ['extrato-itens', importacaoId],
    queryFn: () => fetchExtratoItens(importacaoId),
    enabled: !!importacaoId,
  });
}

export function useImportarOFX() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => importarOFX(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extrato-importacoes'] });
      showSuccess('Extrato importado com sucesso');
    },
    onError: (err: Error) => showError(`Erro ao importar extrato: ${err.message}`),
  });
}

export function useClassificarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      contaPlanoId,
      centroCustoId,
    }: {
      itemId: string;
      contaPlanoId: string;
      centroCustoId?: string;
    }) => classificarItem(itemId, contaPlanoId, centroCustoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extrato-itens'] });
    },
    onError: (err: Error) => showError(`Erro ao classificar: ${err.message}`),
  });
}

export function useIgnorarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => ignorarItem(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extrato-itens'] });
    },
    onError: (err: Error) => showError(`Erro: ${err.message}`),
  });
}

export function useClassificarComIA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itens: ExtratoItem[]) => {
      // 1. Primeiro por regras
      const results = await classificarItensAutomatico(itens);

      // 2. Itens sem match por IA
      const semMatch = itens.filter(item =>
        results.find(r => r.itemId === item.id && !r.contaPlanoId)
      );

      if (semMatch.length > 0) {
        const iaResults = await classificarPorIA(
          semMatch.map(i => ({ id: i.id, descricao: i.descricao_original, valor: i.valor }))
        );
        // Merge resultados IA
        for (const ia of iaResults) {
          const existing = results.find(r => r.itemId === ia.itemId);
          if (existing) {
            existing.contaPlanoId = ia.contaPlanoId;
            existing.confianca = ia.confianca;
          }
        }
      }

      // 3. Salvar no banco
      await salvarClassificacoes(results);
      return results;
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ['extrato-itens'] });
      const classificados = results.filter(r => r.contaPlanoId).length;
      showSuccess(`${classificados} itens classificados com sucesso`);
    },
    onError: (err: Error) => showError(`Erro ao classificar com IA: ${err.message}`),
  });
}

export function useGerarLancamentos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (importacaoId: string) => gerarLancamentosFromExtrato(importacaoId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['extrato-importacoes'] });
      qc.invalidateQueries({ queryKey: ['extrato-itens'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      showSuccess(`${data.length} lançamentos gerados com sucesso`);
    },
    onError: (err: Error) => showError(`Erro ao gerar lançamentos: ${err.message}`),
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TerceirizacaoSugestao {
  catalogo_id: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  nome: string;
  categoria_scan: string;
  preco_unitario_scan: number;
  preco_unitario_venda: number;
  preco_unidade: string;
  preco_total_estimado: number;
  prazo: string;
  material: string | null;
  revestimento: string | null;
  descricao: string | null;
  url: string | null;
  relevancia: number;
  maquina_em_manutencao: boolean;
}

interface UseTerceirizacaoSugestaoParams {
  produto_id: string | null;
  categoria: string | null;
  largura_cm: number | null;
  altura_cm: number | null;
  quantidade: number;
}

export function useTerceirizacaoSugestao({
  produto_id,
  categoria,
  largura_cm,
  altura_cm,
  quantidade,
}: UseTerceirizacaoSugestaoParams) {
  return useQuery({
    queryKey: ["terceirizacao-sugestao", produto_id, categoria, largura_cm, altura_cm, quantidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sugerir_terceirizacao", {
        p_produto_id: produto_id,
        p_categoria: categoria,
        p_largura_cm: largura_cm,
        p_altura_cm: altura_cm,
        p_qtd: quantidade,
      });
      if (error) throw error;
      return (data ?? []) as TerceirizacaoSugestao[];
    },
    enabled: !!(produto_id || categoria),
    staleTime: 60_000,
  });
}

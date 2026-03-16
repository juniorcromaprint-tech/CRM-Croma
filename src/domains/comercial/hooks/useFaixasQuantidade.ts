import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FaixaQuantidade {
  id: string;
  regra_id: string;
  quantidade_minima: number;
  desconto_markup_percentual: number;
  ativo: boolean;
}

export function useFaixasQuantidade(regraId?: string | null) {
  return useQuery({
    queryKey: ["faixas_quantidade", regraId],
    queryFn: async () => {
      if (!regraId) return [];
      const { data, error } = await supabase
        .from("faixas_quantidade")
        .select("*")
        .eq("regra_id", regraId)
        .eq("ativo", true)
        .order("quantidade_minima", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FaixaQuantidade[];
    },
    enabled: !!regraId,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Given quantity and faixas, returns the applicable discount on markup.
 * Uses the highest tier where quantity >= quantidade_minima.
 */
export function calcDescontoVolume(
  quantidade: number,
  faixas: FaixaQuantidade[],
): { desconto: number; faixaAplicada: FaixaQuantidade | null } {
  if (!faixas.length || quantidade <= 0) {
    return { desconto: 0, faixaAplicada: null };
  }

  // Faixas should be sorted ascending by quantidade_minima
  const sorted = [...faixas].sort((a, b) => b.quantidade_minima - a.quantidade_minima);
  const faixaAplicada = sorted.find((f) => quantidade >= f.quantidade_minima) ?? null;

  return {
    desconto: faixaAplicada?.desconto_markup_percentual ?? 0,
    faixaAplicada,
  };
}

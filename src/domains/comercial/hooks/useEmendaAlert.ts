// ============================================================================
// HOOK: useEmendaAlert — Alerta de emenda de impressão
// Verifica se as dimensões do item excedem a área útil das máquinas cadastradas
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MaquinaAreaUtil {
  id: string;
  nome: string;
  area_util_m: number;
  tipo: string;
}

export interface EmendaAlertResult {
  /** Se verdadeiro, o item excede a área útil de alguma máquina */
  hasEmenda: boolean;
  /** Nome da máquina que seria afetada (a de menor área útil compatível) */
  maquinaNome: string | null;
  /** Área útil da máquina em metros */
  areaUtilM: number | null;
}

/**
 * Verifica se as dimensões do item (em cm) excedem a área útil das máquinas
 * de impressão cadastradas. Retorna alerta de emenda se necessário.
 *
 * @param larguraCm - Largura do item em centímetros
 * @param alturaCm - Altura do item em centímetros
 */
export function useEmendaAlert(
  larguraCm: number | null | undefined,
  alturaCm: number | null | undefined
): EmendaAlertResult {
  const { data: maquinas = [] } = useQuery<MaquinaAreaUtil[]>({
    queryKey: ["maquinas-area-util"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as any)
        .from("maquinas")
        .select("id, nome, area_util_m, tipo")
        .eq("ativo", true)
        .not("area_util_m", "is", null)
        .order("area_util_m", { ascending: true });

      if (error) throw error;
      return (data || []) as MaquinaAreaUtil[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos — dados raramente mudam
  });

  // Se não temos dimensões, não há alerta
  if (!larguraCm && !alturaCm) {
    return { hasEmenda: false, maquinaNome: null, areaUtilM: null };
  }

  // Sem máquinas cadastradas com área útil, sem alerta
  if (maquinas.length === 0) {
    return { hasEmenda: false, maquinaNome: null, areaUtilM: null };
  }

  // Verificamos largura e altura separadamente, pois ambas podem causar emenda
  // area_util_m é a largura máxima de impressão em metros — convertemos para cm
  const larguraCmSafe = larguraCm ?? 0;
  const alturaCmSafe = alturaCm ?? 0;

  // Encontra a máquina de impressão com menor área útil que ainda é afetada
  // (se a dimensão excede a área útil, haverá emenda)
  const maquinaAfetada = maquinas.find((m) => {
    const areaUtilCm = m.area_util_m * 100;
    return larguraCmSafe > areaUtilCm || alturaCmSafe > areaUtilCm;
  });

  if (!maquinaAfetada) {
    return { hasEmenda: false, maquinaNome: null, areaUtilM: null };
  }

  return {
    hasEmenda: true,
    maquinaNome: maquinaAfetada.nome,
    areaUtilM: maquinaAfetada.area_util_m,
  };
}

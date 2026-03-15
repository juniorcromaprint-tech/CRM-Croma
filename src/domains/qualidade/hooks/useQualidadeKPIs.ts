// src/domains/qualidade/hooks/useQualidadeKPIs.ts

import { useQuery } from "@tanstack/react-query";
import { qualidadeService } from "../services/qualidadeService";

export function useQualidadeKPIs() {
  return useQuery({
    queryKey: ["qualidade-kpis"],
    queryFn: () => qualidadeService.buscarKPIs(),
    refetchInterval: 5 * 60 * 1000,
  });
}

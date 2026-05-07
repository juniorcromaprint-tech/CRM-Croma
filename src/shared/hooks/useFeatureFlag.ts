// src/shared/hooks/useFeatureFlag.ts
// Lê uma feature flag de admin_config em runtime.
//
// Regra de segurança: em qualquer falha (rede, RLS, chave ausente, valor inesperado)
// o hook retorna `enabled: false`. Esse fallback garante que a UX legacy permanece
// intocada se algo der errado na leitura.
//
// Uso:
//   const { enabled, isLoading } = useFeatureFlag('feature_campanhas_link_disparo');
//   if (enabled) { /* renderizar UI nova */ }
//
// O valor em admin_config é texto. Aceita 'true' (case-insensitive) como ON.
// Qualquer outro valor (incluindo 'false', 'TRUE ', null, undefined) → OFF.

import { useAdminConfig } from '@/domains/portal/hooks/useAdminConfig';

export interface FeatureFlagState {
  enabled: boolean;
  isLoading: boolean;
}

export function useFeatureFlag(chave: string): FeatureFlagState {
  const { data, isLoading } = useAdminConfig(chave);

  let enabled = false;
  if (typeof data === 'string' && data.trim().toLowerCase() === 'true') {
    enabled = true;
  }

  return { enabled, isLoading };
}

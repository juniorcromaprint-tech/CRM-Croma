// src/domains/ai/hooks/useAIModels.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

export interface AIModelEntry {
  slug: string;
  label: string;
  free: boolean; // derived: slug.endsWith(':free')
}

const FALLBACK_MODELS: AIModelEntry[] = [
  { slug: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', free: false },
  { slug: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', free: false },
];

function parseModels(raw: string | null | undefined): AIModelEntry[] {
  if (!raw) return FALLBACK_MODELS;
  try {
    const parsed: Array<{ slug: string; label: string }> = JSON.parse(raw);
    return parsed.map((m) => ({ ...m, free: m.slug.endsWith(':free') }));
  } catch {
    return FALLBACK_MODELS;
  }
}

function parseDefault(raw: string | null | undefined, models: AIModelEntry[]): string {
  if (!raw) return models[0]?.slug ?? 'openai/gpt-4.1-mini';
  try {
    return JSON.parse(raw);
  } catch {
    return models[0]?.slug ?? 'openai/gpt-4.1-mini';
  }
}

async function upsertConfig(chave: string, valor: string) {
  const { error } = await supabase
    .from('admin_config')
    .upsert({ chave, valor }, { onConflict: 'chave' });
  if (error) throw new Error(error.message);
}

export function useAIModels() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin_config', 'ai_models'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('chave, valor')
        .in('chave', ['ai_models', 'ai_default_model']);
      if (error) throw error;
      const map = Object.fromEntries((data ?? []).map((r) => [r.chave, r.valor]));
      const models = parseModels(map['ai_models']);
      const defaultModel = parseDefault(map['ai_default_model'], models);
      return { models, defaultModel };
    },
  });

  const models = data?.models ?? FALLBACK_MODELS;
  const defaultModel = data?.defaultModel ?? 'openai/gpt-4.1-mini';

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin_config', 'ai_models'] });

  const addModel = useMutation({
    mutationFn: async ({ slug, label }: { slug: string; label?: string }) => {
      const cleanSlug = slug.trim();
      if (!cleanSlug) throw new Error('Slug não pode ser vazio');
      if (models.some((m) => m.slug === cleanSlug)) throw new Error('Modelo já cadastrado');
      const autoLabel = label?.trim() || cleanSlug.split('/').pop()?.replace(':free', ' (Free)') || cleanSlug;
      const updated = [...models.map(({ slug, label }) => ({ slug, label })), { slug: cleanSlug, label: autoLabel }];
      await upsertConfig('ai_models', JSON.stringify(updated));
    },
    onSuccess: invalidate,
    onError: (err: Error) => showError(err.message),
  });

  const removeModel = useMutation({
    mutationFn: async (slug: string) => {
      const updated = models.filter((m) => m.slug !== slug).map(({ slug, label }) => ({ slug, label }));
      await upsertConfig('ai_models', JSON.stringify(updated));
    },
    onSuccess: invalidate,
    onError: (err: Error) => showError(err.message),
  });

  const setDefaultModel = useMutation({
    mutationFn: async (slug: string) => {
      await upsertConfig('ai_default_model', JSON.stringify(slug));
    },
    onSuccess: invalidate,
    onError: (err: Error) => showError(err.message),
  });

  return {
    models,
    defaultModel,
    isLoading,
    addModel,
    removeModel,
    setDefaultModel,
  };
}
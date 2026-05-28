// ============================================================================
// Hook: useOrcamentosPendentes
// Tela /orcamentos/pendentes-aprovacao — MVP Beira Rio (BLOCO 0.5)
//
// Heurística temporária (sem migration de schema):
//   propostas
//   WHERE cliente_id = af166ada-e01b-4197-b8c3-33410af325d1  (Beira Rio)
//     AND gerado_por_ia = true
//     AND aprovado_em IS NULL
//     AND status IN ('rascunho','enviada')
//     AND created_at > now() - interval '7 days'
//
// Briefing original e dados extraídos vêm de ai_requests (jsonb contexto),
// vinculado a propostas via ai_requests.entity_id. Faz query separada para
// evitar problemas com PostgREST FK reversa não-declarada.
//
// Faixa histórica (R$/m²) é calculada client-side com base nos itens de
// propostas dos últimos 180d do mesmo cliente (Beira Rio). Se < 5 amostras
// dentro da janela ±20% de área, retorna "amostra insuficiente".
// ============================================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showInfo } from "@/utils/toast";
import { useAuth } from "@/contexts/AuthContext";

export const BEIRA_RIO_CLIENTE_ID = "af166ada-e01b-4197-b8c3-33410af325d1";
export const PENDENTES_QUERY_KEY = "orcamentos-pendentes-aprovacao";
const HORIZONTE_DIAS = 7;
const HORIZONTE_HISTORICO_DIAS = 180;

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface AiRequestContexto {
  briefing?: string;
  parsed?: {
    material?: string;
    largura_cm?: number;
    altura_cm?: number;
    quantidade?: number;
    code?: string;
    [k: string]: any;
  };
  store_name?: string;
  store_id?: string;
  store_code?: string;
  store?: {
    name?: string;
    code?: string;
    address?: string;
    state?: string;
    city?: string;
    lat?: number;
    lng?: number;
  };
  sender?: {
    profile_name?: string;
    waid?: string;
  };
  instalacao?: boolean;
  lookup_tier?: string;
  notify_chat_id?: string;
  whatsapp_message_id?: string;
  [k: string]: any;
}

export interface PropostaPendente {
  id: string;
  numero: string;
  status: string;
  total: number;
  cliente_id: string;
  vendedor_id: string | null;
  created_at: string;
  gerado_por_ia: boolean;
  aprovado_em: string | null;
  config_snapshot: any | null;
  // Anexado client-side
  ai_request?: {
    id: string;
    contexto: AiRequestContexto;
    status: string;
    tipo: string;
    created_at: string;
  } | null;
  // Itens (para cálculo de faixa)
  itens?: Array<{
    id: string;
    descricao: string | null;
    quantidade: number | null;
    area_m2: number | null;
    valor_total: number | null;
    produto_id: string | null;
  }>;
  // Faixa histórica calculada
  faixa?: FaixaHistorica;
}

export interface FaixaHistorica {
  status: "ok" | "amostra_insuficiente";
  min?: number;
  max?: number;
  mediana?: number;
  amostras?: number;
  dentro?: boolean; // valor atual está dentro da faixa
  preco_m2_atual?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function mediana(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function calcularFaixa(
  proposta: PropostaPendente,
  historicoMm2: number[],
): FaixaHistorica {
  if (historicoMm2.length < 5) {
    return { status: "amostra_insuficiente", amostras: historicoMm2.length };
  }
  const sorted = [...historicoMm2].sort((a, b) => a - b);
  // Percentis 10–90 para evitar outliers
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const med = mediana(historicoMm2);

  const areaAtual = (proposta.itens ?? []).reduce(
    (s, i) => s + ((i.area_m2 ?? 0) * (i.quantidade ?? 1)),
    0,
  );
  const precoM2Atual = areaAtual > 0 ? proposta.total / areaAtual : 0;
  const dentro = precoM2Atual >= p10 * 0.85 && precoM2Atual <= p90 * 1.15;

  return {
    status: "ok",
    min: p10,
    max: p90,
    mediana: med,
    amostras: historicoMm2.length,
    dentro,
    preco_m2_atual: precoM2Atual,
  };
}

// ─── Query principal ──────────────────────────────────────────────────────

export function useOrcamentosPendentes() {
  return useQuery({
    queryKey: [PENDENTES_QUERY_KEY],
    refetchInterval: 30 * 1000, // 30s polling
    staleTime: 15 * 1000,
    queryFn: async (): Promise<PropostaPendente[]> => {
      // 1) Lista de propostas SHADOW pendentes (heurística)
      const { data: propostas, error: errProp } = await supabase
        .from("propostas")
        .select(
          `id, numero, status, total, cliente_id, vendedor_id, created_at,
           gerado_por_ia, aprovado_em, config_snapshot`,
        )
        .eq("cliente_id", BEIRA_RIO_CLIENTE_ID)
        .eq("gerado_por_ia", true)
        .is("aprovado_em", null)
        .in("status", ["rascunho", "enviada"])
        .gte("created_at", isoDaysAgo(HORIZONTE_DIAS))
        .is("excluido_em", null)
        .order("created_at", { ascending: false });

      if (errProp) throw errProp;
      const lista = (propostas ?? []) as PropostaPendente[];
      if (lista.length === 0) return [];

      const ids = lista.map((p) => p.id);

      // 2) ai_requests vinculados (briefing original + extração)
      const { data: aiReqs, error: errAi } = await supabase
        .from("ai_requests")
        .select("id, entity_id, contexto, status, tipo, created_at")
        .in("entity_id", ids)
        .eq("tipo", "briefing_beira_rio_shadow")
        .order("created_at", { ascending: false });

      if (errAi) {
        // Não fatal — segue sem briefing
        console.warn("[useOrcamentosPendentes] ai_requests indisponível:", errAi.message);
      }

      const aiByEntity = new Map<string, any>();
      for (const r of aiReqs ?? []) {
        // primeiro registro = mais recente (já ordenado desc) — mantém
        if (!aiByEntity.has((r as any).entity_id)) {
          aiByEntity.set((r as any).entity_id, r);
        }
      }

      // 3) Itens das propostas pendentes (para cálculo de faixa)
      const { data: itens, error: errItens } = await supabase
        .from("proposta_itens")
        .select("id, proposta_id, descricao, quantidade, area_m2, valor_total, produto_id")
        .in("proposta_id", ids);
      if (errItens) {
        console.warn("[useOrcamentosPendentes] itens indisponíveis:", errItens.message);
      }
      const itensByProp = new Map<string, any[]>();
      for (const it of itens ?? []) {
        const k = (it as any).proposta_id as string;
        if (!itensByProp.has(k)) itensByProp.set(k, []);
        itensByProp.get(k)!.push(it);
      }

      // 4) Histórico Beira Rio últimos 180d — uma query, recalculo client-side por proposta
      let historicoItens: any[] = [];
      try {
        const { data: histProps, error: errHistProps } = await supabase
          .from("propostas")
          .select("id")
          .eq("cliente_id", BEIRA_RIO_CLIENTE_ID)
          .in("status", ["aprovada", "enviada"])
          .gte("created_at", isoDaysAgo(HORIZONTE_HISTORICO_DIAS))
          .is("excluido_em", null);

        if (errHistProps) throw errHistProps;
        const histPropIds = (histProps ?? []).map((p: any) => p.id);

        if (histPropIds.length > 0) {
          const { data: histItens, error: errHistItens } = await supabase
            .from("proposta_itens")
            .select("proposta_id, quantidade, area_m2, valor_total, produto_id")
            .in("proposta_id", histPropIds);
          if (errHistItens) throw errHistItens;
          historicoItens = histItens ?? [];
        }
      } catch (e: any) {
        console.warn("[useOrcamentosPendentes] histórico indisponível:", e?.message ?? e);
      }

      // 5) Compor resultado
      return lista.map((p) => {
        const propItens = (itensByProp.get(p.id) ?? []) as PropostaPendente["itens"];
        const areaAtual = (propItens ?? []).reduce(
          (s, i) => s + ((i?.area_m2 ?? 0) * (i?.quantidade ?? 1)),
          0,
        );

        // Filtra histórico por janela de área ±20% e calcula R$/m² de cada
        let historicoMm2: number[] = [];
        if (areaAtual > 0) {
          historicoMm2 = historicoItens
            .filter((h: any) => {
              const areaH = (h.area_m2 ?? 0) * (h.quantidade ?? 1);
              return (
                areaH > 0 &&
                areaH >= areaAtual * 0.8 &&
                areaH <= areaAtual * 1.2 &&
                (h.valor_total ?? 0) > 0
              );
            })
            .map((h: any) => {
              const areaH = (h.area_m2 ?? 0) * (h.quantidade ?? 1);
              return (h.valor_total as number) / areaH;
            });
        }

        const withItens: PropostaPendente = {
          ...p,
          ai_request: aiByEntity.get(p.id) ?? null,
          itens: propItens,
        };
        withItens.faixa = calcularFaixa(withItens, historicoMm2);
        return withItens;
      });
    },
  });
}

// ─── Mutation: aprovar e enviar ───────────────────────────────────────────

export function useAprovarPendente() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      propostaId,
      comentario,
    }: {
      propostaId: string;
      comentario?: string;
    }) => {
      const updates: Record<string, any> = {
        status: "enviada",
        aprovado_em: new Date().toISOString(),
      };
      if (profile?.id) updates.aprovado_por = profile.id;

      const { data, error } = await supabase
        .from("propostas")
        .update(updates)
        .eq("id", propostaId)
        .select("id, numero, status, aprovado_em")
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error("Não foi possível aprovar (RLS pode estar bloqueando).");
      }

      // Registra comentário em ai_requests.resposta_ia (se houver request vinculado)
      if (comentario?.trim()) {
        try {
          const { data: req } = await supabase
            .from("ai_requests")
            .select("id, resposta_ia")
            .eq("entity_id", propostaId)
            .eq("tipo", "briefing_beira_rio_shadow")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (req?.id) {
            const respostaPrev =
              (typeof req.resposta_ia === "object" && req.resposta_ia) || {};
            await supabase
              .from("ai_requests")
              .update({
                resposta_ia: {
                  ...respostaPrev,
                  comentario_aprovacao: comentario.trim(),
                  aprovado_em: new Date().toISOString(),
                  aprovado_por: profile?.id ?? null,
                },
              })
              .eq("id", req.id);
          }
        } catch (e) {
          console.warn("[useAprovarPendente] falha ao salvar comentário:", e);
        }
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PENDENTES_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ["orcamentos"] });
      showSuccess("Orçamento aprovado e marcado como enviado.");
    },
    onError: (err: Error) => {
      showError(err.message || "Erro ao aprovar orçamento.");
    },
  });
}

// ─── Mutation: pingar Viviane (stub MVP) ──────────────────────────────────

export function usePingarViviane() {
  return useMutation({
    mutationFn: async (propostaId: string) => {
      // STUB MVP — integração Edge function vem após rotação do token Telegram
      // Aqui só registramos a intenção em ai_requests (best-effort) p/ rastrear.
      try {
        const { data: req } = await supabase
          .from("ai_requests")
          .select("id, resposta_ia")
          .eq("entity_id", propostaId)
          .eq("tipo", "briefing_beira_rio_shadow")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (req?.id) {
          const respostaPrev =
            (typeof req.resposta_ia === "object" && req.resposta_ia) || {};
          await supabase
            .from("ai_requests")
            .update({
              resposta_ia: {
                ...respostaPrev,
                viviane_ping_solicitado_em: new Date().toISOString(),
                viviane_ping_stub: true,
              },
            })
            .eq("id", req.id);
        }
      } catch (e) {
        // Best-effort, não bloqueia o toast
        console.warn("[usePingarViviane] log falhou:", e);
      }
      return { ok: true, stub: true, propostaId };
    },
    onSuccess: () => {
      showInfo(
        "Aviso para Viviane registrado (integração Telegram entra após rotação do token).",
      );
    },
    onError: (err: Error) => {
      showError(err.message || "Erro ao registrar aviso.");
    },
  });
}

// ============================================================================
// COMISSOES SERVICE — Croma Print ERP
// Lógica de negócio para comissões internas e externas
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

export interface ComissaoCreateInput {
  pedido_id: string;
  vendedor_id: string;
  valor_base: number;
  percentual: number;
  tipo_comissionado?: "interno" | "externo";
  absorver_comissao?: boolean;
}

/**
 * Cria manualmente uma comissão (fallback para quando o trigger não cobrir o caso).
 */
export async function criarComissao(input: ComissaoCreateInput) {
  const valor_comissao = input.valor_base * (input.percentual / 100);

  const { data, error } = await supabase
    .from("comissoes")
    .insert({
      pedido_id: input.pedido_id,
      vendedor_id: input.vendedor_id,
      valor_base: input.valor_base,
      valor_comissao,
      percentual: input.percentual,
      status: "gerada",
      tipo_comissionado: input.tipo_comissionado ?? "interno",
      absorver_comissao: input.absorver_comissao ?? false,
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar comissão: ${error.message}`);
  return data;
}

// ============================================================================
// NOTA PARA ATUALIZAÇÃO DO TRIGGER fn_gerar_comissao_auto()
// Arquivo original: supabase/migrations/091_comissoes_trigger.sql
//
// A função atual gera somente a comissão interna (5% para o vendedor_id do pedido).
// Para suportar comissionados externos, o trigger deve ser expandido assim:
//
// CREATE OR REPLACE FUNCTION fn_gerar_comissao_auto()
// RETURNS TRIGGER LANGUAGE plpgsql AS $$
// DECLARE
//   v_valor_base         numeric;
//   v_vendedor_id        uuid;
//   v_comissao_ext_id    uuid;
//   v_comissao_ext_pct   numeric;
//   v_absorver           boolean;
// BEGIN
//   IF NEW.status <> 'faturado' OR OLD.status = 'faturado' THEN
//     RETURN NEW;
//   END IF;
//
//   -- Idempotência: não duplicar comissão interna
//   IF EXISTS (
//     SELECT 1 FROM comissoes
//     WHERE pedido_id = NEW.id AND (tipo_comissionado IS NULL OR tipo_comissionado = 'interno')
//   ) THEN
//     RETURN NEW;
//   END IF;
//
//   v_valor_base   := COALESCE(NEW.valor_total, 0);
//   v_vendedor_id  := NEW.vendedor_id;
//
//   -- 1) Comissão interna (5%)
//   IF v_vendedor_id IS NOT NULL AND v_valor_base > 0 THEN
//     INSERT INTO comissoes (pedido_id, vendedor_id, valor_base, valor_comissao, percentual, status, tipo_comissionado, created_at)
//     VALUES (NEW.id, v_vendedor_id, v_valor_base, v_valor_base * 0.05, 5.0, 'gerada', 'interno', now())
//     ON CONFLICT DO NOTHING;
//   END IF;
//
//   -- 2) Comissão externa — busca da proposta vinculada ao pedido
//   SELECT p.comissionado_externo_id, p.comissao_externa_pct, p.absorver_comissao
//     INTO v_comissao_ext_id, v_comissao_ext_pct, v_absorver
//   FROM propostas p
//   WHERE p.id = NEW.proposta_id
//   LIMIT 1;
//
//   IF v_comissao_ext_id IS NOT NULL AND v_comissao_ext_pct > 0 THEN
//     -- Idempotência: não duplicar comissão externa
//     IF NOT EXISTS (
//       SELECT 1 FROM comissoes
//       WHERE pedido_id = NEW.id AND tipo_comissionado = 'externo'
//     ) THEN
//       INSERT INTO comissoes (
//         pedido_id, vendedor_id, valor_base, valor_comissao, percentual,
//         status, tipo_comissionado, absorver_comissao, created_at
//       ) VALUES (
//         NEW.id, v_comissao_ext_id, v_valor_base,
//         v_valor_base * (v_comissao_ext_pct / 100),
//         v_comissao_ext_pct, 'gerada', 'externo', COALESCE(v_absorver, false), now()
//       ) ON CONFLICT DO NOTHING;
//     END IF;
//   END IF;
//
//   RETURN NEW;
// EXCEPTION WHEN OTHERS THEN
//   RETURN NEW;
// END;
// $$;
//
// REQUISITO: a tabela pedidos deve ter coluna proposta_id UUID referenciando propostas.
// Verifique se essa coluna existe antes de aplicar. Se não existir, use uma subquery
// alternativa via ordens_producao ou pedido_itens para encontrar a proposta original.
// ============================================================================

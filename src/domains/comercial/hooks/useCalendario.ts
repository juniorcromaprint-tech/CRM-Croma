import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CalendarioEventKind = 'entrega' | 'vencimento' | 'follow_up' | 'visita';

export interface CalendarioEvent {
  id: string;
  data: string; // YYYY-MM-DD
  tipo: CalendarioEventKind;
  titulo: string;
  subtitulo?: string;
  entidade_tipo: 'pedido' | 'orcamento' | 'lead';
  entidade_id: string;
}

export function useCalendarioEvents() {
  return useQuery({
    queryKey: ['calendario', 'events'],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<CalendarioEvent[]> => {
      const events: CalendarioEvent[] = [];

      // 1. Pedidos com data prometida
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('id, numero, data_prometida, status, clientes(nome_fantasia)')
        .not('data_prometida', 'is', null)
        .is('excluido_em', null)
        .neq('status', 'cancelado');

      for (const p of pedidos ?? []) {
        if (p.data_prometida) {
          events.push({
            id: `ped-${p.id}`,
            data: p.data_prometida.slice(0, 10),
            tipo: 'entrega',
            titulo: `Entrega ${p.numero}`,
            subtitulo: (p.clientes as any)?.nome_fantasia ?? undefined,
            entidade_tipo: 'pedido',
            entidade_id: p.id,
          });
        }
      }

      // 2. Leads com próximo contato agendado
      const { data: leads } = await supabase
        .from('leads')
        .select('id, empresa, contato_nome, proximo_contato, status')
        .not('proximo_contato', 'is', null)
        .not('status', 'in', '("convertido","perdido")');

      for (const l of leads ?? []) {
        if (l.proximo_contato) {
          events.push({
            id: `lead-${l.id}`,
            data: l.proximo_contato.slice(0, 10),
            tipo: 'follow_up',
            titulo: `Follow-up: ${l.empresa}`,
            subtitulo: l.contato_nome ?? undefined,
            entidade_tipo: 'lead',
            entidade_id: l.id,
          });
        }
      }

      // 3. Orçamentos próximos do vencimento (validade)
      const { data: orcs } = await supabase
        .from('propostas')
        .select('id, numero, created_at, validade_dias, status')
        .in('status', ['enviada', 'em_revisao'])
        .is('excluido_em', null);

      for (const o of orcs ?? []) {
        if (o.created_at && o.validade_dias) {
          const validade = new Date(o.created_at);
          validade.setDate(validade.getDate() + o.validade_dias);
          events.push({
            id: `orc-${o.id}`,
            data: validade.toISOString().slice(0, 10),
            tipo: 'vencimento',
            titulo: `Vence: Orç. ${o.numero}`,
            entidade_tipo: 'orcamento',
            entidade_id: o.id,
          });
        }
      }

      return events;
    },
  });
}

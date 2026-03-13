// src/domains/portal/services/portal.service.ts
import { supabase } from '@/integrations/supabase/client';

export interface PortalProposta {
  id: string;
  numero: string;
  status: string;
  valor_total: number;
  desconto_percentual: number;
  forma_pagamento: string;
  parcelas_count: number;
  prazo_dias: number[];
  entrada_percentual: number;
  validade: number;
  observacoes: string;
  aprovado_pelo_cliente: boolean;
  cliente: {
    nome_fantasia: string;
    contato_nome: string;
  };
  itens: Array<{
    id: string;
    descricao: string;
    especificacao: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }>;
}

export async function fetchPropostaByToken(token: string): Promise<PortalProposta> {
  const { data, error } = await supabase.rpc('portal_get_proposta', { p_token: token });
  if (error) throw new Error(error.message);
  return data as PortalProposta;
}

export async function aprovarProposta(token: string, comentario?: string): Promise<void> {
  const { error } = await supabase.rpc('portal_aprovar_proposta', {
    p_token: token,
    p_comentario: comentario || null,
  });
  if (error) throw new Error(error.message);
}

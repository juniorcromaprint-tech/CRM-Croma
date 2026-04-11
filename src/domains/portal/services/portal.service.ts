// src/domains/portal/services/portal.service.ts
import { supabase } from '@/integrations/supabase/client';

export interface PortalEmpresa {
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  ie: string | null;
  telefone: string | null;
  logradouro: string | null;
  numero_endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  logo_url: string | null;
}

export interface PortalCliente {
  nome_fantasia: string;
  razao_social: string;
  contato_nome: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  bairro: string | null;
}

export interface PortalItem {
  id: string;
  descricao: string;
  especificacao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  largura_cm: number | null;
  altura_cm: number | null;
  area_m2: number | null;
  grupo_uniao?: string | null;
  nome_exibicao?: string | null;
  item_visivel?: boolean | null;
}

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
  created_at?: string;
  data_validade?: string;
  observacoes: string;
  aprovado_pelo_cliente: boolean;
  cliente: PortalCliente;
  empresa?: PortalEmpresa;
  itens: PortalItem[];
}

export async function fetchPropostaByToken(token: string): Promise<PortalProposta> {
  const { data, error } = await supabase.rpc('portal_get_proposta', { p_token: token });
  if (error) throw new Error(error.message);
  return data as PortalProposta;
}

export interface AprovarPropostaResult {
  aprovada: boolean;
  pedido_id: string | null;
}

export async function aprovarProposta(
  token: string,
  comentario?: string,
): Promise<AprovarPropostaResult> {
  const { data, error } = await supabase.rpc('portal_aprovar_proposta', {
    p_token: token,
    p_comentario: comentario || null,
  });
  if (error) throw new Error(error.message);
  return (data as AprovarPropostaResult) ?? { aprovada: true, pedido_id: null };
}

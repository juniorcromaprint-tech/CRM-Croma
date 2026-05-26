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
  // FASE 2-C — campos extras opcionais retornados ao editar dados.
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
}

// ─── FASE 2-C — Vendedor, logistica, edicao de dados ────────────────────────

/** Vendedor responsavel pela proposta (header + PIX + Whatsapp em FASE 2-D). */
export interface PortalVendedor {
  id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
}

/** Tipo de logistica do orcamento, definido pelo vendedor no briefing. */
export type PortalLogistica = 'instalado' | 'frete' | 'retirada' | null;

/** Whitelist de campos editaveis pelo cliente via portal_atualizar_cliente. */
export interface ClienteEditavel {
  contato_nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
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
  // FASE 2-B — imagem opcional + aprovacao parcial por item
  imagem_url?: string | null;
  /** tri-state: null=pendente, true=aprovado, false=recusado */
  aprovado?: boolean | null;
}

export interface PortalStore {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  brand?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
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
  /** Loja de destino (Beira Rio): preenchido por briefing-beira-rio v9+ */
  store?: PortalStore | null;
  // FASE 2-C — campos populados por briefing-beira-rio v10 + portal_get_proposta v2
  referencia?: string | null;
  prazo_entrega_dias?: number | null;
  logistica?: PortalLogistica;
  vendedor?: PortalVendedor | null;
  // FASE 2-F — assinatura touch (campos retornados pela RPC ja em v2)
  assinatura_cliente_url?: string | null;
  assinatura_cliente_at?: string | null;
}

export async function fetchPropostaByToken(token: string): Promise<PortalProposta> {
  const { data, error } = await supabase.rpc('portal_get_proposta', { p_token: token });
  if (error) throw new Error(error.message);
  return data as PortalProposta;
}

export interface AprovarPropostaResult {
  aprovada: boolean;
  pedido_id: string | null;
  assinatura_capturada?: boolean;
}

/**
 * FASE 2-F — Aprova proposta com assinatura digital opcional.
 *
 * Fluxo quando ha assinatura:
 *  1. Front captura PNG base64 do canvas signature_pad
 *  2. Chama Edge `portal-upload-assinatura` (verify_jwt=false, autoriza via share_token)
 *  3. Edge faz upload no Storage como service_role e devolve signedUrl (TTL 1 ano)
 *  4. signedUrl eh passada pra RPC `portal_aprovar_proposta(p_token, p_comentario, p_assinatura_url)`
 *
 * Sem assinatura: chamada direta a RPC com p_assinatura_url=null (comportamento legado).
 */
export async function aprovarProposta(
  token: string,
  comentario?: string,
  assinaturaBase64?: string | null,
): Promise<AprovarPropostaResult> {
  let assinaturaUrl: string | null = null;

  if (assinaturaBase64) {
    const resp = await supabase.functions.invoke<{
      ok: boolean;
      url?: string;
      error?: string;
    }>('portal-upload-assinatura', {
      body: { token, assinatura_base64: assinaturaBase64 },
    });
    if (resp.error) throw new Error(`Upload assinatura falhou: ${resp.error.message}`);
    if (!resp.data?.ok || !resp.data?.url) {
      throw new Error(`Upload assinatura falhou: ${resp.data?.error || 'sem URL retornada'}`);
    }
    assinaturaUrl = resp.data.url;
  }

  const { data, error } = await supabase.rpc('portal_aprovar_proposta', {
    p_token: token,
    p_comentario: comentario || null,
    p_assinatura_url: assinaturaUrl,
  });
  if (error) throw new Error(error.message);
  return (data as AprovarPropostaResult) ?? { aprovada: true, pedido_id: null };
}

// ─── FASE 2-B — aprovacao parcial de itens ──────────────────────────────────

export interface AprovarItemResult {
  ok: boolean;
  proposta_id: string;
  item_id: string;
  aprovado: boolean;
  novo_status: string;
  total_itens: number;
  aprovados: number;
  recusados: number;
  pendentes: number;
}

/**
 * Marca um item como aprovado (true) ou recusado (false) no portal.
 * O backend recalcula o status da proposta:
 *   - todos itens aprovado=true  -> propostas.status = 'aprovada_cliente'
 *   - alguns aprovados/recusados -> propostas.status = 'aprovacao_parcial'
 *   - nenhuma decisao            -> mantem status atual
 */
export async function aprovarItem(
  token: string,
  itemId: string,
  aprovado: boolean,
): Promise<AprovarItemResult> {
  const { data, error } = await supabase.rpc('portal_aprovar_item', {
    p_token: token,
    p_item_id: itemId,
    p_aprovado: aprovado,
  });
  if (error) throw new Error(error.message);
  return data as AprovarItemResult;
}

// ─── FASE 2-E — Chat persistido (portal_mensagens) ──────────────────────────

export type PortalMensagemRemetente = 'cliente' | 'vendedor' | 'ia';

export interface PortalMensagem {
  id: string;
  proposta_id: string;
  remetente: PortalMensagemRemetente;
  conteudo: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Lista todas as mensagens do chat de uma proposta (ordenadas ASC por created_at).
 * RPC SECURITY DEFINER — autorizada via share_token (p_token).
 */
export async function listarMensagens(token: string): Promise<PortalMensagem[]> {
  const { data, error } = await supabase.rpc('portal_listar_mensagens', { p_token: token });
  if (error) throw new Error(error.message);
  return (data as PortalMensagem[]) ?? [];
}

/**
 * Insere uma mensagem do cliente no chat. RPC fixa remetente='cliente'.
 * Mensagens de 'vendedor' e 'ia' devem ser gravadas via service_role (Edge Function).
 * Retorna o id (uuid) da mensagem criada.
 */
export async function inserirMensagem(
  token: string,
  conteudo: string,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await supabase.rpc('portal_inserir_mensagem', {
    p_token: token,
    p_conteudo: conteudo,
    p_metadata: metadata,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// ─── FASE 2-C — Edicao de dados cadastrais pelo cliente ────────────────────

export interface AtualizarClienteResult {
  ok: boolean;
  cliente_id: string;
  proposta_id: string;
  dados: Record<string, string | null>;
}

/**
 * Atualiza dados cadastrais do cliente da proposta via share_token.
 * Whitelist: contato_nome, telefone, email, endereco, numero, complemento,
 * bairro, cidade, estado, cep. CNPJ/razao_social NAO sao editaveis pelo portal.
 *
 * RPC SECURITY DEFINER em public.portal_atualizar_cliente — valida token ativo
 * e nao expirado antes do UPDATE.
 */
export async function atualizarDadosCliente(
  token: string,
  dados: ClienteEditavel,
): Promise<AtualizarClienteResult> {
  const { data, error } = await supabase.rpc('portal_atualizar_cliente', {
    p_token: token,
    p_dados: dados as unknown as Record<string, unknown>,
  });
  if (error) throw new Error(error.message);
  return data as AtualizarClienteResult;
}

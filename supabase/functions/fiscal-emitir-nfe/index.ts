/**
 * CROMA PRINT ERP — Edge Function: Emitir NF-e
 *
 * SEGURANÇA CRÍTICA:
 * - O certificado A1 é processado SOMENTE aqui (backend)
 * - Nunca retorna o conteúdo do certificado ao frontend
 * - Usa SUPABASE_SERVICE_ROLE_KEY para acessar o storage privado
 *
 * NOTA MVP:
 * Esta função implementa o fluxo de emissão usando um provider externo
 * (ex: Focus NFe, Nota Fiscal de Serviço, ou SEFAZ diretamente).
 * Para o MVP, implementamos integração com Focus NFe (API REST).
 * Para produção real, configure NFE_PROVIDER_TOKEN e NFE_PROVIDER_URL.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

/**
 * Calcula dígito verificador da chave NF-e (módulo 11, pesos 2-9)
 * Conforme Manual de Orientação do Contribuinte NF-e 4.0
 */
function calcDVChaveNFe(chave43: string): number {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i]) * pesos[(chave43.length - 1 - i) % 8];
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmitirRequest {
  documento_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const body: EmitirRequest = await req.json();
    const { documento_id } = body;

    if (!documento_id) {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem_erro: 'documento_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Busca documento com todos os dados necessários
    const { data: doc, error: docError } = await supabaseAdmin
      .from('fiscal_documentos')
      .select(`
        *,
        fiscal_documentos_itens(*),
        clientes(*),
        pedidos(numero, valor_total),
        fiscal_ambientes(tipo, endpoint_base, uf, cnpj_emitente),
        fiscal_series(serie),
        fiscal_certificados(id, nome, arquivo_encriptado_url, senha_secret_ref, cnpj_titular)
      `)
      .eq('id', documento_id)
      .single();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem_erro: 'Documento fiscal não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Valida status
    if (!['apto', 'rascunho', 'rejeitado', 'erro_transmissao'].includes(doc.status)) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          mensagem_erro: `Documento com status '${doc.status}' não pode ser emitido`,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Marca como emitindo
    await supabaseAdmin
      .from('fiscal_documentos')
      .update({ status: 'emitindo', updated_at: new Date().toISOString() })
      .eq('id', documento_id);

    // Gera próximo número da série
    const { data: numeroData, error: numError } = await supabaseAdmin.rpc(
      'fiscal_proximo_numero_serie',
      { p_serie_id: doc.serie_id }
    );

    if (numError) {
      throw new Error('Erro ao gerar número da série: ' + numError.message);
    }

    const numero = numeroData as number;
    const serie = doc.fiscal_series?.serie ?? 1;
    const ambiente = doc.fiscal_ambientes?.tipo ?? 'homologacao';
    const cnpjEmitente = Deno.env.get('NFE_CNPJ_EMITENTE') ?? doc.fiscal_certificados?.cnpj_titular ?? '';

    // Monta o payload para o provider externo (Focus NFe, etc.)
    const nfeProvider = Deno.env.get('NFE_PROVIDER') ?? 'focus_nfe';
    const nfeToken = Deno.env.get('NFE_PROVIDER_TOKEN');
    const nfeBaseUrl = Deno.env.get('NFE_PROVIDER_URL') ?? 'https://homologacao.focusnfe.com.br';

    // Monta payload NF-e (estrutura Focus NFe)
    const cliente = doc.clientes;
    const itens = doc.fiscal_documentos_itens ?? [];

    const nfePayload = {
      natureza_operacao: doc.natureza_operacao ?? 'Venda de mercadoria',
      forma_pagamento: 0,
      tipo_documento: 1, // 1=saída
      serie: serie,
      numero: numero,
      data_emissao: new Date().toISOString().split('T')[0],
      data_entrada_saida: new Date().toISOString().split('T')[0],
      tipo_ambiente: ambiente === 'producao' ? 1 : 2,
      finalidade_emissao: 1,
      consumidor_final: doc.consumidor_final ?? 1,
      presenca_comprador: 1,
      cnpj_emitente: cnpjEmitente,
      cpf_destinatario: cliente?.cpf_cnpj?.length === 11 ? cliente.cpf_cnpj : undefined,
      cnpj_destinatario: cliente?.cpf_cnpj?.length === 14 || cliente?.cpf_cnpj?.length === 18
        ? cliente.cpf_cnpj?.replace(/\D/g, '')
        : undefined,
      nome_destinatario: cliente?.razao_social ?? cliente?.nome_fantasia,
      email_destinatario: cliente?.email_fiscal ?? cliente?.email,
      logradouro_destinatario: cliente?.endereco,
      numero_destinatario: cliente?.numero,
      complemento_destinatario: cliente?.complemento,
      bairro_destinatario: cliente?.bairro,
      municipio_destinatario: cliente?.cidade,
      uf_destinatario: cliente?.estado,
      cep_destinatario: cliente?.cep?.replace(/\D/g, ''),
      pais_destinatario: cliente?.pais ?? 'Brasil',
      indicador_ie_destinatario: parseInt(cliente?.indicador_ie_destinatario ?? '9'),
      inscricao_estadual_destinatario: cliente?.inscricao_estadual,
      informacoes_adicionais_contribuinte: doc.informacoes_contribuinte,
      informacoes_adicionais_fisco: doc.informacoes_fisco,
      items: itens.map((item: any, idx: number) => ({
        numero_item: idx + 1,
        codigo_produto: item.codigo_produto ?? `PROD-${idx + 1}`,
        codigo_barras: undefined,
        descricao: item.descricao,
        codigo_ncm: item.ncm?.replace(/\D/g, ''),
        cfop: item.cfop,
        unidade_comercial: item.unidade,
        quantidade_comercial: item.quantidade,
        valor_unitario_comercial: item.valor_unitario,
        valor_bruto: item.valor_bruto,
        unidade_tributavel: item.unidade,
        quantidade_tributavel: item.quantidade,
        valor_unitario_tributavel: item.valor_unitario,
        valor_frete: 0,
        valor_seguro: 0,
        valor_desconto: item.valor_desconto ?? 0,
        valor_total_tributos: 0,
        inclui_no_total: 1,
        origem_mercadoria: parseInt(item.origem_mercadoria ?? '0'),
        codigo_situacao_operacional: item.cst_ou_csosn,
        modalidade_base_calculo_icms: 3,
        percentual_reducao_base_calculo: 0,
        base_calculo_icms: item.base_calculo_icms ?? 0,
        aliquota_icms: item.aliquota_icms ?? 0,
        valor_icms: item.valor_icms ?? 0,
        cst_pis: '07',
        base_calculo_pis: item.base_calculo_pis ?? 0,
        aliquota_pis: item.aliquota_pis ?? 0,
        valor_pis: item.valor_pis ?? 0,
        cst_cofins: '07',
        base_calculo_cofins: item.base_calculo_cofins ?? 0,
        aliquota_cofins: item.aliquota_cofins ?? 0,
        valor_cofins: item.valor_cofins ?? 0,
      })),
      valor_produtos: doc.valor_produtos,
      valor_frete: doc.valor_frete ?? 0,
      valor_seguro: doc.valor_seguro ?? 0,
      valor_desconto: doc.valor_desconto ?? 0,
      valor_outras_despesas: doc.valor_outras_despesas ?? 0,
      valor_total: doc.valor_total,
      modalidade_frete: 9,
      valor_icms: doc.valor_icms ?? 0,
      valor_pis: doc.valor_pis ?? 0,
      valor_cofins: doc.valor_cofins ?? 0,
    };

    // Se não há token configurado, simula resposta (modo demo)
    let resultado: any;

    if (!nfeToken || nfeToken === 'DEMO_MODE') {
      // MODO DEMO: simula autorização bem-sucedida
      console.log('[fiscal-emitir-nfe] MODO DEMO — simulando autorização');
      const cUF = doc.fiscal_ambientes?.uf === 'SP' ? '35' :
                  doc.fiscal_ambientes?.uf === 'RJ' ? '33' :
                  doc.fiscal_ambientes?.uf === 'MG' ? '31' :
                  doc.fiscal_ambientes?.uf === 'RS' ? '43' :
                  doc.fiscal_ambientes?.uf === 'PR' ? '41' :
                  doc.fiscal_ambientes?.uf === 'SC' ? '42' :
                  doc.fiscal_ambientes?.uf === 'BA' ? '29' :
                  doc.fiscal_ambientes?.uf === 'GO' ? '52' :
                  doc.fiscal_ambientes?.uf === 'PE' ? '26' :
                  doc.fiscal_ambientes?.uf === 'CE' ? '23' : '35'; // default SP
      const now = new Date();
      const aamm = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      const cnpjAmbiente = (doc.fiscal_ambientes as any)?.cnpj_emitente ?? cnpjEmitente;
      const cnpjLimpo = cnpjAmbiente.replace(/\D/g, '').padStart(14, '0');
      const serieStr = doc.fiscal_series?.serie?.toString().padStart(3, '0') ?? '001';
      const nNF = numero.toString().padStart(9, '0');
      const cNF = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      const chave43 = `${cUF}${aamm}${cnpjLimpo}55${serieStr}${nNF}1${cNF}`;
      const dv = calcDVChaveNFe(chave43);
      const chave_acesso_demo = `${chave43}${dv}`;
      resultado = {
        sucesso: true,
        status: 'autorizado',
        numero: numero,
        chave_acesso: chave_acesso_demo,
        protocolo: `1${Date.now().toString()}`,
        recibo: `${Date.now()}`,
        data_autorizacao: new Date().toISOString(),
        xml_autorizado: `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${numero}"/></NFe></nfeProc>`,
        retorno_raw: { status: 'DEMO', numero, ambiente },
      };
    } else {
      // MODO REAL: envia para o provider externo
      try {
        const providerUrl = `${nfeBaseUrl}/v2/nfe?ref=${documento_id}`;
        const response = await fetch(providerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token token=${nfeToken}`,
          },
          body: JSON.stringify(nfePayload),
        });

        const retorno = await response.json();

        if (response.status === 200 || response.status === 201) {
          resultado = {
            sucesso: true,
            status: 'autorizado',
            numero: retorno.numero ?? numero,
            chave_acesso: retorno.chave_nfe ?? retorno.chave,
            protocolo: retorno.protocolo_autorizacao,
            data_autorizacao: retorno.data_hora_autorizacao ?? new Date().toISOString(),
            xml_autorizado: retorno.nfe_proc_url,
            retorno_raw: retorno,
          };
        } else if (response.status === 422) {
          resultado = {
            sucesso: false,
            status: 'rejeitado',
            mensagem_erro: retorno.mensagem ?? retorno.erros?.[0]?.mensagem ?? 'NF-e rejeitada pela SEFAZ',
            codigo_erro: retorno.codigo ?? String(response.status),
            retorno_raw: retorno,
          };
        } else {
          throw new Error(`Provider retornou status ${response.status}: ${JSON.stringify(retorno)}`);
        }
      } catch (providerErr) {
        resultado = {
          sucesso: false,
          status: 'erro_transmissao',
          mensagem_erro: String(providerErr),
          retorno_raw: { error: String(providerErr) },
        };
      }
    }

    // Atualiza documento com resultado
    if (resultado.sucesso) {
      await supabaseAdmin
        .from('fiscal_documentos')
        .update({
          status: 'autorizado',
          numero: resultado.numero,
          chave_acesso: resultado.chave_acesso,
          protocolo: resultado.protocolo,
          recibo: resultado.recibo,
          data_emissao: new Date().toISOString(),
          data_autorizacao: resultado.data_autorizacao,
          retorno_json: resultado.retorno_raw,
          mensagem_erro: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documento_id);

      // Salva XML se disponível
      if (resultado.xml_autorizado) {
        const xmlContent = typeof resultado.xml_autorizado === 'string'
          ? new TextEncoder().encode(resultado.xml_autorizado)
          : resultado.xml_autorizado;

        const xmlPath = `documentos/${documento_id}/nfe_autorizada.xml`;
        await supabaseAdmin.storage
          .from('fiscal-xmls')
          .upload(xmlPath, xmlContent, { contentType: 'application/xml', upsert: true });

        await supabaseAdmin.from('fiscal_xmls').insert({
          fiscal_documento_id: documento_id,
          tipo_arquivo: 'xml_autorizado',
          storage_path: xmlPath,
          tamanho_bytes: typeof resultado.xml_autorizado === 'string'
            ? resultado.xml_autorizado.length
            : 0,
        });
      }

      // Registra evento de emissão
      await supabaseAdmin.from('fiscal_eventos').insert({
        fiscal_documento_id: documento_id,
        tipo_evento: 'emissao',
        status: 'sucesso',
        protocolo: resultado.protocolo,
        mensagem: 'NF-e autorizada com sucesso',
        payload_retorno: resultado.retorno_raw,
      });

      // Auditoria
      await supabaseAdmin.rpc('fiscal_registrar_auditoria', {
        p_user_id: null,
        p_entidade: 'fiscal_documentos',
        p_entidade_id: documento_id,
        p_acao: 'emitir_nfe',
        p_resultado: 'sucesso',
        p_antes: null,
        p_depois: { status: 'autorizado', protocolo: resultado.protocolo },
        p_metadados: { ambiente, numero: resultado.numero },
      });

    } else {
      // Rejeição ou erro
      await supabaseAdmin
        .from('fiscal_documentos')
        .update({
          status: resultado.status === 'rejeitado' ? 'rejeitado' : 'erro_transmissao',
          mensagem_erro: resultado.mensagem_erro,
          retorno_json: resultado.retorno_raw,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documento_id);

      await supabaseAdmin.from('fiscal_erros_transmissao').insert({
        fiscal_documento_id: documento_id,
        provider: nfeProvider,
        etapa: 'emissao',
        codigo_erro: resultado.codigo_erro,
        mensagem_erro: resultado.mensagem_erro ?? 'Erro na emissão',
        payload_resumido: { numero, serie, ambiente },
      });

      await supabaseAdmin.from('fiscal_eventos').insert({
        fiscal_documento_id: documento_id,
        tipo_evento: 'emissao',
        status: 'falha',
        mensagem: resultado.mensagem_erro,
        payload_retorno: resultado.retorno_raw,
      });
    }

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[fiscal-emitir-nfe] Erro:', err);
    return new Response(
      JSON.stringify({ sucesso: false, status: 'erro_transmissao', mensagem_erro: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

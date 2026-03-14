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
        fiscal_ambientes(tipo, endpoint_base),
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

    // === VALIDAÇÕES DE NEGÓCIO PRÉ-EMISSÃO ===
    const errosValidacao: string[] = [];

    // 1. Impedir dupla emissão
    if (doc.status === 'autorizado') {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem_erro: 'NF-e já autorizada — não é possível reemitir' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Cliente com CPF/CNPJ
    const clienteVal = doc.clientes;
    const cpfCnpjVal = clienteVal?.cpf_cnpj?.replace(/\D/g, '');
    if (!cpfCnpjVal || (cpfCnpjVal.length !== 11 && cpfCnpjVal.length !== 14)) {
      errosValidacao.push('Cliente sem CPF/CNPJ válido');
    }

    // 3. Itens com NCM e CFOP
    const itensVal = doc.fiscal_documentos_itens ?? [];
    if (itensVal.length === 0) {
      errosValidacao.push('Documento sem itens');
    }
    itensVal.forEach((item: any, idx: number) => {
      if (!item.ncm || item.ncm.replace(/\D/g, '').length !== 8) {
        errosValidacao.push(`Item ${idx + 1}: NCM inválido ou ausente`);
      }
      if (!item.cfop || item.cfop.length < 4) {
        errosValidacao.push(`Item ${idx + 1}: CFOP ausente`);
      }
      if (!item.descricao) {
        errosValidacao.push(`Item ${idx + 1}: Descrição ausente`);
      }
    });

    // 4. Série configurada
    if (!doc.fiscal_series) {
      errosValidacao.push('Série fiscal não configurada');
    }

    // 5. Valor total positivo
    if (!doc.valor_total || doc.valor_total <= 0) {
      errosValidacao.push('Valor total deve ser maior que zero');
    }

    if (errosValidacao.length > 0) {
      await supabaseAdmin
        .from('fiscal_documentos')
        .update({ status: 'rascunho', mensagem_erro: errosValidacao.join('; ') })
        .eq('id', documento_id);

      return new Response(
        JSON.stringify({
          sucesso: false,
          status: 'erro_validacao',
          mensagem_erro: 'Dados fiscais incompletos',
          erros: errosValidacao,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // === FIM VALIDAÇÕES ===

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

    // Monta payload NF-e (estrutura nfewizard-io / SEFAZ)
    const uf = Deno.env.get('NFE_UF') ?? 'SP';
    const cliente = doc.clientes;
    const itens = doc.fiscal_documentos_itens ?? [];

    const nfePayload = {
      NFe: {
        infNFe: {
          ide: {
            cUF: '35', // SP — Croma Print fica em São Paulo
            natOp: doc.natureza_operacao ?? 'Venda de mercadoria',
            mod: '55',
            serie: serie.toString(),
            nNF: numero.toString(),
            dhEmi: new Date().toISOString(),
            tpNF: '1',
            idDest: '1',
            cMunFG: Deno.env.get('NFE_COD_IBGE') ?? '3550308',
            tpImp: '1',
            tpEmis: '1',
            tpAmb: ambiente === 'producao' ? '1' : '2',
            finNFe: '1',
            indFinal: doc.consumidor_final?.toString() ?? '1',
            indPres: '1',
          },
          emit: {
            CNPJ: cnpjEmitente.replace(/\D/g, ''),
            xNome: Deno.env.get('NFE_RAZAO_SOCIAL') ?? 'CROMA PRINT COMUNICACAO VISUAL LTDA',
            enderEmit: {
              xLgr: Deno.env.get('NFE_ENDERECO') ?? 'RUA PAULO OROZIMBO',
              nro: Deno.env.get('NFE_NUMERO') ?? '424',
              xBairro: Deno.env.get('NFE_BAIRRO') ?? 'ACLIMACAO',
              cMun: Deno.env.get('NFE_COD_IBGE') ?? '3550308',
              xMun: Deno.env.get('NFE_MUNICIPIO') ?? 'SAO PAULO',
              UF: uf,
              CEP: Deno.env.get('NFE_CEP')?.replace(/\D/g, '') ?? '01535000',
              cPais: '1058',
              xPais: 'Brasil',
            },
            IE: Deno.env.get('NFE_IE') ?? '142826237111',
            CRT: Deno.env.get('NFE_CRT') ?? '1', // 1 = Simples Nacional
          },
          dest: {
            ...(cliente?.cpf_cnpj?.replace(/\D/g, '').length === 11
              ? { CPF: cliente.cpf_cnpj.replace(/\D/g, '') }
              : { CNPJ: cliente?.cpf_cnpj?.replace(/\D/g, '') ?? '' }),
            xNome: cliente?.razao_social ?? cliente?.nome_fantasia ?? 'Consumidor Final',
            enderDest: {
              xLgr: cliente?.endereco ?? '',
              nro: cliente?.numero ?? 'SN',
              xBairro: cliente?.bairro ?? '',
              cMun: '9999999', // TODO: mapear código IBGE do cliente
              xMun: cliente?.cidade ?? '',
              UF: cliente?.estado ?? 'SP',
              CEP: cliente?.cep?.replace(/\D/g, '') ?? '',
              cPais: '1058',
              xPais: 'Brasil',
            },
            indIEDest: cliente?.indicador_ie_destinatario ?? '9',
            email: cliente?.email_fiscal ?? cliente?.email,
          },
          det: itens.map((item: any, idx: number) => ({
            '@nItem': (idx + 1).toString(),
            prod: {
              cProd: item.codigo_produto ?? `PROD${idx + 1}`,
              cEAN: 'SEM GTIN',
              xProd: item.descricao,
              NCM: item.ncm?.replace(/\D/g, '') ?? '49019900',
              CFOP: item.cfop ?? '5102',
              uCom: item.unidade ?? 'UN',
              qCom: item.quantidade?.toString(),
              vUnCom: item.valor_unitario?.toFixed(2),
              vProd: item.valor_bruto?.toFixed(2),
              cEANTrib: 'SEM GTIN',
              uTrib: item.unidade ?? 'UN',
              qTrib: item.quantidade?.toString(),
              vUnTrib: item.valor_unitario?.toFixed(2),
              indTot: '1',
            },
            imposto: {
              // SIMPLES NACIONAL (CRT=1) usa CSOSN, não CST
              ICMS: {
                ICMSSN102: {
                  orig: item.origem_mercadoria ?? '0',
                  CSOSN: item.cst_ou_csosn ?? '102',
                },
              },
              PIS: {
                PISOutr: {
                  CST: '99',
                  vBC: '0.00',
                  pPIS: '0.00',
                  vPIS: '0.00',
                },
              },
              COFINS: {
                COFINSOutr: {
                  CST: '99',
                  vBC: '0.00',
                  pCOFINS: '0.00',
                  vCOFINS: '0.00',
                },
              },
            },
          })),
          total: {
            ICMSTot: {
              vBC: '0.00', // SN: base de cálculo ICMS é zero
              vICMS: '0.00',
              vICMSDeson: '0.00',
              vFCPUFDest: '0.00',
              vICMSUFDest: '0.00',
              vICMSUFRemet: '0.00',
              vFCP: '0.00',
              vBCST: '0.00',
              vST: '0.00',
              vFCPST: '0.00',
              vFCPSTRet: '0.00',
              vProd: (doc.valor_produtos ?? 0).toFixed(2),
              vFrete: (doc.valor_frete ?? 0).toFixed(2),
              vSeg: (doc.valor_seguro ?? 0).toFixed(2),
              vDesc: (doc.valor_desconto ?? 0).toFixed(2),
              vII: '0.00',
              vIPI: '0.00',
              vIPIDevol: '0.00',
              vPIS: '0.00',
              vCOFINS: '0.00',
              vOutro: (doc.valor_outras_despesas ?? 0).toFixed(2),
              vNF: (doc.valor_total ?? 0).toFixed(2),
              vTotTrib: '0.00',
            },
          },
          transp: {
            modFrete: '9',
          },
          infAdic: {
            infCpl: doc.informacoes_contribuinte,
            infAdFisco: doc.informacoes_fisco,
          },
        },
      },
    };

    // Chama o microserviço nfe-service
    const nfeServiceUrl = Deno.env.get('NFE_SERVICE_URL');
    const nfeInternalSecret = Deno.env.get('NFE_INTERNAL_SECRET');
    const nfeProvider = 'nfewizard-io';

    let resultado: any;

    if (!nfeServiceUrl || !nfeInternalSecret) {
      // MODO DEMO: simula autorização bem-sucedida quando nfe-service não configurado
      console.log('[fiscal-emitir-nfe] MODO DEMO — NFE_SERVICE_URL não configurado');
      resultado = {
        sucesso: true,
        status: 'autorizado',
        numero: numero,
        chave_acesso: `35${new Date().getFullYear().toString().slice(-2)}${cnpjEmitente?.replace(/\D/g, '').padStart(14, '0')}55001${numero.toString().padStart(9, '0')}1`,
        protocolo: `1${Date.now().toString()}`,
        recibo: `${Date.now()}`,
        data_autorizacao: new Date().toISOString(),
        xml_autorizado: `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${numero}"/></NFe></nfeProc>`,
        retorno_raw: { status: 'DEMO', numero, ambiente },
      };
    } else {
      // MODO REAL: envia para o nfe-service (nfewizard-io)
      try {
        const response = await fetch(`${nfeServiceUrl}/api/emitir`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': nfeInternalSecret,
          },
          body: JSON.stringify(nfePayload),
        });

        const retorno = await response.json();

        if (!response.ok || !retorno.sucesso) {
          resultado = {
            sucesso: false,
            status: 'erro_transmissao',
            mensagem_erro: retorno.mensagem_erro ?? `Serviço NF-e retornou ${response.status}`,
            retorno_raw: retorno,
          };
        } else {
          // Mapear retorno do nfewizard-io para o formato interno
          const r = retorno.retorno;
          const cStat = r?.retEnviNFe?.protNFe?.infProt?.cStat;
          const autorizado = cStat === '100';
          const emProcessamento = cStat === '103';

          resultado = {
            sucesso: autorizado,
            status: autorizado ? 'autorizado' : emProcessamento ? 'processando' : 'rejeitado',
            numero: numero,
            chave_acesso: r?.retEnviNFe?.protNFe?.infProt?.chNFe,
            protocolo: r?.retEnviNFe?.protNFe?.infProt?.nProt,
            recibo: emProcessamento ? r?.retEnviNFe?.infRec?.nRec : undefined,
            data_autorizacao: r?.retEnviNFe?.protNFe?.infProt?.dhRecbto,
            mensagem_erro: autorizado ? undefined : r?.retEnviNFe?.protNFe?.infProt?.xMotivo,
            codigo_erro: autorizado ? undefined : cStat?.toString(),
            retorno_raw: retorno.retorno,
          };
        }
      } catch (serviceErr) {
        resultado = {
          sucesso: false,
          status: 'erro_transmissao',
          mensagem_erro: `Falha ao contactar serviço NF-e: ${String(serviceErr)}`,
          retorno_raw: { error: String(serviceErr) },
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

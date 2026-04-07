/**
 * CROMA PRINT ERP - Edge Function: Emitir NF-e
 *
 * AUTENTICAÇÃO: verify_jwt=false + verificação manual via JWKS público do Supabase.
 * O Supabase Auth emite tokens ES256 com JWKS — verify_jwt=true usa HS256 e é incompatível.
 * A verificação correta é via /auth/v1/user (chamada à API de auth), que valida o token
 * independentemente do algoritmo, usando a sessão ativa no servidor de auth.
 *
 * MODO DEMO: quando NFE_SERVICE_URL não está configurado, simula
 * autorização bem-sucedida sem transmitir para a SEFAZ.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const ALLOWED_ORIGINS = [
  'https://crm-croma.vercel.app',
  'https://campo-croma.vercel.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  };
}

async function verificarAutenticacao(authHeader: string, supabaseUrl: string, anonKey: string): Promise<boolean> {
  // Valida o token chamando o endpoint de auth do Supabase.
  // Este endpoint aceita tokens ES256 e HS256, pois verifica via servidor de auth,
  // não via verificação local de assinatura JWT.
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': authHeader,
        'apikey': anonKey,
      },
    });
    if (!resp.ok) return false;
    const user = await resp.json();
    return !!user?.id;
  } catch {
    return false;
  }
}

interface EmitirRequest {
  documento_id: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ sucesso: false, mensagem_erro: 'Não autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const autenticado = await verificarAutenticacao(authHeader, supabaseUrl, anonKey);
  if (!autenticado) {
    return new Response(
      JSON.stringify({ sucesso: false, mensagem_erro: 'Token inválido ou sessão expirada' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseAdmin = createClient(
      supabaseUrl,
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

    const { data: doc, error: docError } = await supabaseAdmin
      .from('fiscal_documentos')
      .select(`
        *,
        fiscal_documentos_itens(*),
        clientes(*),
        pedidos!fiscal_documentos_pedido_id_fkey(numero, valor_total),
        fiscal_ambientes(tipo, endpoint_base, empresa_id, empresas(*)),
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

    if (!['apto', 'rascunho', 'rejeitado', 'erro_transmissao'].includes(doc.status)) {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem_erro: `Documento com status '${doc.status}' não pode ser emitido` }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (doc.status === 'autorizado') {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem_erro: 'NF-e já autorizada — não é possível reemitir' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === VALIDAÇÕES DE NEGÓCIO PRÉ-EMISSÃO ===
    const errosValidacao: string[] = [];

    const clienteVal = doc.clientes;
    const cpfCnpjVal = clienteVal?.cpf_cnpj?.replace(/\D/g, '');
    if (!cpfCnpjVal || (cpfCnpjVal.length !== 11 && cpfCnpjVal.length !== 14)) {
      errosValidacao.push('Cliente sem CPF/CNPJ válido');
    }

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
      if (!item.valor_unitario || item.valor_unitario <= 0) {
        errosValidacao.push(`Item "${item.descricao}" sem valor unitário válido`);
      }
      if (!item.quantidade || item.quantidade <= 0) {
        errosValidacao.push(`Item "${item.descricao}" sem quantidade válida`);
      }
    });

    if (!doc.fiscal_series) {
      errosValidacao.push('Série fiscal não configurada');
    }

    if (!doc.valor_total || doc.valor_total <= 0) {
      errosValidacao.push('Valor total deve ser maior que zero');
    }

    const codigoIbgeDest = doc.codigo_ibge_municipio_dest;
    if (!codigoIbgeDest || codigoIbgeDest === '9999999') {
      errosValidacao.push('Código IBGE do município do destinatário não configurado. Atualize o cadastro do cliente.');
    }

    if (errosValidacao.length > 0) {
      await supabaseAdmin
        .from('fiscal_documentos')
        .update({ status: 'rascunho', mensagem_erro: errosValidacao.join('; ') })
        .eq('id', documento_id);

      return new Response(
        JSON.stringify({ sucesso: false, status: 'erro_validacao', mensagem_erro: 'Dados fiscais incompletos', erros: errosValidacao }),
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

    const empresa = (doc.fiscal_ambientes as any)?.empresas;
    if (!empresa) {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem_erro: 'Empresa emitente não configurada no ambiente fiscal.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cnpjEmitente = empresa.cnpj?.replace(/\D/g, '') ?? '';
    const emitente = {
      CNPJ: cnpjEmitente,
      xNome: empresa.razao_social ?? '',
      IE: empresa.ie?.replace(/\D/g, '') ?? '',
      CRT: String(empresa.crt ?? 1),
      xLgr: empresa.logradouro ?? '',
      nro: empresa.numero_endereco ?? 'S/N',
      xBairro: empresa.bairro ?? '',
      cMun: empresa.codigo_municipio_ibge ?? '3550308',
      xMun: empresa.municipio ?? '',
      UF: empresa.uf ?? 'SP',
      CEP: empresa.cep?.replace(/\D/g, '') ?? '',
    };

    const cliente = doc.clientes;
    const itens = doc.fiscal_documentos_itens ?? [];

    const nfePayload = {
      NFe: {
        infNFe: {
          ide: {
            cUF: '35',
            natOp: doc.natureza_operacao ?? 'Venda de mercadoria',
            mod: '55',
            serie: serie.toString(),
            nNF: numero.toString(),
            dhEmi: new Date().toISOString(),
            tpNF: '1',
            idDest: '1',
            cMunFG: emitente.cMun,
            tpImp: '1',
            tpEmis: '1',
            tpAmb: ambiente === 'producao' ? '1' : '2',
            finNFe: '1',
            indFinal: doc.consumidor_final?.toString() ?? '1',
            indPres: '1',
          },
          emit: {
            CNPJ: emitente.CNPJ,
            xNome: emitente.xNome,
            enderEmit: {
              xLgr: emitente.xLgr,
              nro: emitente.nro,
              xBairro: emitente.xBairro,
              cMun: emitente.cMun,
              xMun: emitente.xMun,
              UF: emitente.UF,
              CEP: emitente.CEP,
              cPais: '1058',
              xPais: 'Brasil',
            },
            IE: emitente.IE,
            CRT: emitente.CRT,
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
              cMun: doc.codigo_ibge_municipio_dest ?? '9999999',
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
              ICMS: {
                ICMSSN102: {
                  orig: item.origem_mercadoria ?? '0',
                  CSOSN: item.cst_ou_csosn ?? '102',
                },
              },
              PIS: { PISOutr: { CST: '99', vBC: '0.00', pPIS: '0.00', vPIS: '0.00' } },
              COFINS: { COFINSOutr: { CST: '99', vBC: '0.00', pCOFINS: '0.00', vCOFINS: '0.00' } },
            },
          })),
          total: {
            ICMSTot: {
              vBC: '0.00', vICMS: '0.00', vICMSDeson: '0.00',
              vFCPUFDest: '0.00', vICMSUFDest: '0.00', vICMSUFRemet: '0.00',
              vFCP: '0.00', vBCST: '0.00', vST: '0.00',
              vFCPST: '0.00', vFCPSTRet: '0.00',
              vProd: (doc.valor_produtos ?? 0).toFixed(2),
              vFrete: (doc.valor_frete ?? 0).toFixed(2),
              vSeg: (doc.valor_seguro ?? 0).toFixed(2),
              vDesc: (doc.valor_desconto ?? 0).toFixed(2),
              vII: '0.00', vIPI: '0.00', vIPIDevol: '0.00',
              vPIS: '0.00', vCOFINS: '0.00',
              vOutro: (doc.valor_outras_despesas ?? 0).toFixed(2),
              vNF: (doc.valor_total ?? 0).toFixed(2),
              vTotTrib: '0.00',
            },
          },
          transp: { modFrete: '9' },
          infAdic: {
            infCpl: doc.informacoes_contribuinte,
            infAdFisco: doc.informacoes_fisco,
          },
        },
      },
    };

    const nfeServiceUrl = Deno.env.get('NFE_SERVICE_URL');
    const nfeInternalSecret = Deno.env.get('NFE_INTERNAL_SECRET');
    const nfeProvider = 'nfewizard-io';
    let resultado: any;

    if (!nfeServiceUrl || !nfeInternalSecret) {
      // MODO DEMO: simula autorização sem transmitir para SEFAZ
      console.log('[fiscal-emitir-nfe] MODO DEMO — NFE_SERVICE_URL não configurado');
      resultado = {
        sucesso: true,
        status: 'autorizado',
        numero,
        chave_acesso: `35${new Date().getFullYear().toString().slice(-2)}${cnpjEmitente.padStart(14, '0')}55001${numero.toString().padStart(9, '0')}1`,
        protocolo: `1${Date.now()}`,
        recibo: `${Date.now()}`,
        data_autorizacao: new Date().toISOString(),
        xml_autorizado: `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${numero}"/></NFe></nfeProc>`,
        retorno_raw: { status: 'DEMO', numero, ambiente },
      };
    } else {
      try {
        const response = await fetch(`${nfeServiceUrl}/api/emitir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': nfeInternalSecret },
          body: JSON.stringify(nfePayload),
        });
        const retorno = await response.json();
        if (!response.ok || !retorno.sucesso) {
          resultado = {
            sucesso: false, status: 'erro_transmissao',
            mensagem_erro: retorno.mensagem_erro ?? `Serviço NF-e retornou ${response.status}`,
            retorno_raw: retorno,
          };
        } else {
          const r = retorno.retorno;
          const cStat = r?.retEnviNFe?.protNFe?.infProt?.cStat;
          const autorizado = cStat === '100';
          const emProcessamento = cStat === '103';
          resultado = {
            sucesso: autorizado,
            status: autorizado ? 'autorizado' : emProcessamento ? 'processando' : 'rejeitado',
            numero,
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
          sucesso: false, status: 'erro_transmissao',
          mensagem_erro: `Falha ao contactar serviço NF-e: ${String(serviceErr)}`,
          retorno_raw: { error: String(serviceErr) },
        };
      }
    }

    if (resultado.sucesso) {
      await supabaseAdmin.from('fiscal_documentos').update({
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
      }).eq('id', documento_id);

      if (resultado.xml_autorizado) {
        try {
          const xmlBytes = new TextEncoder().encode(resultado.xml_autorizado);
          const xmlPath = `documentos/${documento_id}/nfe_autorizada.xml`;
          await supabaseAdmin.storage.from('fiscal-xmls')
            .upload(xmlPath, xmlBytes, { contentType: 'application/xml', upsert: true });
          await supabaseAdmin.from('fiscal_xmls').insert({
            fiscal_documento_id: documento_id,
            tipo_arquivo: 'xml_autorizado',
            storage_path: xmlPath,
            tamanho_bytes: resultado.xml_autorizado.length,
          });
        } catch (storageErr) {
          console.error('[fiscal-emitir-nfe] Erro ao salvar XML no storage:', storageErr);
        }
      }

      await supabaseAdmin.from('fiscal_eventos').insert({
        fiscal_documento_id: documento_id,
        tipo_evento: 'emissao', status: 'sucesso',
        protocolo: resultado.protocolo,
        mensagem: 'NF-e autorizada com sucesso',
        payload_retorno: resultado.retorno_raw,
      });

      await supabaseAdmin.rpc('fiscal_registrar_auditoria', {
        p_user_id: null, p_entidade: 'fiscal_documentos',
        p_entidade_id: documento_id, p_acao: 'emitir_nfe',
        p_resultado: 'sucesso', p_antes: null,
        p_depois: { status: 'autorizado', protocolo: resultado.protocolo },
        p_metadados: { ambiente, numero: resultado.numero },
      });
    } else {
      await supabaseAdmin.from('fiscal_documentos').update({
        status: resultado.status === 'rejeitado' ? 'rejeitado' : 'erro_transmissao',
        mensagem_erro: resultado.mensagem_erro,
        retorno_json: resultado.retorno_raw,
        updated_at: new Date().toISOString(),
      }).eq('id', documento_id);

      await supabaseAdmin.from('fiscal_erros_transmissao').insert({
        fiscal_documento_id: documento_id,
        provider: nfeProvider, etapa: 'emissao',
        codigo_erro: resultado.codigo_erro,
        mensagem_erro: resultado.mensagem_erro ?? 'Erro na emissão',
        payload_resumido: { numero, serie, ambiente },
      });

      await supabaseAdmin.from('fiscal_eventos').insert({
        fiscal_documento_id: documento_id,
        tipo_evento: 'emissao', status: 'falha',
        mensagem: resultado.mensagem_erro,
        payload_retorno: resultado.retorno_raw,
      });
    }

    return new Response(JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[fiscal-emitir-nfe] Erro:', err);
    return new Response(
      JSON.stringify({ sucesso: false, status: 'erro_transmissao', mensagem_erro: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

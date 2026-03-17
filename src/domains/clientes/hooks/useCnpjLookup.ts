import { useState, useCallback } from 'react';
import { showError, showSuccess } from '@/utils/toast';

export interface CnpjResult {
  razao_social: string;
  nome_fantasia: string;
  email: string;
  telefone: string;
  endereco_rua: string;
  endereco_numero: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  endereco_cep: string;
}

// Parser para ReceitaWS
function parseReceitaWS(data: Record<string, string>): CnpjResult {
  return {
    razao_social: data.nome ?? '',
    nome_fantasia: data.fantasia ?? '',
    email: data.email ?? '',
    telefone: data.telefone ?? '',
    endereco_rua: [data.logradouro, data.numero].filter(Boolean).join(', '),
    endereco_numero: data.numero ?? '',
    endereco_bairro: data.bairro ?? '',
    endereco_cidade: data.municipio ?? '',
    endereco_estado: data.uf ?? '',
    endereco_cep: (data.cep ?? '').replace(/\D/g, ''),
  };
}

// Parser para CNPJ.ws (fallback)
function parseCnpjWs(data: Record<string, unknown>): CnpjResult {
  const e = (data.estabelecimento ?? {}) as Record<string, unknown>;
  const cidade = (e.cidade ?? {}) as Record<string, string>;
  const estado = (e.estado ?? {}) as Record<string, string>;
  return {
    razao_social: (data.razao_social as string) ?? '',
    nome_fantasia: (e.nome_fantasia as string) ?? '',
    email: (e.email as string) ?? '',
    telefone: (e.telefone1 as string) ?? '',
    endereco_rua: [(e.logradouro as string), (e.numero as string)].filter(Boolean).join(', '),
    endereco_numero: (e.numero as string) ?? '',
    endereco_bairro: (e.bairro as string) ?? '',
    endereco_cidade: cidade.nome ?? '',
    endereco_estado: estado.sigla ?? '',
    endereco_cep: ((e.cep as string) ?? '').replace(/\D/g, ''),
  };
}

export function useCnpjLookup() {
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (cnpj: string): Promise<CnpjResult | null> => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      showError('CNPJ inválido — deve ter 14 dígitos');
      return null;
    }

    setLoading(true);
    try {
      // Tenta ReceitaWS primeiro
      let data: Record<string, unknown> | null = null;
      let source: 'receitaws' | 'cnpjws' = 'receitaws';

      try {
        const res = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`);
        if (res.ok) {
          data = await res.json();
        }
      } catch {
        // CORS ou falha — tenta fallback
      }

      // Fallback para CNPJ.ws se necessário
      if (!data || (data as Record<string, string>).status === 'ERROR') {
        const res2 = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`);
        if (!res2.ok) throw new Error('CNPJ não encontrado em nenhuma fonte');
        data = await res2.json();
        source = 'cnpjws';
      }

      // Verifica situação cadastral (ReceitaWS: data.situacao, CNPJ.ws: estabelecimento.situacao_cadastral)
      const estab = (data.estabelecimento ?? {}) as Record<string, string>;
      const situacao = (
        (data as Record<string, string>).situacao
        ?? (data as Record<string, string>).descricao_situacao_cadastral
        ?? estab.situacao_cadastral
        ?? ''
      ).toUpperCase();
      if (situacao && situacao !== 'ATIVA') {
        showError(`Empresa com situação: ${situacao}`);
        return null;
      }

      const result = source === 'receitaws'
        ? parseReceitaWS(data as Record<string, string>)
        : parseCnpjWs(data);

      showSuccess('Dados preenchidos com sucesso');
      return result;
    } catch {
      showError('CNPJ não encontrado ou erro na consulta');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookup, loading };
}

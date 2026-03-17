import { useState, useCallback } from 'react';
import { showError } from '@/utils/toast';

export interface CepResult {
  endereco_rua: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
}

export function useCepLookup() {
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (cep: string): Promise<CepResult | null> => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return null;

    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) throw new Error('Erro na requisição');
      const data = await res.json();
      if (data.erro) {
        showError('CEP não encontrado');
        return null;
      }
      return {
        endereco_rua: data.logradouro ?? '',
        endereco_bairro: data.bairro ?? '',
        endereco_cidade: data.localidade ?? '',
        endereco_estado: data.uf ?? '',
      };
    } catch {
      showError('Erro ao buscar CEP. Verifique sua conexão.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookup, loading };
}

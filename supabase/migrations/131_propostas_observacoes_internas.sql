-- Migration 131: Adiciona campo observacoes_internas na tabela propostas
-- observacoes         = texto visível ao cliente no PDF da proposta
-- observacoes_internas = notas para equipe/produção (NUNCA vai ao PDF cliente)

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS observacoes_internas text;

COMMENT ON COLUMN public.propostas.observacoes IS 'Observações visíveis ao cliente no PDF da proposta';
COMMENT ON COLUMN public.propostas.observacoes_internas IS 'Notas internas para equipe (não aparecem no PDF cliente)';

-- Migrar dados existentes: mover linhas "Criar ordem_..." e "Faturamento:" para observacoes_internas
-- Mantém observacoes limpa apenas com conteúdo voltado ao cliente

UPDATE public.propostas
SET
  observacoes_internas = (
    SELECT string_agg(linha, E'\n')
    FROM (
      SELECT unnest(string_to_array(observacoes, E'\n')) AS linha
    ) t
    WHERE linha ~* '(Criar ordem_|Faturamento:|Instala[cç][aã]o: endere[cç]o)'
  ),
  observacoes = trim(E'\n' FROM (
    SELECT string_agg(linha, E'\n')
    FROM (
      SELECT unnest(string_to_array(observacoes, E'\n')) AS linha
    ) t
    WHERE linha !~* '(Criar ordem_|Faturamento:|Instala[cç][aã]o: endere[cç]o)'
  ))
WHERE observacoes ~* '(Criar ordem_|Faturamento:|Instala[cç][aã]o: endere[cç]o)';

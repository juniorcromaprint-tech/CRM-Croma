-- Ciclo autonomo #10 (2026-05-28) — fix das 6 agent_rules com schema quebrado + desativacao 5 templates WA sem meta_template_name + 2 acao.template inexistente
-- Descoberta ciclo #9 (P0 BOMBA): 6 rules ativas com colunas inexistentes rodando ~1280x cada como silent no-op.
-- Verificacao cruzada information_schema confirmou colunas reais:
--   proposta_itens.desconto_percentual NAO existe -> propostas.desconto_percentual EXISTE
--   clientes.lead_origem_id NAO existe -> clientes.lead_id EXISTE
--   materiais.estoque_atual NAO existe (so estoque_minimo, estoque_ideal, estoque_controlado) -> exige calculo via movimentacoes_materiais (decisao produto Junior)
--   ordens_producao.prazo_entrega NAO existe -> ordens_producao.prazo_interno (date, compromisso) EXISTE
-- Idempotente: WHERE checa estado pre-correcao. Re-aplicacao no-op.

BEGIN;

-- 4 CORRECOES (campo canonico identificado)
UPDATE agent_rules
SET condicao = jsonb_set(condicao, '{campo}', '"propostas.desconto_percentual"')
WHERE nome = 'desconto_maximo_sem_aprovacao'
  AND condicao->>'campo' = 'proposta_itens.desconto_percentual';

UPDATE agent_rules
SET condicao = jsonb_set(condicao, '{filtro}', to_jsonb(replace(condicao->>'filtro', 'lead_origem_id', 'lead_id')))
WHERE nome = 'lead_quente_sem_orcamento'
  AND (condicao->>'filtro') ILIKE '%lead_origem_id%';

UPDATE agent_rules
SET condicao = jsonb_set(condicao, '{campo}', '"ordens_producao.prazo_interno"')
WHERE nome = 'op_atrasada'
  AND condicao->>'campo' = 'ordens_producao.prazo_entrega';

UPDATE agent_rules
SET condicao = jsonb_set(condicao, '{campo}', '"ordens_producao.prazo_interno"')
WHERE nome = 'priorizar_op_urgente'
  AND condicao->>'campo' = 'ordens_producao.prazo_entrega';

-- 2 DESATIVACOES SEGURAS (campo canonico exige decisao produto)
UPDATE agent_rules
SET ativo = false,
    last_error = '[ciclo #10 autonomo 2026-05-28] desativado: materiais.estoque_atual NAO existe (colunas reais: estoque_minimo, estoque_ideal, estoque_controlado). Saldo atual exige agregado via movimentacoes_materiais — decisao produto Junior. Reativar apos refactor calculo saldo.'
WHERE nome IN ('estoque_minimo', 'sugerir_compra_automatica')
  AND ativo = true;

-- 1 ACAO.TEMPLATE CORRIGIDO (croma_followup confirmado aprovado Meta — ciclo #7)
UPDATE agent_rules
SET acao = jsonb_set(acao, '{template}', '"croma_followup"')
WHERE nome = 'follow_up_lead_24h'
  AND acao->>'template' = 'followup_lead';

-- 1 DESATIVACAO (acao.template inexistente)
UPDATE agent_rules
SET ativo = false,
    last_error = '[ciclo #10 autonomo 2026-05-28] desativado: acao.template=followup_proposta nao existe em agent_templates. Canal email — Junior decide criar template email ou converter pra whatsapp.'
WHERE nome = 'follow_up_proposta_48h'
  AND ativo = true
  AND acao->>'template' = 'followup_proposta';

-- 5 DESATIVACOES TEMPLATES WA SEM meta_template_name (seguranca: Meta rejeita fora janela 24h)
-- Bonus: detectadas 2 duplicatas extras nao previstas no ciclo #9 (1afc43be, 21e7035f)
UPDATE agent_templates
SET ativo = false,
    updated_at = NOW()
WHERE canal='whatsapp'
  AND ativo=true
  AND (meta_template_name IS NULL OR meta_template_name='')
  AND nome IN ('WhatsApp Follow-up 2','WhatsApp Follow-up 3','WhatsApp Negociacao');

COMMIT;

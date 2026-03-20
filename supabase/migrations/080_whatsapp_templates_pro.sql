-- ============================================================
-- Migration 080 — Templates WhatsApp profissionais + segmentados
-- Criado: 2026-03-19
-- ============================================================
-- Substitui os 2 templates WhatsApp genéricos da migration 078
-- por 6 templates segmentados + follow-ups de alta conversão.
--
-- IMPORTANTE: O template Meta (croma_abertura) deve ser criado
-- no Meta Business Suite com o texto correspondente.
-- ============================================================

-- Desativar templates WhatsApp antigos (não deletar para manter histórico)
UPDATE agent_templates
SET ativo = false
WHERE canal = 'whatsapp';

-- ============================================================
-- WHATSAPP — ABERTURA POR SEGMENTO (4 templates)
-- ============================================================
-- Regras de ouro WhatsApp:
-- 1. Máximo 3 parágrafos curtos
-- 2. Terminar com UMA pergunta que gera resposta
-- 3. Usar *negrito* para destacar
-- 4. Emojis com moderação (1-2 no máximo)
-- 5. Tom consultivo, nunca vendedor
-- ============================================================

INSERT INTO agent_templates
  (nome, segmento, canal, etapa, assunto, conteudo, variaveis, ativo)
VALUES

-- ── Abertura Varejo ─────────────────────────────────────────
(
  'WhatsApp Abertura Varejo',
  'varejo',
  'whatsapp',
  'abertura',
  NULL,
  E'Oi {{contato_nome}}, tudo bem? 👋\n\n'
  'Sou {{nome_remetente}} da *Croma Print*. A gente faz toda a comunicação visual de redes de lojas — banners, fachadas, PDV, vitrines.\n\n'
  'Vi que a *{{empresa}}* atua no varejo e fiquei curioso: vocês têm alguma campanha ou troca de materiais prevista pros próximos meses?',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}'],
  true
),

-- ── Abertura Franquia ───────────────────────────────────────
(
  'WhatsApp Abertura Franquia',
  'franquia',
  'whatsapp',
  'abertura',
  NULL,
  E'Oi {{contato_nome}}, tudo bem? 👋\n\n'
  'Sou {{nome_remetente}} da *Croma Print*. A gente cuida da comunicação visual de redes com muitas unidades — produção centralizada, padrão garantido, entrega nacional.\n\n'
  'A *{{empresa}}* já tem um fornecedor homologado pra isso ou cada unidade resolve por conta?',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}'],
  true
),

-- ── Abertura Indústria ──────────────────────────────────────
(
  'WhatsApp Abertura Indústria',
  'industria',
  'whatsapp',
  'abertura',
  NULL,
  E'Oi {{contato_nome}}, tudo bem? 👋\n\n'
  'Sou {{nome_remetente}} da *Croma Print*. Fazemos materiais de PDV e comunicação visual pra indústrias que vendem pro varejo — displays, banners, kits de inauguração.\n\n'
  'A *{{empresa}}* distribui materiais visuais pros lojistas parceiros ou isso fica por conta de cada loja?',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}'],
  true
),

-- ── Abertura Genérico ───────────────────────────────────────
(
  'WhatsApp Abertura Geral',
  NULL,
  'whatsapp',
  'abertura',
  NULL,
  E'Oi {{contato_nome}}, tudo bem? 👋\n\n'
  'Sou {{nome_remetente}} da *Croma Print* — comunicação visual profissional. Fazemos banners, fachadas, adesivos, totens, sinalização.\n\n'
  'A *{{empresa}}* tem alguma demanda de comunicação visual prevista? Ou algum material que precisa renovar?',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}'],
  true
),

-- ============================================================
-- WHATSAPP — FOLLOW-UPS (3 templates)
-- ============================================================

-- ── Follow-up 1 ────────────────────────────────────────────
(
  'WhatsApp Follow-up 1',
  NULL,
  'whatsapp',
  'followup1',
  NULL,
  E'Oi {{contato_nome}}! Só passando pra dar um oi 😊\n\n'
  'Uma ideia que funciona muito bem: começar com um *projeto piloto pra 1 loja* — assim vocês testam qualidade e prazo sem compromisso.\n\n'
  'Faz sentido pra *{{empresa}}* nesse momento?',
  ARRAY['{{empresa}}', '{{contato_nome}}'],
  true
),

-- ── Follow-up 2 ────────────────────────────────────────────
(
  'WhatsApp Follow-up 2',
  NULL,
  'whatsapp',
  'followup2',
  NULL,
  E'Oi {{contato_nome}}, sei que o dia a dia é corrido!\n\n'
  'Queria compartilhar: ajudamos uma rede de *40 lojas* a trocar toda a comunicação de vitrine em *menos de 2 semanas* — mesmo padrão em todas.\n\n'
  'Se surgir alguma demanda assim na *{{empresa}}*, posso te mandar uma proposta rápida. Só me chamar aqui!',
  ARRAY['{{empresa}}', '{{contato_nome}}'],
  true
),

-- ── Follow-up 3 (último) ───────────────────────────────────
(
  'WhatsApp Follow-up 3',
  NULL,
  'whatsapp',
  'followup3',
  NULL,
  E'{{contato_nome}}, prometo que é a última mensagem por agora! 🙂\n\n'
  'Quando surgir uma necessidade de comunicação visual — campanha, inauguração, renovação — pode me chamar aqui que retomo na hora.\n\n'
  'Boa sorte com os projetos da *{{empresa}}*! 🚀',
  ARRAY['{{empresa}}', '{{contato_nome}}'],
  true
),

-- ============================================================
-- WHATSAPP — REENGAJAMENTO (1 template)
-- ============================================================

(
  'WhatsApp Reengajamento',
  NULL,
  'whatsapp',
  'reengajamento',
  NULL,
  E'Oi {{contato_nome}}, tudo bem?\n\n'
  'Faz um tempo que conversamos e queria saber: a *{{empresa}}* tem alguma novidade na área de comunicação visual? Inauguração, campanha, reforma?\n\n'
  'Estamos com condições especiais esse mês. Quer que eu mande uma proposta rápida?',
  ARRAY['{{empresa}}', '{{contato_nome}}'],
  true
),

-- ============================================================
-- WHATSAPP — PROPOSTA (1 template)
-- ============================================================

(
  'WhatsApp Proposta',
  NULL,
  'whatsapp',
  'proposta',
  NULL,
  E'{{contato_nome}}, preparei uma *proposta personalizada* pra *{{empresa}}*! 📋\n\n'
  'Inclui tudo o que conversamos: materiais, quantidades, prazo e condições de pagamento.\n\n'
  'Posso te enviar por aqui mesmo ou prefere receber por email?',
  ARRAY['{{empresa}}', '{{contato_nome}}'],
  true
),

-- ============================================================
-- WHATSAPP — NEGOCIAÇÃO (1 template)
-- ============================================================

(
  'WhatsApp Negociação',
  NULL,
  'whatsapp',
  'negociacao',
  NULL,
  E'{{contato_nome}}, sobre a proposta da *{{empresa}}*:\n\n'
  'Consigo fazer uma condição especial se fecharmos essa semana. Quer que eu ajuste algum ponto? Quantidade, prazo, material?\n\n'
  'Me fala o que precisa e eu refaço na hora! 💪',
  ARRAY['{{empresa}}', '{{contato_nome}}'],
  true
);

-- ============================================================
-- COMENTÁRIO: Template Meta Business Suite (croma_abertura)
-- ============================================================
-- O template abaixo deve ser criado no Meta Business Suite
-- em: business.facebook.com → Conta WhatsApp → Modelos de mensagem
--
-- Nome: croma_abertura
-- Categoria: MARKETING
-- Idioma: pt_BR
-- Corpo:
--   Oi {{1}}, tudo bem? 👋
--
--   Sou da *Croma Print* — comunicação visual profissional.
--   Fazemos banners, fachadas, adesivos, totens e sinalização
--   para empresas de todo o Brasil.
--
--   Posso te contar como ajudamos empresas como a sua?
--
-- Variável {{1}} = Nome do contato
-- ============================================================

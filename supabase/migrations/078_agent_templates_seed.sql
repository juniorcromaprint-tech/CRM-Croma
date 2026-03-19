-- ============================================================
-- Migration 078 — Agente de Vendas: seed de templates
-- Criado: 2026-03-19
-- ============================================================
-- Variáveis disponíveis nos templates:
--   {{empresa}}, {{contato_nome}}, {{nome_remetente}},
--   {{telefone_empresa}}, {{assunto_anterior}}
-- ============================================================

INSERT INTO agent_templates
  (nome, segmento, canal, etapa, assunto, conteudo, variaveis, ativo)
VALUES

-- ============================================================
-- EMAIL — ABERTURA (4 templates)
-- ============================================================

(
  'Abertura Varejo',
  'varejo',
  'email',
  'abertura',
  'Comunicação visual que vende mais — para {{empresa}}',
  E'Olá, {{contato_nome}}!\n\n'
  'Meu nome é {{nome_remetente}} e sou da Croma Print, especializada em comunicação visual para o varejo.\n\n'
  'Trabalhamos com redes de lojas e varejistas que precisam de materiais com qualidade consistente em todos os pontos de venda — '
  'de banners e fachadas até sinalização interna e materiais de PDV.\n\n'
  'Uma dúvida rápida: com que frequência a {{empresa}} renova as peças de comunicação visual das lojas? '
  'É algo planejado por coleção/temporada ou acontece de forma pontual conforme a necessidade?\n\n'
  'Pergunto porque isso muda bastante a forma como podemos ajudar — e gostaria de entender melhor o contexto de vocês antes de sugerir qualquer coisa.\n\n'
  'Fico no aguardo!\n\n'
  'Abraços,\n'
  '{{nome_remetente}}\n'
  'Croma Print Comunicação Visual\n'
  '{{telefone_empresa}}',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}', '{{telefone_empresa}}'],
  true
),

(
  'Abertura Franquia',
  'franquia',
  'email',
  'abertura',
  'Padronização visual para todas as unidades da {{empresa}}',
  E'Olá, {{contato_nome}}!\n\n'
  'Sou {{nome_remetente}}, da Croma Print — trabalhamos há anos com redes de franquias que precisam garantir identidade visual uniforme em dezenas ou centenas de unidades espalhadas pelo Brasil.\n\n'
  'Sabemos que um dos maiores desafios de quem gerencia uma rede é justamente manter o padrão: '
  'cada franqueado com seu fornecedor local, qualidades diferentes, cores que não batem, prazos que apertam na inauguração...\n\n'
  'A Croma Print resolve isso com produção centralizada, entrega nacional e controle total do padrão visual — '
  'do gabarito ao material final instalado.\n\n'
  'Como a {{empresa}} gerencia hoje a produção dos materiais para as unidades franqueadas? '
  'Existe um fornecedor homologado ou cada unidade busca localmente?\n\n'
  'Gostaria de entender melhor para ver se faz sentido conversar.\n\n'
  'Abraços,\n'
  '{{nome_remetente}}\n'
  'Croma Print Comunicação Visual\n'
  '{{telefone_empresa}}',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}', '{{telefone_empresa}}'],
  true
),

(
  'Abertura Indústria',
  'industria',
  'email',
  'abertura',
  'Materiais de PDV para o canal de varejo da {{empresa}}',
  E'Olá, {{contato_nome}}!\n\n'
  'Sou {{nome_remetente}}, da Croma Print — desenvolvemos materiais de PDV e comunicação visual para fabricantes que vendem através do varejo.\n\n'
  'Atendemos fabricantes de calçados, confecções e outros segmentos que precisam que sua marca apareça bem nos pontos de venda dos seus clientes: '
  'displays, banners de vitrine, sinalização de gôndola, kits de inauguração para lojistas parceiros.\n\n'
  'O desafio costuma ser escalar com qualidade — quando a rede de varejo cresce, os materiais precisam acompanhar sem perder padrão.\n\n'
  'A {{empresa}} distribui materiais de comunicação visual para seus lojistas parceiros? '
  'Isso é feito de forma centralizada ou cada loja resolve por conta própria?\n\n'
  'Ficaria feliz em trocar uma ideia sobre como outras indústrias do setor têm resolvido isso.\n\n'
  'Abraços,\n'
  '{{nome_remetente}}\n'
  'Croma Print Comunicação Visual\n'
  '{{telefone_empresa}}',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}', '{{telefone_empresa}}'],
  true
),

(
  'Abertura Genérico',
  NULL,
  'email',
  'abertura',
  'Comunicação visual profissional para {{empresa}}',
  E'Olá, {{contato_nome}}!\n\n'
  'Sou {{nome_remetente}}, da Croma Print — somos especializados em comunicação visual profissional: '
  'banners, fachadas, adesivos, totens, sinalização e muito mais.\n\n'
  'Atendemos empresas de todos os portes que precisam que a identidade visual apareça com qualidade no mundo físico — '
  'seja num único ponto de venda ou em uma rede nacional.\n\n'
  'Produção própria, prazo cumprido e qualidade consistente são os pilares do nosso trabalho.\n\n'
  'Tenho curiosidade: qual é o maior desafio que a {{empresa}} enfrenta hoje na área de comunicação visual? '
  'Qualidade, prazo, custo ou escala?\n\n'
  'Pergunto porque dependendo da resposta, a forma de ajudar muda bastante.\n\n'
  'Fico à disposição!\n\n'
  'Abraços,\n'
  '{{nome_remetente}}\n'
  'Croma Print Comunicação Visual\n'
  '{{telefone_empresa}}',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}', '{{telefone_empresa}}'],
  true
),

-- ============================================================
-- EMAIL — FOLLOW-UP 1 (2 templates)
-- ============================================================

(
  'Follow-up 1 Geral',
  NULL,
  'email',
  'followup1',
  'Re: {{assunto_anterior}}',
  E'Olá, {{contato_nome}}!\n\n'
  'Percebi que você abriu meu e-mail anterior — fico feliz em saber que chegou bem.\n\n'
  'Imagino que o dia a dia de quem cuida de comunicação visual é bastante corrido, '
  'por isso não quero tomar muito do seu tempo.\n\n'
  'Deixa eu ser direto: com base no que conheço de empresas como a {{empresa}}, '
  'uma das coisas que mais ajuda é ter um fornecedor que entenda seu padrão e consiga entregar qualquer volume sem você precisar revisar cada detalhe.\n\n'
  'Posso te fazer uma sugestão rápida sobre como poderíamos começar de forma simples, sem compromisso? '
  'Me conta o que faz mais sentido para vocês neste momento.\n\n'
  'Abraços,\n'
  '{{nome_remetente}}\n'
  'Croma Print Comunicação Visual\n'
  '{{telefone_empresa}}',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}', '{{telefone_empresa}}', '{{assunto_anterior}}'],
  true
),

(
  'Follow-up 1 Varejo',
  'varejo',
  'email',
  'followup1',
  'Re: {{assunto_anterior}}',
  E'Olá, {{contato_nome}}!\n\n'
  'Queria compartilhar um caso que talvez faça sentido para a {{empresa}}.\n\n'
  'Recentemente ajudamos uma rede de calçados com 40 lojas a padronizar toda a comunicação visual de vitrine para o lançamento de coleção. '
  'O desafio era entregar materiais idênticos para todas as unidades em menos de 2 semanas — e conseguimos.\n\n'
  'O feedback que mais me marcou foi: "finalmente não precisei ligar para cada loja para corrigir cor errada ou material diferente".\n\n'
  'Não sei se é exatamente isso que vocês enfrentam, mas imagino que algo parecido acontece quando tem uma campanha grande chegando.\n\n'
  'Como funciona esse processo para vocês? Vocês costumam ter prazo curto nesses momentos?\n\n'
  'Abraços,\n'
  '{{nome_remetente}}\n'
  'Croma Print Comunicação Visual\n'
  '{{telefone_empresa}}',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}', '{{telefone_empresa}}', '{{assunto_anterior}}'],
  true
),

-- ============================================================
-- EMAIL — FOLLOW-UP 2 (1 template)
-- ============================================================

(
  'Follow-up 2 Geral',
  NULL,
  'email',
  'followup2',
  'Re: {{assunto_anterior}}',
  E'Olá, {{contato_nome}}!\n\n'
  'Vou ser breve — prometo que é o último contato por agora.\n\n'
  'Sei que o timing nem sempre é o certo, e tudo bem. '
  'Se não for o momento para {{empresa}} pensar em comunicação visual, faz sentido pausarmos por aqui.\n\n'
  'Mas se em algum momento surgir uma necessidade — campanha, inauguração, padronização de rede, materiais para lojistas — '
  'pode me chamar que retomo o contato em minutos.\n\n'
  'Você pode conhecer mais sobre nosso trabalho em www.cromaprint.com.br.\n\n'
  'Foi um prazer tentar contribuir. Boa sorte com os projetos de vocês!\n\n'
  'Abraços,\n'
  '{{nome_remetente}}\n'
  'Croma Print Comunicação Visual\n'
  '{{telefone_empresa}}',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}', '{{telefone_empresa}}', '{{assunto_anterior}}'],
  true
),

-- ============================================================
-- WHATSAPP — ABERTURA (2 templates)
-- ============================================================

(
  'WhatsApp Abertura Geral',
  NULL,
  'whatsapp',
  'abertura',
  NULL,
  E'Olá, {{contato_nome}}! Tudo bem?\n\n'
  'Sou {{nome_remetente}}, da *Croma Print* — comunicação visual profissional.\n\n'
  'Trabalhamos com empresas que precisam de banners, fachadas, adesivos e sinalização com qualidade e prazo garantidos.\n\n'
  'Uma pergunta rápida: a {{empresa}} tem alguma demanda de comunicação visual prevista para os próximos meses?',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}'],
  true
),

(
  'WhatsApp Follow-up 1',
  NULL,
  'whatsapp',
  'followup1',
  NULL,
  E'Oi, {{contato_nome}}!\n\n'
  'Só passando para dar um oi e ver se ficou alguma dúvida sobre a Croma Print.\n\n'
  'Uma ideia que funciona bem para quem ainda não nos conhece: '
  'começar com um *projeto piloto para 1 loja* — assim vocês testam qualidade e prazo sem compromisso maior.\n\n'
  'Faz sentido para a {{empresa}} nesse momento?',
  ARRAY['{{empresa}}', '{{contato_nome}}', '{{nome_remetente}}'],
  true
);

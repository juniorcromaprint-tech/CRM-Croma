# PROMPT DE INSTRUÇÃO — Sessão 2026-05-25 (Segunda)

> **Como usar**: Copie TUDO abaixo da linha "═══ COPIE A PARTIR DAQUI ═══" e cole como
> primeira mensagem na nova sessão Claude. O Claude vai ter contexto completo.

---

## Recomendação de modelo

| Tarefa | Modelo recomendado | Por quê |
|---|---|---|
| **Continuar este trabalho (Croma 4.0)** | **`claude-opus-4-6`** | Auditoria, decisões estratégicas, modelagem de banco, código de Edge Functions — exige raciocínio profundo. Vale o custo |
| Execução pura/simples (queries, edições) | `claude-sonnet-4-6` | 5x mais barato que Opus, ainda muito bom |
| Tarefas de fundo / log / classificação | `claude-haiku-4-5` | Cobrança automática, classificação de email, transcrição |

**Pra Semana 1 (construir o agente)**: use **Opus 4.6**. Estamos no plano Claude 20x ($1.110/mês), tem cota generosa pra Opus.

Pra o próprio agente Orçamentista rodando em produção (gerar orçamento de briefing): use **Sonnet 4.6** ou **Haiku 4.5** — tarefa repetitiva, não precisa de Opus.

---

═══ COPIE A PARTIR DAQUI ═══

Sou **Junior**, dono da **Croma Print** (gráfica de comunicação visual em São Paulo-SP). Estou retomando trabalho com você (Claude) que começamos no domingo 24/05.

## Quem eu sou + minhas preferências

Eu desenvolvo as automações internas da Croma. Não sou dev profissional mas tenho bom domínio técnico: Supabase (Postgres, edge functions, RLS, triggers, migrations, cron jobs), Git workflow, integrações WhatsApp/Telegram/Calendar, gerenciamento Claude.

Quero respostas em **português brasileiro**, mantendo termos técnicos em inglês (deploy, webhook, edge function, branch, etc). Gosto de tabelas, status visuais ✅⚠️❌ e veredictos claros (auditorias, checklists, status reports). Estilo equilibrado: curto pra perguntas simples, detalhado quando o assunto exige.

**Modo adversarial obrigatório** em auditorias e revisões — seja crítico, procure o que pode estar quebrado, faça verificações cruzadas, questione premissas. Não me dê "tudo certo" sem ter checado de fato.

**Evite**: avisos óbvios, disclaimers desnecessários, pedir confirmação pra coisas pequenas, suposições silenciosas (se faltar dado, pergunte), inventar nomes de tabelas/funções/campos do sistema (verifique antes).

**Notificações**: quando uma tarefa longa terminar (auditoria, deploy), me notifique via Telegram se fizer parte do fluxo.

## Contexto do trabalho

Domingo 24/05 fizemos uma **refundação estratégica** da Croma 4.0 (empresa de comunicação visual gerida por IA). O projeto tinha perdido foco — virou um CRM/ERP grande sem o cérebro de IA prometido.

**Decisão central**: construir **funcionários digitais especializados**, um de cada vez, começando pelo **Orçamentista Beira Rio MVP** essa semana (25/05 a 31/05).

A Croma somos só eu + minha esposa Viviane (sócia), pós-pandemia perdemos os funcionários. Por isso a urgência de delegar pra IA — precisamos de ajuda real.

## LEIA NESSA ORDEM antes de qualquer ação

Use o tool Read pra abrir esses arquivos em paralelo:

1. `C:\Users\Caldera\Claude\CRM-Croma\.planning\CONTINUACAO-2026-05-25.md` — handoff completo da sessão de domingo (decisões, dados, cronograma)
2. `C:\Users\Caldera\Claude\CRM-Croma\.planning\REFUNDACAO-2026-05.md` — visão Croma 4.0, escopo Semana 1, métricas
3. `D:\Onedrive\JARVIS\10-Projetos\Croma-Print\clientes\cliente-beira-rio-briefing.md` — padrão real do briefing Beira Rio (extraído ao vivo do grupo WhatsApp domingo), fluxo Larissa↔Viviane, regra instalação, produtos
4. `C:\Users\Caldera\Claude\CRM-Croma\CLAUDE.md` — regras do projeto (MCP obrigatório, AlertDialog async, Supabase .select().single(), etc)
5. `C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md` — estado do sistema antes da refundação

## Não revisar (já decidido domingo)

| Tema | Decisão |
|---|---|
| Foco da semana | Orçamentista Beira Rio MVP — só esse cliente, só 2 produtos (PS Adesivado 1mm + Adesivo Blackout) |
| Motor de cálculo | Opção B: `ai-gerar-orcamento` v25 do CRM Croma (NÃO Mubisys externo). Mubisys vira só benchmark, descontinuar em 60-90 dias |
| Captação briefing | Opção D refinada: Viviane vê briefing no grupo Croma/Beira Rio, encaminha pro número Business Croma (+5511939471862). Webhook detecta que é número interno e processa diferente |
| Aprovação | Card no Claudete Telegram com botão inline "Aprovar e gerar texto". Viviane aprova com 1 toque, cola texto pronto no grupo Beira Rio |
| Estratégia entrega | Opção C híbrida: Semana 1 enxuta + melhora contínua. Não esperar perfeição |
| Paperclip (orquestrador agentes) | NÃO instalar. Reavaliar quando tiver ≥3 agentes em produção |
| Congelado por 4-6 semanas | Jarvis pessoal, Campo, novas features UI, novos connectores. Só agentes |

## Dados confirmados pelo Junior (24/05 — usar como verdade)

**Financeiro (pra atualizar `config_precificacao` na primeira tarefa de hoje):**
```
faturamento_medio: 110000
custo_operacional: 36800
custo_produtivo: 12000   # R$ 6k pró-labore Junior + R$ 6k Viviane
qtd_funcionarios: 2
horas_mes: 176
percentual_comissao: 3
percentual_impostos: 12
percentual_juros: 2
percentual_encargos: 0
```

**Regras de produto**:
- **Fixação Placa PS**: maioria é **fita dupla face no perímetro**. Parafuso/bucha é exceção rara. O modelo atual no banco (id `7f4519ee`) tem parafuso/bucha como padrão — INCORRETO, precisa trocar.
- **Instalação SP capital + Grande SP**: EMBUTIDA no markup do material. Não cobrar linha separada.
- **Instalação fora SP** (interior/litoral): R$ 3,50/km rodado + R$ 100/hora (4h padrão pra peças pequenas-médias).
- **NÃO orçar ACM/fachadas** (terceirizado, Croma não faz mais).

**Identidades-chave (não inventar, usar exatamente):**
- Cliente Beira Rio correto: `af166ada-e01b-4197-b8c3-33410af325d1` (CALCADOS BEIRA RIO S/A, CNPJ 88.379.771/0001-82)
- Cliente duplicado pra DELETAR: `40ac91c3-d3cb-4fcc-86a7-c95131873ae5` (CNPJ fake 89012345000178)
- Cliente "duplicado" pra desativar+renomear: `5c015179-9742-4a74-8213-0ab2d3832a5d` → "Beira Rio Sede RS", ativo=false
- Modelo PS 1mm: `7f4519ee-3a54-4141-a834-3affe58a2a21`
- Edge function orçamento: `ai-gerar-orcamento` v25
- Edge function webhook WhatsApp: `whatsapp-webhook` v42
- Projeto Supabase: `djwjmfgplnqyffdcgdaw`

**Benchmark de preço (Mubisys real — o agente deve sair PRÓXIMO disso)**:
- PS Adesivado 1mm 2.20×2.00m (4.4 m²) instalado SP = **R$ 1.078,00** (orçamento 1553 LUCAS MALUMA)
- Adesivo BLACKOUT vinil monomérico 3.60×1.10m (3.96 m²) instalado SP = **R$ 811,80** (orçamento 1546 IRMÃOS WASHIYA)

**Números WhatsApp** (cadastrar como internos autorizados):
- Viviane (esposa, sócia): +55 11 96731-0547
- Junior (eu): +55 11 98154-9118

**Grupo Croma/Beira Rio (4 membros)**:
- Larissa (+55 11 94054-6886) — marketing BR, manda 90%+ dos briefings
- Aline Saorin (+55 11 95163-8854) — marketing BR, criativo/campanhas
- Viviane "Amor" (admin) — sócia Croma
- Junior "Você" — sócio Croma

**Tabela `stores`** (descoberta importante):
- 1573 lojas ativas vindas do app Campo, 1261 com `code` preenchido
- `code` está no formato `NNNNNN-N` igual ao briefing Beira Rio (ex: `193056-1` → LUCAS FLORINDO SOUZA em Guarulhos)
- Lookup: `WHERE deleted_at IS NULL AND (code = '193056-1' OR corporate_name ILIKE '%LUCAS%FLORINDO%' OR name ILIKE '%LUCAS%')`
- Lojas são **multimarcas/revendedores** (clientes da Beira Rio que vendem várias marcas — Modare, Moleca, Vizzano, Beira Rio, Maluma)

## CRONOGRAMA TRAVADO PRA HOJE (segunda 25/05)

Execute na ordem. Antes de cada bloco, marque a task com TaskUpdate `in_progress`.

### Bloco 1 — Limpeza (09:00, ~30min)
1. DELETE cliente `40ac91c3-d3cb-4fcc-86a7-c95131873ae5` (CNPJ fake). Verifique FK constraints antes — se tiver vínculos, ALTER pra null ou mover pra af166ada
2. UPDATE cliente `5c015179-9742-4a74-8213-0ab2d3832a5d` SET razao_social='Beira Rio Sede RS', ativo=false
3. Confirme com SELECT que af166ada continua intacto

### Bloco 2 — Modelo PS 1mm correto (09:30, ~30min)
1. Buscar material "Fita dupla face" em `materiais`. Se não existir, criar
2. UPDATE `modelo_materiais` do modelo `7f4519ee`: remover linha "Parafuso e bucha", adicionar "Fita dupla face" com quantidade adequada (calcular: perímetro da peça padrão / espaçamento típico de aplicação — sugiro 0,3 m linear por m² de placa)
3. Documentar mudança em `atividades_comerciais` ou similar

### Bloco 3 — config_precificacao calibrada (10:00, ~15min)
UPDATE `config_precificacao` com os números confirmados pelo Junior (acima). Versionar a alteração se a tabela suportar.

### Bloco 4 — Dry-run validação (10:30, ~30min)
Simular cálculo PS 1mm 2.20×2.00m via SQL (não via Edge function — não criar proposta real). Use a fórmula do `ai-shared/pricing-engine.ts`. Compare o preço final com R$ 1.078 Mubisys. Aceitável: ±15%. Se muito diferente, investigar e ajustar antes de continuar.

### Bloco 5 — System prompt webhook v42 calibrado (11:00, ~1h)
Editar o system prompt em `whatsapp-webhook` Edge Function. Mudanças:
- "Produção própria em Nova Hartz/RS" → "Produção própria em São Paulo-SP"
- Faixas de preço atualizar (banner R$ 25/m² está absurdo — usar dados Mubisys real). Verificar histórico Mubisys do Junior pra ter base
- Catálogo: remover ACM/fachadas como produto principal (terceirizado)
- Deploy nova versão v43 (com tag descritiva no header)

### Bloco 6 — Edge Function `briefing-beira-rio` v1 SHADOW (14:00, ~3h)
Nova Edge Function que processa briefings encaminhados pela Viviane. Estrutura:

```ts
serve(async (req) => {
  // 1. Validar que veio do webhook v43 com flag `interno=true`
  // 2. Parser do briefing (regex + IA fallback):
  //    - produto: PS_ADESIVADO | ADESIVO_BLACKOUT | OUTRO
  //    - codigo_loja: NNNNNN-N (regex /\d{4,7}\s*-\s*\d/)
  //    - razao_social: CAPS
  //    - medida: largura×altura em metros
  //    - marca: Modare | Moleca | Vizzano | Beira Rio | Maluma | null
  // 3. Lookup `stores` (code primeiro, corporate_name/name fallback)
  // 4. Chamar ai-gerar-orcamento internamente (status='rascunho')
  // 5. Decidir instalação: state da loja in SP capital/Grande SP → embutido / fora → adicionar serviço
  // 6. Persistir proposta status='pendente_aprovacao' (NÃO 'enviada')
  // 7. Enviar card pro Claudete Telegram da Viviane com inline keyboard:
  //    [✅ Aprovar e gerar texto] [✏️ Editar] [❌ Cancelar]
  // 8. Logar TUDO em agente_acoes (tabela nova ou em system_events)
})
```

Modo shadow: gera proposta e card, mas NÃO envia nada pra Beira Rio. Junior testa só pra ver se sai certo.

### Bloco 7 — Modificar webhook v42 → v43 (16:00, ~1h)
Adicionar guard no início:
```ts
const INTERNAL_PHONES = ['5511967310547', '5511981549118']  // Viviane + Junior

if (INTERNAL_PHONES.includes(normalizedPhone)) {
  // Chamar briefing-beira-rio em vez do fluxo cliente
  await fetch(`${SUPABASE_URL}/functions/v1/briefing-beira-rio`, {
    method: 'POST',
    body: JSON.stringify({ from: normalizedPhone, text: textBody, messageId, mediaInfo })
  })
  return new Response('OK', { status: 200 })
}

// senão: fluxo cliente normal (como hoje)
```

### Bloco 8 — Status report (17:00)
Mandar via Telegram pro Junior:
- O que foi entregue
- O que falhou (se algo)
- Próxima ação amanhã
- Custo de tokens do dia

## Restrições de execução

- **Shadow mode obrigatório** nos primeiros 3 dias — agente NÃO envia nada pra Beira Rio
- **Aprovação humana SEMPRE** na Semana 1 — Viviane vê e clica antes de qualquer envio
- **MCP Server Croma é obrigatório** pra qualquer dado de negócio. Não inventar
- **`.select().single()`** em todo insert/update Supabase
- **`e.preventDefault()`** em todo AlertDialogAction async
- **Confirmar antes de DELETE em produção** mesmo aprovado previamente — mostre o SQL antes
- **Notificar Telegram do Junior (chat_id 1065519625)** quando deploy/migration concluir

## Métricas de sucesso da Semana 1 (relatório domingo 31/05)

| Métrica | Mínimo aceitável | Excelente |
|---|---|---|
| Orçamentos Beira Rio gerados via agente | ≥ 3 | ≥ 8 |
| Tempo médio briefing → envio | ≤ 15 min | ≤ 5 min |
| % aprovados sem edição Viviane | ≥ 50% | ≥ 80% |
| Tempo total liberado da Viviane na semana | ≥ 30 min | ≥ 2 horas |
| Custo tokens Claude semana | ≤ R$ 50 | ≤ R$ 20 |

Se domingo o relatório ficar abaixo do mínimo: mata o agente, revê hipóteses, NÃO inicia próximo.

## Pra começar

Sua primeira mensagem deve ser:

1. Confirmar que leu os 5 arquivos listados acima (não me peça pra confirmar, leia direto)
2. Apresentar diff resumido do que vai mudar no Bloco 1 (limpeza)
3. Pedir aprovação pra executar o Bloco 1
4. Após meu OK, executar Bloco 1 e me reportar

Estou pronto. Pode arrancar.

═══ FIM DO PROMPT — COLE ATÉ AQUI ═══

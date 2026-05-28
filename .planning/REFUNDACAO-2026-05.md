# REFUNDAÇÃO — Croma 4.0 (gerida por funcionários digitais)

> **Data**: 2026-05-24 (domingo) | **Autor**: Junior + Claude | **Status**: ativo

---

## Por que essa refundação

Junior expressou em 2026-05-24:

> "Sinto que nossos projetos se tornaram muito grandes e perderam o foco.
> O projeto principal — Croma Print ser a primeira empresa de comunicação visual gerida
> por IA — não está tomando rumo legal."

E também:

> "Preciso de funcionários digitais pra todas as áreas da Croma, cada um com sua
> responsabilidade e especialidade. (...) Posso dedicar uma semana no máximo
> pois preciso mostrar resultado que justifique o gasto de R$ 1.110 com o Claude
> no plano 20x que temos hoje."

**Diagnóstico cruzado** (Junior + Claude após análise do repo, vault Obsidian, grupo WhatsApp Beira Rio, Mubisys):

| Sintoma | Causa | Evidência |
|---|---|---|
| Sistema "grande mas sem alma de IA" | Construímos CRM/ERP tradicional bem feito, mas o "cérebro" que decide sozinho ficou em segundo plano | 108 ferramentas MCP, 12 Edge Functions IA, 0 agentes autônomos rodando hoje |
| Foco diluído | Jarvis pessoal + CRM Croma + Campo + automações soltas — cada um pede manutenção | Múltiplos sprints com mudança de rumo (STATE.md) |
| Realidade comercial brutalmente pequena | Só Junior + Viviane operam o comercial (pós-pandemia, mandaram funcionários embora, não recuperaram) | Conversa 2026-05-24 |
| ROI da assinatura R$ 1.110/mês não comprovado | Construímos ferramentas, não delegamos decisão | — |

**Conclusão**: a estratégia de "construir features melhores" não está produzindo a empresa AI-first prometida.
Precisamos virar pra outra estratégia — **funcionários digitais com escopo de cargo real**.

---

## Visão de longo prazo (12 meses)

A Croma vira a primeira gráfica do Brasil com **org chart parcialmente IA**:

| # | Funcionário digital | Libera tempo de | Status |
|---|---|---|---|
| 1 | **Orçamentista** (Beira Rio MVP) | Viviane | 🎯 Semana 1 (este doc) |
| 2 | **SDR / Vendedor** (qualifica leads novos no WhatsApp) | Viviane | Backlog Sem 2-3 |
| 3 | **PCP / Produção** (sequencia fila HP Latex, alerta gargalo) | Junior | Backlog Sem 4-5 |
| 4 | **Instalações** (agenda equipe, gera OS, pós-visita) | Junior | Backlog Sem 6-7 |
| 5 | **Cobrador** (quando voltar a ter inadimplência) | Viviane | Backlog quando relevante |
| 6 | **Marketing** (posts redes, análise concorrência) | Viviane | Backlog Sem 8+ |
| 7 | **Comprador** (cota material, sugere compra) | Junior | Backlog Sem 10+ |
| 8 | **CEO Virtual** (relatórios semanais, KPIs, alertas) | Junior+Viviane | Última camada — quando outros estiverem rodando |

**Plataforma**: tudo roda na infra do **Jarvis** (Supabase + Edge Functions + cron + Telegram).
Jarvis vira "sistema operacional dos funcionários digitais". Cada agente é:
edge function + cron + prompt + ferramentas MCP + log de ações + escape humano.

**Paperclip (orquestrador): NÃO ainda.** Avaliação 2026-05-24: nosso problema hoje é
ter 1 agente funcionando, não orquestrar 10. Reavaliar quando ≥3 agentes em produção.

---

## Decisão estratégica desta semana

### O quê
Construir o **primeiro funcionário digital**: **Orçamentista especializado em Beira Rio**.

### Por quê Beira Rio
- Cliente de **16 anos**, classe A, vendedora ref. Viviane Penninck
- **702 lojas SP cadastradas em `public.stores`** (669 com GPS)
- Briefing já chega **estruturado** no WhatsApp (código loja + medida + produto)
- Volume confirmado: **~30 orçamentos em 3 meses (~2-3/semana)**
- 80% das vendas são 2 produtos: **PS Adesivado 1mm + adesivo digital** e **Adesivo BLACKOUT vinil monomérico**
- Faixa de preço previsível: **PS Adesivado ~R$ 245/m²**, **BLACKOUT ~R$ 205/m²** (ambos instalados)

### Decisão técnica — Opção B
Aprovada por Junior em 2026-05-24:

> "Vamos de B, pois nosso sistema já está bem estruturado e podemos melhorar usando o Mubisys
> como referência. Hoje ainda usamos o Mubi pois ainda não estamos 100% confiantes no nosso
> CRM próprio. O plano é deixar de usar o Mubisys em breve e deixar tudo no CRM da Croma."

**Implicação**:
- Agente Orçamentista usa `ai-gerar-orcamento` v12 (Anthropic direto, motor Mubisys 116 modelos)
- Mubisys externo continua existindo em paralelo (Viviane pode usar se preferir em casos limite)
- Mubisys é **benchmark visual e de preço** — orçamento Croma deve ficar pelo menos tão bonito quanto
- **Meta de longo prazo**: descontinuar Mubisys quando Croma estiver 100% confiável

### Decisão arquitetura "ouvidos do agente" — Opção D refinada (encaminhamento interno autorizado)

**Histórico**: tentamos Opção A (adicionar Business Cloud API +55 11 93947-1862 no grupo) em 2026-05-24 — Meta bloqueou. Política oficial: Cloud API não pode participar de grupos.

**Inventário de números Croma**:
| Número | Tipo | Pode entrar em grupo? | Tem webhook? | Papel |
|---|---|---|---|---|
| +55 11 93947-1862 | Cloud API (agente IA) | ❌ não | ✅ webhook v42 | recebe briefings encaminhados |
| +55 11 3399-4517 | Business App (telefone fixo) | ✅ sim | ❌ não tem | atendimento manual |
| +55 11 98154-9118 | Pessoal Junior | ✅ sim | ❌ não tem | interno autorizado (testes) |
| +55 11 96731-0547 | Pessoal Viviane | ✅ sim (já está no grupo Beira Rio) | ❌ não tem | **interno autorizado principal** |

**Decisão final** (Junior em 2026-05-24):

Fluxo:
1. **Larissa manda briefing no grupo** (Viviane vê, do número pessoal dela que já está no grupo)
2. **Viviane encaminha briefing** pro número 93947-1862 (Cloud API)
3. Webhook v42 detecta que `from === número_pessoal_viviane` → marca como **número interno autorizado**
4. **Agente NÃO responde a Viviane como cliente** — processa como briefing interno
5. Extrai produto + código loja + medida, faz lookup `stores`, calcula preço via `ai-gerar-orcamento`
6. **Notifica Viviane no Claudete Telegram** com card: briefing + extração + preço + botão aprovar
7. Viviane aprova com 1 toque no Telegram
8. Claudete devolve pra Viviane o texto pronto: *"Cole no grupo Beira Rio: 'Pra já 💕 Segue: {link}'"*
9. Viviane cola no grupo (1 toque)

**Latência total**: ~1-3 min (depende Viviane ver + encaminhar + aprovar)
**Vantagens**: Larissa vê resposta da Viviane (relação 16 anos preservada), Viviane mantém controle total, zero risco Meta, infra atual cobre 95%
**Custo de implementação**: cadastrar 1-2 números internos + 1 guard no webhook + comando aprovação no Claudete

**Pré-requisitos**:
- [ ] Cadastrar número pessoal Viviane como "interno autorizado" no banco (tabela nova `numeros_internos` ou flag em `admin_config`)
- [ ] Webhook v42 v43: adicionar guard `if from in INTERNAL → processBriefingInterno()` antes do fluxo cliente
- [ ] Comando aprovação no Claudete bot (callback inline keyboard com "✅ Aprovar e gerar texto")

### Plano de evolução futura (Semana 4+) — Opção I (Bridge Business App)
Após Opção D provar ROI, avaliar:
- Instalar `whatsapp-web.js` (Node) em servidor lendo sessão do +55 11 3399-4517 (Business App, telefone fixo)
- Adicionar 3399-4517 no grupo Croma/Beira Rio
- Bridge escuta grupo 24/7, dispara webhook automaticamente quando detecta briefing da Larissa
- Latência: 1-5s automático
- Risco: Meta pode banir o número (mas é o telefone fixo, não pessoal — dano controlado)
- Decisão fica pra Semana 4+, NÃO Semana 1

---

## Escopo Semana 1 — Orçamentista Beira Rio MVP

### O que entra ✅

| Camada | Entregável |
|---|---|
| **Entrada** | Mensagem da Larissa (+55 11 94054-6886) no grupo Croma/Beira Rio detectada via webhook WhatsApp v42 OU comando manual da Viviane via Claudete Telegram (`/orçar 193056-1 LUCAS, PS adesivado, 2.20x2.00`) |
| **Parser** | Extrai: produto (PS_ADESIVADO \| ADESIVO_BLACKOUT \| OUTRO), código loja (`NNNNNN-N`), razão social, medida (largura×altura m), marca (Modare \| Moleca \| Vizzano \| Beira Rio \| Maluma) |
| **Lookup loja** | Query `stores WHERE codigo_loja ILIKE '%NNNNNN%' OR nome ILIKE '%razao_social%'` → pega CNPJ, endereço, cidade, GPS. Se não achar → escalona Viviane |
| **Cálculo** | Chama `ai-gerar-orcamento` v12 com produto+medida → gera proposta numerada PROP-2026-NNNN. Valida preço contra faixa histórica (±15%) |
| **Fila de aprovação** | Nova tela `/orcamentos/pendentes-aprovacao` no ERP — card com briefing original (texto + fotos), resumo extraído, preço gerado, faixa histórica, endereço da loja |
| **Aprovação** | Botão **"Aprovar e enviar"** (1 clique) → cria proposta status=enviada + manda link `crm-croma.vercel.app/p/:token` no grupo WhatsApp. Botão "Editar" abre form. Botão "Pingar Viviane" escala. |
| **Disparo** | Reusa `wa.me/{tel_grupo}?text={msg+link}` que já existe |
| **Métricas** | Tempo briefing→envio, nº orçamentos gerados, % aprovados sem edição, % virou pedido em 7d, R$/m² comparado ao Mubisys histórico |
| **Logs** | Tabela `agente_acoes` com cada passo (parser_ok, lookup_ok, calculo_ok, escalonamento_motivo, aprovacao_viviane) |
| **Escape humano** | Briefing ambíguo / loja não encontrada / produto fora dos 2 principais / preço fora faixa → pinga Viviane no Telegram + Claudete, **agente NÃO orça sozinho** |

### O que NÃO entra ❌
- **ACM e fachadas** (terceirizado, Croma não faz mais)
- Letreiros caixa, totens, cavaletes, PDV — Semana 2+
- Orçamento pra outros clientes que não Beira Rio — Semana 2+
- Envio automático SEM aprovação Viviane — só Semana 3+ quando ela confiar
- Substituir Mubisys 100% — meta de 60-90 dias, não Semana 1
- Auto-resposta a perguntas do cliente — só orçar quando briefing for claro

### Congelamentos (zero-mexer por 4-6 semanas)
- ❌ Jarvis pessoal (sync calendar, alertas, scanner) — funciona, deixa quieto
- ❌ Campo (campo-croma.vercel.app) — funciona, deixa quieto
- ❌ Refatorações cosméticas no ERP
- ❌ Novas integrações (Asana, Notion, Linear, etc) — nada novo
- ❌ Investigar áudio WhatsApp OUT (Meta Business Manager) — fica pra depois
- ❌ Bug Claudete-cliente-fantasma, agent-cron-loop 500 — não-urgente
- ❌ Avaliar Paperclip — só quando tiver ≥3 agentes rodando

Junior aprovou em 2026-05-24: "pode congelar Tudo que nao for construir os agentes"

---

## Verificações técnicas pendentes (Dia 1)

Antes de codar, validar via Supabase MCP:

| # | Verificação | Como |
|---|---|---|
| V1 | Motor tem modelo "PS Adesivado 1mm" calibrado em ~R$ 245/m²? | `SELECT * FROM produto_modelos WHERE nome ILIKE '%PS%' OR nome ILIKE '%adesivado%'` |
| V2 | Motor tem modelo "Adesivo BLACKOUT vinil monomérico" em ~R$ 205/m²? | `SELECT * FROM produto_modelos WHERE nome ILIKE '%blackout%'` |
| V3 | Custo instalação está embutido ou é serviço separado? | `SELECT * FROM acabamentos_servicos WHERE nome ILIKE '%instal%'` |
| V4 | Portal `/p/:token` está apresentável (logo, layout) vs Mubisys? | Acessar 1 proposta real do banco, comparar lado a lado |
| V5 | Tabela `stores` tem coluna `codigo_loja` (formato `NNNNNN-N`)? | `\d stores` |
| V6 | Onde estão configurados os números autorizados no webhook v42 hoje? | Ler `whatsapp-webhook/index.ts` — buscar por `ESCALATION_KEYWORDS`, `MODO DONO`, hardcoded phone numbers |
| V7 | Existem `agent_messages` ou propostas da Beira Rio recentes? Quantas? | `SELECT count(*) FROM propostas WHERE cliente_id = '<id_beira_rio>' AND created_at > now() - interval '90 days'` |
| V8 | Tabela ou flag pra cadastrar **números internos autorizados** existe? | `SELECT * FROM admin_config WHERE chave ILIKE '%interno%'` ou criar nova tabela `numeros_internos` |
| V9 | Claudete bot Python tem suporte a **inline keyboard** (botões Aprovar/Editar)? | Ler `claudete_bot.py` — buscar por `InlineKeyboardMarkup`, `CallbackQuery` |
| V10 | Detector de briefing (produto + cod_loja + medida) funciona com os exemplos reais do grupo? | Testar regex contra os 10 briefings históricos extraídos do grupo (em `cliente-beira-rio-briefing.md`) |

Se V1, V2 ou V3 falhar → criar/calibrar os modelos usando dados Mubisys (1553 e 1546 como referência) ANTES de qualquer outra coisa.

---

## Cronograma 7 dias (25/05 — 31/05)

| Dia | O que faço | O que Junior+Viviane fazem |
|---|---|---|
| **Seg 25/05** | Discovery técnico: V1-V7 via Supabase MCP. Calibrar modelos PS Adesivado e BLACKOUT se necessário. Atualizar PROJECT.md (RS→SP, ACM principal→sob consulta). Deprecar `playbook-orcamento-fachada-acm`. Reportar achados | Junior valida o que vai ser ajustado |
| **Ter 26/05** | Edge function `agente-orcamentista` v1: parser briefing + lookup loja + chama `ai-gerar-orcamento` + grava na tabela `agente_acoes`. Modo **shadow** (não envia, só simula no Telegram) | Viviane orça normal no Mubisys. Eu observo. |
| **Qua 27/05** | Tela ERP `/orcamentos/pendentes-aprovacao` (lista + card aprovação). Cron `*/5min` ativa o agente. Notificação Telegram quando entra na fila | Viviane revisa fila (mesmo que ainda vazia ou simulada) |
| **Qui 28/05** | E2E real: 1 briefing real Beira Rio → agente extrai → fila → Viviane aprova → enviado. Coleta primeiras métricas. Hardening parser baseado em casos reais | Viviane usa pela 1ª vez de verdade |
| **Sex 29/05** | Iteração: corrigir o que falhou na quinta. Melhorar parser, melhorar layout do portal, melhorar tom de mensagem | Viviane usa o dia todo. Feedback constante |
| **Sáb 30/05** | Coleta dados da semana. Gera relatório com R$ economizado, tempo liberado, casos escalados, casos onde agente errou | — |
| **Dom 31/05** | **Relatório final**: número de orçamentos gerados, tempo médio briefing→envio, % aprovados sem edição, % que viraram pedido, custo tokens Claude, ROI. Decisão: continua, ajusta, ou mata. | Junior decide próximo passo |

---

## Métricas de sucesso (Semana 1)

Pra justificar os R$ 1.110/mês de Claude, precisamos atingir pelo menos:

| Métrica | Mínimo aceitável | Excelente |
|---|---|---|
| Orçamentos Beira Rio gerados via agente | ≥ 3 | ≥ 8 |
| Tempo médio briefing → envio | ≤ 15 min (vs ~30 min hoje no Mubisys) | ≤ 5 min |
| % aprovados pela Viviane sem edição | ≥ 50% | ≥ 80% |
| % que viraram pedido em 7 dias | sem regressão vs histórico | melhoria mensurável |
| Tempo total liberado da Viviane na semana | ≥ 30 min | ≥ 2 horas |
| Custo tokens Claude semana | ≤ R$ 50 | ≤ R$ 20 |

**Se domingo o relatório ficar abaixo do mínimo aceitável**: mata o agente, revê hipóteses, NÃO inicia próximo.

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Motor `ai-gerar-orcamento` não cobrir PS Adesivado ou BLACKOUT corretamente | V1-V3 antes de qualquer código. Se faltar, calibrar com dados Mubisys (R$ 245/m² PS, R$ 205/m² BLACKOUT) |
| Portal Croma `/p/:token` ficar feio vs Mubisys (Beira Rio estranhar) | V4 dia 1. Se necessário, aplicar template visual baseado no Mubisys (logo, layout, fonte) |
| Webhook WhatsApp v42 não pegar mensagens de grupo (só DM) | V6 dia 1. Se for o caso, ajustar webhook pra processar `message.from = {grupo}` |
| Parser quebrar com briefings ambíguos / fora do padrão observado | Escalonar Viviane em caso de dúvida. Não tentar adivinhar. Logar todos os casos pra calibrar |
| Viviane não confiar e voltar pro Mubisys | Aprovação humana SEMPRE na Semana 1. Mostrar lado a lado: preço Mubisys (referência) vs preço Croma (gerado) — ela compara |
| Beira Rio reclamar do novo formato (link Croma em vez de Mubisys) | Manter formato e tom de mensagem idênticos. Plus: agradecer no fim ("Faturado, obrigada"). Em caso de reclamação, voltar pro Mubisys naquele orçamento específico |
| Custo tokens passar do esperado | Logar cada chamada com input/output tokens. Cap diário: R$ 10. Se atingir, pausa agente até dia seguinte |
| Eu (Claude) errar premissa não-medida (Karpathy: Think Before Coding) | Toda decisão técnica que muda comportamento de produção exige OK do Junior antes de deploy |

---

## Backlog Semana 2+ (não fazer agora)

1. Expandir Orçamentista pra outros clientes (não só Beira Rio)
2. Expandir produtos: letreiros caixa, totens, cavaletes, PDV
3. Construir SDR/Vendedor (qualifica leads novos)
4. Reativar os 3.127 leads parados em "novo" (mina de ouro identificada)
5. Decidir sobre Mubisys: cronograma de descontinuação (60-90 dias)
6. Construir CEO Virtual (relatório semanal automatizado Telegram)
7. Migrar `playbook-orcamento-fachada-acm` → `playbook-orcamento-ps-adesivado` + `playbook-orcamento-adesivo-blackout`
8. Reavaliar Paperclip quando tiver ≥3 agentes rodando

---

## Sources

- Conversa Junior 2026-05-24 (decisão refundação + Opção B)
- `D:\Onedrive\JARVIS\10-Projetos\Croma-Print\clientes\cliente-beira-rio-briefing.md` (extração ao vivo grupo WhatsApp + 2 orçamentos Mubisys)
- `C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md` (estado atual sistema)
- `C:\Users\Caldera\Claude\CRM-Croma\.context\empresa.md`
- Mubisys 1553 (LUCAS MALUMA): https://www.mubisys.com/index.php?orcamento=true&cc=562416&item=241d3fbd982e0cb6e83c5b818c4bb256
- Mubisys 1546 (IRMÃOS WASHIYA): https://www.mubisys.com/index.php?orcamento=true&cc=562416&item=7be4047bb8f26a9cd8c9cd5c7b09f570

---

## Próxima decisão pendente

Antes de segunda 25/05 começar, Junior precisa confirmar:

- [ ] Aprovação deste doc (geral) — ou ajustes
- [ ] Confirmação da Viviane que ela está dentro (vai encaminhar briefings, validar tom, aprovar fila, dar feedback)
- [ ] Liberação pra eu rodar Supabase MCP em modo leitura (V1-V10)
- [x] **Me passar o número pessoal da Viviane** — ✅ confirmado 2026-05-24: +55 11 96731-0547
- [ ] Garantir que a Viviane já tem o Claudete Telegram instalado e ativo

Quando tiver os 5 OKs, eu carrego Supabase MCP e arranco a Semana 1.

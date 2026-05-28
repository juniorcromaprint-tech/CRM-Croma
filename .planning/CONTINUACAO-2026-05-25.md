# Prompt de Continuação — Sessão 2026-05-25 (segunda)

> Cole este arquivo no início da próxima sessão Claude (Cowork ou Claude Code) pra continuar
> exatamente de onde paramos no domingo 2026-05-24.

---

## Contexto rápido

Sou Junior, dono da Croma Print. Domingo 24/05 eu e o Claude fizemos uma **refundação estratégica**
do projeto Croma 4.0 (empresa de comunicação visual gerida por IA). Eu estava sentindo que o
projeto tinha perdido foco — virou um CRM/ERP grande sem o cérebro de IA que prometemos construir.

**Decisão central**: começar a construir **funcionários digitais especializados**, um de cada vez,
começando pelo **Orçamentista Beira Rio MVP** (Semana 1 = 25/05 a 31/05).

A Croma hoje somos só eu + Viviane (esposa/sócia). Sem funcionários CLT, eventual freelance.
Por isso a urgência de delegar pra IA — precisamos de ajuda real, não de mais ferramentas.

## Leia ANTES de qualquer coisa (ordem)

1. `C:\Users\Caldera\Claude\CRM-Croma\.planning\REFUNDACAO-2026-05.md` — visão, escopo Semana 1, cronograma
2. `D:\Onedrive\JARVIS\10-Projetos\Croma-Print\clientes\cliente-beira-rio-briefing.md` — padrão real do briefing Beira Rio, fluxo Larissa↔Viviane, regra instalação, produtos
3. `C:\Users\Caldera\Claude\CRM-Croma\CLAUDE.md` — regras gerais do projeto
4. `C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md` — sessão NOITE 22/05 (último estado antes da refundação)

## Decisões já travadas (não revisar)

| # | Decisão | Detalhe |
|---|---|---|
| Estratégia | Construir funcionários digitais (não mais features) | Orçamentista primeiro |
| Cliente piloto | Beira Rio | 80% das vendas: PS Adesivado 1mm + Adesivo Blackout |
| Motor | Opção B — `ai-gerar-orcamento` v25 do CRM Croma | Mubisys (externo) vira só benchmark; descontinuar em 60-90 dias |
| Captação briefing | Opção D refinada — Viviane encaminha pro número Cloud API (+5511939471862) | Webhook detecta número interno e processa |
| Aprovação | Claudete Telegram com inline keyboard "Aprovar e gerar texto" | Viviane cola no grupo |
| Plano de entrega | Opção C híbrida — Semana 1 enxuta + melhora contínua | 7 dias entrega MVP funcional, melhorias seguem |
| Paperclip | NÃO instalar agora | Reavaliar quando ≥3 agentes em produção |

## Dados financeiros confirmados pelo Junior (24/05)

```
faturamento_medio: R$ 110.000/mês
custo_operacional: R$ 36.800/mês
custo_produtivo: R$ 12.000/mês (R$ 6k pró-labore Junior + R$ 6k Viviane)
qtd_funcionarios: 2 (sócios)
horas_mes: 176
% comissao: 3 | % impostos: 12 | % juros: 2 | % encargos: 0
```

## Regras de produto confirmadas pelo Junior (24/05)

- **Fixação Placa PS**: maioria absoluta é fita dupla face no perímetro. Parafuso/bucha é exceção rara.
- **Instalação SP capital + Grande SP**: EMBUTIDA no markup do material — não cobra separado.
- **Instalação fora SP** (interior, litoral): R$ 3,50/km + R$ 100/hora (4h padrão).
- **NÃO orçar ACM/fachadas** (terceirizado, Croma não faz mais).

## Números pra o agente acertar (benchmark Mubisys)

| Produto | Mubisys real | Referência |
|---|---|---|
| Placa PS 1mm + adesivo digital (4.4 m²) instalado SP | R$ 1.078,00 | Orçamento 1553 LUCAS MALUMA |
| Adesivo BLACKOUT vinil monomérico (3.96 m²) instalado SP | R$ 811,80 | Orçamento 1546 IRMÃOS WASHIYA |

## Identidades-chave

- **Cliente Beira Rio correto no CRM**: `af166ada-e01b-4197-b8c3-33410af325d1` (CALCADOS BEIRA RIO S/A, CNPJ 88.379.771/0001-82, mkt_spc@beirario.com.br, Carapicuíba/SP)
- **Modelo PS 1mm no banco**: `7f4519ee-3a54-4141-a834-3affe58a2a21`
- **Webhook Cloud API**: `whatsapp-webhook` v42 (slug). Recebe no número 5511939471862
- **Edge function orçamento**: `ai-gerar-orcamento` v25 — usa `ai-shared/pricing-engine.ts` (motor Mubisys 9 passos)
- **Participantes grupo Croma/Beira Rio (WhatsApp)**:
  - Larissa (+55 11 94054-6886) — manda 90%+ dos briefings
  - Aline Saorin Beira Rio (+55 11 95163-8854) — campanhas/criativo
  - Viviane "Amor" (+55 11 96731-0547) — sócia Croma, admin do grupo
  - Junior "Você" (+55 11 98154-9118) — sócio Croma

## Tabela `stores` (descoberta crítica)

- 1573 stores ativas, 1261 com `code` preenchido (formato `NNNNNN-N` igual ao briefing Beira Rio)
- Origem: app Campo (campo-croma.vercel.app)
- Lookup que funciona: `WHERE code = '193056-1' OR corporate_name ILIKE '%LUCAS FLORINDO%' OR name ILIKE '%LUCAS%'`
- ⚠️ `stores.cliente_id` está vazio — não tem vínculo formal "loja é cliente da Beira Rio"
- Lojas são MULTIMARCAS/revendedores (clientes da Beira Rio), Croma adesiva pra Beira Rio

## Cronograma travado pra segunda 25/05

| Hora | Tarefa | Status |
|---|---|---|
| 09:00 | DELETE cliente duplicado `40ac91c3` (CNPJ fake 89012345000178) | aprovado Junior 24/05 |
| 09:15 | UPDATE cliente `5c015179` → razao_social='Beira Rio Sede RS', ativo=false | aprovado Junior 24/05 |
| 09:30 | Cadastrar material "Fita dupla face VHB" em `materiais` (se não existir) | task #16 |
| 09:45 | UPDATE `modelo_materiais` modelo PS 1mm: trocar parafuso/bucha por fita dupla face | task #16 |
| 10:00 | UPDATE `config_precificacao`: faturamento=110000, op=36800, prod=12000, qtd=2 | task #15 |
| 10:30 | Re-rodar dry-run PS 1mm 2.20×2.00m → comparar com R$ 1.078 Mubisys (sem add instalação) | validação |
| 11:00 | UPDATE system prompt webhook v42: preços reais, "São Paulo-SP" (era "Nova Hartz/RS"), produtos reais | task #10 |
| 14:00 | Criar Edge Function `briefing-beira-rio` v1 em modo shadow (extrai + calcula, manda card no Claudete sem enviar nada à BR) | task #8 |
| 17:00 | Notificar Junior no Telegram com relatório do dia | — |

## Pendentes do Junior (humanas)

- [ ] Confirmar com Viviane que ela vai encaminhar briefings pro Business Croma + receber cards no Claudete
- [ ] Garantir que Claudete bot Telegram está ativo pra Viviane (chat_id cadastrado)
- [ ] Aprovar 1º orçamento real do agente em modo shadow (terça/quarta)

## Tasks ativas (task tracker da sessão anterior)

```
✅ #1-#7, #13, #14   Pesquisa + decisões + verificações
⏳ #8   Webhook v43 — guard número interno + processBriefingInterno
⏳ #9   [Junior] Confirmar Viviane: encaminhar briefings + Claudete
🚨 #10  Calibrar system prompt webhook v42 (preços absurdos)
🟡 #11  Limpar duplicatas Beira Rio (em progresso — segunda)
⚠️ #12  Migrar credenciais sensíveis admin_config (Sem 2-3)
🟢 #15  config_precificacao atualizar (in_progress — segunda)
🔧 #16  Modelo PS 1mm: parafuso → fita dupla face
🔧 #17  Regra instalação SP embutida vs fora-SP separada
```

## Restrições / regras do Claude

- **Modo adversarial sempre que pedir auditoria/revisão** — questione premissas
- **Português BR**, termos técnicos em inglês (deploy, webhook, edge function, etc)
- **Tabelas + status visuais ✅⚠️❌** quando faz sentido
- **Nunca inventar dados** — sempre consultar via MCP Croma ou Supabase MCP
- **Shadow mode obrigatório** nos primeiros dias do agente — zero envio ao cliente sem aprovação
- **Aprovação humana SEMPRE** na Semana 1 (Viviane vê e clica antes de qualquer envio)
- **Domingo 31/05 = relatório com NÚMEROS** (orçamentos gerados, R$, tempo liberado, custo tokens, ROI). Se negativo, mata o agente
- **Notificar Junior via Telegram** quando tarefa longa terminar

## Frase de abertura sugerida pra próxima sessão

> "Sou Junior, retomando o trabalho do agente Orçamentista Beira Rio. Lê primeiro
> `C:\Users\Caldera\Claude\CRM-Croma\.planning\CONTINUACAO-2026-05-25.md` que tem
> todo o contexto necessário pra continuarmos sem repetir as decisões já tomadas.
> Depois lê REFUNDACAO-2026-05.md e cliente-beira-rio-briefing.md. Vamos arrancar
> direto pelo cronograma de segunda — pode começar pela limpeza dos duplicados."

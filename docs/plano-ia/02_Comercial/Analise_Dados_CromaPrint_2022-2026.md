# Análise de Dados Históricos — Croma Print

**Relatório Executivo | Dados do ERP Mubisys (2022–2026)**
**Preparado para:** Junior (Edmar Júnior)
**Data:** 23 de março de 2026

---

## 1. Visão Geral dos Dados

Foram analisados 5 arquivos de relatórios de orçamentos exportados do sistema Mubisys, cobrindo o período de janeiro de 2022 a março de 2026.

| Item | Valor |
|---|---|
| Total de orçamentos analisados | 1.192 |
| Período coberto | Jan/2022 a Mar/2026 |
| Valor total orçado | R$ 4.298.126,22 |
| Valor total aprovado | R$ 1.699.419,12 |
| Empresas distintas atendidas | 79 |
| Vendedora principal | Viviane Penninck (99,7% dos orçamentos) |

**Estrutura dos dados:** Cada registro contém número do orçamento, empresa, contato, telefone, descrição do trabalho, data de cadastro, validade, status (Aprovado/Em aberto/Reprovado), vendedor e valor total.

---

## 2. Evolução Anual

### Volume de Orçamentos e Faturamento Aprovado

| Ano | Orçamentos | Aprovados | Taxa Conversão | Faturamento Aprovado | Ticket Médio Aprovado |
|---|---|---|---|---|---|
| 2022 | 332 | 234 | 70,5% | R$ 426.425 | R$ 1.822 |
| 2023 | 314 | 242 | 77,1% | R$ 458.985 | R$ 1.897 |
| 2024 | 300 | 241 | 80,3% | R$ 487.907 | R$ 2.025 |
| 2025 | 189 | 117 | 61,9% | R$ 291.173 | R$ 2.489 |
| 2026* | 57 | 17 | 29,8%** | R$ 34.930 | R$ 2.055 |

*\* 2026 apenas até 14 de março.*
*\*\* Taxa de 2026 distorcida pois muitos orçamentos recentes ainda estão "em aberto".*

**Observações importantes:**

- De 2022 a 2024, houve melhoria consistente na taxa de conversão (70% → 80%), o que é excelente.
- O ticket médio aprovado subiu de R$ 1.822 para R$ 2.489, um crescimento de 37% em 3 anos.
- Porém, o volume de orçamentos caiu de 332 (2022) para 189 (2025), uma queda de 43%.
- O faturamento aprovado de 2025 (R$ 291 mil) caiu 40% em relação a 2024 (R$ 488 mil). Esse é o principal sinal de alerta.

### Produtividade Mensal

| Ano | Média de orçamentos/mês |
|---|---|
| 2022 | 27,7 |
| 2023 | 26,2 |
| 2024 | 25,0 |
| 2025 | 15,8 |

A queda para 15,8 orçamentos/mês em 2025 é preocupante e sugere menos demanda entrando ou menos prospecção ativa.

---

## 3. Dependência da Beira Rio — O Risco Principal

Este é, sem dúvida, o achado mais crítico de toda a análise.

| Ano | % Orçamentos Beira Rio | Faturamento Beira Rio | Faturamento Outros |
|---|---|---|---|
| 2022 | 67% | R$ 831.527 | R$ 273.022 |
| 2023 | 81% | R$ 1.522.980 | R$ 110.596 |
| 2024 | 88% | R$ 610.912 | R$ 89.051 |
| 2025 | 69% | R$ 535.378 | R$ 230.913 |
| 2026 | 82% | R$ 84.671 | R$ 9.076 |

A Calçados Beira Rio S/A representa entre 67% e 88% de todos os orçamentos e a grande maioria do faturamento. Isso configura uma dependência altíssima de um único cliente. Se a Beira Rio mudar de fornecedor ou reduzir demanda, o impacto para a Croma Print seria devastador.

**Lado positivo:** A Beira Rio é um cliente fiel (presente em todos os anos), com ticket médio crescente (R$ 1.959 em 2022 → R$ 2.707 em 2025), e demanda recorrente.

**Risco:** Uma empresa de 4 pessoas com 70-88% do faturamento vindo de um único cliente está em posição frágil.

---

## 4. Outros Clientes Relevantes

Fora a Beira Rio, os clientes que mais geraram faturamento:

| Empresa | Orçamentos | Valor Total |
|---|---|---|
| Pontal | 7 | R$ 146.566 |
| L. Paulistanas Calçados | 50 | R$ 102.001 |
| Poupa Farma | 29 | R$ 109.832 |
| Pampili | 55 | R$ 64.919 |

A L. Paulistanas e a Pampili são clientes recorrentes com bom volume, mas ainda representam uma fração pequena comparada à Beira Rio.

---

## 5. Serviços Mais Vendidos

A descrição do campo "Trabalho" costuma misturar nome do cliente/loja com tipo de serviço. Dos trabalhos identificáveis por categoria:

| Tipo de Serviço | Observação |
|---|---|
| **Camisetas** | Maior valor total aprovado (R$ 156 mil em 4 pedidos). Trabalhos pontuais mas de alto valor. |
| **Showroom** (comunicação visual de showrooms) | Recorrente, especialmente para Beira Rio. Ticket médio de R$ 5-12 mil. |
| **Banners / Banners Tecido** | Serviço frequente e recorrente, ticket médio de R$ 2-5 mil. |
| **Placas** | Demanda constante, ticket médio de R$ 2.800. |
| **Adesivos** | Serviço frequente, valores mais baixos. |
| **Puff / Mobiliário** | Pedidos pontuais mas de valor alto (R$ 8-16 mil). |
| **Quadros** | Demanda recorrente, valores variados. |

A Croma Print é essencialmente uma fornecedora de comunicação visual para lojas/showrooms de calçados, com capacidade de produzir banners, adesivos, placas, camisetas personalizadas e itens especiais.

---

## 6. Sazonalidade

Analisando o volume de orçamentos por mês (média de todos os anos):

| Período | Comportamento |
|---|---|
| **Janeiro-Fevereiro** | Pico de demanda (renovação de lojas para coleções de verão) |
| **Março** | Volume ainda bom |
| **Abril-Junho** | Queda moderada |
| **Julho** | Leve retomada |
| **Agosto-Setembro** | Variável (setembro teve pico pontual em 2022) |
| **Outubro** | Volume médio |
| **Novembro-Dezembro** | Queda forte (menor volume do ano) |

O primeiro trimestre é claramente o mais forte, provavelmente alinhado com o calendário de coleções das empresas de calçados. Novembro e dezembro são os meses mais fracos, o que pode parecer contraintuitivo, mas faz sentido: a produção para o fim de ano já foi feita antes.

---

## 7. Taxa de Conversão e Orçamentos Reprovados

| Ano | Reprovados | Valor Reprovado | Ticket Médio Reprovado |
|---|---|---|---|
| 2022 | 97 | R$ 670.703 | R$ 6.914 |
| 2023 | 45 | R$ 486.426 | R$ 10.809 |
| 2024 | 1 | R$ 1.756 | R$ 1.756 |
| 2025 | 3 | R$ 82.872 | R$ 27.624 |

Há uma mudança de padrão interessante: em 2022-2023, havia muitos orçamentos reprovados (97 e 45), mas a partir de 2024 quase não há reprovações. Isso pode significar que a Croma Print passou a orçar apenas trabalhos com alta probabilidade de aprovação (menos prospecção de novos clientes), ou que o sistema de registro mudou.

O valor dos reprovados em 2022 (R$ 671 mil) era maior que o faturamento aprovado (R$ 426 mil), sugerindo que havia tentativas de pegar trabalhos maiores que não se concretizavam.

---

## 8. Diagnóstico e Recomendações

### O que os dados mostram claramente:

1. **Dependência perigosa da Beira Rio.** Com 70-88% do faturamento em um único cliente, qualquer mudança nessa relação impacta diretamente a sobrevivência do negócio.

2. **Queda de volume em 2025.** A produtividade caiu de ~27 orçamentos/mês para ~16. Menos orçamentos entrando = menos faturamento.

3. **Ticket médio subindo.** O valor médio por trabalho aprovado cresceu consistentemente, o que é positivo — a Croma está conseguindo cobrar mais.

4. **Base de clientes encolhendo.** A concentração na Beira Rio aumentou de 67% (2022) para 88% (2024). Outros clientes estão sumindo.

5. **Viviane faz tudo.** 99,7% dos orçamentos são dela. Não há registro de outros vendedores atuando de forma consistente.

### Recomendações práticas para uma equipe de 4 pessoas:

**Curto prazo (próximos 3 meses):**
- Retomar contato com clientes inativos (Pampili, L. Paulistanas, Poupa Farma, Pontal) que já compraram antes
- Aproveitar janeiro-março (alta temporada) para maximizar o faturamento

**Médio prazo (3-12 meses):**
- Estabelecer meta de que a Beira Rio não ultrapasse 60% do faturamento
- Investir em prospecção ativa de novos clientes na região de Sao Paulo Capital (zona leste)
- Considerar ampliar os serviços de camisetas personalizadas (maior valor por pedido)
- Explorar parcerias com outras empresas de calçados (já conhecem o segmento)

**Longo prazo:**
- Diversificar a carteira para ter pelo menos 5-10 clientes regulares
- Usar o CRM (novo sistema) para acompanhar follow-up de orçamentos em aberto
- Criar processo de pós-venda para fidelizar clientes menores

---

## 9. Resumo dos Números-Chave

| Indicador | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|
| Orçamentos/ano | 332 | 314 | 300 | 189 |
| Orçamentos/mês | 27,7 | 26,2 | 25,0 | 15,8 |
| Taxa de conversão | 70,5% | 77,1% | 80,3% | 61,9% |
| Faturamento aprovado | R$ 426 mil | R$ 459 mil | R$ 488 mil | R$ 291 mil |
| Ticket médio aprovado | R$ 1.822 | R$ 1.897 | R$ 2.025 | R$ 2.489 |
| % Beira Rio (orçamentos) | 67% | 81% | 88% | 69% |
| Clientes ativos (aprox.) | ~40 | ~25 | ~15 | ~20 |

---

*Relatório gerado a partir da análise de 1.192 orçamentos exportados do sistema Mubisys.*
*Análise realizada em 23/03/2026.*

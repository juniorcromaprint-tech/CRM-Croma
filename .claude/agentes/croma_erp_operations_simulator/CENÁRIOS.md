# CENÁRIOS DE TESTE — SIMULADOR DE OPERAÇÕES CROMA_ERP

> Cenários organizados por nível de complexidade.
> O CROMA_MASTER_AGENT deve executar o Cenário 1 em toda sessão.
> Os demais são executados sob demanda ou em rotações periódicas.

---

## CENÁRIO 1 — PADRÃO OBRIGATÓRIO: Banner-Teste (Fluxo Completo)

Este é o cenário executado automaticamente em toda invocação do sistema.

### Produto de Teste

```
Nome:      Banner-Teste
Categoria: Banner
Tipo:      Sob encomenda

Variações (modelos):
  Banner 60x80   → L: 0,60m | A: 0,80m | Área: 0,48 m²
  Banner 70x100  → L: 0,70m | A: 1,00m | Área: 0,70 m²
  Banner 90x120  → L: 0,90m | A: 1,20m | Área: 1,08 m² ← FOCO DO TESTE
```

### Composição BOM (Banner 90x120 — 1 unidade)

| Material | Quantidade | Unidade | Preço Ref. | Custo |
|----------|-----------|---------|-----------|-------|
| Lona 440g | 1,08 | m² | R$ 8,50/m² | R$ 9,18 |
| Bastão alumínio (sup.) | 0,92 | m | R$ 12,00/m | R$ 11,04 |
| Bastão alumínio (inf.) | 0,92 | m | R$ 12,00/m | R$ 11,04 |
| Ponteira plástica | 4 | un | R$ 1,20/un | R$ 4,80 |
| Cordinha nylon | 0,50 | m | R$ 0,80/m | R$ 0,40 |
| Tinta HP Latex | 150 | ml | R$ 0,045/ml | R$ 6,75 |
| **TOTAL** | | | | **R$ 43,21** |

### Máquinas Disponíveis

| Máquina | Boca | Compatível com 90x120? |
|---------|------|----------------------|
| Ampla Targa XT | 1,80m | ✅ Sim |
| HP Latex | 1,60m | ✅ Sim |

### Dados do Cliente Fictício

```
Empresa:   Papelaria São Lucas Ltda
CNPJ:      34.567.890/0001-12
IE:        123.456.789.110
Contato:   Rafael Mendonça
Cargo:     Gerente de Marketing
E-mail:    rafael@papelariaslucas.com.br
Telefone:  (11) 99234-5678
Endereço:  Rua das Flores, 892, Sala 3
Bairro:    Vila Mariana
Cidade:    São Paulo / SP
CEP:       04117-010
```

### Dados do Orçamento

```
Produto:   Banner-Teste, modelo 90x120
Quantidade: 10 unidades
Prazo:     5 dias úteis
Condições: Boleto 30 dias
Observação: Arte já aprovada
```

### Valores Esperados

```
Custo unitário:        R$    43,21
Markup aplicado:       3,5×
Preço de venda (ref.): R$   151,24
Total 10 unidades:     R$ 1.512,40
Impostos (ref.):       R$   236,69
```

### Distribuição de Sub-Agentes por Passo

| Passo | Descrição | Sub-Agente Responsável |
|-------|-----------|----------------------|
| 1 | Cadastrar matéria-prima | AGENTE_ENGENHARIA |
| 2 | Criar produto | AGENTE_ENGENHARIA |
| 3 | Criar variações | AGENTE_ENGENHARIA |
| 4 | Compor produto | AGENTE_ENGENHARIA |
| 5 | Gerar lead | AGENTE_COMERCIAL |
| 6 | Converter lead em cliente | AGENTE_COMERCIAL |
| 7 | Criar orçamento | AGENTE_COMERCIAL |
| 8 | Enviar proposta | AGENTE_COMERCIAL |
| 9 | Simular aprovação | AGENTE_COMERCIAL |
| 10 | Gerar ordem de serviço/pedido | AGENTE_COMERCIAL |
| 11 | Executar produção | AGENTE_PRODUCAO |
| 12 | Finalizar produção | AGENTE_PRODUCAO |
| 13 | Enviar ao financeiro | AGENTE_FINANCIAL |
| 14 | Emitir nota fiscal | AGENTE_FINANCIAL |
| 15 | Emitir boleto | AGENTE_FINANCIAL |
| 16 | Liberar para entrega/instalação | AGENTE_PRODUCAO |
| 17 | Validar integração App de Campo | AGENTE_PRODUCAO |

**Auditoria**: AGENTE_AUDITOR executa ao final (Fase 5).

---

## CENÁRIO 2 — FOCO: Motor de Precificação

**Objetivo**: Testar isoladamente o cálculo de preços com múltiplas variações.

**Executar**: apenas AGENTE_ENGENHARIA + AGENTE_COMERCIAL

| Variação | Custo esperado | Preço esperado (3,5×) |
|----------|---------------|----------------------|
| Banner 60x80 | R$ 22,48 | R$ 78,68 |
| Banner 70x100 | R$ 32,06 | R$ 112,21 |
| Banner 90x120 | R$ 43,21 | R$ 151,24 |

**Verificar**: os três modelos calculam custo e preço proporcionais à área.

**Red flag**: qualquer modelo com custo = R$ 0,00 → ERR CRÍTICO.

---

## CENÁRIO 3 — FOCO: Integração App de Campo

**Objetivo**: Testar isoladamente a bridge ERP ↔ Campo.

**Executar**: apenas AGENTE_PRODUCAO (passos 16-17) + AGENTE_AUDITOR

**Pré-requisito**: existir um pedido faturado no sistema.

**Verificações específicas**:
```sql
-- Bridge: trigger cria job ao agendar OI
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_create_job_from_ordem';

-- Views da bridge retornam dados
SELECT COUNT(*) FROM vw_campo_instalacoes;
SELECT COUNT(*) FROM vw_campo_fotos;

-- Sincronização de status
SELECT j.status, oi.status
FROM jobs j
JOIN ordens_instalacao oi ON j.ordem_instalacao_id = oi.id
WHERE j.deleted_at IS NULL;
-- jobs.status e oi.status devem ser consistentes
```

---

## CENÁRIO 4 — FOCO: Fluxo Financeiro

**Objetivo**: Testar isoladamente o módulo financeiro e fiscal.

**Executar**: apenas AGENTE_FINANCIAL + AGENTE_AUDITOR

**Pré-requisito**: existir um pedido com produção concluída.

**Verificar**:
- Valor do pedido = valor da NF-e = valor do boleto
- Impostos calculados corretamente
- Pagamento registrado libera pedido para expedição

---

## CENÁRIO 5 — FOCO: Dados de Borda (Edge Cases)

**Objetivo**: Testar limites e casos não convencionais.

**Executar**: AGENTE_COMERCIAL + AGENTE_ENGENHARIA + AGENTE_AUDITOR

| Caso | Dado | Comportamento esperado |
|------|------|----------------------|
| Quantidade zero | Qty = 0 | Sistema bloqueia |
| Valor negativo | Preço = -R$ 10 | Sistema bloqueia |
| CNPJ inválido | CNPJ = 00.000.000/0000-00 | Sistema valida e rejeita |
| Data no passado | Entrega = ontem | Sistema alerta |
| E-mail inválido | E-mail = "nao@e@email" | Sistema valida e rejeita |
| Produto sem composição | Orçamento com produto sem BOM | Sistema alerta custo zero |
| Cliente sem IE (PF) | IE = isento | Sistema aceita com flag PF |

---

## CENÁRIO 6 — FOCO: Regressão Pós-Deploy

**Objetivo**: Verificar que deploys não quebraram funcionalidades existentes.

**Executar**: todos os sub-agentes em modo rápido (verificações básicas)

**Checklist rápido** (cada item deve ser ✅ em menos de 2 minutos):
- [ ] Login no ERP funciona
- [ ] Orçamento pode ser criado e salvo
- [ ] Produto aparece na listagem
- [ ] Portal de proposta abre sem login
- [ ] Módulo fiscal acessível
- [ ] App de Campo acessível

---

## Dados Fictícios Extras

### Clientes Adicionais (para variação)

```
Cliente 2:
  Empresa:  Calçados Vêneto SA
  CNPJ:     12.345.678/0001-90
  Contato:  Juliana Ferreira
  Cidade:   Novo Hamburgo / RS

Cliente 3:
  Empresa:  Supermercados Bom Dia Ltda
  CNPJ:     98.765.432/0001-11
  Contato:  Carlos Andrade
  Cidade:   Belo Horizonte / MG

Cliente 4 (PF):
  Nome:     Marcos Souza
  CPF:      123.456.789-09
  Cidade:   Curitiba / PR
```

### Produtos Adicionais (para testes futuros)

```
Produto: Faixa-Lona-Teste
  Variação padrão: 1,00 × 3,00m
  Material: Lona 440g + ilhós
  Processo: Impressão + acabamento

Produto: Adesivo-Teste
  Variação padrão: 0,50 × 1,00m
  Material: Vinil adesivo + laminado
  Processo: Impressão + recorte

Produto: Placa-ACM-Teste
  Variação padrão: 1,22 × 2,44m
  Material: ACM 3mm + estrutura
  Processo: Impressão + corte + instalação
```

---

## Referência Cruzada

Para detalhamento completo dos 17 passos, consultar também:
```
.claude/agentes/croma_erp_qa_agent/CENÁRIOS_DE_TESTE.md
```

Os dois sistemas usam o mesmo cenário padrão (Banner-Teste) —
a diferença é a arquitetura de execução (1 agente vs. multi-agente).

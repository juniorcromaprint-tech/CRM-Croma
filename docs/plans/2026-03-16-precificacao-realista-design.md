# Precificação Realista — Design

> Data: 2026-03-16 | Status: Aprovado

## Contexto

Motor de precificação Mubisys com valores desconectados da realidade. Empresa tem 3 pessoas (2 sócios + 1 funcionário), faturamento R$30k/mês, mas sistema estava configurado para 6 funcionários e R$110k.

## Dados Reais da Empresa

| Parâmetro | Valor Real |
|-----------|-----------|
| Faturamento médio | R$ 30.000/mês |
| Custo produtivo (MO) | R$ 16.400/mês (2 sócios R$7k cada + 1 func. R$2.400) |
| Qtd pessoas produção | 3 |
| Aluguel + condomínio | R$ 3.000 |
| Energia elétrica | R$ 350 |
| Internet/telefone | R$ 400 |
| Outros fixos | R$ 700 |
| Retirada total sócios | ~R$ 20.000 (diferença ~R$3.600 além do pró-labore implícito) |
| Custo operacional total | ~R$ 24.850 |
| Encargos trabalhistas | 0% (funcionário sem registro, parente) |

## Máquinas da Empresa

1. Impressora base solvente (custo/m² baixo)
2. HP Latex 365 (custo/m² alto — tinta cara)
3. Plotter de recorte
4. Router CNC de corte
5. Laminadora
6. Máquina de solda banner

## 6 Itens de Implementação

### 1. Fix Cache Config (Bug)
- Admin salva config_precificacao → hook tem staleTime 5min → orçamento usa valor antigo
- Solução: `queryClient.invalidateQueries({ queryKey: ["config_precificacao"] })` após salvar
- Arquivo: `src/domains/admin/pages/AdminPrecificacaoPage.tsx`

### 2. Aproveitamento Default por Categoria
- Default atual: 100% (zero desperdício) — irreal
- Adicionar campo `aproveitamento_padrao` em `regras_precificacao`
- Valores por categoria:
  - banner/backdrop: 90%
  - adesivo: 85%
  - fachada/placa/painel: 85%
  - letreiro/totem: 80%
  - envelopamento: 75%
  - geral/pdv: 85%
- `orcamento-pricing.service.ts` usa esse valor quando usuário não preenche

### 3. Cadastro de Máquinas + Custo no Motor
- Nova tabela `maquinas`:
  - id, nome, tipo (impressao|corte|acabamento), custo_hora, custo_m2, ativo, created_at, updated_at
- Nova tabela `orcamento_item_maquinas`:
  - id, proposta_item_id, maquina_id, tempo_minutos (ou area_m2 calculada), custo_calculado
- Tela admin `/admin/maquinas`: CRUD simples (6 máquinas iniciais)
- No orçamento: seletor de máquinas por item
- Motor Passo 6 revisado: `Custo Base = (MP + MO + Máquinas) × (1 + P%)`
- Cálculo: máquinas com custo/m² usam área do item; máquinas com custo/hora usam tempo do processo

### 4. Encargos Trabalhistas (Campo Configurável)
- Novo campo `percentual_encargos` em `config_precificacao` (default 0%)
- Motor aplica: `MO efetiva = custoProdutivo × (1 + encargos%/100)`
- Configurável pra futuro (70% se registrar funcionário)

### 5. Preço/m² Mínimo Bloqueia
- Validação atual só avisa (alerta amarelo)
- Mudar: alerta vermelho + desabilitar botão "Salvar" quando preço/m² < mínimo da categoria
- Mensagem clara com valores

### 6. Defaults Realistas no Código
- Atualizar `DEFAULT_PRICING_CONFIG` em `pricing-engine.ts`:
  - faturamentoMedio: 30_000
  - custoOperacional: 24_850
  - custoProdutivo: 16_400
  - qtdFuncionarios: 3
  - horasMes: 176
  - percentualComissao: 5
  - percentualImpostos: 12
  - percentualJuros: 2

## O que NÃO fazer (YAGNI)
- Cálculo automático de encargos por regime tributário
- Histórico de configs
- Depreciação automática de máquinas
- Integração com contabilidade

# Auditoria UX — Módulo de Orçamento

> Atualizado em: 2026-03-10 | Status: Auditado — implementação parcial

---

## Personas

### Vendedor
- **Perfil**: Comercial que atende redes, franquias e novos clientes
- **Meta principal**: Criar orçamentos rápidos com preço correto para fechar negócios
- **Dor maior**: Digitar tudo manualmente, não saber se o preço está bom
- **Frequência de uso**: Diário (5–10 orçamentos/semana)

### Admin / Gerente Comercial
- **Perfil**: Acompanha pipeline, aprova descontos, configura tabelas de preço
- **Meta principal**: Garantir margem mínima, visão de conversão do funil
- **Dor maior**: Orçamentos com margem negativa passando sem revisão
- **Frequência de uso**: Diário (monitoramento) + semanal (revisões)

### Financeiro
- **Perfil**: Analisa rentabilidade, fecha mês, acompanha comissões
- **Meta principal**: Ver custo real vs preço vendido; auditar descontos
- **Dor maior**: Dados de custo inconsistentes, sem rastreabilidade
- **Frequência de uso**: Semanal (revisão) + mensal (fechamento)

### Técnico / Operações
- **Perfil**: Produção e instalação — recebe o pedido e executa
- **Meta principal**: Entender o que foi vendido (materiais, medidas, acabamentos)
- **Dor maior**: Orçamento incompleto ou sem especificações técnicas claras
- **Frequência de uso**: Por demanda (ao receber nova ordem de produção)

---

## Fluxo Atual vs Fluxo Ideal

### Vendedor — Criar Orçamento

| Etapa | Fluxo Atual | Fluxo Ideal | Gap |
|---|---|---|---|
| 1. Iniciar | Clica "Novo Orçamento", digita título, seleciona cliente | Idem — OK | Nenhum |
| 2. Salvar | Obrigatório salvar antes de adicionar itens | Idem — OK | Nenhum |
| 3. Adicionar item | Passo 1: seleciona produto + modelo | Idem + carregar materiais automaticamente do modelo | Modelos não carregam materiais |
| 4. Materiais | Aparece lista vazia, usuário adiciona manualmente | Pré-preenchido do catálogo, ajuste fino de qtd | Lista sempre vazia |
| 5. Acabamentos | Não existe seletor | Checkboxes com opções do modelo | Funcionalidade ausente (migration 006) |
| 6. Precificação | PricingCalculator mostra R$ 0,00 | Cálculo Mubisys em tempo real com materiais | Sem dados = sem cálculo |
| 7. Revisar | Passo 3 mostra alertas e resumo | Idem + margem real + comparativo de markup | Alertas presentes, mas dados zerados |
| 8. Duplicar | Disponível na lista de orçamentos | Idem — OK | Nenhum |
| 9. Converter | Botão "Converter em Pedido" na view | Idem — OK | Nenhum |

### Admin — Configurar Precificação

| Etapa | Fluxo Atual | Fluxo Ideal | Gap |
|---|---|---|---|
| 1. Acessar configuração | `/admin/precificacao` funcional | Idem | Nenhum |
| 2. Editar parâmetros globais | Sliders e campos editáveis | Idem + histórico de alterações | Sem histórico |
| 3. Regras por categoria | UI existe, tabela ausente no banco | Regras salvas e aplicadas automaticamente | Tabela `regras_precificacao` ausente (migration 006) |
| 4. Ver impacto | Nenhum | Simulador: "se markup virar X, margem fica Y" | Inexistente |

---

## Gaps por Grau de Impacto

### Impacto Alto — Bloqueia uso real

| Gap | Causa | Onde no Código |
|---|---|---|
| Materiais nunca preenchidos automaticamente | `modelo_materiais` com 0 registros no banco | `useProdutosModelos.ts` + banco |
| Preço sempre R$ 0,00 | Motor recebe arrays vazios | `useOrcamentoPricing.ts` → `pricing-engine.ts` |
| Acabamentos inacessíveis | Tabela `acabamentos` não existe (migration 006 pendente) | `OrcamentoEditorPage.tsx` passo 2 |
| Regras de markup por categoria inoperantes | Tabela `regras_precificacao` ausente | `useOrcamentoPricing.ts` |
| Templates inexistentes | Tabela `templates_orcamento` ausente | `useTemplates.ts` |
| Item adicionado não pode ser editado | Sem handler de edição — só exclusão e readição | `OrcamentoEditorPage.tsx` |

### Impacto Médio — Degrada experiência

| Gap | Causa | Solução Sugerida |
|---|---|---|
| Markup padrão fixo em 40% | Não lê regras da categoria | Implementar `regras_precificacao` |
| Nenhum feedback de margem real durante edição | Preço = 0 mascara o problema | Resolver os gaps de impacto alto primeiro |
| Sem indicação de progresso nos 3 passos | Wizard sem stepper visual claro | Adicionar componente `Stepper` com passos numerados |
| Validação de medidas inconsistente | Campos livres sem limites de negócio | Adicionar validação Zod para dimensões mínimas/máximas |
| Sem atalho para "adicionar item similar" | Usuário refaz tudo para item parecido | Botão "duplicar item" dentro do editor |
| Descrição do item é campo livre | Sem sugestão automática baseada no produto | Auto-completar com nome do produto + dimensões |

### Impacto Baixo — Melhoria de conforto

| Gap | Solução Sugerida |
|---|---|
| Sem ordenação de itens do orçamento | Drag-and-drop ou botões ↑↓ |
| Validade padrão não configurável | Adicionar campo `validade_padrao_dias` na config |
| Sem preview de impressão dentro do editor | Link para `OrcamentoViewPage` durante edição |
| Condições de pagamento sem opções padrão | Dropdown com opções: À vista, 30/60/90, 50%+50% |
| Sem contagem de itens no cabeçalho do orçamento | Badge numérico no título da seção Itens |

---

## Status Atual do Editor (3 Passos Implementados)

### Passo 1 — Produto + Cliente

**O que funciona:**
- Seletor de produto (`produto_id`) busca do banco
- Seletor de modelo (`modelo_id`) filtra por produto
- Campo de quantidade com validação numérica básica
- Campo de dimensões (largura × altura)

**O que não funciona:**
- Ao selecionar modelo, materiais NÃO são carregados automaticamente
- Processos de produção NÃO são carregados do modelo

---

### Passo 2 — Medidas + Materiais + Acabamentos

**O que funciona:**
- Campos de largura/altura/área calculada
- Lista de materiais (pode adicionar manualmente)
- Interface de acabamentos renderiza (mas sem dados do banco)

**O que não funciona:**
- Materiais do modelo não aparecem pré-preenchidos
- Acabamentos: seletor presente mas sem dados (tabela ausente)
- PricingCalculator mostra R$ 0,00 pois recebe arrays vazios

---

### Passo 3 — Revisão + Alertas + Resumo

**O que funciona:**
- Componente `ResumoVendedor` renderiza corretamente
- Alertas de markup e margem são exibidos (quando há dados)
- Campo de observações / condições comerciais
- Botão salvar item funciona (persiste o que tem)

**O que não funciona:**
- Alertas baseados em dados zerados — sempre indicam "margem insuficiente"
- Não mostra breakdown de custos (MP, MO, fixos)
- Não compara com histórico de preços do cliente

---

## Componentes Disponíveis e Uso

| Componente | Localização | Onde é Usado | Status |
|---|---|---|---|
| `OrcamentoEditorPage` | `domains/comercial/pages/` | Rota `/orcamentos/:id/editar` | Parcial — 3 passos |
| `OrcamentosPage` | `domains/comercial/pages/` | Rota `/orcamentos` | Funcional |
| `OrcamentoViewPage` | `domains/comercial/pages/` | Rota `/orcamentos/:id` | Funcional |
| `PricingCalculator` | `domains/comercial/components/` | Dentro do editor | Retorna R$ 0,00 |
| `ResumoVendedor` | `domains/comercial/components/` | Passo 3 do editor | Renderiza com dados zerados |
| `TemplatesPage` | `domains/comercial/pages/` | Rota `/orcamentos/templates` | Inoperante (tabela ausente) |
| `AdminPrecificacaoPage` | `domains/admin/pages/` | Rota `/admin/precificacao` | Parcial — config global OK, regras ausentes |

---

## Recomendações de UX para Futuras Versões

### Curto Prazo (próximo sprint)
1. **Resolver dados zerados primeiro** — sem isso, toda a UX é enganosa. Prioridade absoluta.
2. **Stepper visual claro** — barra de progresso com "Passo 1 de 3" e validação por passo.
3. **Edição de item existente** — atualmente só é possível excluir e readicionar.
4. **Autocompletar descrição** — usar `produto.nome + dimensões` como sugestão de título do item.

### Médio Prazo
5. **Templates de orçamento** — executar migration 006, criar 3 templates padrão (Fachada, Banner, Kit PDV).
6. **Comparativo de versões** — ao duplicar orçamento, permitir comparar preços lado a lado.
7. **Histórico de aprovações** — linha do tempo de status (Rascunho → Enviado → Aprovado).
8. **Simulador de desconto** — slider mostra nova margem ao aplicar X% de desconto.

### Longo Prazo
9. **Integração com catálogo visual** — foto do produto no seletor de modelo.
10. **Sugestão de preço baseada em histórico** — "Você vendeu banner similar por R$ X antes".
11. **Aprovação com assinatura digital** — cliente recebe link, visualiza e assina online.
12. **Geração de PDF customizável** — templates de proposta com logo e cores da Croma.

# ANÁLISE COMPLETA DO SISTEMA MUBISYS
## Referência para construção do sistema integrado Croma Print

> **Data da análise**: 2026-03-09 (atualizado)
> **Usuário analisado**: Edmar Júnior (junior@cromaprint.com.br) | Conta Croma Print do Brasil: 562416
> **Objetivo**: Mapear 100% das funcionalidades para replicar/superar no sistema integrado próprio

---

## 1. VISÃO GERAL TÉCNICA

**Mubisys** é um SaaS para empresas de comunicação visual (gráficas, plotagem, fachadas).
- **Arquitetura**: PHP monolítico, single-entry-point `index.php?modulo=X&acao=Y`
- **Frontend**: jQuery + Bootstrap + jquery.mask + alertify (sem framework moderno)
- **Backend**: PHP, respostas HTML ou JSON via POST AJAX
- **Proteção CSRF**: bloqueia navegação direta por URL — obrigatório clicar nos menus
- **Integração WhatsApp**: MubiChat (API Oficial do WhatsApp)
- **Módulo de IA**: "Árvore de decisões" para precificação automatizada

**Conclusão técnica**: Sistema legado. O app React/Supabase da Croma Print é tecnicamente superior. A missão é adicionar os **módulos comerciais e de produção faltantes** aproveitando a stack moderna já existente.

---

## 2. MAPA COMPLETO DE MÓDULOS

| Módulo | Sub-módulo | Prioridade p/ replicar |
|---|---|---|
| **Calendário** | Agenda compartilhada | MÉDIA |
| **Administração** | Cadastros (produtos, MP, equipamentos, veículos) | **CRÍTICA** |
| | Quadro de avisos | BAIXA |
| | Gestão a vista (dashboard) | ALTA |
| | Relatórios | ALTA |
| | Avaliação clientes | MÉDIA |
| **Comercial** | Atendimentos | ALTA |
| | **Funil de vendas (CRM Kanban)** | ALTA |
| | **Orçamentos** | **CRÍTICA** |
| | **Ordens de serviços** | **CRÍTICA** |
| | Campanhas | MÉDIA |
| | **Clientes** | **CRÍTICA** |
| | FTP Arquivos | BAIXA |
| **Financeiro** | Fluxo de caixa | ALTA |
| | Colaboradores | MÉDIA |
| | **Contas a pagar** | ALTA |
| | **Contas a receber** | ALTA |
| | Fiscal / SPED | BAIXA (usar Omie/Bling) |
| | Monitor de notas | MÉDIA |
| | O.Ss com restrição | ALTA |
| | Lançamentos futuros | MÉDIA |
| | Faturamento | ALTA |
| **Suprimentos** | Fornecedor | MÉDIA |
| | Compras | MÉDIA |
| | Estoque | MÉDIA |
| **Produção** | PCP (Planejamento) | ALTA |
| | Produção | ALTA |
| | Almoxarife | MÉDIA |
| | Diário de bordo | BAIXA |
| | Acompanhamento produção | ALTA |
| **Sistema** | Usuários + Permissões | ALTA |
| | Gerenciador de arquivos | BAIXA |
| | Log de acesso | MÉDIA |

---

## 3. METODOLOGIA DE PRECIFICAÇÃO — CUSTEIO DIRETO

> **Fonte oficial**: PDF "Formação de preço" do Mubisys (3 páginas, Adobe Illustrator, 2022)

### 3.1 Por que Custeio Direto?

O Mubisys usa **CUSTEIO DIRETO** porque:
- Comunicação visual mistura setores (impressão, serralheria, instalação)
- O rateio do custo fixo é igual para todos
- Aplica o rateio também na matéria prima (materiais são frágeis e de fácil perda — um corte errado gera prejuízo maior que a própria mão de obra)
- Deixa os preços menos sujeitos a prejuízo

### 3.2 As 9 Etapas do Cálculo

#### Etapa 1 — Levantamento de toda a matéria prima usada
Exemplo (Painel em lona):
```
Estrutura metalon:   R$ 123,33
Rebites:             R$   4,80
Lona impressa:       R$  40,80
─────────────────────────────
Total MP (Vmp):      R$ 168,93
```

#### Etapa 2 — Levantamento do tempo produtivo interno
```
1 - Estrutura metalon:    40 minutos
2 - Impressão de lona:    20 minutos
3 - Esticar lona quadro:  20 minutos
4 - Expedir o produto:     3 minutos
──────────────────────────────────
Total produtivo (T):      83 minutos
```

#### Etapa 3 — Percentual sobre custos fixos (P%)
```
Variáveis:
  F  = Faturamento médio (média dos últimos 12 meses)
  C  = Custo Operacional (Despesas fixas + Operacional + Colaboradores + Depreciação)
  CP = Custo Produtivo (Salários + encargos dos colaboradores de produção)

Fórmula SEM colaboradores produtivos:
  P = (C × 100) / F
  Exemplo: P = (36.800 × 100) / 110.000 = 33,45%

Fórmula COM colaboradores produtivos (mais comum):
  P = ((C - CP) × 100) / F
  Obs: Os colaboradores de produção são cobrados em minutos (etapa 4)
```

#### Etapa 4 — Custo por minuto produtivo (Cm)
Exemplo de tabela de colaboradores produtivos:
```
Cargo          | Salário  | Qtd | Custo mensal
─────────────────────────────────────────────
Serralheiro    | 2.800,00 |  1  |  4.480,00
Montador       | 2.200,00 |  2  |  7.040,00
Ajudante       | 1.300,00 |  2  |  4.160,00
Impressor      | 1.680,00 |  1  |  2.688,00
─────────────────────────────────────────────
Total folha (Fp)                 23.744,00

Fórmula (176h/mês com 20% ociosidade):
  Cm = ((Fp / Qf) / 176) / 60
  Cm = ((23.744 / 8) / 176) / 60
  Cm = R$ 0,28 / minuto

Custo MO do painel:
  Total MO = T × Cm = 83 × 0,28 = R$ 23,24
```

#### Etapa 5 — Percentual de custos de venda (Pv)
```
Comissão de venda:       5%
Impostos sobre venda:   12%
Juros a serem cobrados:  2%
──────────────────────────
Pv (Percentual de venda): 19%
```

#### Etapa 6 — Custo base (Vb)
```
Vmm = Valor Matéria + Minuto = MP + MO
Vb  = Vmm + (Vmm × P/100)   ← aplica custo fixo proporcional

Exemplo:
  Vmm = 168,93 + 23,24 = 192,17
  Custo fixo = 192,17 × 33,45/100 = 25,85  (← aplicado sobre Vmm)
  Vb = 192,17 + 25,85 = 218,02
```

#### Etapa 7 — Valor antes do markup (Vam)
```
Fórmula: Vam = Vb / (1 - Pv)
Exemplo: Vam = 218,02 / (1 - 0,19) = 218,02 / 0,81 = 269,16
```

#### Etapa 8 — Aplicando o markup (Vm)
```
Pm = Percentual markup desejado (configurado no produto, ex: 40%)
Vm = Valor Markup

Vm = Vam × Pm         → Vm = 269,16 × 0,40 = 107,66
Vm ajustado = Vm / (1 - Pv)  → 107,66 / 0,81 = 132,91
```

#### Etapa 9 — Valor final de venda (Vv)
```
Vv = Vam + Vm = 269,16 + 132,91 = R$ 402,07
```

### 3.3 Validação de Margem Líquida (Exemplo Painel em Lona)

| Componente | Valor | % |
|---|---|---|
| **Valor de venda** | **R$ 402,07** | **100,00%** |
| Matéria prima | R$ 168,93 | 42,01% |
| Mão de obra produtiva | R$ 23,24 | 5,78% |
| Custo fixo | R$ 47,68 | 11,86% |
| Impostos | R$ 48,24 | 12,00% |
| Comissão | R$ 20,10 | 5,00% |
| **Custos totais** | **R$ 308,19** | **76,66%** |
| **Margem líquida** | **R$ 93,88** | **23,34%** |

### 3.4 Parâmetros configuráveis por produto

- **Mark-up**: índice multiplicador (ex: 100 para Banner = 100%, 40% no exemplo do PDF)
- **Margem líquida padrão**: margem desejada para o produto
- **Limite comercial** (Margem mínima): piso para negociação do vendedor
- **Preço final fixo**: override manual de preço
- **Preço por demanda**: faixas de quantidade com preços diferentes (escalonado)

---

## 4. ESTRUTURA COMPLETA DO ORÇAMENTO

### 4.1 Cabeçalho / Identificação

```
Cliente        → Busca com: estrelas (rating), CNPJ, telefone, classificação, origem
Contato        → Dropdown (adicionar novo: +)
Vendedor       → Usuário responsável
Atendente      → Usuário do atendimento
Status         → Rascunho | Aprovado | Enviado | Recusado | Convertido em OS
Endereço entrega → (adicionar novo: +)
Enviado por    → Canal de envio
Tabela de preço → Tabela aplicada ao cliente
```

### 4.2 Dados do Trabalho

```
Trabalho       → Nome/descrição do trabalho
Logística      → Cliente Retira | Entrega própria | Instalado | Transportadora | Correios
Campanha       → Vínculo com campanha
Prazo entrega  → Data
Validade       → Data de validade do orçamento
```

### 4.3 Comissões / Premiações

```
Tabela multi-linha:
  Pessoa + % + Tipo (Interno | Externo)
  [pode ter múltiplas pessoas]
```

### 4.4 Outros Custos

```
Outros: Custos diversos
Hora homem:   Tabela com: view | edit | copy | delete por item
```

### 4.5 Itens do Orçamento — 3 abas

**Aba "Produtos"** (principal):
```
1. Selecione produto   → dropdown hierárquico (produto > modelo > variação)
2. Equipamentos        → dropdown de equipamentos para o produto
3. Acabamentos         → dropdown de acabamentos
4. Largura             → número (m)
5. Altura              → número (m)
6. Espessura           → número (m) [quando aplicável]
7. Quantidade          → número
8. Valor               → calculado automaticamente (MP+MO+Markup) ou manual
   Botões: "Incluir e abrir" | "Incluir"
```

**Aba "Venda direta"**:
```
Selecione matéria prima diretamente (sem produto/modelo)
Quantidade + valor
```

**Aba "Agrupados"**:
```
Conjuntos pré-agrupados de produtos
```

### 4.6 Navegação entre itens

```
◄ item anterior | item N de M | item seguinte ►
Imagens de visualização: upload de arquivos
```

### 4.7 Gráfico de breakdown de custos (donut)

```
MP  = Matéria Prima
CF  = Custo Fixo
MO  = Mão de Obra
TF  = Terceirizado Fixo (?)
CI  = Custo Interno (?)
CE  = Custo Externo (?)
TB  = Tributação (?)
TR  = Trabalho (?)
DT  = Despesas de transporte (?)
ML  = Margem Líquida
```

### 4.8 Financeiro / Fechamento

```
Forma de pagamento     → Tipo (boleto, PIX, cartão...)
Condições de pagamento → Parcelamento/prazo
Faturamento            → Emissão da NF

Total                  → R$
Descontos              → R$ ou %
Valor final            → R$
Saldo a pagar          → R$
```

### 4.9 Observações (3 campos separados)

```
1. Observações para o cliente (aparece na proposta PDF)
2. Observações para a produção (aparece na OS)
3. Observações para o financeiro (aparece no financeiro)
```

### 4.10 Botões de ação

```
Opções | Visualizar (gera PDF) | Finalizar | Fechar
```

---

## 5. ESTRUTURA DO CADASTRO DE PRODUTOS (14 seções)

Cada produto/modelo tem 14 abas de configuração:

### Seção 1 — Informações gerais
```
Produto          → Nome do produto (categoria)
Categoria        → Grupo/família
Modelo           → Variante do produto (ex: Banner 60x80, Banner 90x120)
Acabamento       → Tipo de acabamento
Unidade          → m² | m linear | unidade | etc.
Tamanho do item  → L × A × E (largura, altura, espessura padrão)
Alterar produção → Toggle
Plano de contas  → Vinculo contábil
Permitir estoque → Toggle
Peso             → kg
Campo adicional  → Campo extra para formação de preço
```

### Seção 2 — Comercial
```
Mark-up                  → índice (ex: 100)
Margem líquida padrão    → % mínima padrão
Preço final              → override de preço fixo
Descrição para o cliente → Rich text com ícones (aparece na proposta)
Etiqueta                 → Tag/rótulo
Limite comercial         → Margem mínima para negociação (piso do vendedor)
Preço por demanda        → Tabela quantidade × preço escalonado
```

### Seção 3 — Processos
Cada processo tem: checkbox (ativo/inativo) + minutos + unidade + complexidade
```
Criação          → min/unidade
Arquivos         → min/m² (ex: 2 min/m²)
Impressão        → min/m² (ex: 10 min/m²)
Router           → min/m²
Acabamentos      → min/m²
Serralheria      → min/unidade
Expedição        → min/m² (ex: 1 min/m²)
Instalação       → min/unidade
Terceirizados    → min + valor
```

### Seção 4 — Fiscal
```
NCM, CSOSN, Alíquotas ICMS, PIS, COFINS
```

### Seção 5 — Matéria prima
```
Toggle: Impressão dupla-face
Toggle: Usinagem como serviço

Tabela de materiais:
  Nome MP | Equipamentos | Acabamentos | Unidade | Quantidade |
  Largura | Altura | Espessura | Descritivo | Simulador de consumo |
  Valor MP/unit | Subtotal
```

### Seção 6 — Questionário
```
Perguntas configuráveis a serem respondidas no orçamento
```

### Seção 7 — Variações
```
Variantes do produto (ex: diferentes acabamentos, materiais)
```

### Seção 8 — Serviços de terceiros
```
Serviços externos contratados (ex: instalação terceirizada)
```

### Seção 9 — Produtos complementares
```
Produtos que são sugeridos/obrigatórios junto
```

### Seção 10 — Condições para orçamentos
```
Regras de aplicação do produto em orçamentos
```

### Seção 11 — Ficha técnica
```
Especificações técnicas para produção
```

### Seção 12 — Arquivos de Produção
```
Templates e arquivos para a equipe de produção
```

### Seção 13 — Hora Homem
```
Configuração detalhada de tempo por colaborador
```

### Seção 14 — Mercado de Produtos
```
Posicionamento do produto no mercado
```

---

## 6. CATÁLOGO COMPLETO DE PRODUTOS (98+ produtos cadastrados)

```
ACM (2 modelos)
AMARELINHA (1)
Aplique de Ponta de Gondola (3)
Banner (10 modelos — principal linha da gráfica)
Banner em Tecido (3)
BLOCO DE ANOTAÇÕES (1)
BOOK (1)
Brinde (1)
Caderno (1)
CAIXA (1)
CAIXA PARA CAMERA (1)
CALENDARIO (1)
CALENDARIO DE MESA (1)
Calhas/Rufos (2)
Camisetas (5)
CANECA (1)
CANECA TÉRMICA (1)
Capa de alarme (3)
Cartão (2)
Cartaz (6)
Catalogo (1)
Catalogo revista (1)
Cavalete madeira e lona (2)
Cobertura (1)
CONJUNTO MESA C/ 4 CADEIRAS INFANTIL (2)
COPO (1)
Display Acrílico Branco Adesivado (4)
Display Dobravel (3)
DISPLAY MDF (3)
DISPLAY P.S CRISTAL (1)
Display PVC Cristal Transparente (7)
Display Toten (2)
Ecobag (1)
EMBALAGEM (1)
ENCARTE (1)
ENVELOPE OFICIO (1)
Expositor (1)
Faixa (1)
Faixa de Gôndola (1)
Folder (3)
Forro (2)
Imã calendário (1)
KIT PDV MOLEKINHA E MOLEKINHO (1)
LED (1)
Letra Caixa Galvanizada (5)
Letra Caixa Galvanizada com Acrílico (3)
Letras PVC Expandido (4)
Letras XPS (4)
Lona (1)
Luminosos (3)
MALETA (1)
Mao de Obra Avulsa (1)
Marca Páginas (1)
MATERIAIS DE PDV (1)
MATERIAL GRAFICO (1)
MDF (1)
Móbile (1)
MOBILE ESCOLAR MOLEKINHO E MOLEKINHA (1)
Necessarie (1)
Orelha de Monitor (1)
OUTROS (1)
PAPEL LINHO TEXTURIZADO (1)
PASTA (1)
PERSONALIZAÇÃO DE CAIXA LAPIS DE COR (1)
PERSONALIZADO (1)
Placa 0,5mm (1)
PLACA CERCA ELETRICA (1)
Placa Homenagem (1)
PLACA P.S CRISTAL (1)
Placas Acrílico Branco Adesivada (4)
Placas Acrílico Transparente Adesivada (7)
Placas PS Adesivada (6)
Placas PVC Adesivada (3)
Precificador (3)
Puff (2)
QUADRO (1)
Quadro de metalon (3)
Quadro Simples (1)
Régua de gôndola (1)
Reparo (1)
SACOLA (2)
SUPORTE (2)
SUPORTE PARA CAMERA (1)
Sustentação Fachada (2)
Tag (1)
TECIDO (1)
TESTEIRA RIACHUELO (1)
Totem (1)
Totem triedo (1)
TRIPÉ (1)
TUBETE (1)
Urna (1)
Vinil (1)
Wind Banner (3)
Wobbler (3)
```

**Exemplo real — Banner 60x80 (processo completo):**
```
Matéria prima:
  Lona Frontlight Fosca 280g (impressa em Targa-XT): R$ 5,32
  Acabamento (ilhós, etc.): R$ 3,85
  Impressão (processo): R$ 1,72
  Total produção: ~R$ 9,17 (sem custo fixo e markup)
  Preço final orçamento: ~R$ 16,17

Processos configurados:
  Arquivos: 2 min/m²
  Impressão: 10 min/m²
  Expedição: 1 min/m²
```

---

## 7. ESTRUTURA DO CADASTRO DE CLIENTES

```
── DADOS DA EMPRESA ──────────────────────
Nome empresa        → Nome fantasia
CNPJ/CPF            → Com validação + máscara
Razão Social        → Razão social completa
Inscrição Municipal → IE Municipal
Inscrição Estadual  → IE Estadual

── CONTATO PRINCIPAL ─────────────────────
Nome do contato     → OBRIGATÓRIO
Email               →
Telefone 1          → Com bandeira BR + máscara
Telefone 2          → (adicional)

── ENDEREÇO ──────────────────────────────
CEP                 → Auto-preenchimento
Endereço            →
Número              →
Complemento         →
Bairro              →
Cidade              →
UF                  →

── DADOS INTERNOS ────────────────────────
Tipo de atendimento → Ativo | Inativo
Tabela de preço     → Tabela aplicada (padrão, especial, etc.)
Perfil              → Agência | Cliente Final | Revenda
Como conheceu       → Carteira | E-mail | Indicação | Internet | Prospecção
```

---

## 8. FUNIL DE VENDAS (CRM KANBAN)

### 8.1 Dados de um Card (Oportunidade)

**Etapa 1 — Identificação do cliente:**
```
empresa        → Nome da empresa
contato        → Nome do contato
telefone       → Com máscara BR
email          →
divulgacao     → Como conheceu: Carteira|E-mail|Indicação|Internet|Prospecção
classificacao  → Perfil: Agência|Cliente Final|Revenda
atendimento    → Tipo: Ativo|Receptivo
vendedor       → Usuário responsável
```

**Etapa 2 — Dados do negócio:**
```
titulo         → Título do negócio
valor          → Valor estimado (R$)
descricao      → Breve descrição
grupofunil     → Grupo (ex: "Vendas")
fase           → Estágio no Kanban (configurável)
arquivo        → Anexo
```

### 8.2 Dashboard / Relatório do Funil
```
Total em Vendas (R$)
Taxa de conversão (%)
Ticket médio (R$)
Taxa de perda (%)
Previsto (R$ em aberto)

Tabela: Entrada | Valores | Em Aberto | Perdeu | % Perda | Ganhou | % Conversão
Gráfico por vendedor: Total | Ganho | Perda
Meta mensal configurável (R$)
```

---

## 9. USUÁRIOS E PERMISSÕES

| Nome | Role |
|---|---|
| Admin | Administrador total |
| Edmar Júnior | Vendedor (acesso restrito) |
| Viviane Penninck | Vendedora |
| Regiane Penninck | Vendedora |

**Sistema de permissões**: Matriz módulo × usuário — configurável no módulo Sistema > Permissão de acesso.

---

## 10. MÓDULO AJUDA — 189 VÍDEOS

### Distribuição por categoria:
| Categoria | Qtd |
|---|---|
| Administração | 67 vídeos |
| Shots (conteúdo curto) | 41 vídeos |
| Dicas de uso | 25 vídeos |
| Financeiro | 21 vídeos |
| Comercial | 10 vídeos |
| Produção | 6 vídeos |
| Sistema | 4 vídeos |
| Suprimentos | 4 vídeos |
| Aulas ao vivo | - |
| **Total** | **189 vídeos** |

### Vídeos-chave identificados:
```
"Formação de preço - Gráfica" → Metodologia completa MP+MO+Markup
"Calculando Preço de Venda"   → Markup vs margem vs preço fixo
"Árvore de decisões (Precificação)" → IA para precificação automática
"Ligando os pontos"           → Como cadastros conectam ao preço
"Entendendo as unidades de medidas" → m², m linear, unidade, etc.
"Shot - Movimentação Metro quadrado X Metro linear"
"Mubichat - API Oficial"      → Integração WhatsApp
"Produtos - Banner"           → Cadastro do produto Banner passo a passo
"Forma e condição de pagamento"
"Campo adicional de medida"
"Cadastro de matéria prima"
"Matérias Primas - Papel"
"Cadastro de Equipamentos"
"Cadastro de Veiculos"
"Cadastro de empresas"        → Multi-CNPJ
"Plano de contas"
"Primeiros Passos"
```

---

## 11. MATERIAL DE APOIO — 12 DOCUMENTOS

| Documento | Conteúdo |
|---|---|
| **Formação de preço** | Passo a passo de como o Mubisys monta o preço (PDF 3 páginas — lido completo) |
| **Cálculo para o ponto de equilíbrio** | Como calcular e configurar o ponto de equilíbrio |
| **Treinamento para IA** | Base para treinar agente de atendimento com IA |
| **Contratei o Mubisys, e agora?** | Onboarding e expectativas do sistema |
| **Cadastro de matéria prima** | Como cadastrar principais tipos de MP com exemplos |
| **Estrutura DRE** | DRE gerencial — explicação de cada tipo de despesa |
| **Identificando os tipos de despesas** | Manual de classificação de despesas com exemplos |
| **Primeiros Passos** | Implantação completa e segura passo a passo |
| **Modelo Imagem rodapé** | Dimensões do rodapé do orçamento |
| **Modelo Imagem fundo** | Dimensões do fundo do orçamento |
| **Modelo Imagem Cabeçalho** | Dimensões do cabeçalho do orçamento |
| **RELATÓRIO DE MATERIAIS MUBISYS** | Arquivo para SketchUp (gerar relatório de materiais 3D) |

---

## 11.1 CADASTRO DE MATÉRIA PRIMA — ESTRUTURA OFICIAL

> **Fonte**: PDF "Cadastro de matéria prima" (3 páginas, Material de apoio Mubisys)

### Campos do cadastro de MP:
```
Nome         → texto livre
Unid.C.V.    → Unidade de Compra e Venda (ex: M², ML, PC, KG, L)
Unid.M.      → Unidade de Medida para cálculo interno
Tipo         → Mídia | Material
Valor Unid.  → Preço por unidade de compra
```

### 7 tipos principais de matéria prima (comunicação visual):

| Tipo | Exemplos |
|---|---|
| **Lonas / Adesivos** | Lona 440g, Lona 510g, Adesivo vinil, Adesivo perfurado, Lona backlit |
| **Chapas Rígidas** | ACM, PVC rígido, Policarbonato, Acrílico, Dibond |
| **Chapas especiais** | Forex, Alumínio, Inox espelhado, Chapa galvanizada |
| **Chapas uso diário** | MDF, Compensado, OSB, Papelão reforçado |
| **Metalon / Barras** | Metalon 30×30, 20×20, Barra chata, Cantoneira, Tubo redondo |
| **Parafusos / Fontes** | Parafuso sextavado, Rebite pop, Fita dupla face, Espaçadores |
| **Tintas fração** | Tinta spray, Tinta esmalte (fração por litro ou kg) |

### Unidades de medida usadas:
- **M²** → lonas, adesivos, ACM, PVC (área = Largura × Altura)
- **ML** → metalon, barra chata (metro linear)
- **PC** → peças avulsas (parafusos, rebites, espaçadores)
- **KG** → tintas, massa plástica
- **L** → tintas líquidas, solventes
- **UN** → itens unitários (LED, fonte, conector)

---

## 11.2 ESTRUTURA DRE GERENCIAL

> **Fonte**: PDF "Estrutura DRE Gerencial" (1 página, Material de apoio Mubisys)

```
(+) RECEITA BRUTA
(-) IMPOSTOS SOBRE VENDA       ← Simples Nacional / Lucro Presumido
─────────────────────────────
(=) RECEITA LÍQUIDA
(-) DESPESA OPERACIONAL        ← Custos variáveis operacionais diretos
(-) DESPESA VARIÁVEL           ← Matéria prima, comissões, fretes
─────────────────────────────
(=) LUCRO BRUTO
(-) DESPESAS FIXAS             ← Aluguel, contas, serviços recorrentes
(-) PESSOAL                    ← Folha de pagamento + encargos
(-) FINANCEIRO                 ← Juros, tarifas bancárias, cartão
─────────────────────────────
(=) LUCRO ANTES IR
(-) IR (15%) + CSLL (9%)       ← Só para Lucro Real / Presumido
─────────────────────────────
(=) LUCRO LÍQUIDO
```

---

## 11.3 TIPOS DE DESPESAS — CLASSIFICAÇÃO MUBISYS

> **Fonte**: PDF "Identificando os tipos de despesas" (1 página, Material de apoio Mubisys)

| Tipo | Descrição | Exemplos |
|---|---|---|
| **Variável** | Oscila conforme a produção | Matéria prima, energia produtiva, embalagem |
| **Operacional** | Custos diretos da operação | Manutenção, ferramentas, uniformes |
| **Fixas** | Não variam com produção | Aluguel, internet, contador, licenças |
| **Comissões** | Pagamentos por resultado de venda | Comissão vendedor, parceiro externo |
| **Impostos** | Tributos sobre venda/receita | Simples, ICMS, PIS/COFINS, ISS |
| **Adiantamento / Pagamento Colaborador** | Antecipações de salário | Vale salário, adiantamento quinzenal |
| **Vale Refeição / Transporte** | Benefícios fixos por colaborador | VR, VT |
| **Outros benefícios** | Benefícios não-padrão | Plano de saúde, convênio |
| **Pensão alimentícia** | Desconto judicial em folha | Determinação judicial |
| **Imposto GRF / GPS / IRRF** | Encargos trabalhistas mensais | FGTS (GRF), INSS (GPS), IR retido (IRRF) |

---

## 11.4 CHECK-LIST COMPLETO DE IMPLANTAÇÃO (21 itens)

> **Fonte**: PDF "Primeiros Passos" (10 páginas, check-list de implantação, Material de apoio Mubisys)

### SEÇÃO A — Cadastros básicos

| # | Item | Descrição |
|---|---|---|
| 1 | **Plano de contas** | Apontar onde entram receitas e saem custos. Base para DRE e relatórios |
| 2 | **Centro de custos** | Identificar qual setor custa mais. Criar por setor: Administrativo, Comercial, Impressão digital, Acabamentos, Letra Caixa |
| 3 | **Cadastro da empresa** | Configurar impostos, layout do PDF do orçamento, **logotipo (obrigatório para gerar PDF)** |
| 4 | **Colaboradores** | Cadastrar todos os funcionários; marcar flag **PRODUÇÃO** para Impressores, Adesivadores, Montadores |
| 5 | **Definir preferências** | Decimais = 3; Faturamento = média últimos 12 meses; Despesas fixas = **EXCETO** MP, Impostos de notas e comissões |

### SEÇÃO B — Cadastros operacionais (chegar a 60% do sistema pronto)

| # | Item | Descrição |
|---|---|---|
| 6 | **Matéria prima** | Cadastrar lonas, parafusos, ACM, etc. (ver estrutura seção 11.1) |
| 7 | **Equipamentos** | Plotters (impressão/recorte) e CNCs (Router/laser); configurar qualidades de impressão; vincular MP ao equipamento CNC |
| 8 | **Imobilizados** | Depreciar equipamentos; usar equipamentos elétricos/manuais pelo Almoxarife |
| 9 | **Veículos** | Depreciar frota; controla seguro e validade de habilitação |
| 10 | **Processos** | Setores produtivos; exemplo: pré-impressão → impressão → acabamento → expedição |
| 11 | **Acabamentos** | Cadastrar como serviços; padronizar tempo + lista de MP; reutilizar em vários produtos; exemplo pintura: tempo + tinta + fundo + estopa |
| 12 | **Produtos** | Tempo de produção + MP; **Dica**: separar itens de fachada (Estrutura, Cobertura, Forro, Letras caixas) e vender via Agrupamento |
| 13 | **Agrupar produtos** | Kits/conjuntos pré-configurados para venda no orçamento |

### SEÇÃO C — Configurações

| # | Item | Descrição |
|---|---|---|
| 14 | **Email** | Criar grupos de emails para envio de orçamentos e automações de cobrança |
| 15 | **Comercial** | Configurar custos adicionais e hora homem nos orçamentos |
| 16 | **Funil, Orçamentos e OS** | Configurar parâmetros e nomes usados no funil, orçamentos e ordens de serviço |

### SEÇÃO D — Cadastros financeiros (completar por último — precisam das informações de custo)

| # | Item | Descrição |
|---|---|---|
| 17 | **Formas de pagamento** | Pré-definir opções — vendedor **não pode** alterar em negociação |
| 18 | **Regras de comissões** | Definir base de cálculo dos pagamentos de comissão |
| 19 | **Contas** | ← **ÚLTIMO antes de usar o sistema**: bancárias + caixa interno + configuração de boletos |
| 20 | **Cartões de crédito** | Cadastrar todos os cartões para controle de faturas |
| 21 | **Preços e comissões** | Tabelas de preço diferenciadas por cliente ou vendedor |

---

## 12. ARQUITETURA DO SISTEMA CROMA PRINT

### 12.1 Stack (manter e expandir)
```
Frontend:   React + TypeScript + Vite + Tailwind + shadcn/ui  ✅
Backend/DB: Supabase (PostgreSQL + Auth + Storage + Realtime)  ✅
Deploy:     Vercel                                             ✅
```

### 12.2 Schema Supabase — Módulo Comercial

```sql
-- ── CLIENTES ─────────────────────────────────────────────────
CREATE TABLE clientes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_fantasia text NOT NULL,
  razao_social  text,
  cnpj_cpf      text,
  insc_municipal text,
  insc_estadual  text,
  perfil        text CHECK (perfil IN ('agencia','cliente_final','revenda')),
  origem        text CHECK (origem IN ('carteira','email','indicacao','internet','prospeccao')),
  atendimento   text DEFAULT 'ativo' CHECK (atendimento IN ('ativo','inativo')),
  tabela_preco  text DEFAULT 'padrao',
  vendedor_id   uuid REFERENCES auth.users,
  observacoes   text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── CONTATOS DO CLIENTE ───────────────────────────────────────
CREATE TABLE clientes_contatos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  uuid REFERENCES clientes ON DELETE CASCADE,
  nome        text NOT NULL,
  cargo       text,
  email       text,
  telefone1   text,
  telefone2   text,
  principal   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- ── ENDEREÇOS DO CLIENTE ──────────────────────────────────────
CREATE TABLE clientes_enderecos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   uuid REFERENCES clientes ON DELETE CASCADE,
  tipo         text DEFAULT 'entrega',
  cep          text,
  logradouro   text,
  numero       text,
  complemento  text,
  bairro       text,
  cidade       text,
  estado       char(2),
  principal    boolean DEFAULT false
);

-- ── CATÁLOGO: PRODUTOS ────────────────────────────────────────
CREATE TABLE produtos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,   -- ex: "Banner"
  categoria       text,
  unidade         text DEFAULT 'm2', -- m2|ml|un|kg
  ativo           boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- ── CATÁLOGO: MODELOS ─────────────────────────────────────────
CREATE TABLE produtos_modelos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id          uuid REFERENCES produtos,
  nome                text NOT NULL,  -- ex: "60x80"
  markup              numeric DEFAULT 100,
  margem_minima       numeric DEFAULT 10,
  preco_fixo          numeric,        -- override (NULL = calculado)
  largura_padrao      numeric,
  altura_padrao       numeric,
  espessura_padrao    numeric,
  unidade             text,
  descricao_cliente   text,           -- aparece na proposta
  ativo               boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

-- ── CATÁLOGO: MATÉRIAS PRIMAS (por modelo) ───────────────────
CREATE TABLE modelos_materiais (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id       uuid REFERENCES produtos_modelos ON DELETE CASCADE,
  nome            text NOT NULL,
  unidade         text,
  quantidade_base numeric,  -- por m² ou por unidade
  valor_unitario  numeric,
  obs             text
);

-- ── CATÁLOGO: PROCESSOS (por modelo) ─────────────────────────
CREATE TABLE modelos_processos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id   uuid REFERENCES produtos_modelos ON DELETE CASCADE,
  tipo        text, -- criacao|arquivos|impressao|router|acabamentos|serralheria|expedicao|instalacao|terceirizado
  ativo       boolean DEFAULT true,
  minutos     numeric,
  unidade     text  -- m2|ml|un
);

-- ── ORÇAMENTOS ────────────────────────────────────────────────
CREATE TABLE orcamentos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              serial UNIQUE,
  cliente_id          uuid REFERENCES clientes,
  contato_id          uuid REFERENCES clientes_contatos,
  vendedor_id         uuid REFERENCES auth.users,
  atendente_id        uuid REFERENCES auth.users,
  status              text DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho','enviado','aprovado','recusado','convertido')),
  nome_trabalho       text,
  logistica           text CHECK (logistica IN ('cliente_retira','entrega_propria','instalado','transportadora','correios')),
  campanha            text,
  prazo_entrega       date,
  validade            date,
  forma_pagamento     text,
  condicoes_pagamento text,
  obs_cliente         text,
  obs_producao        text,
  obs_financeiro      text,
  subtotal            numeric DEFAULT 0,
  desconto_valor      numeric DEFAULT 0,
  desconto_pct        numeric DEFAULT 0,
  total               numeric DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ── ITENS DO ORÇAMENTO ────────────────────────────────────────
CREATE TABLE orcamentos_itens (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id        uuid REFERENCES orcamentos ON DELETE CASCADE,
  tipo                text DEFAULT 'produto' CHECK (tipo IN ('produto','venda_direta','agrupado')),
  modelo_id           uuid REFERENCES produtos_modelos,
  descricao           text,
  largura             numeric,
  altura              numeric,
  espessura           numeric,
  quantidade          int DEFAULT 1,
  valor_mp            numeric DEFAULT 0,
  valor_mo            numeric DEFAULT 0,
  valor_custo_fixo    numeric DEFAULT 0,
  valor_unitario      numeric DEFAULT 0,
  valor_total         numeric DEFAULT 0,
  obs                 text,
  posicao             int,
  created_at          timestamptz DEFAULT now()
);

-- ── FUNIL DE VENDAS ───────────────────────────────────────────
CREATE TABLE funil_cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid REFERENCES clientes,
  empresa         text NOT NULL,     -- pode ser prospect (sem cliente cadastrado)
  contato         text,
  telefone        text,
  email           text,
  origem          text,
  classificacao   text,
  atendimento     text,
  vendedor_id     uuid REFERENCES auth.users,
  titulo          text NOT NULL,
  valor_estimado  numeric,
  descricao       text,
  grupo_funil     text DEFAULT 'Vendas',
  fase            text NOT NULL,     -- configurável
  status          text DEFAULT 'aberto' CHECK (status IN ('aberto','ganhou','perdeu')),
  motivo_perda    text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── ORDENS DE SERVIÇO ─────────────────────────────────────────
CREATE TABLE ordens_servico (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                serial UNIQUE,
  orcamento_id          uuid REFERENCES orcamentos,
  cliente_id            uuid REFERENCES clientes,
  status                text DEFAULT 'aguardando'
                          CHECK (status IN ('aguardando','producao','pronto','instalacao','concluido','cancelado')),
  data_prevista         date,
  data_conclusao        date,
  endereco_instalacao   text,
  obs_tecnicas          text,
  responsavel_id        uuid REFERENCES auth.users,
  instalador_id         uuid,  -- ref ao sistema de instalações existente
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ── FINANCEIRO: CONTAS A RECEBER ──────────────────────────────
CREATE TABLE contas_receber (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id           uuid REFERENCES ordens_servico,
  cliente_id      uuid REFERENCES clientes,
  descricao       text,
  valor           numeric NOT NULL,
  vencimento      date,
  status          text DEFAULT 'pendente' CHECK (status IN ('pendente','pago','vencido')),
  data_pagamento  date,
  created_at      timestamptz DEFAULT now()
);

-- ── FINANCEIRO: CONTAS A PAGAR ────────────────────────────────
CREATE TABLE contas_pagar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao       text NOT NULL,
  fornecedor      text,
  categoria       text,  -- folha|aluguel|material|servico|imposto|outro
  valor           numeric NOT NULL,
  vencimento      date,
  status          text DEFAULT 'pendente' CHECK (status IN ('pendente','pago','vencido')),
  data_pagamento  date,
  created_at      timestamptz DEFAULT now()
);
```

### 12.3 Lógica de Precificação no Frontend

```typescript
// Custeio Direto — implementação das 9 etapas do PDF Mubisys

interface PrecificacaoConfig {
  faturamentoMedio: number;    // F = faturamento médio 12 meses
  custoOperacional: number;    // C = custo fixo total
  custoProdutivo: number;      // CP = soma folha colaboradores produtivos
  totalFolha: number;          // Fp = folha de pagamento produtivo
  qtdFuncionarios: number;     // Qf = quantidade funcionários
  comissao: number;            // % comissão (ex: 5)
  impostos: number;            // % impostos (ex: 12)
  juros: number;               // % juros (ex: 2)
}

function calcularPreco(
  totalMP: number,           // soma das matérias primas
  minutosProducao: number,   // total de minutos no processo
  markup: number,            // % markup do produto (ex: 40)
  config: PrecificacaoConfig
): PrecificacaoResult {
  // Etapa 4: Custo por minuto
  const Cm = ((config.totalFolha / config.qtdFuncionarios) / 176) / 60;

  // Custo MO
  const custoMO = minutosProducao * Cm;

  // Etapa 3: Percentual custo fixo
  const P = ((config.custoOperacional - config.custoProdutivo) * 100) / config.faturamentoMedio;

  // Etapa 6: Custo base
  const Vmm = totalMP + custoMO;
  const custoFixo = Vmm * (P / 100);
  const Vb = Vmm + custoFixo;

  // Etapa 5: Percentual de venda
  const Pv = (config.comissao + config.impostos + config.juros) / 100;

  // Etapa 7: Valor antes do markup
  const Vam = Vb / (1 - Pv);

  // Etapa 8: Markup
  const Vm_base = Vam * (markup / 100);
  const Vm = Vm_base / (1 - Pv);

  // Etapa 9: Valor final
  const Vv = Vam + Vm;

  return {
    custoMP: totalMP,
    custoMO,
    custoFixo,
    subtotalCusto: Vb,
    valorAntesMark: Vam,
    valorMark: Vm,
    precoVenda: Vv,
    margemLiquida: Vv - totalMP - custoMO - custoFixo - (Vv * Pv),
    margemPct: ((Vv - totalMP - custoMO - custoFixo - (Vv * Pv)) / Vv) * 100
  };
}
```

---

## 13. VANTAGENS DO SISTEMA PRÓPRIO SOBRE O MUBISYS

| Aspecto | Mubisys | Sistema Croma Print |
|---|---|---|
| Custo | Mensalidade recorrente | Zero após desenvolvimento |
| Customização | Limitada | Total |
| Integração com instalações | Não tem | Nativa |
| Interface | jQuery/Bootstrap legado | React moderno, PWA |
| Mobile | Responsivo básico | PWA offline-first |
| Velocidade | Lenta (PHP server-side) | SPA instantâneo |
| API | Não exposta | REST via Supabase |
| IA integrada | Árvore de decisões (pré-configurada) | Agentes de IA (GPT/Claude) |
| WhatsApp | MubiChat (pago extra) | Evolution API + N8N (self-hosted) |
| Dados | No Mubisys (deles) | No Supabase (nossos) |
| DRE/Relatórios | Fixo | Customizável |
| Multi-empresa | Pago extra | Nativo |

---

## 14. ROADMAP DE IMPLEMENTAÇÃO

### Fase 1 — Base comercial ← ATUAL
- [x] Módulo Clientes (mock/demo funcionando)
- [x] Módulo Orçamentos (mock/demo funcionando)
- [ ] Supabase: executar `supabase_comercial.sql`
- [ ] Conectar Clientes ao Supabase
- [ ] Conectar Orçamentos ao Supabase
- [ ] Precificação automática MP+MO+Markup

### Fase 2 — Funil e Produtos
- [ ] Catálogo de Produtos com modelos e precificação
- [ ] Funil de Vendas CRM (Kanban)
- [ ] Dashboard comercial (métricas)

### Fase 3 — Produção
- [ ] Ordens de Serviço (integração com sistema de instalações)
- [ ] Acompanhamento de produção
- [ ] PCP básico

### Fase 4 — Financeiro
- [ ] Contas a receber
- [ ] Contas a pagar
- [ ] Fluxo de caixa
- [ ] DRE gerencial

### Fase 5 — IA e Automação
- [ ] Agente SDR (prospecção automática)
- [ ] Agente de Vendas (fechamento)
- [ ] WhatsApp (Evolution API + N8N)
- [ ] Precificação por IA (árvore de decisões)

---

> **Documentado por**: Claude Sonnet 4.6 | **Data**: 2026-03-09
> **Baseado em**: Exploração direta do Mubisys + PDF "Formação de preço" (3 páginas lidas integralmente)

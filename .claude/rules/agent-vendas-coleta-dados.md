# Regra: Agente de Vendas — coletar dados cadastrais antes de orçar

Todo agente de vendas (WhatsApp, chat, email) DEVE coletar dados cadastrais completos
ANTES de gerar qualquer orçamento formal.

## Dados obrigatórios antes de orçar
- Nome completo
- Email
- Empresa / razão social
- Cidade e estado

## Por que
Leads cadastrados apenas com nome e telefone não podem receber proposta formal,
não geram vínculo com cliente no CRM e não recebem email com link do portal.

## Como aplicar
```ts
function checkDadosFaltantes(lead) {
  const faltando = []
  if (!lead.nome_completo) faltando.push('nome completo')
  if (!lead.email) faltando.push('email')
  if (!lead.empresa) faltando.push('empresa')
  if (!lead.cidade) faltando.push('cidade/estado')
  return faltando
}

// Antes de chamar ai-gerar-orcamento:
const faltando = checkDadosFaltantes(lead)
if (faltando.length > 0) {
  // Pedir os dados faltantes ao cliente antes de prosseguir
  return pedirDados(faltando)
}
```

## Dados de pagamento — HARDCODED (nunca deixar o Claude "lembrar")
- PIX: CNPJ 18.923.994/0001-83 (Croma Print Comunicação Visual)
- Email oficial: junior@cromaprint.com.br

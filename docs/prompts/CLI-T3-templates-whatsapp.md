# T3 — Templates WhatsApp Meta
> Copiar e colar no CLI

---

Submeter templates WhatsApp à Meta e criar 2 templates adicionais.

## Contexto
- Edge Function `whatsapp-submit-templates` já existe em supabase/functions/whatsapp-submit-templates/
- 3 templates definidos no código: croma_abertura, croma_followup, croma_proposta
- WABA ID: 1262844242060742
- API: Meta Cloud API v22.0
- Credenciais: WHATSAPP_ACCESS_TOKEN no Supabase secrets

## Tarefas

### 1. Verificar templates existentes na Meta
Fazer GET para verificar quais templates já foram aprovados:
```
GET https://graph.facebook.com/v22.0/1262844242060742/message_templates
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
```
Usar o token do Supabase secrets. Se não tiver acesso direto, invocar via Edge Function.

### 2. Criar 2 templates adicionais

Adicionar ao código de `whatsapp-submit-templates/index.ts`:

**a) croma_cobranca (UTILITY):**
```json
{
  "name": "croma_cobranca",
  "category": "UTILITY",
  "language": "pt_BR",
  "components": [
    {
      "type": "BODY",
      "text": "Olá {{1}}! Identificamos que o pagamento ref. pedido {{2}} no valor de R$ {{3}} venceu em {{4}}. Se já pagou, por favor desconsidere esta mensagem. PIX CNPJ: 18.923.994/0001-83 (Croma Print). Qualquer dúvida estamos à disposição! - Croma Print",
      "example": { "body_text": [["João", "PED-2026-0001", "1.500,00", "25/03/2026"]] }
    },
    {
      "type": "FOOTER",
      "text": "Croma Print Comunicação Visual"
    }
  ]
}
```

**b) croma_reativacao (MARKETING):**
```json
{
  "name": "croma_reativacao",
  "category": "MARKETING",
  "language": "pt_BR",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Novidades da Croma Print!"
    },
    {
      "type": "BODY",
      "text": "Olá {{1}}! Faz um tempo que não nos falamos. A Croma Print tem novidades em comunicação visual que podem ajudar sua empresa. Quer saber mais?",
      "example": { "body_text": [["Maria"]] }
    },
    {
      "type": "FOOTER",
      "text": "Croma Print - Comunicação Visual Profissional"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Quero ver novidades" },
        { "type": "QUICK_REPLY", "text": "Agora não" }
      ]
    }
  ]
}
```

### 3. Submeter todos os 5 templates

Invocar a Edge Function (via curl ou fetch) para submeter cada template.
Se a Edge Function só submete os 3 originais, atualizar o código para incluir os 2 novos.

### 4. Atualizar agent-cron-loop para usar template croma_cobranca

No agent-cron-loop, nas regras de cobrança D1 e D3, quando o lead/cliente NÃO respondeu nas últimas 24h (fora da janela de sessão), usar o template `croma_cobranca` ao invés de texto livre.

Lógica:
```typescript
// Se última mensagem recebida do cliente > 24h, usar template
const usarTemplate = !ultimaMensagemRecebida ||
  (Date.now() - new Date(ultimaMensagemRecebida).getTime()) > 24 * 60 * 60 * 1000;

if (usarTemplate) {
  // Enviar via template croma_cobranca
  await enviarWhatsApp({ telefone, template: 'croma_cobranca', params: [nomeCliente, numeroPedido, valor, dataVencimento] });
} else {
  // Dentro da janela 24h, pode mandar texto livre
  await enviarWhatsApp({ telefone, mensagem: textoCobranca });
}
```

### 5. Deploy da Edge Function atualizada
```bash
supabase functions deploy whatsapp-submit-templates --project-ref djwjmfgplnqyffdcgdaw
```

### 6. Verificar status de aprovação
Após submeter, consultar status via GET na API Meta. Templates UTILITY costumam ser aprovados em minutos. MARKETING pode levar 24-48h.

Documentar status final no arquivo docs/whatsapp-templates-status.md.

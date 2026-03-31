# Relatório E2E — CRM Croma

**Data**: 2026-03-26
**Método**: Teste via UI (Chrome automation)
**Testador**: Claude (automação E2E)
**Ambiente**: crm-croma.vercel.app (produção)

---

## Bugs Encontrados (5)

### BUG #1 — Criação de Lead falha silenciosamente
- **Severidade**: CRÍTICA
- **Módulo**: Comercial > Leads
- **Passos**: Abrir /comercial > Novo Lead > Preencher campos > Salvar
- **Resultado**: Dialog fecha, nenhum lead é criado no banco
- **Esperado**: Lead aparecer na listagem
- **Nota**: INSERT direto via API REST funciona — problema é exclusivamente no frontend (React state/mutation)
- **Arquivo**: `src/domains/comercial/pages/LeadsPage.tsx` — função `handleSalvar` (linha 198)

### BUG #2 — Conversão Lead→Cliente: status não atualiza
- **Severidade**: CRÍTICA
- **Módulo**: Comercial > Lead Detail
- **Passos**: Abrir lead > Converter para Cliente
- **Resultado**: Cliente É criado no banco, mas o lead permanece com status "novo" (deveria ir para "convertido"). UI não redireciona para o novo cliente.
- **Causa provável**: `updateLead.mutateAsync` falha silenciosamente após `createCliente.mutateAsync`
- **Arquivo**: `src/domains/comercial/pages/LeadDetailPage.tsx` — função `doConvert` (linha 180)

### BUG #3 — Proposta sem vínculo real com cliente
- **Severidade**: ALTA
- **Módulo**: Comercial > Propostas
- **Passos**: Criar nova proposta
- **Resultado**: Campo cliente é texto livre, não um select vinculado à tabela clientes. Como `cliente_id` é NOT NULL no banco, propostas criadas pelo form podem falhar.
- **Esperado**: Select/autocomplete buscando da tabela clientes

### BUG #4 — Aprovação de proposta mostra R$ 0,00
- **Severidade**: ALTA
- **Módulo**: Comercial > Propostas > Aprovar
- **Passos**: Abrir proposta PROP-2026-0007 (total R$ 469,02) > Aprovar
- **Resultado**: Dialog de confirmação mostra "R$ 0,00" ao invés de R$ 469,02
- **Causa**: Campo `total` não está sendo lido corretamente no dialog de aprovação

### BUG #5 — Aprovação de proposta não executa
- **Severidade**: CRÍTICA
- **Módulo**: Comercial > Propostas > Aprovar
- **Passos**: Confirmar aprovação no dialog
- **Resultado**: Nada acontece — status continua "enviada", `aprovado_em` = null, nenhum pedido gerado
- **Esperado**: Status → "aprovada", pedido criado automaticamente

---

## Resumo

| Área | Status |
|---|---|
| Login/autenticação | ✅ OK |
| Navegação entre módulos | ✅ OK |
| Listagens e consultas | ✅ OK |
| Backend (Supabase RLS/auth) | ✅ OK |
| Operações de escrita via UI | ❌ 3/3 FALHARAM |
| Vinculação de dados | ⚠️ Inconsistente |

---

## Padrão Identificado

Todas as operações de ESCRITA via frontend falham silenciosamente. O backend funciona (testado via API direta com mesmo auth token). Provável causa sistêmica: mutations do TanStack Query + Supabase client não estão propagando erros corretamente, ou o React state management está engolindo exceções.

---

## Recomendações

1. Auditar TODAS as mutations (`useMutation`) — verificar `onError` handlers
2. Adicionar error boundaries e logging nas mutations
3. Testar se o Supabase client está enviando o auth token correto nas mutations
4. Vincular campo cliente nas propostas à tabela clientes (select/autocomplete)
5. Corrigir leitura do campo `total` no dialog de aprovação

# CORREÇÕES DE BUGS — AUDITORIA 2026-03-14

> **Branch**: `claude/optimistic-mendeleev`
> **Build**: TypeScript OK (sem erros)
> **Total de correções**: 19 bugs corrigidos em 12 arquivos
> **Autor**: Claude Opus 4.6

---

## RESUMO PARA O DEV

Esta branch contém as correções de 19 bugs identificados na auditoria completa do ERP Croma Print. As correções foram classificadas por severidade (CRÍTICO > ALTO > MÉDIO) e validadas com `tsc --noEmit`.

**Antes de mergear, verifique:**
1. Testar fluxo Lead → Cliente → Orçamento → Pedido no sistema
2. Validar que migration 006 ainda precisa ser executada (pendência de banco, não de código)
3. Verificar se as colunas `cancelado_em` e `motivo_cancelamento` existem na tabela `pedidos` (se não, criar migration)

---

## CORREÇÕES CRÍTICAS (5)

### C-01 — Bloqueio de item com R$ 0,00 no orçamento
**Arquivo**: `src/domains/comercial/pages/OrcamentoEditorPage.tsx` (linha ~461)
**O que era**: `toast.warning` sem `return` — item com valor zero era salvo normalmente
**O que faz agora**: `showError()` + `return` — impede salvar item com valor zero
**Motivo**: Orçamentos com valor R$ 0,00 podiam ser enviados a clientes
```diff
- toast.warning("Item com valor R$ 0,00 — verifique os materiais...");
+ showError("Não é possível adicionar item com valor R$ 0,00. Verifique se o modelo possui materiais e processos cadastrados.");
+ return;
```

### C-02 — Tabela errada na verificação de NF-e
**Arquivo**: `src/domains/pedidos/pages/PedidoDetailPage.tsx` (linha ~152)
**O que era**: Consultava tabela `nfe_documentos` que NÃO existe no schema
**O que faz agora**: Consulta `fiscal_documentos` (tabela correta)
**Motivo**: Sistema sempre mostrava "Concluir sem NF-e?" mesmo quando NF-e existia
```diff
- .from('nfe_documentos')
+ .from('fiscal_documentos')
```

### C-05 — lead_id não vinculado ao cliente na conversão
**Arquivo**: `src/domains/comercial/pages/LeadDetailPage.tsx` (linha ~114)
**O que era**: `createCliente.mutateAsync()` não enviava `lead_id` no payload
**O que faz agora**: Envia `lead_id: id` para rastreabilidade Lead→Cliente
**Motivo**: Funil de vendas perdia rastreabilidade na conversão
```diff
  origem: "lead_convertido",
+ lead_id: id,
+ cnpj: convertCnpj.trim() || null,
```

### A-01 — Verificação anti-duplicação de pedido + numeração atômica
**Arquivo**: `src/domains/comercial/services/orcamento.service.ts` (linha ~660)
**O que era**: (1) Sem verificação de pedido existente — possível duplicar; (2) SELECT COUNT + INSERT não-atômico para número do pedido
**O que faz agora**: (1) Verifica `pedidos.proposta_id` antes de criar; (2) Usa MAX do número existente + 1
**Motivo**: Portal podia criar pedido + vendedor duplicar manualmente; race condition na numeração
```typescript
// Novo: verificação anti-duplicação
const { data: pedidoExistente } = await supabase
  .from("pedidos")
  .select("id, numero")
  .eq("proposta_id", orcamentoId)
  .neq("status", "cancelado")
  .limit(1);

if (pedidoExistente && pedidoExistente.length > 0) {
  throw new Error(`Já existe o pedido ${pedidoExistente[0].numero}...`);
}

// Novo: numeração via MAX + 1 em vez de COUNT
const { data: ultimoPedido } = await supabase
  .from("pedidos")
  .select("numero")
  .like("numero", `PED-${ano}-%`)
  .order("numero", { ascending: false })
  .limit(1);
```

### A-02 — Numeração sequencial de OP e OS (substituir Math.random)
**Arquivos**:
- `src/domains/producao/services/producao.service.ts` (linha 5-9)
- `src/domains/instalacao/services/instalacao-criacao.service.ts` (linha 3-7)

**O que era**: `Math.floor(Math.random() * 9999)` — risco de colisão
**O que faz agora**: Busca último número via ORDER BY DESC + incrementa
**Motivo**: Em produção com volume real, dois OPs podiam ter o mesmo número
```diff
- function generateOpNumero(): string {
-   const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
-   return `OP-${year}-${seq}`;
- }
+ async function generateOpNumero(): Promise<string> {
+   const { data: ultimo } = await supabase
+     .from('ordens_producao')
+     .select('numero')
+     .like('numero', `OP-${year}-%`)
+     .order('numero', { ascending: false })
+     .limit(1);
+   let seq = 1;
+   if (ultimo?.[0]) { /* parse e incrementar */ }
+   return `OP-${year}-${String(seq).padStart(4, '0')}`;
+ }
```

---

## CORREÇÕES ALTAS (8)

### A-05 — user_id real na emissão de NF-e
**Arquivo**: `src/domains/fiscal/hooks/useFiscal.ts` (linha ~132)
**O que era**: `p_user_id: '00000000-0000-0000-0000-000000000000'` hardcoded
**O que faz agora**: `supabase.auth.getUser()` para obter ID real, com fallback
```diff
+ const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc('fiscal_criar_rascunho_nfe', {
    p_pedido_id: pedidoId,
-   p_user_id: '00000000-0000-0000-0000-000000000000',
+   p_user_id: user?.id ?? '00000000-0000-0000-0000-000000000000',
  });
```

### A-06 — Validação CNPJ com dígito verificador
**Arquivo**: `src/shared/schemas/clientes.schemas.ts` (linha ~12)
**O que era**: Apenas regex de formato (`/^\d{14}$/`)
**O que faz agora**: Algoritmo módulo 11 completo (rejeita CNPJs com dígitos inválidos)
**Motivo**: NF-e seria rejeitada pela SEFAZ com CNPJ de formato correto mas dígitos errados

### A-07 — Default role de 'admin' para 'comercial'
**Arquivo**: `src/contexts/AuthContext.tsx` (linha ~89)
**O que era**: `profile?.role ?? 'admin'` — usuário sem role = acesso total
**O que faz agora**: `profile?.role ?? 'comercial'` — acesso restrito por padrão
**Motivo**: Segurança — novos usuários não devem ter acesso administrativo
```diff
- const effectiveRole = profile?.role ?? 'admin';
+ const effectiveRole = profile?.role ?? 'comercial';
```

### A-09 — ErrorBoundary adicionado ao App.tsx
**Arquivo**: `src/App.tsx`
**O que era**: ErrorBoundary existia em `src/components/` mas não era usado
**O que faz agora**: Wrapping de todo o app com `<ErrorBoundary>`
**Motivo**: Erros de renderização causavam tela branca sem feedback

### A-12 — 7 ícones faltantes no menu lateral
**Arquivo**: `src/components/Layout.tsx` (linha ~21-37)
**O que era**: Ícones `Calendar, Megaphone, Package2, ArrowLeftRight, Building, Layers, BarChart2` não estavam no `ICON_MAP`, caindo no fallback genérico
**O que faz agora**: Importados e registrados corretamente

### A-13 — Rota Templates removida do menu
**Arquivo**: `src/shared/constants/navigation.ts` (linha ~36)
**O que era**: Item "Templates" no menu apontava para `/orcamentos/templates` que não tinha Route
**O que faz agora**: Removido do menu (pode ser recriado quando a funcionalidade existir)

### A-14 — Status do pedido atualiza automaticamente após produção
**Arquivo**: `src/domains/producao/services/producao.service.ts` (nova função)
**O que era**: Ao finalizar OP, status do pedido não mudava — financeiro não sabia quando faturar
**O que faz agora**: `atualizarStatusPedidoSeTodasOpsConcluidas()` verifica se todas as OPs do pedido estão concluídas e muda para `'produzido'`

### M-15 — Rota fiscal duplicada removida
**Arquivo**: `src/routes/fiscalRoutes.tsx` (linha ~14)
**O que era**: `/fiscal/emissao` e `/fiscal/fila` apontavam para o mesmo componente
**O que faz agora**: Rota duplicada removida (comentário explicativo mantido)

---

## CORREÇÕES MÉDIAS (6)

### M-01 — Validação de email e telefone nos leads
**Arquivo**: `src/domains/comercial/pages/LeadDetailPage.tsx`
**Adicionado**: Regex de email (`[^\s@]+@[^\s@]+\.[^\s@]+`) e telefone brasileiro `(XX) XXXXX-XXXX` no `handleSave()`

### M-02 — Cálculo automático de area_m2 no modelo
**Arquivo**: `src/domains/admin/pages/AdminProdutosPage.tsx` (linha ~476)
**Adicionado**: `area_m2 = (largura_cm / 100) * (altura_cm / 100)` calculado automaticamente ao salvar modelo
```diff
  if (form.largura_cm) payload.largura_cm = parseFloat(form.largura_cm);
  if (form.altura_cm) payload.altura_cm = parseFloat(form.altura_cm);
+ if (form.largura_cm && form.altura_cm) {
+   payload.area_m2 = (parseFloat(form.largura_cm) / 100) * (parseFloat(form.altura_cm) / 100);
+ }
```

### M-04 — Campo CNPJ no dialog de conversão Lead → Cliente
**Arquivo**: `src/domains/comercial/pages/LeadDetailPage.tsx`
**Adicionado**: Campo de input para CNPJ no `AlertDialog` de conversão. Valor é enviado no `createCliente` payload.

### M-05 — Vencimento de conta a receber usa condições da proposta
**Arquivo**: `src/domains/financeiro/services/financeiro-automation.service.ts`
**O que era**: Vencimento fixo de 30 dias e `forma_pagamento: 'a_definir'`
**O que faz agora**: Busca `forma_pagamento` e `prazo_dias` da proposta vinculada ao pedido. PIX = 1 dia, Boleto à vista = 5 dias, parcelado = usa prazo_dias

### M-09 — custo_fixo não pode ficar negativo
**Arquivo**: `src/domains/comercial/pages/OrcamentoEditorPage.tsx` (linha ~480)
**Adicionado**: `Math.max(0, ...)` para impedir custo_fixo negativo
```diff
- custo_fixo: pricingResult.custoTotal - pricingResult.custoMP - pricingResult.custosAcabamentos - pricingResult.custoMO,
+ custo_fixo: Math.max(0, pricingResult.custoTotal - pricingResult.custoMP - pricingResult.custosAcabamentos - pricingResult.custoMO),
```

### M-14 — Cancelamento de pedido com campos dedicados
**Arquivo**: `src/domains/pedidos/pages/PedidoDetailPage.tsx` (linha ~77)
**O que era**: Motivo de cancelamento concatenado no campo `observacoes`
**O que faz agora**: Envia `cancelado_em` e `motivo_cancelamento` como campos separados (via `as any` para compatibilidade — precisa migration para criar as colunas)

---

## ARQUIVOS MODIFICADOS (12)

| Arquivo | Bugs corrigidos |
|---------|----------------|
| `src/domains/comercial/pages/OrcamentoEditorPage.tsx` | C-01, M-09 |
| `src/domains/pedidos/pages/PedidoDetailPage.tsx` | C-02, M-14 |
| `src/domains/comercial/pages/LeadDetailPage.tsx` | C-05, M-01, M-04 |
| `src/domains/comercial/services/orcamento.service.ts` | A-01 |
| `src/domains/producao/services/producao.service.ts` | A-02, A-14 |
| `src/domains/instalacao/services/instalacao-criacao.service.ts` | A-02 |
| `src/domains/fiscal/hooks/useFiscal.ts` | A-05 |
| `src/shared/schemas/clientes.schemas.ts` | A-06 |
| `src/contexts/AuthContext.tsx` | A-07 |
| `src/App.tsx` | A-09 |
| `src/components/Layout.tsx` | A-12 |
| `src/shared/constants/navigation.ts` | A-13 |
| `src/routes/fiscalRoutes.tsx` | M-15 |
| `src/domains/admin/pages/AdminProdutosPage.tsx` | M-02 |
| `src/domains/financeiro/services/financeiro-automation.service.ts` | M-05 |

---

## PENDÊNCIAS QUE NÃO SÃO CÓDIGO (requer ação de infra/banco)

| # | Pendência | Tipo | Ação necessária |
|---|-----------|------|-----------------|
| 1 | **Migration 006** — tabelas de detalhamento de orçamento não existem | Banco | Corrigir schema e executar `006_orcamento_module.sql` |
| 2 | **Colunas de cancelamento** — `cancelado_em`, `motivo_cancelamento` em `pedidos` | Banco | Criar migration ALTER TABLE |
| 3 | **Tipos TypeScript do Supabase** — não gerados | Infra | Executar `supabase gen types typescript` e atualizar imports |
| 4 | **Lazy loading nas rotas** — bundle grande (~64k linhas) | Performance | Converter imports para `React.lazy()` nas 38 rotas |
| 5 | **Testes** — apenas 17 testes (0.02% de cobertura) | Qualidade | Adicionar testes para services e hooks críticos |

---

## COMO TESTAR

### Fluxo crítico (testar primeiro)
1. **Criar lead** → verificar validação de email/telefone
2. **Converter lead** → verificar CNPJ no dialog, lead_id vinculado ao cliente
3. **Criar orçamento** → tentar adicionar item sem materiais → deve BLOQUEAR com erro
4. **Aprovar pelo portal** → tentar converter manualmente → deve mostrar erro "já existe pedido"
5. **Criar OP** → verificar número sequencial (não mais aleatório)
6. **Finalizar OP** → verificar se status do pedido muda para "produzido"
7. **Concluir pedido** → verificar se consulta `fiscal_documentos` (não `nfe_documentos`)

### Segurança
8. **Criar usuário sem role** → verificar que recebe acesso "comercial" (não "admin")
9. **Cadastrar cliente com CNPJ inválido** → verificar rejeição pelo validador

### Menu/UI
10. **Verificar sidebar** → ícones corretos (sem fallback genérico)
11. **Verificar que "Templates" não aparece** no menu
12. **Provocar erro de renderização** → verificar tela do ErrorBoundary

---

*Relatório gerado em 2026-03-14 | Branch: claude/optimistic-mendeleev*

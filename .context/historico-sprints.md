# Histórico de Sprints e Correções

> Arquivo de referência — carregado sob demanda para contexto histórico

## Sprints Concluídos (2026-03-14)

Auditoria identificou 66 problemas. 4 sprints executados:

### Sprint 1 — Blindagem (Segurança)
RLS em 8 tabelas, 14 FK indexes, NOT NULL constraints, AuthContext null-role fix, rota /tv protegida, mapa transições status pedidos, gerarContasReceber transacional.

### Sprint 2 — Fluxo Completo (Lead→Faturamento)
N+1 orçamento (23→2 queries), guards idempotência (OP/CR), KPIs produção, página Expedição, calendário 3 fontes.

### Sprint 3 — Experiência (Performance + UX)
Lazy loading (100+ chunks), paginação server-side, select colunas específicas, loading states, dead code removido.

### Sprint 4 — Crescimento (Features avançadas)
102 testes (Vitest), parser CNAB 400, relatórios exportáveis (Excel+PDF), NF-e homologação SEFAZ, campanhas (Resend), lock otimista.

## Correções E2E (2026-03-26)
5 bugs críticos: insert sem .select().single() (RLS), AlertDialogAction fechando antes de async, proposta sem vínculo, aprovação R$0, aprovação não executa.

## WhatsApp IA v14 (2026-03-31)
3 correções: preços inventados→motor Mubisys, sem coleta dados→checkDadosFaltantes, PIX/email incorretos→hardcoded.

## Auditorias Pendentes
Ver `docs/qa-reports/2026-03-21-MASTER-AUDIT-REPORT.md`:
- 5 bugs críticos restantes
- 7 gaps funcionais
- 10 gaps de produto
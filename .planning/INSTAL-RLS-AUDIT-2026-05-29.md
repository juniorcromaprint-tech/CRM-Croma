# Auditoria RLS - Modulo Instalacao/Campo - 2026-05-29 (ciclo autonomo #33)

Escopo: qualidade das RLS policies das 18 tabelas do dominio Instalacao/Campo.
Motivo: ciclos #27-#31 confirmaram "RLS ON" mas nunca auditaram a QUALIDADE das policies (roles/qual).
Metodo: pg_class.relrowsecurity + pg_policies (roles, cmd, qual, with_check). 100% read-only.

## VEREDICTO: SEM EXPOSICAO (para o modelo de ameaca atual)
- RLS ON em 100% das 18 tabelas. ZERO policies role anon. ZERO policies role {public}.
- TODAS as policies permissivas (qual=true / USING true) sao role {authenticated} -> acesso flat de usuario logado.
- App interno de campo (todo authenticated = funcionario Croma) -> qual=true authenticated e BY-DESIGN, nao vazamento.
- Encerra a duvida herdada do #18 ("authenticated read all" estilo portal_mensagens) para o dominio campo: confirmado authenticated-only.

## RESSALVA - unico vetor que inverteria o veredicto (P2, verificar)
- SE o portal do cliente emitir JWT role=authenticated do Supabase a clientes finais (em vez de acessar via Edge+service_role),
  entao qual=true em jobs / ordens_instalacao / job_photos exporia TODOS os dados de campo cross-cliente.
- Historico do projeto aponta portal via Edge functions + service_role (ai-chat-portal, portal-upload-assinatura) -> provavel employee-only.
- ACAO default (sem A/B): confirmar como o portal emite sessao. Se employee-only -> marcar by-design e seguir. Se clientes recebem JWT authenticated -> escopar policies por tenant (store_id/cliente_id).

## DRIFT COSMETICO (LOW - housekeeping, zero impacto funcional)
- jobs: 2 policies ALL identicas redundantes -> authenticated_all_jobs + jobs_auth_all.
- anexos: 2 policies ALL identicas redundantes -> authenticated_all + authenticated_all_anexos.
- Dedup recomendado (drift de migrations repetidas). Migration DROP POLICY idempotente, janela monitorada.

## campo_audit_logs - TABELA MORTA (confirmado por catalogo)
- RLS ON + 0 policies + 0 trigger na tabela + 0 funcao pg_proc referenciando + 0 rows lifetime.
- Colunas: id, user_id, action, target_id, old_value, new_value, created_at.
- Locked-by-default (so service_role escreveria, mas nada escreve). NAO e security hole; e infra de audit nunca cabeada.
- Decisao: deixar como esta (inofensiva) OU dropar se Junior confirmar obsolescencia. Sem urgencia.

## POSTURE (snapshot)
tabela | rls_on | est_rows | policies | qual_true(authenticated) | cmds
campo_audit_logs | ON | 0 | 0 | 0 | (nenhuma)
jobs | ON | 41 | 2 | 2 | ALL,ALL (duplicada)
job_photos | ON | 156 | 1 | 1 | ALL
job_videos | ON | 1 | 1 | 1 | ALL
checklist_itens | ON | 134 | 2 | 1 | ALL,SELECT
anexos | ON | ~ | 2 | 2 | ALL,ALL (duplicada)
ordens_instalacao | ON | 9 | 5 | 1 | ALL,DELETE,INSERT,SELECT,UPDATE
job_attachments | ON | ~ | 3 | 0 | INSERT,SELECT,UPDATE (scoped, sem qual=true)
producao_checklist | ON | ~ | 5 | 0 | ALL,DELETE,INSERT,SELECT,UPDATE (scoped)
(demais checklists*/midias_campo/tarefas_campo/assinaturas_campo/agenda_instalacao: ON, 2-3 policies, qual=true authenticated)

Zero prod write neste ciclo: RLS change unmonitored as 6am = risco; dedup e P2; ressalva exige verificacao do modelo de auth do portal.

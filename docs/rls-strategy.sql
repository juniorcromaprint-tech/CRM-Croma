-- ============================================================
-- ESTRATEGIA INCREMENTAL DE RLS — CRM CROMA ERP
-- xQuads Cybersecurity Squad
-- Data: 2026-03-17
-- ============================================================
--
-- PROBLEMA: ~47 tabelas com USING (true) — qualquer autenticado
-- lê/escreve TUDO. Dados financeiros, preços, clientes expostos.
--
-- SOLUCAO: Apertar RLS sprint a sprint, sem quebrar o app.
--
-- ROLES DO SISTEMA:
--   admin, comercial, comercial_senior, producao, financeiro,
--   instalador, diretor
--
-- CONVENCAO DE MIGRATIONS:
--   {NNN}_rls_{sprint}_{dominio}.sql
--   Ex: 041_rls_s1_catalogo_precificacao.sql
--       042_rls_s2_estoque.sql
--       043_rls_s3_producao.sql
--       044_rls_s4_financeiro.sql
--       045_rls_s5_nfe.sql
--
-- ============================================================


-- ############################################################
-- 0. FUNCOES HELPER BASE (rodar ANTES de qualquer sprint)
--    Migration: 041_rls_base_helpers.sql
-- ############################################################

-- 0.1 get_user_role() já existe (002_schema_corrections.sql:769)
-- Vamos apenas garantir que está otimizada com cache via SET LOCAL

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  _role TEXT;
BEGIN
  -- Tenta pegar do cache da transação primeiro
  BEGIN
    _role := current_setting('app.current_user_role', true);
    IF _role IS NOT NULL AND _role <> '' THEN
      RETURN _role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- ignora se setting não existe
  END;

  -- Busca no banco
  SELECT r.nome INTO _role
  FROM profiles p
  JOIN roles r ON r.id = p.role_id
  WHERE p.id = auth.uid();

  _role := COALESCE(_role, 'none');

  -- Cacheia na transação
  PERFORM set_config('app.current_user_role', _role, true);

  RETURN _role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_role() IS 'Retorna role do usuario autenticado com cache por transação';


-- 0.2 is_admin() — atalho para policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() IN ('admin', 'diretor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 0.3 is_role() — check flexível
CREATE OR REPLACE FUNCTION public.is_role(VARIADIC allowed_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = ANY(allowed_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 0.4 is_owner() — verifica se o user é dono do registro
CREATE OR REPLACE FUNCTION public.is_owner(owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN owner_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 0.5 Macro para dropar todas policies de uma tabela (útil em rollback)
CREATE OR REPLACE FUNCTION public.drop_all_policies(target_table TEXT)
RETURNS VOID AS $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = target_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, target_table);
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- ############################################################
-- SPRINT 1: CATALOGO PRODUTOS + PRECIFICACAO
-- Migration: 042_rls_s1_catalogo_precificacao.sql
-- ############################################################
--
-- TABELAS AFETADAS:
--   produtos, produto_modelos, modelo_materiais, modelo_processos,
--   config_precificacao, regras_precificacao, acabamentos, servicos,
--   faixas_quantidade, materiais_historico_preco, maquinas
--
-- LOGICA:
--   - Catálogo (produtos, modelos): todos LEEM, admin/comercial ESCREVEM
--   - Precificação (config, regras, markups): admin/financeiro ESCREVEM,
--     comercial LÊ (precisa pra montar proposta), produção NÃO vê preços
--   - Máquinas: admin/produção gerenciam
--

-- === produtos ===
SELECT drop_all_policies('produtos');

CREATE POLICY "produtos_select"
  ON produtos FOR SELECT TO authenticated
  USING (true); -- todos veem catálogo

CREATE POLICY "produtos_insert"
  ON produtos FOR INSERT TO authenticated
  WITH CHECK (is_role('admin', 'diretor', 'comercial_senior'));

CREATE POLICY "produtos_update"
  ON produtos FOR UPDATE TO authenticated
  USING (is_role('admin', 'diretor', 'comercial_senior'))
  WITH CHECK (is_role('admin', 'diretor', 'comercial_senior'));

CREATE POLICY "produtos_delete"
  ON produtos FOR DELETE TO authenticated
  USING (is_admin());


-- === produto_modelos ===
SELECT drop_all_policies('produto_modelos');

CREATE POLICY "modelos_select"
  ON produto_modelos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "modelos_write"
  ON produto_modelos FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'comercial_senior'))
  WITH CHECK (is_role('admin', 'diretor', 'comercial_senior'));


-- === modelo_materiais ===
SELECT drop_all_policies('modelo_materiais');

CREATE POLICY "modelo_mat_select"
  ON modelo_materiais FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "modelo_mat_write"
  ON modelo_materiais FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === modelo_processos ===
SELECT drop_all_policies('modelo_processos');

CREATE POLICY "modelo_proc_select"
  ON modelo_processos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "modelo_proc_write"
  ON modelo_processos FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === config_precificacao (SENSIVEL — custos reais da empresa) ===
SELECT drop_all_policies('config_precificacao');

CREATE POLICY "config_preco_select"
  ON config_precificacao FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro', 'comercial_senior'));
  -- producao e comercial junior NÃO veem custos reais

CREATE POLICY "config_preco_write"
  ON config_precificacao FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === regras_precificacao ===
SELECT drop_all_policies('regras_precificacao');

CREATE POLICY "regras_preco_select"
  ON regras_precificacao FOR SELECT TO authenticated
  USING (
    ativo = true
    OR is_role('admin', 'diretor', 'financeiro')
  );

CREATE POLICY "regras_preco_write"
  ON regras_precificacao FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === acabamentos ===
SELECT drop_all_policies('acabamentos');

CREATE POLICY "acabamentos_select"
  ON acabamentos FOR SELECT TO authenticated
  USING (ativo = true OR is_admin());

CREATE POLICY "acabamentos_write"
  ON acabamentos FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === servicos ===
SELECT drop_all_policies('servicos');

CREATE POLICY "servicos_select"
  ON servicos FOR SELECT TO authenticated
  USING (ativo = true OR is_admin());

CREATE POLICY "servicos_write"
  ON servicos FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro', 'comercial_senior'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro', 'comercial_senior'));


-- === maquinas ===
SELECT drop_all_policies('maquinas');

CREATE POLICY "maquinas_select"
  ON maquinas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "maquinas_write"
  ON maquinas FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === faixas_quantidade ===
SELECT drop_all_policies('faixas_quantidade');

CREATE POLICY "faixas_select"
  ON faixas_quantidade FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "faixas_write"
  ON faixas_quantidade FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === materiais_historico_preco ===
SELECT drop_all_policies('materiais_historico_preco');

CREATE POLICY "mat_hist_preco_select"
  ON materiais_historico_preco FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro', 'comercial_senior'));

CREATE POLICY "mat_hist_preco_write"
  ON materiais_historico_preco FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- ############################################################
-- SPRINT 2: ESTOQUE REAL
-- Migration: 043_rls_s2_estoque.sql
-- ############################################################
--
-- TABELAS AFETADAS:
--   materiais, estoque_saldos, estoque_movimentacoes,
--   fornecedores, pedidos_compra, pedido_compra_itens,
--   historico_precos (historico_precos_fornecedor),
--   inventarios, inventario_itens, recebimentos, recebimento_itens,
--   solicitacoes_compra, cotacoes_compra
--
-- LOGICA:
--   - Materiais: todos LEEM (precisam ver na proposta), admin/produção ESCREVEM
--   - Estoque saldos/movimentações: producao + admin (quem mexe no chão de fábrica)
--   - Fornecedores/Compras: financeiro + admin (área de suprimentos)
--   - Inventários: producao + admin
--

-- === materiais ===
SELECT drop_all_policies('materiais');

CREATE POLICY "materiais_select"
  ON materiais FOR SELECT TO authenticated
  USING (true); -- todos precisam ver pra compor proposta

CREATE POLICY "materiais_write"
  ON materiais FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'producao', 'financeiro'));


-- === estoque_saldos ===
SELECT drop_all_policies('estoque_saldos');

CREATE POLICY "estoque_saldos_select"
  ON estoque_saldos FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'financeiro'));
  -- comercial NÃO precisa ver saldos de estoque

CREATE POLICY "estoque_saldos_write"
  ON estoque_saldos FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === estoque_movimentacoes ===
SELECT drop_all_policies('estoque_movimentacoes');

CREATE POLICY "estoque_mov_select"
  ON estoque_movimentacoes FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'financeiro'));

CREATE POLICY "estoque_mov_insert"
  ON estoque_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (is_role('admin', 'diretor', 'producao'));

-- Movimentações não devem ser editadas/deletadas (imutáveis)
-- Sem policy de UPDATE/DELETE = ninguém altera


-- === fornecedores ===
SELECT drop_all_policies('fornecedores');

CREATE POLICY "fornecedores_select"
  ON fornecedores FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro', 'producao'));

CREATE POLICY "fornecedores_write"
  ON fornecedores FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === pedidos_compra ===
SELECT drop_all_policies('pedidos_compra');

CREATE POLICY "ped_compra_select"
  ON pedidos_compra FOR SELECT TO authenticated
  USING (
    is_admin()
    OR is_role('financeiro')
    OR is_owner(criado_por) -- quem criou pode ver
  );

CREATE POLICY "ped_compra_insert"
  ON pedidos_compra FOR INSERT TO authenticated
  WITH CHECK (is_role('admin', 'diretor', 'financeiro', 'producao'));

CREATE POLICY "ped_compra_update"
  ON pedidos_compra FOR UPDATE TO authenticated
  USING (
    is_role('admin', 'diretor', 'financeiro')
    OR (is_owner(criado_por) AND status = 'rascunho') -- autor edita só rascunho
  )
  WITH CHECK (is_role('admin', 'diretor', 'financeiro') OR is_owner(criado_por));

CREATE POLICY "ped_compra_delete"
  ON pedidos_compra FOR DELETE TO authenticated
  USING (is_admin() AND status = 'rascunho'); -- só admin deleta rascunho


-- === pedido_compra_itens ===
SELECT drop_all_policies('pedido_compra_itens');

CREATE POLICY "ped_compra_itens_select"
  ON pedido_compra_itens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos_compra pc
      WHERE pc.id = pedido_compra_id
      -- herda visibilidade do pedido pai
    )
  );

CREATE POLICY "ped_compra_itens_write"
  ON pedido_compra_itens FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro', 'producao'));


-- === historico_precos ===
SELECT drop_all_policies('historico_precos');

CREATE POLICY "hist_precos_select"
  ON historico_precos FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "hist_precos_write"
  ON historico_precos FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === inventarios ===
SELECT drop_all_policies('inventarios');

CREATE POLICY "inventarios_select"
  ON inventarios FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'financeiro'));

CREATE POLICY "inventarios_write"
  ON inventarios FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === inventario_itens ===
SELECT drop_all_policies('inventario_itens');

CREATE POLICY "inv_itens_select"
  ON inventario_itens FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'financeiro'));

CREATE POLICY "inv_itens_write"
  ON inventario_itens FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === recebimentos ===
SELECT drop_all_policies('recebimentos');

CREATE POLICY "recebimentos_select"
  ON recebimentos FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'financeiro'));

CREATE POLICY "recebimentos_write"
  ON recebimentos FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === recebimento_itens ===
SELECT drop_all_policies('recebimento_itens');

CREATE POLICY "receb_itens_select"
  ON recebimento_itens FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'financeiro'));

CREATE POLICY "receb_itens_write"
  ON recebimento_itens FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === solicitacoes_compra ===
SELECT drop_all_policies('solicitacoes_compra');

CREATE POLICY "solic_compra_select"
  ON solicitacoes_compra FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro', 'producao'));

CREATE POLICY "solic_compra_write"
  ON solicitacoes_compra FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro', 'producao'));


-- === cotacoes_compra ===
SELECT drop_all_policies('cotacoes_compra');

CREATE POLICY "cotacoes_select"
  ON cotacoes_compra FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "cotacoes_write"
  ON cotacoes_compra FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- ############################################################
-- SPRINT 3: PCP / PRODUCAO
-- Migration: 044_rls_s3_producao.sql
-- ############################################################
--
-- TABELAS AFETADAS:
--   ordens_producao, producao_etapas, producao_checklist,
--   producao_retrabalho, producao_apontamentos, producao_materiais,
--   ferramentas, checkout_almoxarife, diario_bordo,
--   checklists, checklist_itens, checklist_execucoes, checklist_execucao_itens
--
-- LOGICA:
--   - Ordens/Etapas: produção LEITURA+ATUALIZACAO, admin TUDO
--   - Comercial pode VER status (acompanhar pedido do cliente)
--   - Almoxarife/Diário: só produção + admin
--   - Retrabalho: produção registra, financeiro/admin VÊ (impacto custo)
--

-- === ordens_producao ===
SELECT drop_all_policies('ordens_producao');

CREATE POLICY "op_select"
  ON ordens_producao FOR SELECT TO authenticated
  USING (
    is_role('admin', 'diretor', 'producao', 'financeiro')
    OR (
      -- comercial vê OP dos seus pedidos
      is_role('comercial', 'comercial_senior')
      AND EXISTS (
        SELECT 1 FROM pedidos p
        WHERE p.id = pedido_id AND p.vendedor_id = auth.uid()
      )
    )
  );

CREATE POLICY "op_insert"
  ON ordens_producao FOR INSERT TO authenticated
  WITH CHECK (is_role('admin', 'diretor', 'producao'));

CREATE POLICY "op_update"
  ON ordens_producao FOR UPDATE TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));

CREATE POLICY "op_delete"
  ON ordens_producao FOR DELETE TO authenticated
  USING (is_admin());


-- === producao_etapas ===
SELECT drop_all_policies('producao_etapas');

CREATE POLICY "etapas_select"
  ON producao_etapas FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao'));

CREATE POLICY "etapas_write"
  ON producao_etapas FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === producao_checklist ===
SELECT drop_all_policies('producao_checklist');

CREATE POLICY "prod_check_select"
  ON producao_checklist FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao'));

CREATE POLICY "prod_check_write"
  ON producao_checklist FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === producao_retrabalho (SENSIVEL — impacto financeiro) ===
SELECT drop_all_policies('producao_retrabalho');

CREATE POLICY "retrabalho_select"
  ON producao_retrabalho FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'financeiro'));

CREATE POLICY "retrabalho_insert"
  ON producao_retrabalho FOR INSERT TO authenticated
  WITH CHECK (is_role('admin', 'diretor', 'producao'));

CREATE POLICY "retrabalho_update"
  ON producao_retrabalho FOR UPDATE TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));
  -- financeiro vê mas não edita


-- === producao_apontamentos ===
SELECT drop_all_policies('producao_apontamentos');

CREATE POLICY "apontamentos_select"
  ON producao_apontamentos FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'financeiro'));

CREATE POLICY "apontamentos_write"
  ON producao_apontamentos FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === producao_materiais ===
SELECT drop_all_policies('producao_materiais');

CREATE POLICY "prod_mat_select"
  ON producao_materiais FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao'));

CREATE POLICY "prod_mat_write"
  ON producao_materiais FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === ferramentas (almoxarife) ===
SELECT drop_all_policies('ferramentas');

CREATE POLICY "ferramentas_select"
  ON ferramentas FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao'));

CREATE POLICY "ferramentas_write"
  ON ferramentas FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === checkout_almoxarife ===
SELECT drop_all_policies('checkout_almoxarife');

CREATE POLICY "checkout_select"
  ON checkout_almoxarife FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao'));

CREATE POLICY "checkout_write"
  ON checkout_almoxarife FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === diario_bordo ===
SELECT drop_all_policies('diario_bordo');

CREATE POLICY "diario_select"
  ON diario_bordo FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao'));

CREATE POLICY "diario_write"
  ON diario_bordo FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === checklists (templates) ===
SELECT drop_all_policies('checklists');

CREATE POLICY "checklists_select"
  ON checklists FOR SELECT TO authenticated
  USING (true); -- templates são publicos

CREATE POLICY "checklists_write"
  ON checklists FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === checklist_itens ===
SELECT drop_all_policies('checklist_itens');

CREATE POLICY "check_itens_select"
  ON checklist_itens FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "check_itens_write"
  ON checklist_itens FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao'))
  WITH CHECK (is_role('admin', 'diretor', 'producao'));


-- === checklist_execucoes ===
SELECT drop_all_policies('checklist_execucoes');

CREATE POLICY "check_exec_select"
  ON checklist_execucoes FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'instalador'));

CREATE POLICY "check_exec_write"
  ON checklist_execucoes FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'instalador'))
  WITH CHECK (is_role('admin', 'diretor', 'producao', 'instalador'));


-- === checklist_execucao_itens ===
SELECT drop_all_policies('checklist_execucao_itens');

CREATE POLICY "check_exec_itens_select"
  ON checklist_execucao_itens FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'instalador'));

CREATE POLICY "check_exec_itens_write"
  ON checklist_execucao_itens FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'producao', 'instalador'))
  WITH CHECK (is_role('admin', 'diretor', 'producao', 'instalador'));


-- ############################################################
-- SPRINT 4: MOTOR FINANCEIRO
-- Migration: 045_rls_s4_financeiro.sql
-- ############################################################
--
-- TABELAS AFETADAS:
--   contas_receber, parcelas_receber, contas_pagar, parcelas_pagar,
--   comissoes, plano_contas, centros_custo, lancamentos_caixa,
--   bank_accounts, bank_slips, bank_remittances, bank_remittance_items,
--   bank_returns, bank_return_items, retornos_bancarios
--
-- LOGICA:
--   - TUDO financeiro: admin + financeiro ESCREVEM
--   - Comercial vê APENAS suas comissões
--   - Contas a receber: comercial pode VER (acompanhar pagamento do cliente)
--   - Contas a pagar: SOMENTE admin + financeiro (dados sensíveis de custo)
--   - Plano de contas/CC: admin configura, financeiro usa
--

-- === contas_receber ===
SELECT drop_all_policies('contas_receber');

CREATE POLICY "cr_select"
  ON contas_receber FOR SELECT TO authenticated
  USING (
    is_role('admin', 'diretor', 'financeiro')
    OR (
      -- comercial vê contas dos seus clientes
      is_role('comercial', 'comercial_senior')
      AND EXISTS (
        SELECT 1 FROM pedidos p
        WHERE p.id = pedido_id AND p.vendedor_id = auth.uid()
      )
    )
  );

CREATE POLICY "cr_write"
  ON contas_receber FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === parcelas_receber ===
SELECT drop_all_policies('parcelas_receber');

CREATE POLICY "pr_select"
  ON parcelas_receber FOR SELECT TO authenticated
  USING (
    is_role('admin', 'diretor', 'financeiro')
    OR (
      is_role('comercial', 'comercial_senior')
      AND EXISTS (
        SELECT 1 FROM contas_receber cr
        JOIN pedidos p ON p.id = cr.pedido_id
        WHERE cr.id = conta_receber_id AND p.vendedor_id = auth.uid()
      )
    )
  );

CREATE POLICY "pr_write"
  ON parcelas_receber FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === contas_pagar (ALTAMENTE SENSIVEL) ===
SELECT drop_all_policies('contas_pagar');

CREATE POLICY "cp_select"
  ON contas_pagar FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));
  -- NINGUÉM mais vê contas a pagar

CREATE POLICY "cp_write"
  ON contas_pagar FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === parcelas_pagar ===
SELECT drop_all_policies('parcelas_pagar');

CREATE POLICY "pp_select"
  ON parcelas_pagar FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "pp_write"
  ON parcelas_pagar FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === comissoes (comercial vê SÓ as suas) ===
SELECT drop_all_policies('comissoes');

CREATE POLICY "comissoes_select"
  ON comissoes FOR SELECT TO authenticated
  USING (
    is_role('admin', 'diretor', 'financeiro')
    OR vendedor_id = auth.uid() -- vendedor vê só as dele
  );

CREATE POLICY "comissoes_write"
  ON comissoes FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));
  -- comercial NUNCA edita comissão


-- === plano_contas ===
SELECT drop_all_policies('plano_contas');

CREATE POLICY "plano_contas_select"
  ON plano_contas FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "plano_contas_write"
  ON plano_contas FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- === centros_custo ===
SELECT drop_all_policies('centros_custo');

CREATE POLICY "cc_select"
  ON centros_custo FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "cc_write"
  ON centros_custo FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- === lancamentos_caixa ===
SELECT drop_all_policies('lancamentos_caixa');

CREATE POLICY "caixa_select"
  ON lancamentos_caixa FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "caixa_write"
  ON lancamentos_caixa FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === bank_accounts ===
SELECT drop_all_policies('bank_accounts');

CREATE POLICY "bank_acc_select"
  ON bank_accounts FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "bank_acc_write"
  ON bank_accounts FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- === bank_slips (boletos) ===
SELECT drop_all_policies('bank_slips');

CREATE POLICY "boletos_select"
  ON bank_slips FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "boletos_write"
  ON bank_slips FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === bank_remittances ===
SELECT drop_all_policies('bank_remittances');

CREATE POLICY "remessas_select"
  ON bank_remittances FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "remessas_write"
  ON bank_remittances FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === bank_remittance_items ===
SELECT drop_all_policies('bank_remittance_items');

CREATE POLICY "remessa_itens_select"
  ON bank_remittance_items FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "remessa_itens_write"
  ON bank_remittance_items FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === bank_returns ===
SELECT drop_all_policies('bank_returns');

CREATE POLICY "retornos_select"
  ON bank_returns FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "retornos_write"
  ON bank_returns FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === bank_return_items ===
SELECT drop_all_policies('bank_return_items');

CREATE POLICY "retorno_itens_select"
  ON bank_return_items FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "retorno_itens_write"
  ON bank_return_items FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === retornos_bancarios ===
SELECT drop_all_policies('retornos_bancarios');

CREATE POLICY "ret_banc_select"
  ON retornos_bancarios FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "ret_banc_write"
  ON retornos_bancarios FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- ############################################################
-- SPRINT 5: NF-e (MODULO FISCAL)
-- Migration: 046_rls_s5_nfe.sql
-- ############################################################
--
-- TABELAS AFETADAS:
--   fiscal_ambientes, fiscal_series, fiscal_certificados,
--   fiscal_regras_operacao, fiscal_documentos, fiscal_documentos_itens,
--   fiscal_eventos, fiscal_xmls, fiscal_filas_emissao,
--   fiscal_erros_transmissao, fiscal_audit_logs
--
-- LOGICA:
--   - Configuração fiscal (ambientes, séries, certificados, regras): SOMENTE admin
--   - Documentos fiscais: financeiro LÊ/ESCREVE, comercial VÊ (NF do pedido)
--   - XMLs/Filas/Erros: admin + financeiro (operacional)
--   - Audit logs: SOMENTE admin LÊ (imutável, ninguém escreve via RLS)
--

-- === fiscal_ambientes (config) ===
SELECT drop_all_policies('fiscal_ambientes');

CREATE POLICY "fiscal_amb_select"
  ON fiscal_ambientes FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "fiscal_amb_write"
  ON fiscal_ambientes FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- === fiscal_series (config) ===
SELECT drop_all_policies('fiscal_series');

CREATE POLICY "fiscal_series_select"
  ON fiscal_series FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "fiscal_series_write"
  ON fiscal_series FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- === fiscal_certificados (ALTAMENTE SENSIVEL — certificado digital) ===
SELECT drop_all_policies('fiscal_certificados');

CREATE POLICY "fiscal_cert_select"
  ON fiscal_certificados FOR SELECT TO authenticated
  USING (is_admin());
  -- SOMENTE admin vê certificados digitais

CREATE POLICY "fiscal_cert_write"
  ON fiscal_certificados FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- === fiscal_regras_operacao ===
SELECT drop_all_policies('fiscal_regras_operacao');

CREATE POLICY "fiscal_regras_select"
  ON fiscal_regras_operacao FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "fiscal_regras_write"
  ON fiscal_regras_operacao FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- === fiscal_documentos (NF-e emitidas) ===
SELECT drop_all_policies('fiscal_documentos');

CREATE POLICY "fiscal_doc_select"
  ON fiscal_documentos FOR SELECT TO authenticated
  USING (
    is_role('admin', 'diretor', 'financeiro')
    OR (
      -- comercial vê NF dos seus pedidos
      is_role('comercial', 'comercial_senior')
      AND EXISTS (
        SELECT 1 FROM pedidos p
        WHERE p.id = pedido_id AND p.vendedor_id = auth.uid()
      )
    )
  );

CREATE POLICY "fiscal_doc_insert"
  ON fiscal_documentos FOR INSERT TO authenticated
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "fiscal_doc_update"
  ON fiscal_documentos FOR UPDATE TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));

-- NF-e NUNCA é deletada (obrigação fiscal)
-- Sem policy de DELETE


-- === fiscal_documentos_itens ===
SELECT drop_all_policies('fiscal_documentos_itens');

CREATE POLICY "fiscal_doc_itens_select"
  ON fiscal_documentos_itens FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro', 'comercial', 'comercial_senior'));

CREATE POLICY "fiscal_doc_itens_write"
  ON fiscal_documentos_itens FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === fiscal_eventos ===
SELECT drop_all_policies('fiscal_eventos');

CREATE POLICY "fiscal_eventos_select"
  ON fiscal_eventos FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "fiscal_eventos_insert"
  ON fiscal_eventos FOR INSERT TO authenticated
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));
  -- Eventos são imutáveis


-- === fiscal_xmls ===
SELECT drop_all_policies('fiscal_xmls');

CREATE POLICY "fiscal_xmls_select"
  ON fiscal_xmls FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "fiscal_xmls_write"
  ON fiscal_xmls FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === fiscal_filas_emissao ===
SELECT drop_all_policies('fiscal_filas_emissao');

CREATE POLICY "fiscal_fila_select"
  ON fiscal_filas_emissao FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "fiscal_fila_write"
  ON fiscal_filas_emissao FOR ALL TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'))
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));


-- === fiscal_erros_transmissao ===
SELECT drop_all_policies('fiscal_erros_transmissao');

CREATE POLICY "fiscal_erros_select"
  ON fiscal_erros_transmissao FOR SELECT TO authenticated
  USING (is_role('admin', 'diretor', 'financeiro'));

CREATE POLICY "fiscal_erros_insert"
  ON fiscal_erros_transmissao FOR INSERT TO authenticated
  WITH CHECK (is_role('admin', 'diretor', 'financeiro'));
  -- Erros são log imutável


-- === fiscal_audit_logs (AUDITORIA — somente leitura admin) ===
SELECT drop_all_policies('fiscal_audit_logs');

CREATE POLICY "fiscal_audit_select"
  ON fiscal_audit_logs FOR SELECT TO authenticated
  USING (is_admin());
  -- Nenhuma policy de INSERT/UPDATE/DELETE via RLS
  -- Inserções feitas via SECURITY DEFINER triggers


-- ############################################################
-- ESTRATEGIA DE TESTES
-- ############################################################
--
-- 1. TESTE UNITARIO POR ROLE (rodar no Supabase SQL Editor):
--
--    -- Simular um usuario especifico:
--    SET LOCAL role = 'authenticated';
--    SET LOCAL request.jwt.claims = '{"sub": "<UUID_DO_USUARIO>"}';
--
--    -- Testar SELECT:
--    SELECT count(*) FROM contas_pagar; -- deve retornar 0 se role=comercial
--
--    -- Testar INSERT:
--    INSERT INTO config_precificacao (faturamento_medio) VALUES (100000);
--    -- deve dar "new row violates row-level security policy" se role=producao
--
--
-- 2. SCRIPT DE VALIDACAO AUTOMATICA:
--
--    CREATE OR REPLACE FUNCTION test_rls_matrix()
--    RETURNS TABLE(tabela TEXT, role_name TEXT, operacao TEXT, resultado TEXT) AS $$
--    DECLARE
--      test_tables TEXT[] := ARRAY['contas_pagar', 'config_precificacao', 'fiscal_certificados'];
--      t TEXT;
--      r TEXT;
--      test_roles TEXT[] := ARRAY['admin', 'comercial', 'producao', 'financeiro', 'instalador'];
--    BEGIN
--      FOREACH t IN ARRAY test_tables
--      LOOP
--        FOREACH r IN ARRAY test_roles
--        LOOP
--          tabela := t;
--          role_name := r;
--          operacao := 'SELECT';
--          BEGIN
--            EXECUTE format('SELECT 1 FROM %I LIMIT 1', t);
--            resultado := 'PERMITIDO';
--          EXCEPTION WHEN insufficient_privilege THEN
--            resultado := 'BLOQUEADO';
--          END;
--          RETURN NEXT;
--        END LOOP;
--      END LOOP;
--    END;
--    $$ LANGUAGE plpgsql SECURITY DEFINER;
--
--
-- 3. TESTE NO FRONTEND:
--    - Criar usuarios de teste para cada role
--    - Logar como cada role e navegar por todas as telas
--    - Verificar que:
--      * Telas de financeiro retornam vazio para role=producao
--      * Botões de editar desaparecem quando role não tem permissão
--      * Erros de RLS são capturados pelo error boundary
--
--
-- 4. CHECKLIST POR SPRINT:
--    [ ] Rodar migration em branch Supabase (não em prod)
--    [ ] Testar com usuario admin (deve ver tudo)
--    [ ] Testar com usuario comercial (deve ver apenas seus dados)
--    [ ] Testar com usuario producao (deve ver apenas produção)
--    [ ] Testar com usuario financeiro (deve ver finanças)
--    [ ] Verificar que triggers SECURITY DEFINER não foram bloqueados
--    [ ] Verificar que edge functions com service_role_key bypassam RLS
--    [ ] Só então aplicar em prod
--
--
-- ############################################################
-- PLANO DE ROLLBACK
-- ############################################################
--
-- Se RLS quebrar algo em produção, executar IMEDIATAMENTE:
--
-- OPCAO 1: Reverter tabela específica para USING(true)
--
--   SELECT drop_all_policies('NOME_DA_TABELA');
--   CREATE POLICY "emergency_rollback"
--     ON NOME_DA_TABELA FOR ALL TO authenticated
--     USING (true) WITH CHECK (true);
--
--
-- OPCAO 2: Rollback completo de um sprint (ex: Sprint 4 Financeiro)
--
--   DO $$
--   DECLARE
--     t TEXT;
--     sprint4_tables TEXT[] := ARRAY[
--       'contas_receber', 'parcelas_receber', 'contas_pagar', 'parcelas_pagar',
--       'comissoes', 'plano_contas', 'centros_custo', 'lancamentos_caixa',
--       'bank_accounts', 'bank_slips', 'bank_remittances', 'bank_remittance_items',
--       'bank_returns', 'bank_return_items', 'retornos_bancarios'
--     ];
--   BEGIN
--     FOREACH t IN ARRAY sprint4_tables
--     LOOP
--       PERFORM drop_all_policies(t);
--       EXECUTE format(
--         'CREATE POLICY "emergency_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
--         t, t
--       );
--     END LOOP;
--   END $$;
--
--
-- OPCAO 3: Desabilitar RLS completamente (ULTIMO RECURSO — expõe dados!)
--
--   ALTER TABLE NOME_DA_TABELA DISABLE ROW LEVEL SECURITY;
--   -- CUIDADO: isso expõe a tabela para anon também!
--
--
-- ############################################################
-- NOTAS IMPORTANTES
-- ############################################################
--
-- 1. SECURITY DEFINER: Triggers e functions com SECURITY DEFINER
--    bypassam RLS. Verificar que trigger_pedido_conta_receber,
--    trigger_validar_status_propostas etc. usam SECURITY DEFINER.
--
-- 2. SERVICE_ROLE_KEY: Edge functions (ex: OneDrive integration)
--    usam service_role_key que bypassa RLS. Sem impacto.
--
-- 3. PERFORMANCE: get_user_role() é chamada em TODA query.
--    O cache via set_config minimiza impacto, mas monitorar
--    pg_stat_statements após cada sprint.
--
-- 4. SOFT DELETE: Tabelas com excluido_em devem manter o filtro
--    de soft delete nos selects do frontend. RLS NÃO filtra soft delete.
--
-- 5. ORDEM DE DEPLOY:
--    a) Rodar migration de helpers (041) PRIMEIRO
--    b) Cada sprint subsequente depende dos helpers
--    c) Nunca rodar Sprint N+1 sem validar Sprint N
--
-- 6. TABELAS NAO COBERTAS (ficam com USING true por design):
--    - profiles (gerenciado pelo Supabase Auth)
--    - roles, permissions, role_permissions (admin-only já no 002)
--    - audit_logs (insert-only via trigger)
--    - admin_config (feature flags — todos leem)
--    - notifications, notificacoes (cada user vê as suas — filtro no frontend)
--    - campanhas, campanha_destinatarios (comercial)
--    - clientes, cliente_contatos, cliente_unidades (todos precisam)
--    - propostas, proposta_itens (já tem RLS granular no 006)
--    - pedidos, pedido_itens (já tem RLS granular no 002)

-- 063_rls_producao.sql
-- RLS para módulo de produção

-- Habilitar RLS nas tabelas de produção
ALTER TABLE ordens_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE producao_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE producao_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE producao_apontamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE producao_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE producao_retrabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE setores_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;

-- ordens_producao: todos leem, producao+admin escrevem
DROP POLICY IF EXISTS "op_select" ON ordens_producao;
CREATE POLICY "op_select" ON ordens_producao
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "op_write" ON ordens_producao;
CREATE POLICY "op_write" ON ordens_producao
  FOR ALL TO authenticated
  USING (get_user_role() IN ('producao', 'admin', 'gerente'))
  WITH CHECK (get_user_role() IN ('producao', 'admin', 'gerente'));

-- producao_etapas: todos leem, producao+admin escrevem
DROP POLICY IF EXISTS "etapas_select" ON producao_etapas;
CREATE POLICY "etapas_select" ON producao_etapas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "etapas_write" ON producao_etapas;
CREATE POLICY "etapas_write" ON producao_etapas
  FOR ALL TO authenticated
  USING (get_user_role() IN ('producao', 'admin', 'gerente'))
  WITH CHECK (get_user_role() IN ('producao', 'admin', 'gerente'));

-- producao_apontamentos: operador insere próprios, leitura geral
DROP POLICY IF EXISTS "apontamentos_select" ON producao_apontamentos;
CREATE POLICY "apontamentos_select" ON producao_apontamentos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "apontamentos_insert" ON producao_apontamentos;
CREATE POLICY "apontamentos_insert" ON producao_apontamentos
  FOR INSERT TO authenticated
  WITH CHECK (operador_id = auth.uid());

DROP POLICY IF EXISTS "apontamentos_update" ON producao_apontamentos;
CREATE POLICY "apontamentos_update" ON producao_apontamentos
  FOR UPDATE TO authenticated
  USING (operador_id = auth.uid() OR get_user_role() IN ('admin', 'gerente'));

-- producao_materiais: todos leem, producao+admin+almoxarife escrevem
DROP POLICY IF EXISTS "materiais_producao_select" ON producao_materiais;
CREATE POLICY "materiais_producao_select" ON producao_materiais
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "materiais_producao_write" ON producao_materiais;
CREATE POLICY "materiais_producao_write" ON producao_materiais
  FOR ALL TO authenticated
  USING (get_user_role() IN ('producao', 'admin', 'almoxarife', 'gerente'))
  WITH CHECK (get_user_role() IN ('producao', 'admin', 'almoxarife', 'gerente'));

-- setores_producao: todos leem, admin escreve
DROP POLICY IF EXISTS "setores_select" ON setores_producao;
CREATE POLICY "setores_select" ON setores_producao
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "setores_write" ON setores_producao;
CREATE POLICY "setores_write" ON setores_producao
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- etapa_templates: todos leem, admin escreve
DROP POLICY IF EXISTS "etapa_templates_select" ON etapa_templates;
CREATE POLICY "etapa_templates_select" ON etapa_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "etapa_templates_write" ON etapa_templates;
CREATE POLICY "etapa_templates_write" ON etapa_templates
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- routing_rules: todos leem, admin escreve
DROP POLICY IF EXISTS "routing_rules_select" ON routing_rules;
CREATE POLICY "routing_rules_select" ON routing_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "routing_rules_write" ON routing_rules;
CREATE POLICY "routing_rules_write" ON routing_rules
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- producao_checklist: producao+admin
DROP POLICY IF EXISTS "checklist_all" ON producao_checklist;
CREATE POLICY "checklist_all" ON producao_checklist
  FOR ALL TO authenticated
  USING (get_user_role() IN ('producao', 'admin', 'gerente'))
  WITH CHECK (get_user_role() IN ('producao', 'admin', 'gerente'));

-- producao_retrabalho: producao+admin
DROP POLICY IF EXISTS "retrabalho_all" ON producao_retrabalho;
CREATE POLICY "retrabalho_all" ON producao_retrabalho
  FOR ALL TO authenticated
  USING (get_user_role() IN ('producao', 'admin', 'gerente'))
  WITH CHECK (get_user_role() IN ('producao', 'admin', 'gerente'));

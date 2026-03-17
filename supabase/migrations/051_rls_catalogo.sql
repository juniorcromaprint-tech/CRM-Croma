-- 051_rls_catalogo.sql
-- RLS para tabelas do catálogo (Sprint 1)
-- Supersede policies de migration 027 via drop_all_policies()

-- CATEGORIAS DE PRODUTO: todos leem, apenas admin escreve
SELECT drop_all_policies('categorias_produto');
ALTER TABLE categorias_produto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_categorias_select" ON categorias_produto FOR SELECT USING (true);
CREATE POLICY "cat_categorias_write" ON categorias_produto FOR ALL USING (is_admin());

-- PRODUTOS: todos leem, admin escreve
SELECT drop_all_policies('produtos');
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_produtos_select" ON produtos FOR SELECT USING (true);
CREATE POLICY "cat_produtos_write" ON produtos FOR ALL USING (is_admin());

-- PRODUTO_MODELOS: todos leem, admin e producao escrevem
SELECT drop_all_policies('produto_modelos');
ALTER TABLE produto_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_modelos_select" ON produto_modelos FOR SELECT USING (true);
CREATE POLICY "cat_modelos_write" ON produto_modelos FOR ALL USING (is_role('admin') OR is_role('producao'));

-- MODELO_MATERIAIS: todos leem, admin e producao escrevem
SELECT drop_all_policies('modelo_materiais');
ALTER TABLE modelo_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_mm_select" ON modelo_materiais FOR SELECT USING (true);
CREATE POLICY "cat_mm_write" ON modelo_materiais FOR ALL USING (is_role('admin') OR is_role('producao'));

-- MODELO_PROCESSOS: todos leem, admin e producao escrevem
SELECT drop_all_policies('modelo_processos');
ALTER TABLE modelo_processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_mp_select" ON modelo_processos FOR SELECT USING (true);
CREATE POLICY "cat_mp_write" ON modelo_processos FOR ALL USING (is_role('admin') OR is_role('producao'));

-- REGRAS_PRECIFICACAO: todos leem (comercial precisa), admin escreve
SELECT drop_all_policies('regras_precificacao');
ALTER TABLE regras_precificacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_regras_select" ON regras_precificacao FOR SELECT USING (true);
CREATE POLICY "cat_regras_write" ON regras_precificacao FOR ALL USING (is_admin());

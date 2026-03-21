-- Migration 082: Configuração chave PIX no admin_config
INSERT INTO admin_config (chave, valor, descricao)
VALUES ('chave_pix', '', 'Chave PIX da empresa (CNPJ, CPF, email ou telefone)')
ON CONFLICT (chave) DO NOTHING;

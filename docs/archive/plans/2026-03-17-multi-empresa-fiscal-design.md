# Multi-Empresa Fiscal (Hibrida) — Design

> **Aprovado**: 2026-03-17 | **Abordagem**: Hibrida (multi-empresa so no fiscal)

## Objetivo

Permitir emitir NF-e por diferentes CNPJs/empresas usando o mesmo ERP.
Quando ha apenas 1 empresa cadastrada, emite automaticamente por ela.
Quando ha 2+, o sistema pergunta por qual empresa emitir.

## Arquitetura

### Modelo de Dados

```sql
-- NOVA tabela
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL UNIQUE,
  ie TEXT,                    -- Inscricao Estadual
  im TEXT,                    -- Inscricao Municipal
  crt INTEGER NOT NULL DEFAULT 1,  -- 1=Simples, 2=Simples Excesso, 3=Normal
  logradouro TEXT,
  numero_endereco TEXT,
  complemento TEXT,
  bairro TEXT,
  municipio TEXT,
  uf TEXT,
  cep TEXT,
  codigo_municipio_ibge TEXT,
  telefone TEXT,
  logo_url TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK adicionadas
ALTER TABLE fiscal_ambientes ADD COLUMN empresa_id UUID REFERENCES empresas(id);
ALTER TABLE fiscal_certificados ADD COLUMN empresa_id UUID REFERENCES empresas(id);
ALTER TABLE fiscal_series ADD COLUMN empresa_id UUID REFERENCES empresas(id);
ALTER TABLE fiscal_documentos ADD COLUMN empresa_id UUID REFERENCES empresas(id);
```

### Migracao de Dados

1. Cria registro em `empresas` com dados da Croma Print (extraidos de fiscal_ambientes atual)
2. Popula `empresa_id` em todos os registros fiscais existentes com o ID da Croma
3. Os campos de emitente em fiscal_ambientes ficam como cache/override (nao removidos)

### Comportamento na Emissao

```
total_empresas = SELECT count(*) FROM empresas WHERE ativa = true

IF total_empresas == 1:
  empresa = SELECT * FROM empresas WHERE ativa LIMIT 1
  -> usa automaticamente, sem perguntar

IF total_empresas >= 2:
  -> mostra dropdown "Emitir por qual empresa?"
  -> usuario seleciona
  -> sistema puxa ambiente/certificado/series da empresa selecionada
```

### UI

1. **Configuracoes Fiscais > aba "Empresas"** — CRUD com campos completos
2. **Certificados** — filtro por empresa (cada empresa tem seu .pfx)
3. **Emissao NF-e** — dropdown de empresa so aparece se count >= 2
4. **Sidebar** — sem mudanca (nao e seletor global)

### Impacto no Resto do ERP

ZERO. Clientes, pedidos, leads, producao, financeiro — tudo continua global.
Apenas as tabelas fiscais ganham `empresa_id`.

## Escopo do que NAO muda

- Tabelas nao-fiscais (clientes, pedidos, leads, etc.)
- AuthContext (sem empresa_id no perfil)
- RLS policies existentes
- Sidebar/navegacao

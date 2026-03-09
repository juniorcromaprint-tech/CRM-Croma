-- =========================================================
-- CROMA PRINT ERP
-- MÓDULO FISCAL MVP - NF-e
-- PostgreSQL / Supabase
-- Migration: 003_fiscal_module.sql
-- =========================================================
-- OBJETIVO:
-- Estruturar o núcleo fiscal para emissão de NF-e,
-- mantendo arquitetura preparada para futura NFSe.
--
-- OBSERVAÇÕES:
-- 1. Este schema assume que já existem:
--    - profiles
--    - clientes
--    - pedidos
--    - pedido_itens
--    - audit_logs (ou equivalente)
-- 2. Caso alguns desses objetos ainda não existam,
--    adaptar os FKs ao schema real.
-- 3. Certificado A1 deve ser usado SOMENTE no backend.
-- =========================================================

begin;

-- =========================================================
-- EXTENSÕES
-- =========================================================
create extension if not exists pgcrypto;

-- =========================================================
-- FUNÇÃO AUXILIAR DE UPDATED_AT
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- AJUSTES NO CADASTRO DE CLIENTES
-- =========================================================
-- Adiciona campos fiscais mínimos para NF-e
-- Adaptar caso a tabela clientes já tenha alguns campos.
-- =========================================================
alter table if exists public.clientes
  add column if not exists cpf_cnpj text,
  add column if not exists inscricao_estadual text,
  add column if not exists inscricao_municipal text,
  add column if not exists email_fiscal text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists pais text default 'Brasil',
  add column if not exists tipo_contribuinte text,
  add column if not exists regime_tributario text,
  add column if not exists contato_financeiro text,
  add column if not exists observacoes_fiscais text,
  add column if not exists suframa text,
  add column if not exists indicador_ie_destinatario text;

comment on column public.clientes.cpf_cnpj is 'CPF ou CNPJ do cliente para emissão fiscal';
comment on column public.clientes.inscricao_estadual is 'IE do destinatário, quando aplicável';
comment on column public.clientes.indicador_ie_destinatario is '9=não contribuinte, 1=contribuinte ICMS etc., conforme regra fiscal adotada';

-- =========================================================
-- AJUSTES EM PEDIDOS
-- =========================================================
alter table if exists public.pedidos
  add column if not exists status_fiscal text default 'nao_iniciado',
  add column if not exists fiscal_validado boolean default false,
  add column if not exists fiscal_validado_em timestamptz,
  add column if not exists fiscal_validado_por uuid references public.profiles(id),
  add column if not exists fiscal_regra_id uuid,
  add column if not exists tipo_documento_previsto text default 'nfe',
  add column if not exists possui_documento_fiscal boolean default false,
  add column if not exists ultimo_documento_fiscal_id uuid,
  add column if not exists bloqueio_fiscal_motivo text;

comment on column public.pedidos.status_fiscal is 'nao_iniciado, validando, apto, rascunho, emitindo, autorizado, rejeitado, cancelado';
comment on column public.pedidos.tipo_documento_previsto is 'nfe no MVP; arquitetura preparada para nfse futuramente';

-- =========================================================
-- TABELA DE AMBIENTES FISCAIS
-- =========================================================
create table if not exists public.fiscal_ambientes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null check (tipo in ('homologacao', 'producao')),
  endpoint_base text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fiscal_ambientes is 'Ambientes fiscais separados por homologação e produção';

drop trigger if exists trg_fiscal_ambientes_updated_at on public.fiscal_ambientes;
create trigger trg_fiscal_ambientes_updated_at
before update on public.fiscal_ambientes
for each row execute function public.set_updated_at();

-- =========================================================
-- TABELA DE SÉRIES FISCAIS
-- =========================================================
create table if not exists public.fiscal_series (
  id uuid primary key default gen_random_uuid(),
  tipo_documento text not null check (tipo_documento in ('nfe', 'nfse')),
  serie integer not null,
  ultimo_numero bigint not null default 0,
  ambiente_id uuid not null references public.fiscal_ambientes(id),
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo_documento, serie, ambiente_id)
);

comment on table public.fiscal_series is 'Controla séries fiscais por ambiente';

drop trigger if exists trg_fiscal_series_updated_at on public.fiscal_series;
create trigger trg_fiscal_series_updated_at
before update on public.fiscal_series
for each row execute function public.set_updated_at();

-- =========================================================
-- TABELA DE CERTIFICADOS
-- =========================================================
-- O arquivo do A1 deve ser armazenado criptografado em storage
-- ou em cofre externo. Aqui ficam apenas os metadados.
-- =========================================================
create table if not exists public.fiscal_certificados (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo_certificado text not null check (tipo_certificado in ('a1')),
  arquivo_encriptado_url text not null,
  thumbprint text,
  cnpj_titular text not null,
  validade_inicio date,
  validade_fim date,
  senha_secret_ref text,
  ambiente_id uuid references public.fiscal_ambientes(id),
  ativo boolean not null default true,
  ultimo_teste_em timestamptz,
  ultimo_teste_status text,
  observacoes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fiscal_certificados is 'Metadados do certificado A1; nunca armazenar senha pura';
comment on column public.fiscal_certificados.senha_secret_ref is 'Referência a segredo no secret manager / environment';

drop trigger if exists trg_fiscal_certificados_updated_at on public.fiscal_certificados;
create trigger trg_fiscal_certificados_updated_at
before update on public.fiscal_certificados
for each row execute function public.set_updated_at();

-- =========================================================
-- TABELA DE REGRAS FISCAIS DE OPERAÇÃO
-- =========================================================
-- Mantida genérica para permitir NFSe no futuro,
-- mas o MVP trabalha com NFe.
-- =========================================================
create table if not exists public.fiscal_regras_operacao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text unique,
  tipo_documento text not null check (tipo_documento in ('nfe', 'nfse')),
  natureza_operacao text not null,
  finalidade_nfe text default 'normal',
  cfop text,
  ncm_padrao text,
  cst_padrao text,
  csosn_padrao text,
  serie_id uuid references public.fiscal_series(id),
  ambiente_id uuid references public.fiscal_ambientes(id),
  consumidor_final boolean,
  contribuinte_icms boolean,
  gerar_financeiro_apos_autorizacao boolean not null default true,
  observacoes text,
  ativo boolean not null default true,
  prioridade_regra integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fiscal_regras_operacao is 'Matriz fiscal parametrizável por operação';
comment on column public.fiscal_regras_operacao.tipo_documento is 'MVP usa nfe; nfse reservada para expansão futura';

drop trigger if exists trg_fiscal_regras_operacao_updated_at on public.fiscal_regras_operacao;
create trigger trg_fiscal_regras_operacao_updated_at
before update on public.fiscal_regras_operacao
for each row execute function public.set_updated_at();

-- =========================================================
-- TABELA PRINCIPAL DE DOCUMENTOS FISCAIS
-- =========================================================
create table if not exists public.fiscal_documentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id),
  cliente_id uuid not null references public.clientes(id),
  tipo_documento text not null check (tipo_documento in ('nfe', 'nfse')),
  categoria_operacao text,
  provider text not null,
  regra_operacao_id uuid references public.fiscal_regras_operacao(id),
  ambiente_id uuid references public.fiscal_ambientes(id),
  serie_id uuid references public.fiscal_series(id),
  certificado_id uuid references public.fiscal_certificados(id),
  status text not null default 'rascunho' check (
    status in (
      'rascunho',
      'validando',
      'apto',
      'emitindo',
      'autorizado',
      'rejeitado',
      'cancelado',
      'denegado',
      'inutilizado',
      'erro_transmissao'
    )
  ),
  numero bigint,
  chave_acesso text,
  protocolo text,
  recibo text,
  data_emissao timestamptz,
  data_autorizacao timestamptz,
  data_cancelamento timestamptz,
  valor_total numeric(14,2) not null default 0,
  valor_produtos numeric(14,2) not null default 0,
  valor_frete numeric(14,2) not null default 0,
  valor_seguro numeric(14,2) not null default 0,
  valor_desconto numeric(14,2) not null default 0,
  valor_outras_despesas numeric(14,2) not null default 0,
  valor_bc_icms numeric(14,2) not null default 0,
  valor_icms numeric(14,2) not null default 0,
  valor_bc_icms_st numeric(14,2) not null default 0,
  valor_icms_st numeric(14,2) not null default 0,
  valor_ipi numeric(14,2) not null default 0,
  valor_pis numeric(14,2) not null default 0,
  valor_cofins numeric(14,2) not null default 0,
  valor_ii numeric(14,2) not null default 0,
  valor_danfe numeric(14,2) not null default 0,
  natureza_operacao text,
  finalidade_emissao text,
  observacoes text,
  informacoes_fisco text,
  informacoes_contribuinte text,
  payload_json jsonb,
  retorno_json jsonb,
  xml_url text,
  pdf_url text,
  mensagem_erro text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo_documento, ambiente_id, serie_id, numero)
);

comment on table public.fiscal_documentos is 'Documento fiscal emitido ou em processo de emissão';
comment on column public.fiscal_documentos.provider is 'Identificador do provedor fiscal usado pelo backend';
comment on column public.fiscal_documentos.payload_json is 'Payload montado para emissão';
comment on column public.fiscal_documentos.retorno_json is 'Retorno bruto resumido do provider';

drop trigger if exists trg_fiscal_documentos_updated_at on public.fiscal_documentos;
create trigger trg_fiscal_documentos_updated_at
before update on public.fiscal_documentos
for each row execute function public.set_updated_at();

-- =========================================================
-- ITENS DO DOCUMENTO FISCAL
-- =========================================================
create table if not exists public.fiscal_documentos_itens (
  id uuid primary key default gen_random_uuid(),
  fiscal_documento_id uuid not null references public.fiscal_documentos(id) on delete cascade,
  pedido_item_id uuid references public.pedido_itens(id),
  item_numero integer not null,
  codigo_produto text,
  descricao text not null,
  ncm text,
  cfop text not null,
  cest text,
  unidade text not null default 'UN',
  quantidade numeric(14,4) not null default 0,
  valor_unitario numeric(14,6) not null default 0,
  valor_bruto numeric(14,2) not null default 0,
  valor_desconto numeric(14,2) not null default 0,
  valor_total numeric(14,2) not null default 0,
  cst_ou_csosn text,
  origem_mercadoria text,
  aliquota_icms numeric(8,4) default 0,
  base_calculo_icms numeric(14,2) default 0,
  valor_icms numeric(14,2) default 0,
  aliquota_ipi numeric(8,4) default 0,
  base_calculo_ipi numeric(14,2) default 0,
  valor_ipi numeric(14,2) default 0,
  aliquota_pis numeric(8,4) default 0,
  base_calculo_pis numeric(14,2) default 0,
  valor_pis numeric(14,2) default 0,
  aliquota_cofins numeric(8,4) default 0,
  base_calculo_cofins numeric(14,2) default 0,
  valor_cofins numeric(14,2) default 0,
  observacoes text,
  created_at timestamptz not null default now(),
  unique (fiscal_documento_id, item_numero)
);

comment on table public.fiscal_documentos_itens is 'Itens detalhados da NF-e';

-- =========================================================
-- EVENTOS FISCAIS
-- =========================================================
-- Emissão, consulta, cancelamento, correção, reprocessamento etc.
-- =========================================================
create table if not exists public.fiscal_eventos (
  id uuid primary key default gen_random_uuid(),
  fiscal_documento_id uuid not null references public.fiscal_documentos(id) on delete cascade,
  tipo_evento text not null check (
    tipo_evento in (
      'validacao',
      'rascunho',
      'emissao',
      'consulta',
      'cancelamento',
      'reprocessamento',
      'download_xml',
      'download_pdf',
      'correcao',
      'sincronizacao_status'
    )
  ),
  status text not null,
  protocolo text,
  justificativa text,
  payload_envio jsonb,
  payload_retorno jsonb,
  mensagem text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

comment on table public.fiscal_eventos is 'Histórico de eventos do documento fiscal';

-- =========================================================
-- XMLS / ARQUIVOS FISCAIS
-- =========================================================
create table if not exists public.fiscal_xmls (
  id uuid primary key default gen_random_uuid(),
  fiscal_documento_id uuid not null references public.fiscal_documentos(id) on delete cascade,
  tipo_arquivo text not null check (
    tipo_arquivo in (
      'xml_envio',
      'xml_retorno',
      'xml_autorizado',
      'xml_cancelamento',
      'pdf_danfe',
      'json_payload'
    )
  ),
  storage_path text not null,
  hash_arquivo text,
  tamanho_bytes bigint,
  created_at timestamptz not null default now()
);

comment on table public.fiscal_xmls is 'Arquivos fiscais armazenados em storage';

-- =========================================================
-- FILA DE EMISSÃO
-- =========================================================
create table if not exists public.fiscal_filas_emissao (
  id uuid primary key default gen_random_uuid(),
  fiscal_documento_id uuid not null references public.fiscal_documentos(id) on delete cascade,
  status_fila text not null default 'pendente' check (
    status_fila in (
      'pendente',
      'processando',
      'aguardando_retorno',
      'sucesso',
      'falha',
      'cancelado'
    )
  ),
  tentativas integer not null default 0,
  prioridade integer not null default 0,
  proxima_tentativa_em timestamptz,
  ultimo_erro text,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fiscal_filas_emissao is 'Fila de processamento assíncrono da emissão fiscal';

drop trigger if exists trg_fiscal_filas_emissao_updated_at on public.fiscal_filas_emissao;
create trigger trg_fiscal_filas_emissao_updated_at
before update on public.fiscal_filas_emissao
for each row execute function public.set_updated_at();

-- =========================================================
-- ERROS DE TRANSMISSÃO
-- =========================================================
create table if not exists public.fiscal_erros_transmissao (
  id uuid primary key default gen_random_uuid(),
  fiscal_documento_id uuid references public.fiscal_documentos(id) on delete cascade,
  provider text not null,
  etapa text,
  codigo_erro text,
  mensagem_erro text not null,
  payload_resumido jsonb,
  stack_resumida text,
  created_at timestamptz not null default now()
);

comment on table public.fiscal_erros_transmissao is 'Erros técnicos de integração/transmissão';

-- =========================================================
-- LOG DE AUDITORIA FISCAL
-- =========================================================
create table if not exists public.fiscal_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  entidade text not null,
  entidade_id uuid not null,
  acao text not null,
  resultado text,
  antes jsonb,
  depois jsonb,
  metadados jsonb,
  created_at timestamptz not null default now()
);

comment on table public.fiscal_audit_logs is 'Auditoria específica do módulo fiscal';

-- =========================================================
-- AJUSTA FK DE PEDIDOS PARA REGRA E DOCUMENTO FISCAL
-- =========================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_pedidos_fiscal_regra'
  ) then
    alter table public.pedidos
      add constraint fk_pedidos_fiscal_regra
      foreign key (fiscal_regra_id) references public.fiscal_regras_operacao(id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'fk_pedidos_ultimo_documento_fiscal'
  ) then
    alter table public.pedidos
      add constraint fk_pedidos_ultimo_documento_fiscal
      foreign key (ultimo_documento_fiscal_id) references public.fiscal_documentos(id);
  end if;
end $$;

-- =========================================================
-- ÍNDICES PRINCIPAIS
-- =========================================================
create index if not exists idx_clientes_cpf_cnpj
  on public.clientes (cpf_cnpj);
create index if not exists idx_clientes_email_fiscal
  on public.clientes (email_fiscal);
create index if not exists idx_pedidos_status_fiscal
  on public.pedidos (status_fiscal);
create index if not exists idx_pedidos_possui_documento_fiscal
  on public.pedidos (possui_documento_fiscal);
create index if not exists idx_fiscal_documentos_pedido_id
  on public.fiscal_documentos (pedido_id);
create index if not exists idx_fiscal_documentos_cliente_id
  on public.fiscal_documentos (cliente_id);
create index if not exists idx_fiscal_documentos_status
  on public.fiscal_documentos (status);
create index if not exists idx_fiscal_documentos_tipo_documento
  on public.fiscal_documentos (tipo_documento);
create index if not exists idx_fiscal_documentos_data_emissao
  on public.fiscal_documentos (data_emissao);
create index if not exists idx_fiscal_documentos_numero
  on public.fiscal_documentos (numero);
create index if not exists idx_fiscal_documentos_chave_acesso
  on public.fiscal_documentos (chave_acesso);
create index if not exists idx_fiscal_documentos_provider
  on public.fiscal_documentos (provider);
create index if not exists idx_fiscal_itens_fiscal_documento_id
  on public.fiscal_documentos_itens (fiscal_documento_id);
create index if not exists idx_fiscal_itens_pedido_item_id
  on public.fiscal_documentos_itens (pedido_item_id);
create index if not exists idx_fiscal_eventos_documento
  on public.fiscal_eventos (fiscal_documento_id, created_at desc);
create index if not exists idx_fiscal_xmls_documento
  on public.fiscal_xmls (fiscal_documento_id);
create index if not exists idx_fiscal_filas_status
  on public.fiscal_filas_emissao (status_fila, proxima_tentativa_em);
create index if not exists idx_fiscal_erros_documento
  on public.fiscal_erros_transmissao (fiscal_documento_id);
create index if not exists idx_fiscal_audit_entidade
  on public.fiscal_audit_logs (entidade, entidade_id, created_at desc);

-- =========================================================
-- FUNÇÃO: GERAR PRÓXIMO NÚMERO DA SÉRIE
-- =========================================================
create or replace function public.fiscal_proximo_numero_serie(p_serie_id uuid)
returns bigint
language plpgsql
as $$
declare
  v_numero bigint;
begin
  update public.fiscal_series
     set ultimo_numero = ultimo_numero + 1,
         updated_at = now()
   where id = p_serie_id
   returning ultimo_numero into v_numero;
  if v_numero is null then
    raise exception 'Série fiscal não encontrada: %', p_serie_id;
  end if;
  return v_numero;
end;
$$;

comment on function public.fiscal_proximo_numero_serie(uuid) is 'Reserva e retorna o próximo número fiscal da série';

-- =========================================================
-- FUNÇÃO: VALIDAR DADOS MÍNIMOS DO CLIENTE PARA NF-e
-- =========================================================
create or replace function public.fiscal_validar_cliente_nfe(p_cliente_id uuid)
returns table (
  ok boolean,
  mensagem text
)
language plpgsql
as $$
declare
  v_cliente record;
begin
  select *
    into v_cliente
    from public.clientes
   where id = p_cliente_id;

  if not found then
    return query select false, 'Cliente não encontrado';
    return;
  end if;
  if coalesce(trim(v_cliente.razao_social), '') = '' then
    return query select false, 'Razão social não informada';
    return;
  end if;
  if coalesce(trim(v_cliente.cpf_cnpj), '') = '' then
    return query select false, 'CPF/CNPJ não informado';
    return;
  end if;
  if coalesce(trim(v_cliente.endereco), '') = '' then
    return query select false, 'Endereço não informado';
    return;
  end if;
  if coalesce(trim(v_cliente.numero), '') = '' then
    return query select false, 'Número do endereço não informado';
    return;
  end if;
  if coalesce(trim(v_cliente.bairro), '') = '' then
    return query select false, 'Bairro não informado';
    return;
  end if;
  if coalesce(trim(v_cliente.cidade), '') = '' then
    return query select false, 'Cidade não informada';
    return;
  end if;
  if coalesce(trim(v_cliente.estado), '') = '' then
    return query select false, 'Estado não informado';
    return;
  end if;
  if coalesce(trim(v_cliente.cep), '') = '' then
    return query select false, 'CEP não informado';
    return;
  end if;
  return query select true, 'Cliente apto para NF-e';
end;
$$;

-- =========================================================
-- FUNÇÃO: VALIDAR PEDIDO PARA EMISSÃO
-- =========================================================
create or replace function public.fiscal_validar_pedido_nfe(p_pedido_id uuid)
returns table (
  ok boolean,
  mensagem text
)
language plpgsql
as $$
declare
  v_pedido record;
  v_itens integer;
  v_cliente_validacao record;
begin
  select *
    into v_pedido
    from public.pedidos
   where id = p_pedido_id;

  if not found then
    return query select false, 'Pedido não encontrado';
    return;
  end if;
  if v_pedido.status = 'cancelado' then
    return query select false, 'Pedido cancelado não pode emitir NF-e';
    return;
  end if;

  select count(*)
    into v_itens
    from public.pedido_itens
   where pedido_id = p_pedido_id;

  if coalesce(v_itens, 0) = 0 then
    return query select false, 'Pedido sem itens não pode emitir NF-e';
    return;
  end if;

  select *
    into v_cliente_validacao
    from public.fiscal_validar_cliente_nfe(v_pedido.cliente_id);

  if not v_cliente_validacao.ok then
    return query select false, v_cliente_validacao.mensagem;
    return;
  end if;

  return query select true, 'Pedido apto para emissão de NF-e';
end;
$$;

-- =========================================================
-- FUNÇÃO: AUDITORIA FISCAL
-- =========================================================
create or replace function public.fiscal_registrar_auditoria(
  p_user_id uuid,
  p_entidade text,
  p_entidade_id uuid,
  p_acao text,
  p_resultado text,
  p_antes jsonb default null,
  p_depois jsonb default null,
  p_metadados jsonb default null
)
returns void
language plpgsql
as $$
begin
  insert into public.fiscal_audit_logs (
    user_id,
    entidade,
    entidade_id,
    acao,
    resultado,
    antes,
    depois,
    metadados
  ) values (
    p_user_id,
    p_entidade,
    p_entidade_id,
    p_acao,
    p_resultado,
    p_antes,
    p_depois,
    p_metadados
  );
end;
$$;

-- =========================================================
-- FUNÇÃO: REFLETIR STATUS FISCAL NO PEDIDO
-- =========================================================
create or replace function public.fiscal_sincronizar_status_pedido()
returns trigger
language plpgsql
as $$
begin
  update public.pedidos
     set status_fiscal =
       case
         when new.status = 'rascunho'         then 'rascunho'
         when new.status = 'validando'         then 'validando'
         when new.status = 'apto'              then 'apto'
         when new.status = 'emitindo'          then 'emitindo'
         when new.status = 'autorizado'        then 'autorizado'
         when new.status = 'rejeitado'         then 'rejeitado'
         when new.status = 'cancelado'         then 'cancelado'
         else coalesce(status_fiscal, 'nao_iniciado')
       end,
       possui_documento_fiscal = true,
       ultimo_documento_fiscal_id = new.id,
       updated_at = now()
   where id = new.pedido_id;
  return new;
end;
$$;

drop trigger if exists trg_fiscal_sincronizar_status_pedido on public.fiscal_documentos;
create trigger trg_fiscal_sincronizar_status_pedido
after insert or update of status on public.fiscal_documentos
for each row execute function public.fiscal_sincronizar_status_pedido();

-- =========================================================
-- FUNÇÃO: CRIAR RASCUNHO FISCAL A PARTIR DO PEDIDO
-- =========================================================
-- Não emite a nota. Apenas cria o documento fiscal em rascunho.
-- =========================================================
create or replace function public.fiscal_criar_rascunho_nfe(
  p_pedido_id uuid,
  p_user_id uuid,
  p_provider text default 'nfe_provider'
)
returns uuid
language plpgsql
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_regra public.fiscal_regras_operacao%rowtype;
  v_certificado public.fiscal_certificados%rowtype;
  v_documento_id uuid;
  v_validacao record;
  v_item record;
  v_total numeric(14,2) := 0;
  v_item_numero integer := 1;
begin
  select * into v_pedido
    from public.pedidos
   where id = p_pedido_id;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  select * into v_validacao
    from public.fiscal_validar_pedido_nfe(p_pedido_id);

  if not v_validacao.ok then
    raise exception '%', v_validacao.mensagem;
  end if;

  select *
    into v_regra
    from public.fiscal_regras_operacao
   where id = v_pedido.fiscal_regra_id
     and ativo = true
   limit 1;

  if v_regra.id is null then
    raise exception 'Pedido sem regra fiscal válida';
  end if;

  select *
    into v_certificado
    from public.fiscal_certificados
   where ambiente_id = v_regra.ambiente_id
     and ativo = true
   order by created_at desc
   limit 1;

  if v_certificado.id is null then
    raise exception 'Nenhum certificado ativo encontrado para o ambiente fiscal';
  end if;

  insert into public.fiscal_documentos (
    pedido_id,
    cliente_id,
    tipo_documento,
    provider,
    regra_operacao_id,
    ambiente_id,
    serie_id,
    certificado_id,
    status,
    valor_total,
    valor_produtos,
    natureza_operacao,
    finalidade_emissao,
    created_by,
    updated_by
  ) values (
    v_pedido.id,
    v_pedido.cliente_id,
    'nfe',
    p_provider,
    v_regra.id,
    v_regra.ambiente_id,
    v_regra.serie_id,
    v_certificado.id,
    'rascunho',
    0,
    0,
    v_regra.natureza_operacao,
    coalesce(v_regra.finalidade_nfe, 'normal'),
    p_user_id,
    p_user_id
  )
  returning id into v_documento_id;

  for v_item in
    select pi.*
      from public.pedido_itens pi
     where pi.pedido_id = p_pedido_id
     order by pi.created_at
  loop
    insert into public.fiscal_documentos_itens (
      fiscal_documento_id,
      pedido_item_id,
      item_numero,
      descricao,
      ncm,
      cfop,
      unidade,
      quantidade,
      valor_unitario,
      valor_bruto,
      valor_total,
      cst_ou_csosn
    ) values (
      v_documento_id,
      v_item.id,
      v_item_numero,
      coalesce(v_item.descricao, 'Item do pedido'),
      v_regra.ncm_padrao,
      coalesce(v_regra.cfop, '5102'),
      coalesce(v_item.unidade, 'UN'),
      coalesce(v_item.quantidade, 0),
      coalesce(v_item.valor_unitario, 0),
      coalesce(v_item.valor_total, 0),
      coalesce(v_item.valor_total, 0),
      coalesce(v_regra.csosn_padrao, v_regra.cst_padrao)
    );
    v_item_numero := v_item_numero + 1;
    v_total := v_total + coalesce(v_item.valor_total, 0);
  end loop;

  update public.fiscal_documentos
     set valor_total = v_total,
         valor_produtos = v_total
   where id = v_documento_id;

  perform public.fiscal_registrar_auditoria(
    p_user_id,
    'fiscal_documentos',
    v_documento_id,
    'gerar_rascunho',
    'sucesso',
    null,
    jsonb_build_object('pedido_id', p_pedido_id, 'tipo_documento', 'nfe'),
    null
  );

  return v_documento_id;
end;
$$;

-- =========================================================
-- TRIGGER BÁSICO: IMPEDIR EXCLUSÃO FÍSICA DE DOCUMENTO AUTORIZADO
-- =========================================================
create or replace function public.fiscal_bloquear_delete_documento_autorizado()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'autorizado' then
    raise exception 'Documento fiscal autorizado não pode ser excluído fisicamente';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_fiscal_bloquear_delete_documento_autorizado on public.fiscal_documentos;
create trigger trg_fiscal_bloquear_delete_documento_autorizado
before delete on public.fiscal_documentos
for each row execute function public.fiscal_bloquear_delete_documento_autorizado();

-- =========================================================
-- DADOS INICIAIS
-- =========================================================
insert into public.fiscal_ambientes (codigo, nome, tipo, endpoint_base, ativo)
values
  ('NFE_HML', 'NF-e Homologação', 'homologacao', 'https://hom.nfe.fazenda.gov.br', true),
  ('NFE_PRD', 'NF-e Produção',    'producao',    'https://nfe.fazenda.gov.br',     true)
on conflict (codigo) do nothing;

-- Séries padrão para MVP
insert into public.fiscal_series (tipo_documento, serie, ultimo_numero, ambiente_id, ativo, observacoes)
select
  'nfe',
  1,
  0,
  fa.id,
  true,
  'Série padrão inicial'
from public.fiscal_ambientes fa
where fa.codigo in ('NFE_HML', 'NFE_PRD')
and not exists (
  select 1
    from public.fiscal_series fs
   where fs.tipo_documento = 'nfe'
     and fs.serie = 1
     and fs.ambiente_id = fa.id
);

-- Regra fiscal padrão para comunicação visual
insert into public.fiscal_regras_operacao (
  nome,
  codigo,
  tipo_documento,
  natureza_operacao,
  finalidade_nfe,
  cfop,
  ncm_padrao,
  csosn_padrao,
  consumidor_final,
  contribuinte_icms,
  gerar_financeiro_apos_autorizacao,
  observacoes,
  ativo,
  prioridade_regra,
  serie_id,
  ambiente_id
)
select
  'Venda de Comunicação Visual',
  'VENDA_COM_VISUAL',
  'nfe',
  'Venda de mercadoria',
  'normal',
  '5102',
  '4911.99.00',
  '500',
  true,
  false,
  true,
  'Regra padrão para venda de produtos de comunicação visual - Simples Nacional',
  true,
  10,
  fs.id,
  fa.id
from public.fiscal_ambientes fa
join public.fiscal_series fs on fs.ambiente_id = fa.id and fs.serie = 1
where fa.codigo = 'NFE_HML'
and not exists (
  select 1 from public.fiscal_regras_operacao where codigo = 'VENDA_COM_VISUAL'
);

commit;

# Design: Melhorias no Formulário de Clientes

**Data**: 2026-03-16
**Status**: Aprovado
**Escopo**: `src/domains/clientes/`

---

## Objetivo

Melhorar a experiência de cadastro de clientes com três funcionalidades:
1. Campo Inscrição Estadual no formulário de edição
2. Autocomplete de endereço via CEP (ViaCEP)
3. Autocomplete de dados da empresa via CNPJ (ReceitaWS)

---

## 1. Campo Inscrição Estadual

- Campo já existe no banco (`clientes.inscricao_estadual`) e é exibido na view
- Falta apenas o input no formulário de edição
- Opcional, sem validação de formato (varia por estado)
- Posicionado ao lado do CNPJ no grid do formulário

**Sem migration necessária.**

---

## 2. Autocomplete de CEP — ViaCEP

**Hook:** `useCepLookup()` em `src/domains/clientes/hooks/useCepLookup.ts`

**Trigger:** `onBlur` no campo CEP, quando contém exatamente 8 dígitos (ignorando hífen)

**API:** `https://viacep.com.br/ws/{cep}/json/` — gratuita, sem chave, sem limite

**Mapeamento:**
| Campo do form | Campo ViaCEP |
|---|---|
| `endereco_rua` | `logradouro` |
| `endereco_bairro` | `bairro` |
| `endereco_cidade` | `localidade` |
| `endereco_estado` | `uf` |

**Número e complemento:** sempre manuais.

**Estados:**
- Loading: spinner/disabled no campo CEP durante a busca
- Sucesso: campos preenchidos, foco move para campo Número
- CEP inválido (`erro: true` na resposta): toast de aviso, campos inalterados
- Erro de rede: toast de aviso, campos inalterados

---

## 3. Autocomplete de CNPJ — ReceitaWS

**Hook:** `useCnpjLookup()` em `src/domains/clientes/hooks/useCnpjLookup.ts`

**Trigger:** botão "Buscar" ao lado do campo CNPJ (não automático)

**API primária:** `https://receitaws.com.br/v1/cnpj/{cnpj}` — gratuita, 3 req/min (suficiente para uso manual)
**Fallback CORS:** `https://publica.cnpj.ws/cnpj/{cnpj}` — sem chave, sem limite documentado

**Mapeamento:**
| Campo do form | ReceitaWS | CNPJ.ws |
|---|---|---|
| `razao_social` | `nome` | `razao_social` |
| `nome_fantasia` | `fantasia` | `nome_fantasia` |
| `email` | `email` | `estabelecimento.email` |
| `telefone` | `telefone` | `estabelecimento.telefone1` |
| `endereco_rua` | `logradouro` + `numero` | `estabelecimento.logradouro` + `numero` |
| `endereco_bairro` | `bairro` | `estabelecimento.bairro` |
| `endereco_cidade` | `municipio` | `estabelecimento.cidade.nome` |
| `endereco_estado` | `uf` | `estabelecimento.estado.sigla` |
| `endereco_cep` | `cep` | `estabelecimento.cep` |

**Regra de sobrescrita:** preenche apenas campos **vazios** no formulário. Campos já preenchidos pelo vendedor são preservados.

**Estados:**
- Loading: botão "Buscando..." disabled com spinner
- CNPJ ativo: toast de sucesso "Dados preenchidos", campos populados
- CNPJ inativo/baixado: toast de erro com situação ("Empresa BAIXADA")
- CNPJ não encontrado: toast de erro "CNPJ não encontrado"
- Erro de rede: toast de erro, tenta fallback automaticamente

**UX do botão:** ícone de busca (Search) + texto "Buscar" — posicionado à direita do campo CNPJ.

---

## Arquitetura

```
src/domains/clientes/
  hooks/
    useCepLookup.ts     ← novo
    useCnpjLookup.ts    ← novo
  pages/
    ClienteDetailPage.tsx  ← adiciona IE, conecta os hooks
```

**Sem migration. Sem Edge Function. Sem nova dependência npm.**

---

## Critérios de Sucesso

- [ ] Campo IE aparece no form de edição e salva corretamente
- [ ] Digitar CEP válido e sair do campo preenche rua, bairro, cidade e estado
- [ ] CEP inválido mostra toast e não altera campos
- [ ] Botão Buscar com CNPJ válido preenche todos os campos mapeados
- [ ] CNPJ de empresa baixada mostra toast com situação
- [ ] Campos já preenchidos não são sobrescritos pelo autocomplete do CNPJ

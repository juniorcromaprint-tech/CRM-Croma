# CROMA PRINT — APP DE CAMPO

> Integracao entre o CRM/ERP (Produto A) e o App de Campo (Produto B)
> Atualizado: 2026-03-10

---

## 1. Visao Geral

O App de Campo e uma aplicacao separada (PWA mobile-first) usada por instaladores e tecnicos em campo. Ele se integra ao CRM/ERP atraves do mesmo backend Supabase.

```
┌──────────────────────────────────────────────┐
│               SUPABASE (Backend)              │
│  PostgreSQL ─ Auth ─ Storage ─ Realtime       │
└──────────────┬────────────────┬───────────────┘
               │                │
     ┌─────────┴──────┐  ┌────┴────────────┐
     │   CRM/ERP       │  │   App de Campo   │
     │   (desktop)     │  │   (mobile/PWA)   │
     │                 │  │                  │
     │  Gestao:        │  │  Execucao:       │
     │  - Agenda       │  │  - Minhas tarefas│
     │  - Equipes      │  │  - Checklist     │
     │  - Ordens inst. │  │  - Fotos         │
     │  - Qualidade    │  │  - Assinatura    │
     │  - Financeiro   │  │  - Ocorrencias   │
     └────────────────┘  └──────────────────┘
```

---

## 2. Arquitetura Tecnica

### Stack do App de Campo
| Tecnologia | Uso |
|-----------|-----|
| React 19 + TypeScript | Framework |
| Vite | Build |
| Tailwind + shadcn/ui | UI (mesmo design system do CRM) |
| React Router | Navegacao |
| TanStack React Query | Data fetching |
| Supabase | Backend (mesmo do CRM) |
| PWA (Service Worker) | Funcionamento offline |
| Camera API | Captura de fotos |
| Geolocation API | Rastreamento de posicao |
| Canvas API | Assinatura digital |

### Localizacao no Repositorio
```
CRM-Croma/
  src/                    # CRM/ERP (Produto A)
  apps/campo/             # App de Campo (Produto B)
    src/
      App.tsx             # Router com ProtectedRoute
      pages/
        Login.tsx
        Index.tsx         # Dashboard/tarefas do dia
        Jobs.tsx          # Lista de tarefas
        JobDetail.tsx     # Detalhe da tarefa
        Clients.tsx
        StoreMap.tsx      # Mapa de instalacoes
        Analytics.tsx
        Settings.tsx
```

### Deploy Separado
| Produto | Dominio | Root dir |
|---------|---------|----------|
| CRM/ERP | tender-archimedes.vercel.app | `./` (raiz) |
| App Campo | campo-croma.vercel.app | `apps/campo/` |

---

## 3. Fluxo de Integracao

### CRM → App de Campo (dados que descem)

```
CRM/ERP                              App de Campo
────────────────                     ────────────────
Pedido aprovado
  ↓
Producao concluida
  ↓
Instalacao agendada ─────────────→   Tarefa aparece na lista
  - Data/horario                     do tecnico
  - Endereco completo
  - Materiais necessarios
  - Instrucoes especificas
  - Contato do cliente
```

### App de Campo → CRM (dados que sobem)

```
App de Campo                         CRM/ERP
────────────────                     ────────────────
Tecnico inicia tarefa ───────────→   Status: em_deslocamento
  - Geolocalizacao inicio

Checklist pre-instalacao ────────→   Registro de conformidade
  - Itens verificados

Fotos "antes" ──────────────────→   Storage Supabase
                                     Vinculadas a tarefa

Instalacao concluida ───────────→   Status: concluida
  - Fotos "depois"                   Evidencias salvas
  - Checklist pos
  - Assinatura cliente

Ocorrencia de campo ────────────→   Registro de qualidade
  - Descricao do problema            Gera ocorrencia
  - Fotos da evidencia               no modulo Qualidade
```

---

## 4. Telas do App de Campo

### 4.1 Login
- Autenticacao via Supabase Auth (email/senha)
- Roles permitidos: `instalador`, `logistica`
- Sessao persistente (nao precisa logar todo dia)

### 4.2 Minhas Tarefas (Dashboard)
- Lista de instalacoes do dia ordenadas por horario
- Cada tarefa mostra:
  - Cliente e endereco
  - Horario agendado
  - Status atual (badge colorida)
  - Materiais necessarios
- Pull-to-refresh para atualizar

### 4.3 Detalhe da Tarefa
Informacoes completas para execucao:
- Dados do pedido (itens, quantidades, especificacoes)
- Materiais a transportar
- Endereco com link para Google Maps
- Instrucoes especificas do comercial
- Contato do cliente (telefone direto)
- Historico de agendamentos (se reagendada)

### 4.4 Execucao da Tarefa (6 etapas)

**Etapa 1 — Check-in**
- Tecnico marca chegada ao local
- Captura geolocalizacao automatica
- Registra hora de inicio

**Etapa 2 — Checklist Pre-Instalacao**
Lista configuravel de verificacoes:
- Local limpo e acessivel?
- Energia eletrica disponivel?
- Superficies preparadas?
- Materiais conferidos?
- Cliente presente/representante?

**Etapa 3 — Fotos "Antes"**
- Camera nativa do dispositivo
- Minimo 2 fotos obrigatorias
- Categorias: frente, lateral, detalhe

**Etapa 4 — Execucao**
- Registro livre (notas, tempo, dificuldades)
- Opcao de registrar ocorrencia em campo

**Etapa 5 — Fotos "Depois"**
- Mesmos angulos do "antes" para comparacao
- Fotos de detalhe do acabamento

**Etapa 6 — Finalizacao**
- Checklist pos-instalacao
- Assinatura digital do cliente (canvas touch)
- Nome e cargo do assinante
- Observacoes finais
- Botao "Concluir" envia tudo ao CRM

### 4.5 Registro de Ocorrencia
Quando algo da errado em campo:
- Tipo: problema no local, material incorreto, acesso negado, reagendamento
- Descricao livre
- Fotos de evidencia
- Sugestao de acao (reagendar, completar parcial, etc.)

### 4.6 Mapa de Instalacoes
- Mapa com pins de todas as instalacoes
- Filtro por status, periodo, equipe
- Rota sugerida para o dia (otimizacao)

---

## 5. Tabelas de Banco de Dados (Campo)

### `tarefas_campo` (field_tasks)
Tarefa atribuida a um tecnico especifico:
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | PK |
| ordem_instalacao_id | UUID | FK → ordens_instalacao |
| tecnico_id | UUID | FK → profiles |
| status | TEXT | atribuida, em_deslocamento, em_execucao, concluida, nao_concluida |
| inicio | TIMESTAMPTZ | Hora que comecou |
| fim | TIMESTAMPTZ | Hora que terminou |
| latitude_inicio | NUMERIC | Geoloc chegada |
| longitude_inicio | NUMERIC | Geoloc chegada |
| latitude_fim | NUMERIC | Geoloc saida |
| longitude_fim | NUMERIC | Geoloc saida |
| observacoes | TEXT | Notas do tecnico |

### `campo_checklists` (field_checklists)
Itens de verificacao pre e pos instalacao:
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | PK |
| field_task_id | UUID | FK → tarefas_campo |
| tipo | TEXT | pre, pos |
| item | TEXT | Descricao do item |
| marcado | BOOLEAN | Verificado? |
| observacao | TEXT | Nota adicional |
| marcado_em | TIMESTAMPTZ | Quando marcou |

### `campo_midias` (field_media)
Fotos e videos capturados em campo:
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | PK |
| field_task_id | UUID | FK → tarefas_campo |
| tipo | TEXT | foto, video |
| momento | TEXT | antes, durante, depois |
| url | TEXT | URL no Supabase Storage |
| descricao | TEXT | Legenda |

### `campo_assinaturas` (field_signatures)
Assinatura digital do cliente:
| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | PK |
| field_task_id | UUID | FK → tarefas_campo |
| assinante_nome | TEXT | Nome de quem assinou |
| assinante_cargo | TEXT | Cargo |
| imagem_url | TEXT | Imagem da assinatura |

---

## 6. Sincronizacao

### Modo Online (padrao)
- POST direto para Supabase via REST API
- Fotos enviadas para Supabase Storage
- Status atualizado em tempo real

### Modo Offline (futuro)
- Dados salvos em IndexedDB local
- Fila de operacoes pendentes
- Sync automatico ao reconectar
- Indicador visual de "pendente de envio"

### Realtime (Supabase)
O CRM pode acompanhar em tempo real:
- Posicao do tecnico (se compartilhada)
- Atualizacao de status da tarefa
- Novas fotos adicionadas
- Conclusao da instalacao

---

## 7. Limites do App de Campo

O app de campo **NAO** tem acesso a:
- Modulos administrativos
- Financeiro (precos, custos, margens)
- Edicao de pedidos ou propostas
- Gestao de estoque
- Relatorios gerenciais
- Dados de outros tecnicos

### Seguranca (RLS)
- Tecnico so ve suas proprias tarefas
- Acesso restrito por `tecnico_id = auth.uid()`
- Storage isolado por pasta do tecnico
- Sem permissao de DELETE em nenhuma tabela

---

## 8. Metricas de Campo

Dados capturados automaticamente para analise no CRM:

| Metrica | Calculo | Uso |
|---------|---------|-----|
| Tempo medio de instalacao | fim - inicio | Planejamento |
| Taxa de conclusao | concluidas / total | Performance |
| Ocorrencias por tecnico | count por tecnico | Qualidade |
| Km percorrido (estimado) | distancia entre geolocalizacoes | Custo logistico |
| Fotos por tarefa | media de fotos enviadas | Documentacao |
| Tempo de deslocamento | checkin - hora agendada | Roteirizacao |

---

## 9. Fluxo Completo (Exemplo)

```
DIA ANTERIOR (CRM):
  Gestor agenda 3 instalacoes para tecnico Joao
  → 3 tarefas criadas em tarefas_campo

MANHA (App Campo):
  08:00 - Joao abre o app, ve 3 tarefas do dia
  08:30 - Sai para primeira tarefa → status: em_deslocamento
  09:00 - Chega no local → check-in com geolocalizacao
        → Faz checklist pre-instalacao
        → Tira 3 fotos "antes"
  09:15 - Inicia instalacao → status: em_execucao
  10:30 - Finaliza → tira fotos "depois"
        → Checklist pos-instalacao
        → Cliente assina no celular
        → Observacao: "Instalacao OK, parede precisou de limpeza previa"
  10:35 - Marca concluida → status: concluida

TEMPO REAL (CRM):
  Gestor ve no painel: "Tarefa #1 - Concluida as 10:35"
  Fotos ja disponiveis no detalhe da ordem
  Assinatura registrada
  → Automaticamente: pedido_item.status = instalado
  → Se todos itens instalados: pedido.status = concluido
  → Trigger: habilita faturamento
```

# CROMA PRINT — APP DE CAMPO

> Integração entre o CRM/ERP (Produto A) e o App de Campo (Produto B)
> Atualizado: 2026-03-10

**Documentos relacionados**: [ARCHITECTURE](ARCHITECTURE.md) | [BUSINESS_FLOW](BUSINESS_FLOW.md) | [DATABASE_OVERVIEW](DATABASE_OVERVIEW.md)

---

## Índice

- [1. Visão Geral](#1-visão-geral)
- [2. Arquitetura Técnica](#2-arquitetura-técnica)
- [3. Fluxo de Integração](#3-fluxo-de-integração)
- [4. Telas do App](#4-telas-do-app-de-campo)
- [5. Funcionalidades de Mídia](#5-funcionalidades-de-mídia)
- [6. Tabelas do Banco](#6-tabelas-de-banco-de-dados-campo)
- [7. Sincronização](#7-sincronização)
- [8. Segurança e Limites](#8-segurança-e-limites)
- [9. Métricas de Campo](#9-métricas-de-campo)
- [10. Exemplo Completo](#10-fluxo-completo-exemplo)
- [11. Status de Implementação](#11-status-de-implementação)

---

## 1. Visão Geral

O App de Campo é uma aplicação separada (PWA mobile-first) usada por instaladores e técnicos em campo. Ele se integra ao CRM/ERP através do **mesmo backend Supabase**.

```
┌──────────────────────────────────────────────────┐
│               SUPABASE (Backend Unificado)        │
│   PostgreSQL ─ Auth ─ Storage ─ Realtime          │
└──────────────┬─────────────────┬──────────────────┘
               │                 │
     ┌─────────┴──────┐   ┌─────┴──────────────┐
     │   CRM/ERP       │   │   App de Campo      │
     │   (desktop)     │   │   (mobile/PWA)      │
     │                 │   │                     │
     │  Gestão:        │   │  Execução:          │
     │  - Agenda       │   │  - Minhas tarefas   │
     │  - Equipes      │   │  - Checklist        │
     │  - Ordens inst. │   │  - Fotos + watermark│
     │  - Qualidade    │   │  - Assinatura digital│
     │  - Financeiro   │   │  - Ocorrências      │
     └────────────────┘   └─────────────────────┘
```

### Diferença Fundamental
| Aspecto | CRM/ERP | App de Campo |
|---------|---------|-------------|
| Propósito | Gerenciar | Executar |
| Interface | Desktop-first | Mobile-first |
| Auth | DemoRoute (sem login obrigatório) | ProtectedRoute (login real) |
| Dados | Todos os módulos | Apenas tarefas próprias |
| Ações | CRUD completo | Registrar execução |

---

## 2. Arquitetura Técnica

### Stack do App de Campo
| Tecnologia | Uso |
|-----------|-----|
| React 19 + TypeScript | Framework (mesmo do CRM) |
| Vite | Build (PWA plugin) |
| Tailwind + shadcn/ui | UI (mesmo design system) |
| React Router | Navegação |
| TanStack React Query | Data fetching + cache offline |
| Supabase | Backend (mesmo projeto do CRM) |
| Service Worker (PWA) | Funcionamento offline parcial |
| Camera API | Captura de fotos nativa |
| Geolocation API | Rastreamento de posição |
| Canvas API (react-signature-canvas) | Assinatura digital |

### Localização no Repositório
```
CRM-Croma/
├── src/                    # CRM/ERP (Produto A)
├── apps/campo/             # App de Campo (Produto B)
│   └── src/
│       ├── App.tsx          # Router com ProtectedRoute
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Index.tsx    # Dashboard/tarefas do dia
│       │   ├── Jobs.tsx     # Lista com infinite scroll
│       │   ├── JobDetail.tsx # Fotos, assinatura, vídeo, notas
│       │   ├── Clients.tsx
│       │   ├── StoreMap.tsx # Mapa Leaflet
│       │   ├── Analytics.tsx
│       │   ├── BillingReport.tsx
│       │   ├── Team.tsx     # Gestão de equipe (admin)
│       │   └── Settings.tsx
│       └── ...
```

### Deploy Separado
| Produto | Domínio | Root dir | Vercel |
|---------|---------|----------|--------|
| CRM/ERP | crm-croma.vercel.app | `./` (raiz) | Auto-deploy |
| App Campo | campo-croma.vercel.app | `apps/campo/` | Auto-deploy |

---

## 3. Fluxo de Integração

### CRM → App de Campo (dados que descem)

```
CRM/ERP                                App de Campo
────────────────                       ────────────────
Pedido aprovado
  ↓
Produção concluída
  ↓
Instalação agendada ──────────────→    Tarefa aparece na lista
  - Data/horário                       do técnico logado
  - Endereço completo
  - Materiais necessários
  - Instruções específicas
  - Contato do cliente
  - Arte/layout de referência
```

### App de Campo → CRM (dados que sobem)

```
App de Campo                           CRM/ERP
────────────────                       ────────────────
Técnico inicia tarefa ────────────→    Status: em_deslocamento
  - Geolocalização início              (realtime via Supabase)

Checklist pré-instalação ─────────→    Registro de conformidade
  - Itens verificados

Fotos "antes" ───────────────────→    Storage Supabase
  - Com watermark automático           Vinculadas à tarefa
  - Com compressão

Instalação concluída ────────────→    Status: concluída
  - Fotos "depois"                     Evidências salvas
  - Checklist pós
  - Assinatura cliente

Ocorrência de campo ─────────────→    Registro no módulo Qualidade
  - Descrição do problema              Gera ocorrência automática
  - Fotos de evidência
```

---

## 4. Telas do App de Campo

### 4.1 Login
- Autenticação via Supabase Auth (email/senha)
- Roles permitidos: `instalador`, `logística`
- Sessão persistente (não precisa logar todo dia)

### 4.2 Minhas Tarefas (Dashboard)
- Lista de instalações do dia ordenadas por horário
- Cada tarefa mostra:
  - Cliente e endereço
  - Horário agendado
  - Status atual (badge colorida)
  - Materiais necessários
- Pull-to-refresh para atualizar
- Infinite scroll para histórico

### 4.3 Detalhe da Tarefa
Informações completas para execução:
- Dados do pedido (itens, quantidades, especificações)
- Materiais a transportar
- Endereço com link para Google Maps/Waze
- Instruções específicas do comercial
- Contato do cliente (telefone direto com botão ligar)
- Histórico de agendamentos (se reagendada)
- Arte/layout de referência (se disponível)

### 4.4 Execução da Tarefa (6 etapas)

**Etapa 1 — Check-in**
- Técnico marca chegada ao local
- Captura geolocalização automática
- Registra hora de início

**Etapa 2 — Checklist Pré-Instalação**
Lista configurável de verificações:
- ☐ Local limpo e acessível?
- ☐ Energia elétrica disponível?
- ☐ Superfícies preparadas?
- ☐ Materiais conferidos?
- ☐ Cliente presente/representante?

**Etapa 3 — Fotos "Antes"**
- Câmera nativa do dispositivo
- Mínimo 2 fotos obrigatórias
- Categorias: frente, lateral, detalhe
- **Watermark automático** com data/hora e coordenadas
- **Compressão automática** para reduzir upload

**Etapa 4 — Execução**
- Registro livre (notas de voz, tempo, dificuldades)
- Opção de registrar ocorrência em campo
- Foto durante execução (opcional)

**Etapa 5 — Fotos "Depois"**
- Mesmos ângulos do "antes" para comparação visual
- Fotos de detalhe do acabamento
- Watermark e compressão automáticos

**Etapa 6 — Finalização**
- Checklist pós-instalação
- Assinatura digital do cliente (canvas touch com react-signature-canvas)
- Nome e cargo do assinante
- Observações finais
- Botão "Concluir" envia tudo ao CRM

### 4.5 Registro de Ocorrência
Quando algo dá errado em campo:
- Tipo: problema no local, material incorreto, acesso negado, reagendamento
- Descrição livre
- Fotos de evidência
- Sugestão de ação (reagendar, completar parcial, etc.)

### 4.6 Mapa de Instalações
- Mapa com pins de todas as instalações (Leaflet)
- Filtro por status, período, equipe
- Rota sugerida para o dia

### 4.7 Analytics
- Gráficos de produtividade por técnico
- Tarefas concluídas por período
- Tempo médio de instalação

### 4.8 Relatório de Faturamento
- Resumo financeiro das instalações concluídas
- Agrupamento por período/cliente

### 4.9 Gestão de Equipe (admin only)
- Adicionar/remover membros
- Atribuir roles (líder/auxiliar)
- Exclusão via Edge Function (admin)

---

## 5. Funcionalidades de Mídia

### Fotos
| Feature | Status | Descrição |
|---------|--------|-----------|
| Captura via câmera | ✅ Funcional | Camera API nativa |
| Upload para Storage | ✅ Funcional | Supabase Storage |
| Compressão automática | ✅ Funcional | Reduz tamanho antes do upload |
| Watermark automático | ✅ Funcional | Data/hora + coordenadas GPS |
| Categorização (antes/depois) | ✅ Funcional | Momento da captura |
| Galeria por tarefa | ✅ Funcional | Visualização no CRM |

### Vídeo
| Feature | Status | Descrição |
|---------|--------|-----------|
| Captura curta | ✅ Funcional | Vídeos de até 30s |
| Upload | ✅ Funcional | Supabase Storage |

### Assinatura Digital
| Feature | Status | Descrição |
|---------|--------|-----------|
| Canvas touch | ✅ Funcional | react-signature-canvas |
| Salvar como imagem | ✅ Funcional | PNG no Storage |
| Nome + cargo | ✅ Funcional | Campos de texto |

---

## 6. Tabelas de Banco de Dados (Campo)

### `jobs` (tarefas de campo)
Tarefa atribuída a um técnico específico:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| ordem_instalacao_id | UUID | FK → ordens_instalação |
| tecnico_id | UUID | FK → profiles |
| status | TEXT | Pendente, Em andamento, Concluído, Cancelado |
| inicio | TIMESTAMPTZ | Hora que começou |
| fim | TIMESTAMPTZ | Hora que terminou |
| latitude_inicio | NUMERIC | Geoloc chegada |
| longitude_inicio | NUMERIC | Geoloc chegada |
| latitude_fim | NUMERIC | Geoloc saída |
| longitude_fim | NUMERIC | Geoloc saída |
| observacoes | TEXT | Notas do técnico |

### `checklists_campo`
Itens de verificação pré e pós-instalação:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| job_id | UUID | FK → jobs |
| tipo | TEXT | pre, pos |
| item | TEXT | Descrição do item |
| marcado | BOOLEAN | Verificado? |
| observacao | TEXT | Nota adicional |
| marcado_em | TIMESTAMPTZ | Quando marcou |

### `midias_campo` (job_photos / job_videos)
Fotos e vídeos capturados em campo:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| job_id | UUID | FK → jobs |
| tipo | TEXT | foto, video |
| momento | TEXT | antes, durante, depois |
| url | TEXT | URL no Supabase Storage |
| descricao | TEXT | Legenda |

### `assinaturas_campo`
Assinatura digital do cliente:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| job_id | UUID | FK → jobs |
| assinante_nome | TEXT | Nome de quem assinou |
| assinante_cargo | TEXT | Cargo |
| imagem_url | TEXT | Imagem da assinatura (PNG) |

---

## 7. Sincronização

### Modo Online (padrão)
- POST direto para Supabase via REST API
- Fotos enviadas para Supabase Storage (bucket `job_photos`)
- Status atualizado em tempo real

### Detecção de Offline
- ✅ Indicador visual "Sem conexão" implementado
- ⚠️ Fila de sync offline **não implementada** ainda

### Realtime (Supabase)
O CRM pode acompanhar em tempo real via `useCampoRealtimeGlobal()`:
- Atualização de status da tarefa
- Novas fotos adicionadas
- Conclusão da instalação
- Mudanças em qualquer campo do job

---

## 8. Segurança e Limites

### O que o App de Campo **NÃO** tem acesso:
- ❌ Módulos administrativos
- ❌ Financeiro (preços, custos, margens)
- ❌ Edição de pedidos ou propostas
- ❌ Gestão de estoque
- ❌ Relatórios gerenciais
- ❌ Dados de outros técnicos (exceto admin)

### Row Level Security (RLS)
- Técnico só vê **suas próprias tarefas** (⚠️ RLS atualmente mais permissiva — gap identificado)
- Acesso restrito por `tecnico_id = auth.uid()`
- Storage isolado por pasta do técnico
- Sem permissão de DELETE em nenhuma tabela

### Storage Security
- Bucket `job_photos`: acesso privado (não público)
- RLS no bucket implementada via migration 005
- Upload apenas por usuários autenticados

---

## 9. Métricas de Campo

Dados capturados automaticamente para análise no CRM:

| Métrica | Cálculo | Uso |
|---------|---------|-----|
| Tempo médio de instalação | fim - início | Planejamento de agenda |
| Taxa de conclusão | concluídas / total | Performance por técnico |
| Ocorrências por técnico | count agrupado | Qualidade do trabalho |
| Km percorrido (estimado) | distância entre geolocalizações | Custo logístico |
| Fotos por tarefa | média de fotos enviadas | Qualidade da documentação |
| Tempo de deslocamento | check-in - hora agendada | Otimização de rotas |

---

## 10. Fluxo Completo (Exemplo)

```
DIA ANTERIOR (CRM):
  Gestor agenda 3 instalações para técnico João
  → 3 tarefas criadas em jobs

MANHÃ (App Campo):
  08:00 - João abre o app, vê 3 tarefas do dia
  08:30 - Sai para primeira tarefa → status: em_deslocamento
  09:00 - Chega no local → check-in com geolocalização
        → Faz checklist pré-instalação (5 itens ✓)
        → Tira 3 fotos "antes" (com watermark automático)
  09:15 - Inicia instalação → status: em_execução
  10:30 - Finaliza → tira 4 fotos "depois"
        → Checklist pós-instalação
        → Cliente assina no celular (nome: Maria Silva, Gerente)
        → Observação: "Instalação OK, parede precisou de limpeza prévia"
  10:35 - Marca concluída → status: concluída

TEMPO REAL (CRM):
  Gestor vê no painel: "Tarefa #1 - Concluída às 10:35"
  Fotos já disponíveis no detalhe da ordem
  Assinatura registrada
  → Automaticamente: pedido_item.status = instalado
  → Se todos itens instalados: pedido.status = concluído
  → Trigger: habilita faturamento
```

---

## 11. Status de Implementação

### Funcionalidades Prontas ✅
| Feature | Status |
|---------|--------|
| Auth + ProtectedRoute | ✅ Funcional |
| Jobs (lista, filtros, infinite scroll) | ✅ Funcional |
| JobDetail (fotos, assinatura, vídeo, notas) | ✅ Funcional |
| Upload/compressão de fotos | ✅ Funcional |
| Watermark automático | ✅ Funcional |
| Assinatura digital (react-signature-canvas) | ✅ Funcional |
| Mapa de lojas (Leaflet) | ✅ Funcional |
| Analytics + gráficos | ✅ Funcional |
| Relatório de faturamento | ✅ Funcional |
| Gestão de equipe (incluindo delete via Edge Function) | ✅ Funcional |
| Detecção de offline | ✅ Funcional |

### Gaps Conhecidos ⚠️
| Feature | Status | Dependência |
|---------|--------|-------------|
| Fila de sync offline | ❌ Não implementado | IndexedDB + service worker |
| Checklists de conclusão | ❌ Não implementado | UI + tabela campo |
| Notificações push | ❌ Não implementado | FCM ou Web Push API |
| RLS mais restritiva | ⚠️ Técnico vê todos os jobs | Precisa filtrar por tecnico_id |
| Bridge ERP↔Campo (triggers) | ⚠️ SQL criado, não executado | Migration 004 pendente |
| Mapeamento de status ERP↔Campo | ⚠️ Status divergem | ERP: "agendada" vs Campo: "Pendente" |

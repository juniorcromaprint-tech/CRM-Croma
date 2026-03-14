# NF-e com nfewizard-io no Vercel — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrar emissão real de NF-e federal (modelo 55) via nfewizard-io, hospedado como microserviço Node.js no Vercel, substituindo o MODO DEMO atual que usa Focus NFe simulado.

**Architecture:** Criar pasta `nfe-service/` na raiz do repo com um app Node.js standalone, deployado como projeto separado no Vercel (mesma conta) **no mínimo no plano Pro** ou no Railway ($5/mês). As Supabase Edge Functions existentes (`fiscal-emitir-nfe`, `fiscal-consultar-nfe`, `fiscal-cancelar-nfe`) passam a chamar esse microserviço em vez de chamar Focus NFe direto. O certificado A1 fica armazenado como base64 em variável de ambiente, nunca em arquivo versionado.

**Tech Stack:** nfewizard-io, Express.js, Node.js 18+, Vercel serverless, Supabase Edge Functions (Deno), certificado A1 (.pfx → base64)

---

## Contexto Importante

### Estado atual do código
- Edge Functions em `supabase/functions/fiscal-emitir-nfe/index.ts`, `fiscal-consultar-nfe`, `fiscal-cancelar-nfe`, `fiscal-gerar-danfe`
- Todas rodam em **MODO DEMO** quando `NFE_PROVIDER_TOKEN` não está configurado ou é `DEMO_MODE`
- Toda lógica de negócio (atualizar DB, salvar XML, registrar eventos/auditoria) já está implementada e funciona — só o envio real ao SEFAZ não ocorre
- Frontend fiscal completo: dashboard, fila, certificados, séries — tudo pronto

### Por que microserviço separado no Vercel
O projeto principal usa Vite + ESM (`"type": "module"`). O nfewizard-io usa CJS (`require()`). Colocar os dois no mesmo projeto causaria conflito de módulos. A solução é criar `nfe-service/` com seu próprio `package.json` (sem `"type": "module"`), deployado como projeto Vercel separado — mesma conta, sem nova plataforma.

### ⚠️ Limitação de timeout — CRÍTICO
Vercel **Hobby plan: 10 segundos** máximo — **INVIÁVEL**. SEFAZ responde em 15-45s.
- **Vercel Pro ($20/mês)**: 60s — marginal mas funcional para maioria dos casos
- **Railway Hobby ($5/mês)**: 3600s — recomendado, sem preocupação com timeout
- **Decisão antes do deploy**: escolher entre Vercel Pro ou Railway

### Segurança entre serviços
O microserviço não pode ser público. Proteger com `NFE_INTERNAL_SECRET` — a Edge Function passa esse header, o microserviço valida antes de processar.

---

## Diagnóstico Técnico — nfewizard-io

| Item | Status |
|------|--------|
| Emissão NF-e modelo 55 — `NFE_Autorizacao()` | ✅ Suportado |
| Cancelamento — `NFE_RecepcaoEvento()` (tpEvento: 110111) | ✅ Suportado |
| Inutilização — `NFE_Inutilizacao()` | ✅ Suportado |
| Consulta protocolo — `NFE_ConsultaProtocolo(chave)` | ✅ Suportado |
| Consulta recibo — `NFE_RetornoAutorizacao({nRec})` | ✅ Suportado |
| **DANFE** — `NFE_GerarDanfe()` | ✅ **Nativo! Não é stub** |
| Certificado A1 (.pfx) | ✅ Apenas via arquivo (`pathCertificado`) |
| Certificado via buffer/base64 | ❌ Não suportado — contornar escrevendo em `/tmp/nfewizard/` |
| NFC-e (modelo 65) — `NFCE_Autorizacao()` | ⚠️ Módulo separado, deixar para depois |
| Deno/Edge Functions | ❌ Node.js apenas — por isso o microserviço separado |
| Java/JDK | ❌ Não exige — 100% Node.js |
| `libxmljs` (addon nativo C++) | ⚠️ Dependência transitória — pode ter problema em Vercel Linux |
| Reforma Tributária 2025 | ✅ NT 2025.002 v.130 já suportado |
| Estados além de SP | ⚠️ Testado em SP, testar outros |

### Métodos exatos validados por auditoria

```typescript
// Import correto (default export)
import NFeWizard from 'nfewizard-io';

const nfe = new NFeWizard();

// Emissão
await nfe.NFE_Autorizacao(payload);          // ← não é AutorizacaoLote

// Cancelamento (via evento)
await nfe.NFE_RecepcaoEvento({              // ← não é método direto
  tpEvento: '110111',                        // ← código de cancelamento
  chNFe: chaveAcesso,
  nProt: protocolo,
  xJust: justificativa,
});

// Consulta protocolo
await nfe.NFE_ConsultaProtocolo(chaveAcesso);

// Consulta recibo (quando SEFAZ retorna 103)
await nfe.NFE_RetornoAutorizacao({ nRec: numeroRecibo });

// Inutilização
await nfe.NFE_Inutilizacao({ ... });

// DANFE (nativo!)
await nfe.NFE_GerarDanfe({ nfe: payloadNFe });
```

**O que usar do nfewizard-io:** Tudo — autorização, cancelamento via evento, inutilização, consultas, DANFE.
**O que NÃO usar:** Módulo de email (`NFE_EnviaEmail`) — usar Resend/Supabase já configurado no ERP.

---

## Task 1: Criar estrutura do microserviço `nfe-service/`

**Files:**
- Create: `nfe-service/package.json`
- Create: `nfe-service/tsconfig.json`
- Create: `nfe-service/vercel.json`
- Create: `nfe-service/.env.example`

**Step 1: Criar pasta e package.json**

```bash
mkdir -p nfe-service/api
```

Criar `nfe-service/package.json`:
```json
{
  "name": "croma-nfe-service",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "ts-node api/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "nfewizard-io": "latest",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Criar `nfe-service/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["api/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Criar `nfe-service/vercel.json`**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/*.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" }
  ]
}
```

**Step 4: Criar `nfe-service/.env.example`**

```
# Segredo compartilhado com as Supabase Edge Functions
NFE_INTERNAL_SECRET=gerar-um-uuid-aqui

# Certificado A1 em base64
# Para converter: base64 -w 0 certificado.pfx
NFE_CERT_BASE64=

# Senha do certificado A1
NFE_CERT_PASSWORD=

# CNPJ do emitente (só números)
NFE_CNPJ_EMITENTE=

# Ambiente: 1=Produção, 2=Homologação
NFE_AMBIENTE=2

# UF do emitente (ex: SP, MG, PR)
NFE_UF=SP
```

**Step 5: Instalar dependências**

```bash
cd nfe-service && npm install
```

**Step 6: Commit**

```bash
git add nfe-service/
git commit -m "feat(nfe): scaffold microserviço nfewizard-io no Vercel"
```

---

## Task 1.5: Types TypeScript + Factory NFeWizard reutilizável

**Problema:** Sem isso, cada endpoint repete as ~25 linhas de `NFE_LoadEnvironment`. DRY violation.

**Files:**
- Create: `nfe-service/api/_types.ts`
- Create: `nfe-service/api/_wizard.ts`

**Step 1: Criar `nfe-service/api/_types.ts`**

```typescript
/** Resultado padronizado retornado por todos os endpoints do nfe-service */
export interface NFeServiceResult {
  sucesso: boolean;
  retorno?: unknown;
  mensagem_erro?: string;
}

/** Payload de emissão enviado pela Edge Function */
export interface EmitirPayload {
  NFe: {
    infNFe: Record<string, unknown>;
  };
}

/** Status SEFAZ — cStat mais comuns */
export const SEFAZ_STATUS = {
  AUTORIZADO: '100',
  DENEGADO: '110',
  DUPLICIDADE: '204',
  NAO_ENCONTRADO: '302',
  NAO_CONSTA: '217',
} as const;

/** Ambiente fiscal */
export type AmbienteNFe = 1 | 2; // 1=produção, 2=homologação

/** Regime tributário */
export enum RegimeTributario {
  SIMPLES_NACIONAL = '1',
  SIMPLES_NACIONAL_EXCESSO = '2',
  REGIME_NORMAL = '3',
}
```

**Step 2: Criar `nfe-service/api/_wizard.ts`** — factory reutilizável

```typescript
import NFeWizard from 'nfewizard-io'; // default export — import estático CJS
import { loadCertificate } from './_cert';
import type { AmbienteNFe } from './_types';

/**
 * Cria e inicializa uma instância do NFeWizard com a configuração
 * carregada das variáveis de ambiente. Reutilizar em todos os endpoints.
 */
export async function createNFeWizard() {
  const { certPath, certPassword } = loadCertificate();
  const ambiente = parseInt(process.env.NFE_AMBIENTE ?? '2') as AmbienteNFe;
  const uf = process.env.NFE_UF ?? 'SP';
  const cnpj = process.env.NFE_CNPJ_EMITENTE ?? '';

  const nfe = new NFeWizard();

  await nfe.NFE_LoadEnvironment({
    dfe: {
      pathCertificado: certPath,
      senhaCertificado: certPassword,
      UF: uf,
      CPFCNPJ: cnpj,
      xmlFolder: '/tmp/nfewizard/',
      xmlAutorizados: '/tmp/nfewizard/autorizados/',
      xmlCancelados: '/tmp/nfewizard/cancelados/',
    },
    nfe: {
      ambiente,
      versaoDF: '4.00',
      idCSC: '',
      tokenCSC: '',
    },
    // email é completamente opcional — omitido intencionalmente
    // notificações são feitas pelo ERP via Resend
    conexao: { timeout: 30000 }, // 30s — SEFAZ pode levar 15-45s
  });

  return nfe;
}
```

**Step 3: Atualizar endpoints (Tasks 3, 4, 5) para usar `createNFeWizard()`**

Cada endpoint passa de ~30 linhas de config para:
```typescript
const nfe = await createNFeWizard();
const resultado = await nfe.NFE_Autorizacao(payload); // ← método correto
```

**Step 4: Commit**

```bash
git add nfe-service/api/_types.ts nfe-service/api/_wizard.ts
git commit -m "feat(nfe): types + factory NFeWizard reutilizável — elimina duplicação"
```

---

## Task 2: Utilitário de certificado (`_cert.ts`)

O nfewizard-io exige `pathCertificado` (caminho de arquivo). No Vercel serverless, o sistema de arquivos é read-only exceto `/tmp`. Esse utilitário extrai o cert da variável de ambiente e escreve em `/tmp`.

**Files:**
- Create: `nfe-service/api/_cert.ts`

**Step 1: Criar `nfe-service/api/_cert.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';

const CERT_PATH = '/tmp/croma_cert.pfx';

/**
 * Extrai o certificado A1 da variável de ambiente NFE_CERT_BASE64
 * e escreve em /tmp para ser usado pelo nfewizard-io.
 * Reutiliza o arquivo se já existir na invocação atual.
 */
export function loadCertificate(): { certPath: string; certPassword: string } {
  const certBase64 = process.env.NFE_CERT_BASE64;
  const certPassword = process.env.NFE_CERT_PASSWORD;

  if (!certBase64) throw new Error('NFE_CERT_BASE64 não configurado');
  if (!certPassword) throw new Error('NFE_CERT_PASSWORD não configurado');

  if (!fs.existsSync(CERT_PATH)) {
    const certBuffer = Buffer.from(certBase64, 'base64');
    fs.writeFileSync(CERT_PATH, certBuffer);
  }

  return { certPath: CERT_PATH, certPassword };
}

/**
 * Lê a validade do certificado A1 e retorna os dias restantes.
 * Retorna -1 se não conseguir ler.
 */
export function getCertificateExpiryDays(): number {
  try {
    const { certPath, certPassword } = loadCertificate();
    // Usa node-forge para inspecionar o .pfx sem depender de OpenSSL externo
    const forge = require('node-forge');
    const pfxBuffer = fs.readFileSync(certPath);
    const p12 = forge.pkcs12.pkcs12FromAsn1(
      forge.asn1.fromDer(pfxBuffer.toString('binary')),
      certPassword
    );
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
    if (!cert) return -1;
    const validTo = new Date(cert.validity.notAfter);
    const hoje = new Date();
    return Math.floor((validTo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return -1;
  }
}

/**
 * Valida o header de autenticação interna entre Edge Function e microserviço.
 */
export function validateInternalSecret(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const secret = process.env.NFE_INTERNAL_SECRET;
  if (!secret) return false;
  return req.headers['x-internal-secret'] === secret;
}
```

**Step 2: Commit**

```bash
git add nfe-service/api/_cert.ts
git commit -m "feat(nfe): utilitário de certificado A1 + validação de secret"
```

---

## Task 3: Endpoint de emissão (`emitir.ts`)

**Files:**
- Create: `nfe-service/api/emitir.ts`

**Step 1: Criar `nfe-service/api/emitir.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInternalSecret } from './_cert';
import { createNFeWizard } from './_wizard';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem_erro: 'Método não permitido' });
  }

  // Valida secret interno
  if (!validateInternalSecret(req as any)) {
    return res.status(401).json({ sucesso: false, mensagem_erro: 'Não autorizado' });
  }

  try {
    const nfe = await createNFeWizard();
    const payload = req.body; // Payload NF-e completo enviado pela Edge Function

    // NFE_Autorizacao — método correto (não é AutorizacaoLote)
    const resultado = await nfe.NFE_Autorizacao(payload);

    return res.status(200).json({
      sucesso: true,
      retorno: resultado,
    });

  } catch (err) {
    console.error('[nfe-service/emitir]', err);
    return res.status(500).json({
      sucesso: false,
      mensagem_erro: String(err),
    });
  }
}
```

**Step 2: Commit**

```bash
git add nfe-service/api/emitir.ts
git commit -m "feat(nfe): endpoint POST /api/emitir — autorização NF-e via nfewizard-io"
```

---

## Task 4: Endpoint de consulta (`consultar.ts`)

**Files:**
- Create: `nfe-service/api/consultar.ts`

**Step 1: Criar `nfe-service/api/consultar.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInternalSecret } from './_cert';
import { createNFeWizard } from './_wizard';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem_erro: 'Método não permitido' });
  }

  if (!validateInternalSecret(req as any)) {
    return res.status(401).json({ sucesso: false, mensagem_erro: 'Não autorizado' });
  }

  try {
    const nfe = await createNFeWizard();
    const { chave_acesso } = req.body;
    const resultado = await nfe.NFE_ConsultaProtocolo({ chNFe: chave_acesso });

    return res.status(200).json({ sucesso: true, retorno: resultado });
  } catch (err) {
    console.error('[nfe-service/consultar]', err);
    return res.status(500).json({ sucesso: false, mensagem_erro: String(err) });
  }
}
```

**Step 2: Commit**

```bash
git add nfe-service/api/consultar.ts
git commit -m "feat(nfe): endpoint POST /api/consultar — consulta protocolo NF-e"
```

---

## Task 5: Endpoint de cancelamento (`cancelar.ts`)

**Files:**
- Create: `nfe-service/api/cancelar.ts`

**Step 1: Criar `nfe-service/api/cancelar.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInternalSecret } from './_cert';
import { createNFeWizard } from './_wizard';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem_erro: 'Método não permitido' });
  }

  if (!validateInternalSecret(req as any)) {
    return res.status(401).json({ sucesso: false, mensagem_erro: 'Não autorizado' });
  }

  const { chave_acesso, protocolo, justificativa } = req.body;

  if (!chave_acesso || !protocolo || !justificativa) {
    return res.status(400).json({
      sucesso: false,
      mensagem_erro: 'Campos obrigatórios: chave_acesso, protocolo, justificativa',
    });
  }

  if (justificativa.length < 15) {
    return res.status(400).json({
      sucesso: false,
      mensagem_erro: 'Justificativa deve ter no mínimo 15 caracteres',
    });
  }

  try {
    const nfe = await createNFeWizard();

    // Cancelamento NF-e é feito via RecepcaoEvento (tpEvento 110111)
    // NFE_Cancelamento() não existe — método correto é NFE_RecepcaoEvento()
    const resultado = await nfe.NFE_RecepcaoEvento({
      tpEvento: '110111',
      chNFe: chave_acesso,
      nProt: protocolo,
      xJust: justificativa,
    });

    return res.status(200).json({ sucesso: true, retorno: resultado });
  } catch (err) {
    console.error('[nfe-service/cancelar]', err);
    return res.status(500).json({ sucesso: false, mensagem_erro: String(err) });
  }
}
```

**Step 2: Commit**

```bash
git add nfe-service/api/cancelar.ts
git commit -m "feat(nfe): endpoint POST /api/cancelar — cancelamento NF-e"
```

---

## Task 5.5: Endpoint de validação de certificado (`certificado.ts`)

Expõe endpoint para o ERP verificar se o certificado está válido e quantos dias faltam para vencer — usado pela tela de configuração fiscal.

**Files:**
- Create: `nfe-service/api/certificado.ts`

**Step 1: Criar `nfe-service/api/certificado.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCertificateExpiryDays, validateInternalSecret } from './_cert';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ sucesso: false, mensagem_erro: 'Método não permitido' });
  }
  if (!validateInternalSecret(req as any)) {
    return res.status(401).json({ sucesso: false, mensagem_erro: 'Não autorizado' });
  }

  const diasRestantes = getCertificateExpiryDays();

  if (diasRestantes < 0) {
    return res.status(200).json({
      sucesso: false,
      valido: false,
      mensagem: 'Não foi possível ler o certificado',
      dias_restantes: null,
    });
  }

  const vencido = diasRestantes <= 0;
  const alerta = diasRestantes > 0 && diasRestantes <= 30;

  return res.status(200).json({
    sucesso: true,
    valido: !vencido,
    dias_restantes: diasRestantes,
    status: vencido ? 'vencido' : alerta ? 'vencendo' : 'ok',
    mensagem: vencido
      ? 'Certificado expirado — emissão bloqueada'
      : alerta
      ? `Certificado vence em ${diasRestantes} dias — renovar urgente`
      : `Certificado válido por ${diasRestantes} dias`,
  });
}
```

**Step 2: Adicionar `node-forge` nas dependências**

Em `nfe-service/package.json`, adicionar:
```json
"node-forge": "^1.3.1",
"@types/node-forge": "^1.3.11"
```

**Step 3: Commit**

```bash
git add nfe-service/api/certificado.ts
git commit -m "feat(nfe): endpoint GET /api/certificado — validade do certificado A1"
```

---

## Task 5.6: Endpoint de inutilização (`inutilizar.ts`)

**Files:**
- Create: `nfe-service/api/inutilizar.ts`

**Step 1: Criar `nfe-service/api/inutilizar.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInternalSecret } from './_cert';
import { createNFeWizard } from './_wizard';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem_erro: 'Método não permitido' });
  }
  if (!validateInternalSecret(req as any)) {
    return res.status(401).json({ sucesso: false, mensagem_erro: 'Não autorizado' });
  }

  const { serie, numero_inicial, numero_final, justificativa } = req.body;

  if (!serie || !numero_inicial || !numero_final || !justificativa) {
    return res.status(400).json({
      sucesso: false,
      mensagem_erro: 'Campos obrigatórios: serie, numero_inicial, numero_final, justificativa',
    });
  }

  if (justificativa.length < 15) {
    return res.status(400).json({
      sucesso: false,
      mensagem_erro: 'Justificativa deve ter no mínimo 15 caracteres',
    });
  }

  try {
    const nfe = await createNFeWizard();
    const cnpj = process.env.NFE_CNPJ_EMITENTE ?? '';
    const uf = process.env.NFE_UF ?? 'SP';
    const ano = new Date().getFullYear().toString().slice(-2);

    const resultado = await nfe.NFE_Inutilizacao({
      cUF: uf === 'SP' ? '35' : uf,
      ano,
      CNPJ: cnpj.replace(/\D/g, ''),
      mod: '55',
      serie: serie.toString(),
      nNFIni: numero_inicial.toString(),
      nNFFin: numero_final.toString(),
      xJust: justificativa,
    });

    return res.status(200).json({ sucesso: true, retorno: resultado });
  } catch (err) {
    console.error('[nfe-service/inutilizar]', err);
    return res.status(500).json({ sucesso: false, mensagem_erro: String(err) });
  }
}
```

**Step 2: Commit**

```bash
git add nfe-service/api/inutilizar.ts
git commit -m "feat(nfe): endpoint POST /api/inutilizar — inutilização de numeração NF-e"
```

---

## Task 5.7: Endpoint de consulta de recibo (`recibo.ts`)

Diferente de `consultar.ts` (que consulta por chave de acesso), `recibo.ts` consulta pelo número do recibo gerado no envio do lote — usado quando a SEFAZ retorna código 103 (lote em processamento).

**Files:**
- Create: `nfe-service/api/recibo.ts`

**Step 1: Criar `nfe-service/api/recibo.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInternalSecret } from './_cert';
import { createNFeWizard } from './_wizard';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem_erro: 'Método não permitido' });
  }
  if (!validateInternalSecret(req as any)) {
    return res.status(401).json({ sucesso: false, mensagem_erro: 'Não autorizado' });
  }

  const { numero_recibo } = req.body;
  if (!numero_recibo) {
    return res.status(400).json({ sucesso: false, mensagem_erro: 'numero_recibo é obrigatório' });
  }

  try {
    const nfe = await createNFeWizard();
    const resultado = await nfe.NFE_RetornoAutorizacao({ nRec: numero_recibo });
    return res.status(200).json({ sucesso: true, retorno: resultado });
  } catch (err) {
    console.error('[nfe-service/recibo]', err);
    return res.status(500).json({ sucesso: false, mensagem_erro: String(err) });
  }
}
```

**Step 2: Commit**

```bash
git add nfe-service/api/recibo.ts
git commit -m "feat(nfe): endpoint POST /api/recibo — consulta retorno de lote NF-e"
```

---

## Task 5.8: Endpoint DANFE (nativo via nfewizard-io)

O nfewizard-io **SIM gera DANFE** via `NFE_GerarDanfe()` — não é stub. Esta task implementa o endpoint real.

**Files:**
- Create: `nfe-service/api/danfe.ts`

**Step 1: Criar `nfe-service/api/danfe.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as fs from 'fs';
import * as path from 'path';
import { validateInternalSecret } from './_cert';
import { createNFeWizard } from './_wizard';

/**
 * DANFE — Geração de PDF da NF-e via NFE_GerarDanfe() do nfewizard-io.
 *
 * Recebe: { nfe_payload } — o mesmo payload usado na autorização
 * Retorna: PDF base64 ou URL temporária para download
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem_erro: 'Método não permitido' });
  }
  if (!validateInternalSecret(req as any)) {
    return res.status(401).json({ sucesso: false, mensagem_erro: 'Não autorizado' });
  }

  const { nfe_payload } = req.body;

  if (!nfe_payload) {
    return res.status(400).json({ sucesso: false, mensagem_erro: 'nfe_payload é obrigatório' });
  }

  try {
    const nfe = await createNFeWizard();

    // NFE_GerarDanfe é nativo no nfewizard-io
    const resultado = await nfe.NFE_GerarDanfe({ nfe: nfe_payload });

    // O resultado pode ser um caminho de arquivo ou buffer — normalizar para base64
    let pdfBase64: string;
    if (typeof resultado === 'string' && fs.existsSync(resultado)) {
      pdfBase64 = fs.readFileSync(resultado).toString('base64');
    } else if (Buffer.isBuffer(resultado)) {
      pdfBase64 = resultado.toString('base64');
    } else {
      pdfBase64 = Buffer.from(String(resultado)).toString('base64');
    }

    return res.status(200).json({
      sucesso: true,
      pdf_base64: pdfBase64,
    });
  } catch (err) {
    console.error('[nfe-service/danfe]', err);
    return res.status(500).json({ sucesso: false, mensagem_erro: String(err) });
  }
}
```

**Step 2: Commit**

```bash
git add nfe-service/api/danfe.ts
git commit -m "feat(nfe): endpoint POST /api/danfe — DANFE real via NFE_GerarDanfe()"
```

---

## Task 5.9: Validações de negócio pré-emissão na Edge Function

Antes de enviar ao nfe-service, a Edge Function `fiscal-emitir-nfe` deve validar dados mínimos e impedir dupla emissão.

**Files:**
- Modify: `supabase/functions/fiscal-emitir-nfe/index.ts`

**Step 1: Adicionar validações após buscar o documento (após linha ~64)**

Inserir após `if (docError || !doc) { ... }`:

```typescript
// === VALIDAÇÕES DE NEGÓCIO PRÉ-EMISSÃO ===

const errosValidacao: string[] = [];

// 1. Impedir dupla emissão
if (doc.status === 'autorizado') {
  return new Response(
    JSON.stringify({ sucesso: false, mensagem_erro: 'NF-e já autorizada — não é possível reemitir' }),
    { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// 2. Certificado configurado
if (!doc.fiscal_certificados || doc.fiscal_certificados.length === 0) {
  errosValidacao.push('Nenhum certificado digital ativo');
}

// 3. Cliente com CPF/CNPJ
const cliente = doc.clientes;
const cpfCnpj = cliente?.cpf_cnpj?.replace(/\D/g, '');
if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
  errosValidacao.push('Cliente sem CPF/CNPJ válido');
}

// 4. Itens com NCM e CFOP
const itens = doc.fiscal_documentos_itens ?? [];
if (itens.length === 0) {
  errosValidacao.push('Documento sem itens');
}
itens.forEach((item: any, idx: number) => {
  if (!item.ncm || item.ncm.replace(/\D/g, '').length !== 8) {
    errosValidacao.push(`Item ${idx + 1}: NCM inválido ou ausente`);
  }
  if (!item.cfop || item.cfop.length < 4) {
    errosValidacao.push(`Item ${idx + 1}: CFOP ausente`);
  }
  if (!item.unidade) {
    errosValidacao.push(`Item ${idx + 1}: Unidade comercial ausente`);
  }
  if (!item.descricao) {
    errosValidacao.push(`Item ${idx + 1}: Descrição ausente`);
  }
});

// 5. Série configurada
if (!doc.fiscal_series) {
  errosValidacao.push('Série fiscal não configurada');
}

// 6. Valor total positivo
if (!doc.valor_total || doc.valor_total <= 0) {
  errosValidacao.push('Valor total deve ser maior que zero');
}

if (errosValidacao.length > 0) {
  // Marca como erro de validação e retorna lista de problemas
  await supabaseAdmin
    .from('fiscal_documentos')
    .update({ status: 'rascunho', mensagem_erro: errosValidacao.join('; ') })
    .eq('id', documento_id);

  return new Response(
    JSON.stringify({
      sucesso: false,
      status: 'erro_validacao',
      mensagem_erro: 'Dados fiscais incompletos',
      erros: errosValidacao,
    }),
    { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
// === FIM VALIDAÇÕES ===
```

**Step 2: Commit**

```bash
git add supabase/functions/fiscal-emitir-nfe/index.ts
git commit -m "feat(nfe): validações pré-emissão — bloqueia dados incompletos e dupla emissão"
```

---

## Task 5.10: Adicionar lock transacional na RPC `fiscal_proximo_numero_serie`

**Problema:** Sem lock, duas emissões simultâneas podem gerar o mesmo número de NF-e — erro grave (duplicidade SEFAZ, cStat 204).

**Files:**
- Create: `supabase/migrations/011_fix_serie_lock.sql`

**Step 1: Criar migration com `FOR UPDATE`**

```sql
-- Migration 011: Adiciona lock pessimista na RPC de geração de número NF-e
-- Evita duplicidade de numeração em emissões simultâneas

CREATE OR REPLACE FUNCTION fiscal_proximo_numero_serie(p_serie_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proximo integer;
BEGIN
  -- FOR UPDATE: bloqueia a linha até o commit, impedindo concorrência
  SELECT proximo_numero
  INTO v_proximo
  FROM fiscal_series
  WHERE id = p_serie_id
  FOR UPDATE;

  IF v_proximo IS NULL THEN
    RAISE EXCEPTION 'Série fiscal não encontrada: %', p_serie_id;
  END IF;

  -- Incrementa atomicamente
  UPDATE fiscal_series
  SET proximo_numero = proximo_numero + 1,
      updated_at = now()
  WHERE id = p_serie_id;

  RETURN v_proximo;
END;
$$;
```

**Step 2: Executar no Supabase**

Copiar o SQL acima e executar em:
`supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql`

**Step 3: Commit**

```bash
git add supabase/migrations/011_fix_serie_lock.sql
git commit -m "fix(nfe): lock FOR UPDATE em fiscal_proximo_numero_serie — evita numeração duplicada"
```

---

## Task 6: Adaptar Edge Function `fiscal-emitir-nfe`

Trocar a chamada ao Focus NFe (hardcoded) pela chamada ao microserviço Vercel.

**Files:**
- Modify: `supabase/functions/fiscal-emitir-nfe/index.ts` (linhas ~104-253)

**Step 1: Localizar o bloco de chamada ao provider**

No arquivo `supabase/functions/fiscal-emitir-nfe/index.ts`, localizar:
```typescript
// Monta o payload para o provider externo (Focus NFe, etc.)
const nfeProvider = Deno.env.get('NFE_PROVIDER') ?? 'focus_nfe';
const nfeToken = Deno.env.get('NFE_PROVIDER_TOKEN');
const nfeBaseUrl = Deno.env.get('NFE_PROVIDER_URL') ?? 'https://homologacao.focusnfe.com.br';
```

**Step 2: Substituir o bloco completo de provider (~linhas 104-253)**

Substituir desde `const nfeProvider = ...` até o fechamento do bloco `} catch (providerErr) {...}` por:

```typescript
// Chama o microserviço nfe-service no Vercel
const nfeServiceUrl = Deno.env.get('NFE_SERVICE_URL');
const nfeInternalSecret = Deno.env.get('NFE_INTERNAL_SECRET');

if (!nfeServiceUrl || !nfeInternalSecret) {
  throw new Error('NFE_SERVICE_URL ou NFE_INTERNAL_SECRET não configurados');
}

let resultado: any;

try {
  const response = await fetch(`${nfeServiceUrl}/api/emitir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': nfeInternalSecret,
    },
    body: JSON.stringify(nfePayload),
  });

  const retorno = await response.json();

  if (!response.ok || !retorno.sucesso) {
    resultado = {
      sucesso: false,
      status: 'erro_transmissao',
      mensagem_erro: retorno.mensagem_erro ?? `Serviço NF-e retornou ${response.status}`,
      retorno_raw: retorno,
    };
  } else {
    // Mapear retorno do nfewizard-io para o formato interno
    const r = retorno.retorno;
    const autorizado = r?.retEnviNFe?.protNFe?.infProt?.cStat === '100';
    resultado = {
      sucesso: autorizado,
      status: autorizado ? 'autorizado' : 'rejeitado',
      numero: numero,
      chave_acesso: r?.retEnviNFe?.protNFe?.infProt?.chNFe,
      protocolo: r?.retEnviNFe?.protNFe?.infProt?.nProt,
      data_autorizacao: r?.retEnviNFe?.protNFe?.infProt?.dhRecbto,
      mensagem_erro: autorizado ? undefined : r?.retEnviNFe?.protNFe?.infProt?.xMotivo,
      codigo_erro: autorizado ? undefined : r?.retEnviNFe?.protNFe?.infProt?.cStat?.toString(),
      retorno_raw: retorno.retorno,
    };
  }
} catch (serviceErr) {
  resultado = {
    sucesso: false,
    status: 'erro_transmissao',
    mensagem_erro: `Falha ao contactar serviço NF-e: ${String(serviceErr)}`,
    retorno_raw: { error: String(serviceErr) },
  };
}
```

**Step 3: Remover o bloco `nfePayload` (formato Focus NFe) e reescrever no formato nfewizard-io**

O payload do nfewizard-io usa a estrutura XML da NF-e diretamente. Substituir o objeto `nfePayload` (~linhas 113-189):

```typescript
// Monta payload NF-e (estrutura nfewizard-io / SEFAZ)
const cliente = doc.clientes;
const itens = doc.fiscal_documentos_itens ?? [];

const nfePayload = {
  NFe: {
    infNFe: {
      ide: {
        cUF: '35', // SP — Croma Print fica em São Paulo
        natOp: doc.natureza_operacao ?? 'Venda de mercadoria',
        mod: '55',
        serie: serie.toString(),
        nNF: numero.toString(),
        dhEmi: new Date().toISOString(),
        tpNF: '1', // saída
        idDest: '1',
        cMunFG: Deno.env.get('NFE_COD_IBGE') ?? '3550308', // São Paulo capital
        tpImp: '1',
        tpEmis: '1',
        tpAmb: ambiente === 'producao' ? '1' : '2',
        finNFe: '1',
        indFinal: doc.consumidor_final?.toString() ?? '1',
        indPres: '1',
      },
      emit: {
        CNPJ: cnpjEmitente.replace(/\D/g, ''),
        xNome: Deno.env.get('NFE_RAZAO_SOCIAL') ?? 'CROMA PRINT COMUNICACAO VISUAL LTDA',
        enderEmit: {
          xLgr: Deno.env.get('NFE_ENDERECO') ?? '',
          nro: Deno.env.get('NFE_NUMERO') ?? '',
          xBairro: Deno.env.get('NFE_BAIRRO') ?? '',
          cMun: Deno.env.get('NFE_COD_IBGE') ?? '3550308',
          xMun: Deno.env.get('NFE_MUNICIPIO') ?? '',
          UF: uf,
          CEP: Deno.env.get('NFE_CEP')?.replace(/\D/g, '') ?? '',
          cPais: '1058',
          xPais: 'Brasil',
        },
        IE: Deno.env.get('NFE_IE') ?? '',
        CRT: Deno.env.get('NFE_CRT') ?? '1',
      },
      dest: {
        ...(cliente?.cpf_cnpj?.replace(/\D/g, '').length === 11
          ? { CPF: cliente.cpf_cnpj.replace(/\D/g, '') }
          : { CNPJ: cliente?.cpf_cnpj?.replace(/\D/g, '') ?? '' }),
        xNome: cliente?.razao_social ?? cliente?.nome_fantasia ?? 'Consumidor Final',
        enderDest: {
          xLgr: cliente?.endereco ?? '',
          nro: cliente?.numero ?? 'SN',
          xBairro: cliente?.bairro ?? '',
          cMun: '9999999',
          xMun: cliente?.cidade ?? '',
          UF: cliente?.estado ?? 'SP',
          CEP: cliente?.cep?.replace(/\D/g, '') ?? '',
          cPais: '1058',
          xPais: 'Brasil',
        },
        indIEDest: cliente?.indicador_ie_destinatario ?? '9',
        email: cliente?.email_fiscal ?? cliente?.email,
      },
      det: itens.map((item: any, idx: number) => ({
        '@nItem': (idx + 1).toString(),
        prod: {
          cProd: item.codigo_produto ?? `PROD${idx + 1}`,
          cEAN: 'SEM GTIN',
          xProd: item.descricao,
          NCM: item.ncm?.replace(/\D/g, '') ?? '49019900',
          CFOP: item.cfop ?? '5102',
          uCom: item.unidade ?? 'UN',
          qCom: item.quantidade?.toString(),
          vUnCom: item.valor_unitario?.toFixed(2),
          vProd: item.valor_bruto?.toFixed(2),
          cEANTrib: 'SEM GTIN',
          uTrib: item.unidade ?? 'UN',
          qTrib: item.quantidade?.toString(),
          vUnTrib: item.valor_unitario?.toFixed(2),
          indTot: '1',
        },
        imposto: {
          // SIMPLES NACIONAL (CRT=1) usa CSOSN, não CST
          // CSOSN 102 = Tributado sem permissão de crédito (mais comum no SN)
          // CSOSN 400 = Não tributado
          // CSOSN 500 = ICMS cobrado anteriormente por ST
          ICMS: {
            ICMSSN102: {
              orig: item.origem_mercadoria ?? '0',
              CSOSN: item.cst_ou_csosn ?? '102',
              // SN não tem campos vBC/pICMS/vICMS — são zerados automaticamente
            },
          },
          PIS: {
            PISOutr: {
              CST: '99', // SN usa CST 99 para PIS
              vBC: '0.00',
              pPIS: '0.00',
              vPIS: '0.00',
            },
          },
          COFINS: {
            COFINSOutr: {
              CST: '99', // SN usa CST 99 para COFINS
              vBC: '0.00',
              pCOFINS: '0.00',
              vCOFINS: '0.00',
            },
          },
        },
      })),
      total: {
        ICMSTot: {
          vBC: (doc.valor_produtos ?? 0).toFixed(2),
          vICMS: (doc.valor_icms ?? 0).toFixed(2),
          vICMSDeson: '0.00',
          vFCPUFDest: '0.00',
          vICMSUFDest: '0.00',
          vICMSUFRemet: '0.00',
          vFCP: '0.00',
          vBCST: '0.00',
          vST: '0.00',
          vFCPST: '0.00',
          vFCPSTRet: '0.00',
          vProd: (doc.valor_produtos ?? 0).toFixed(2),
          vFrete: (doc.valor_frete ?? 0).toFixed(2),
          vSeg: (doc.valor_seguro ?? 0).toFixed(2),
          vDesc: (doc.valor_desconto ?? 0).toFixed(2),
          vII: '0.00',
          vIPI: '0.00',
          vIPIDevol: '0.00',
          vPIS: (doc.valor_pis ?? 0).toFixed(2),
          vCOFINS: (doc.valor_cofins ?? 0).toFixed(2),
          vOutro: (doc.valor_outras_despesas ?? 0).toFixed(2),
          vNF: (doc.valor_total ?? 0).toFixed(2),
          vTotTrib: '0.00',
        },
      },
      transp: {
        modFrete: '9',
      },
      infAdic: {
        infCpl: doc.informacoes_contribuinte,
        infAdFisco: doc.informacoes_fisco,
      },
    },
  },
};
```

**Step 4: Commit**

```bash
git add supabase/functions/fiscal-emitir-nfe/index.ts
git commit -m "feat(nfe): adaptar fiscal-emitir-nfe para chamar nfe-service no Vercel"
```

---

## Task 7: Adaptar Edge Functions `fiscal-consultar-nfe` e `fiscal-cancelar-nfe`

**Files:**
- Modify: `supabase/functions/fiscal-consultar-nfe/index.ts`
- Modify: `supabase/functions/fiscal-cancelar-nfe/index.ts`

**Step 1: `fiscal-consultar-nfe` — substituir chamada ao Focus NFe**

Localizar o bloco com `focusnfe.com.br` e substituir por:

```typescript
const nfeServiceUrl = Deno.env.get('NFE_SERVICE_URL');
const nfeInternalSecret = Deno.env.get('NFE_INTERNAL_SECRET');

const response = await fetch(`${nfeServiceUrl}/api/consultar`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-secret': nfeInternalSecret ?? '',
  },
  body: JSON.stringify({ chave_acesso: chaveAcesso }),
});

const retorno = await response.json();
```

**Step 2: `fiscal-cancelar-nfe` — substituir chamada ao Focus NFe**

Localizar o bloco com `focusnfe.com.br` e substituir por:

```typescript
const nfeServiceUrl = Deno.env.get('NFE_SERVICE_URL');
const nfeInternalSecret = Deno.env.get('NFE_INTERNAL_SECRET');

const response = await fetch(`${nfeServiceUrl}/api/cancelar`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-secret': nfeInternalSecret ?? '',
  },
  body: JSON.stringify({ chave_acesso: chaveAcesso, protocolo, justificativa }),
});

const retorno = await response.json();
```

**Step 3: Commit**

```bash
git add supabase/functions/fiscal-consultar-nfe/index.ts
git add supabase/functions/fiscal-cancelar-nfe/index.ts
git commit -m "feat(nfe): adaptar consulta e cancelamento NF-e para nfe-service"
```

---

## Task 8: Deploy do microserviço no Vercel

**Step 1: Fazer push do branch**

```bash
git push origin claude/elastic-shtern
```

**Step 2: Criar novo projeto no Vercel (mesma conta)**

1. Acessar `vercel.com/dashboard`
2. Clicar em **Add New Project**
3. Importar o repositório `CRM-Croma` (mesmo repo)
4. Em **Root Directory**, selecionar `nfe-service`
5. Framework preset: **Other**
6. Clicar em **Deploy**

**Step 3: Configurar variáveis de ambiente no Vercel (projeto nfe-service)**

No painel do projeto `nfe-service` → Settings → Environment Variables, adicionar:

| Variável | Valor |
|----------|-------|
| `NFE_INTERNAL_SECRET` | UUID gerado (ex: `openssl rand -hex 32`) |
| `NFE_CERT_BASE64` | Certificado .pfx em base64 |
| `NFE_CERT_PASSWORD` | Senha do certificado A1 |
| `NFE_CNPJ_EMITENTE` | `18923994000183` |
| `NFE_AMBIENTE` | `2` (homologação) → depois `1` (produção) |
| `NFE_UF` | `SP` |
| `NFE_RAZAO_SOCIAL` | `CROMA PRINT COMUNICACAO VISUAL LTDA` |
| `NFE_ENDERECO` | `RUA PAULO OROZIMBO` |
| `NFE_NUMERO` | `424` |
| `NFE_BAIRRO` | `ACLIMACAO` |
| `NFE_MUNICIPIO` | `SAO PAULO` |
| `NFE_COD_IBGE` | `3550308` |
| `NFE_CEP` | `01535000` |
| `NFE_IE` | `142826237111` |
| `NFE_CRT` | `1` (Simples Nacional) |

**Step 4: Configurar variáveis nas Supabase Edge Functions**

No Supabase Dashboard → Edge Functions → Secrets, adicionar:

| Variável | Valor |
|----------|-------|
| `NFE_SERVICE_URL` | URL do deploy (ex: `https://nfe-croma.vercel.app`) |
| `NFE_INTERNAL_SECRET` | Mesmo valor do Vercel |

**Step 5: Converter o certificado para base64**

```bash
# Linux/Mac
base64 -w 0 certificado.pfx

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.pfx"))
```

---

## Task 9: Testar em homologação

**Step 1: Testar endpoint de emissão diretamente**

```bash
curl -X POST https://nfe-croma.vercel.app/api/emitir \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: SEU_SECRET_AQUI" \
  -d '{"NFe": {"infNFe": {}}}' \
  -v
```

Esperado: resposta JSON (mesmo que seja erro de validação SEFAZ — prova que o serviço está rodando)

**Step 2: Testar via ERP em homologação**

1. Acessar `crm-croma.vercel.app/fiscal/emissao`
2. Criar documento fiscal de teste com valor baixo
3. Clicar em **Emitir NF-e**
4. Verificar se o status muda de `emitindo` para `autorizado` ou mostra erro real do SEFAZ

**Step 3: Verificar logs**

- Vercel: Dashboard → nfe-service → Functions → Ver logs em tempo real
- Supabase: Dashboard → Edge Functions → Logs

**Step 4: Commit final**

```bash
git add .
git commit -m "docs(nfe): plano de deploy e configuração do nfe-service"
```

---

## Task 8.5: Nova Edge Function `fiscal-inutilizar-nfe`

**Files:**
- Create: `supabase/functions/fiscal-inutilizar-nfe/index.ts`

**Step 1: Criar a Edge Function**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { serie, numero_inicial, numero_final, justificativa, serie_id } = await req.json();

    if (!justificativa || justificativa.length < 15) {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem_erro: 'Justificativa mínima de 15 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nfeServiceUrl = Deno.env.get('NFE_SERVICE_URL');
    const nfeInternalSecret = Deno.env.get('NFE_INTERNAL_SECRET');

    const response = await fetch(`${nfeServiceUrl}/api/inutilizar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': nfeInternalSecret ?? '',
      },
      body: JSON.stringify({ serie, numero_inicial, numero_final, justificativa }),
    });

    const retorno = await response.json();

    // Registra inutilização no banco
    if (retorno.sucesso) {
      await supabaseAdmin.from('fiscal_eventos').insert({
        tipo_evento: 'inutilizacao',
        status: 'sucesso',
        mensagem: `Inutilização ${serie}/${numero_inicial}-${numero_final}: ${justificativa}`,
        payload_retorno: retorno.retorno,
      });
    }

    return new Response(JSON.stringify(retorno), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ sucesso: false, mensagem_erro: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/fiscal-inutilizar-nfe/
git commit -m "feat(nfe): edge function fiscal-inutilizar-nfe"
```

---

## Relatório Técnico Final (gerar após Task 9)

Criar `docs/NFE_RELATORIO_TECNICO.md` com:

```markdown
# NF-e Croma Print — Relatório Técnico

## A. Diagnóstico nfewizard-io
[copiar da seção Diagnóstico Técnico do plano]

## B. Decisões de Arquitetura
- Microserviço Node.js separado em nfe-service/ (razão: ESM vs CJS)
- Certificado via variável de ambiente base64 → /tmp (razão: Vercel read-only filesystem)
- Edge Functions como orquestrador (razão: já têm acesso ao Supabase Admin)
- Segurança via NFE_INTERNAL_SECRET (razão: impedir chamadas externas ao microserviço)

## C. O que foi implementado
- [ ] nfe-service/ com 8 endpoints (emitir, consultar, cancelar, recibo, inutilizar, certificado, danfe via NFE_GerarDanfe)
- [ ] Validações pré-emissão na Edge Function
- [ ] Edge Functions adaptadas (fiscal-emitir-nfe, consultar, cancelar)
- [ ] Nova Edge Function fiscal-inutilizar-nfe

## D. Pendências
- NFC-e: módulo separado do nfewizard-io, implementar quando necessário
- Email automático de NF-e: conectar ao Resend já configurado no ERP

## E. Riscos
- Timeout Vercel Hobby (10s): **INVIÁVEL** — usar Vercel Pro (60s) ou Railway ($5/mês)
- Estados além de SP: testar antes de emitir em produção para outros estados

## F. Como testar em homologação
1. Configurar NFE_AMBIENTE=2 no Vercel
2. Usar CNPJ de homologação (pode ser o próprio CNPJ — SEFAZ aceita em HML)
3. Criar documento fiscal no ERP → emitir → verificar status
4. Retorno cStat=100 = autorizado em HML

## G. Como ir para produção
1. Alterar NFE_AMBIENTE=1 no Vercel
2. Confirmar que certificado é o de produção (não o de homologação)
3. Confirmar IE e CRT corretos
4. Emitir NF-e de baixo valor primeiro como teste

## H. Arquivos criados/alterados
- nfe-service/package.json
- nfe-service/tsconfig.json
- nfe-service/vercel.json
- nfe-service/api/_types.ts
- nfe-service/api/_wizard.ts
- nfe-service/api/_cert.ts
- nfe-service/api/emitir.ts
- nfe-service/api/consultar.ts
- nfe-service/api/cancelar.ts
- nfe-service/api/recibo.ts
- nfe-service/api/inutilizar.ts
- nfe-service/api/certificado.ts
- nfe-service/api/danfe.ts (real — NFE_GerarDanfe)
- supabase/functions/fiscal-emitir-nfe/index.ts (adaptado)
- supabase/functions/fiscal-consultar-nfe/index.ts (adaptado)
- supabase/functions/fiscal-cancelar-nfe/index.ts (adaptado)
- supabase/functions/fiscal-inutilizar-nfe/index.ts (novo)

## RESUMO EXECUTIVO PARA O DONO

**O que foi feito:** Integração real de emissão de NF-e federal usando nfewizard-io (gratuito, open source). O sistema agora consegue emitir, consultar, cancelar e inutilizar notas fiscais diretamente pela SEFAZ, sem pagar mensalidade de nenhum provedor.

**O que já funciona:** Todo o módulo fiscal do ERP (telas, fila, configuração). Após esse deploy, a emissão real passa a funcionar — hoje está em modo simulado.

**O que já está incluído:** DANFE (PDF da nota) via `NFE_GerarDanfe()` nativo do nfewizard-io — implementado neste plano.

**O que você precisa configurar:** Certificado digital A1 em base64 + senha + dados da empresa nas variáveis de ambiente do Vercel.

**Riscos antes de emitir em produção:** Testar em homologação primeiro. Verificar que o certificado é o correto. Verificar regime tributário (CRT) e inscrição estadual.
```

---

## Notas Importantes

### Timeout — CRÍTICO
O plano Hobby tem limite de **10 segundos** — **INVIÁVEL** (SEFAZ responde em 15-45s). Usar obrigatoriamente **Vercel Pro** (60s) ou **Railway** ($5/mês, sem limite prático). Ver seção de limitações no início do plano.

### Estados além de SP
O nfewizard-io foi testado principalmente em SP. Para outros estados, o código IBGE e endpoint SEFAZ mudam. Abrir issue no repositório se houver problemas com outros estados.

### Reforma Tributária 2025
O nfewizard-io v1.0.0 já suporta NT 2025.002. Manter a dependência atualizada com `npm update nfewizard-io` periodicamente.

### Mapeamento de retorno
O `cStat === '100'` indica autorização. Outros códigos comuns:
- `100` — Autorizado
- `110` — Uso Denegado
- `302` — NF-e não encontrada
- `204` — Duplicidade (já emitida)
- `217` — NF-e não consta na base da SEFAZ

Consultar tabela completa em: https://www.nfe.fazenda.gov.br/portal/codigos.aspx

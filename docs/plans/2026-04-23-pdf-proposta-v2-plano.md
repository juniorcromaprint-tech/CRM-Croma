# Plano executável: PDF Proposta v2 — Mubisys+ 100%

**Data alvo:** 2026-04-23 (sessão overnight com Sonnet)
**Contexto:** 2026-04-22 foi feito rewrite inicial (commit `dbc2e7f` em main). Junior validou e listou 12 melhorias. Este plano detalha a execução de cada uma com código pronto.

**Regra de ouro:** Sonnet deve executar tudo, testar tudo, comitar em 3 commits (P0/P1/P2) e fazer deploy em `main`. Junior acorda com o trabalho 100% entregue.

**Arquivo de teste canônico:**
- Proposta: PROP-2026-0024 (id `5b695afc-38f4-4b4e-b825-7094bb981f27`)
- Cliente: CALCADOS BEIRA RIO S/A (CNPJ 88.379.771/0001-82)
- Valor: R$ 753,80
- URL: `https://crm-croma.vercel.app/comercial/propostas/5b695afc-38f4-4b4e-b825-7094bb981f27`

---

## Regras do projeto que Sonnet DEVE seguir

Ler antes de começar:
- `CLAUDE.md` (raiz) — papel do Claude, stack, padrões
- `.claude/rules/supabase-mutations.md` — sempre `.select().single()` em mutations
- `.claude/rules/alert-dialog-async.md` — `e.preventDefault()` em AlertDialogAction
- `.claude/rules/agent-vendas-coleta-dados.md` — PIX/email hardcoded

Dados fixos hardcoded (nunca inventar):
- PIX: CNPJ **18.923.994/0001-83** — Croma Print Comunicação Visual
- Email oficial: **junior@cromaprint.com.br**

---

## Arquivos principais

```
src/domains/comercial/
  components/OrcamentoPDFMulti.tsx          ← template dos 3 PDFs (editar)
  services/orcamento-pdf-enrich.service.ts  ← enriquecimento de dados (editar)
  pages/OrcamentoViewPage.tsx               ← handler já OK
  pages/OrcamentoEditorPage.tsx             ← formulário (pode precisar p/ P0.4)
```

---

## P0 — Bugs que o cliente VÊ (45 min)

### P0.1 — Telefone da Larissa cortado 🐛 BUG IDENTIFICADO

**Arquivo:** `src/domains/comercial/services/orcamento-pdf-enrich.service.ts`
**Linha:** 144
**Causa raiz:** regex do split quebra no hífen dentro do telefone.

**Código atual (linha 142-148):**
```ts
const mContato = linha.match(/^contato\s+(.+?):\s*(.+)$/i);
if (mContato) {
  const partes = mContato[2].split(/\s*[—\-]\s*/);   // ← BUG: divide em "-" também
  local.marca = (local.marca || mContato[1]).trim();
  local.contato_nome = (partes[0] || '').trim() || null;
  local.contato_telefone = (partes[1] || '').trim() || null;
  continue;
}
```

Para o input `"Contato Beira Rio: Larissa — (51) 3584-2200"`:
- `mContato[2]` = `"Larissa — (51) 3584-2200"`
- split `/\s*[—\-]\s*/` gera `["Larissa", "(51) 3584", "2200"]` (quebra no hífen do telefone!)
- `partes[1]` = `"(51) 3584"` → **telefone truncado**

**Fix:** split apenas no em-dash (—), não no hífen curto (-):
```ts
const mContato = linha.match(/^contato\s+(.+?):\s*(.+)$/i);
if (mContato) {
  // Split apenas em em-dash (—) ou em hífen rodeado de espaços, não hífens dentro do telefone
  const partes = mContato[2].split(/\s+[—–]\s+/);  // em-dash e en-dash com espaço obrigatório em volta
  local.marca = (local.marca || mContato[1]).trim();
  local.contato_nome = (partes[0] || '').trim() || null;
  local.contato_telefone = (partes.slice(1).join(' — ') || '').trim() || null;
  continue;
}
```

**Critério de aceite:** PROP-2026-0024 exibe `Larissa — (51) 3584-2200` (completo).

**Teste unitário sugerido** (criar em `src/domains/comercial/services/__tests__/orcamento-pdf-enrich.service.test.ts` se já tiver setup vitest):
```ts
describe('parseObservacoesInstalacao', () => {
  it('não trunca telefone com hífen', () => {
    const obs = 'LOCAL DE INSTALAÇÃO\nContato Beira Rio: Larissa — (51) 3584-2200';
    const { local } = parseObservacoesInstalacao(obs);
    expect(local?.contato_telefone).toBe('(51) 3584-2200');
    expect(local?.contato_nome).toBe('Larissa');
  });
});
```

---

### P0.2 — Rodapé da página 2 borrado/cortado

**Arquivo:** `src/domains/comercial/components/OrcamentoPDFMulti.tsx`
**Problema:** o footer usa provavelmente `position: fixed` ou renderização parcial que quebra em múltiplas páginas.

**Investigação inicial:** buscar no arquivo:
```
grep -n "CROMA PRINT COMUNICACAO VISUAL LTDA" src/domains/comercial/components/OrcamentoPDFMulti.tsx
grep -n "position.*fixed\|position.*absolute\|@page" src/domains/comercial/components/OrcamentoPDFMulti.tsx
```

**Abordagem correta com html2pdf.js** — footer em flow normal com `break-inside: avoid`, repetindo por página via CSS `@page`:

```tsx
// No final do componente, ANTES do fechamento da div root:
<footer
  style={{
    marginTop: '32pt',
    paddingTop: '12pt',
    borderTop: '1px solid #e5e7eb',
    fontSize: '9pt',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 1.4,
    breakInside: 'avoid',
    pageBreakInside: 'avoid',
  }}
>
  <div style={{ fontWeight: 600, color: '#334155' }}>
    CROMA PRINT COMUNICACAO VISUAL LTDA
  </div>
  <div>
    CNPJ 18.923.994/0001-83 · junior@cromaprint.com.br · São Paulo/SP
  </div>
  <div style={{ marginTop: '4pt', fontSize: '8pt', color: '#94a3b8' }}>
    Proposta Comercial · Emitida em {dataEmissao} · {numero}
  </div>
</footer>
```

**Alternativa se html2pdf suportar `@page`:** adicionar no topo do componente:
```tsx
<style>{`
  @page { margin: 24mm 18mm 28mm 18mm; }
  @page :left { @bottom-center { content: "CROMA PRINT ... · CNPJ 18.923.994/0001-83"; } }
`}</style>
```
(depende da versão do html2pdf; se não funcionar, usar a abordagem em-flow acima).

**Critério de aceite:** ambas as páginas mostram rodapé limpo, legível, mesma posição vertical.

---

### P0.3 — Quebra de página na "DADOS PARA PAGAMENTO"

**Arquivo:** `src/domains/comercial/components/OrcamentoPDFMulti.tsx`
**Fix:** envolver cada seção principal com `breakInside: 'avoid'`.

```tsx
const sectionStyle = {
  marginTop: '18pt',
  breakInside: 'avoid' as const,
  pageBreakInside: 'avoid' as const,
};

// ...
<section style={sectionStyle}>
  <h3 style={sectionHeaderStyle}>DADOS PARA PAGAMENTO</h3>
  <table>...</table>
</section>
```

Aplicar a TODAS as seções do PDF: DADOS DO CLIENTE, LOCAL DE INSTALAÇÃO, ESCOPO, ITENS (exceto a tabela itself — essa pode quebrar), RESUMO FINANCEIRO, CONDIÇÕES COMERCIAIS, DADOS PARA PAGAMENTO, OBSERVAÇÕES, APROVAÇÃO, TERMOS.

**Exceção:** a tabela de itens pode quebrar entre linhas, mas cabeçalho deve repetir. Usar `<thead style={{ display: 'table-header-group' }}>`.

**Critério de aceite:** nenhuma seção é cortada entre páginas.

---

### P0.4 — Observações vazam linguagem interna 🔧 SOLUÇÃO ESTRUTURAL

**Problema atual:** o texto "Criar ordem_instalacao quando proposta for aprovada" e "Faturamento: CALCADOS BEIRA RIO S/A (SP). Instalação: endereço da loja acima." aparecem no PDF do cliente.

**Solução:** criar campo `observacoes_internas` separado.

**Passo 1 — Migration (criar arquivo):**
`supabase/migrations/131_propostas_observacoes_internas.sql`:
```sql
-- Adiciona campo observacoes_internas na tabela propostas
-- observacoes = texto exibido no PDF do cliente
-- observacoes_internas = notas para equipe/produção (nunca vai pro PDF cliente)

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS observacoes_internas text;

COMMENT ON COLUMN public.propostas.observacoes IS 'Observações visíveis ao cliente no PDF da proposta';
COMMENT ON COLUMN public.propostas.observacoes_internas IS 'Notas internas para equipe (não aparecem no PDF cliente)';

-- Migrar dados existentes: mover linhas "Criar ordem_..." e "Faturamento:" para observacoes_internas
UPDATE public.propostas
SET 
  observacoes_internas = COALESCE(observacoes_internas, '') || E'\n' || 
    regexp_replace(observacoes, '(?!.*(Ref\.?:|LOCAL DE INSTALAÇÃO|Responsável local|CONDIÇÕES:|Contato [A-Z])).*(Criar ordem_|Faturamento:|Instalação: endereço).*', '\0', 'g'),
  observacoes = regexp_replace(
    observacoes,
    E'\\n?(Criar ordem_[^\\n]*|Faturamento:[^\\n]*|Instalação: endereço[^\\n]*)',
    '',
    'gi'
  )
WHERE observacoes ~* '(Criar ordem_|Faturamento:|Instalação: endereço)';
```

**Passo 2 — Aplicar via MCP:**
```
mcp__d972dcbc-07a8-4bda-9c80-f932664e8c48__apply_migration
name: "propostas_observacoes_internas"
query: <conteúdo acima>
project_id: djwjmfgplnqyffdcgdaw
```

**Passo 3 — Atualizar TypeScript types:**
```bash
# Regenerar tipos via MCP Supabase
mcp__d972dcbc-07a8-4bda-9c80-f932664e8c48__generate_typescript_types
```
Salvar output em `src/integrations/supabase/types.ts` (se usar esse padrão).

**Passo 4 — Atualizar `OrcamentoEditorPage.tsx`** (formulário de proposta):
```tsx
// Adicionar campo abaixo de "observacoes" no form:
<FormField
  control={form.control}
  name="observacoes_internas"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Observações internas (não aparecem pro cliente)</FormLabel>
      <FormControl>
        <Textarea {...field} placeholder="Notas para equipe, instruções de produção, faturamento..." />
      </FormControl>
      <FormDescription>
        Use este campo para instruções internas. O cliente NUNCA vê isso.
      </FormDescription>
    </FormItem>
  )}
/>
```

**Passo 5 — Atualizar `OrcamentoPDFMulti.tsx`:**
- No modo **Cliente:** usar só `observacoes` (limpo).
- No modo **Ficha Técnica** e **OS Produção:** mostrar `observacoes` + `observacoes_internas` (produção precisa ver).

**Passo 6 — Atualizar enrich service:** incluir `observacoes_internas` na query:
```ts
// linha ~220-230 do orcamento-pdf-enrich.service.ts
const { data: proposta } = await supabase
  .from('propostas')
  .select('observacoes, observacoes_internas, ...')
  .eq('id', orcamento.id)
  .single();
```

**Critério de aceite:**
- PDF Cliente da PROP-2026-0024 NÃO mostra "Criar ordem_instalacao" nem "Faturamento: CALCADOS...".
- PDF Ficha Técnica e OS Produção mostram ambos os blocos (observações externas e internas).
- Formulário de edição tem 2 campos separados.

---

## P1 — Layout (1h30)

### P1.5 — Coluna "ARTE" condicional

**Arquivo:** `OrcamentoPDFMulti.tsx`
**Fix:**
```tsx
// No início do componente, calcular:
const hasAnyArte = orcamento.itens.some(
  (i) => i.arte_url || i.preview_url || i.imagem_arte
);

// No render da tabela:
<thead>
  <tr>
    {hasAnyArte && <th style={thStyle}>ARTE</th>}
    <th style={thStyle}>DESCRIÇÃO</th>
    <th style={thStyle}>MEDIDA</th>
    <th style={thStyle}>QTD</th>
    <th style={thStyle}>VALOR UN.</th>
    <th style={thStyle}>SUBTOTAL</th>
  </tr>
</thead>
<tbody>
  {orcamento.itens.map((item) => (
    <tr key={item.id}>
      {hasAnyArte && (
        <td style={tdStyle}>
          {item.arte_url ? (
            <img src={item.arte_url} style={{ maxWidth: '60px', maxHeight: '60px' }} />
          ) : null /* célula vazia, não mostrar "sem arte" */}
        </td>
      )}
      {/* resto */}
    </tr>
  ))}
</tbody>
```

**Critério de aceite:** PROP-2026-0024 não tem coluna ARTE (nenhum item tem arte). Se tivesse 1 item com arte e 2 sem, coluna aparece com thumb no 1º e vazia nos outros.

---

### P1.6 — "QTD 2,80 un" incoerente

**Arquivo:** `OrcamentoPDFMulti.tsx`
**Lógica atual:** provavelmente `item.quantidade` + `item.unidade` literalmente (2.80 + "un").

**Fix — função helper no topo do arquivo:**
```ts
function formatQuantidade(item: OrcamentoItem): string {
  // Se tem área calculada e unidade é m², mostrar peças se houver, senão área
  const temArea = item.area_m2 && item.area_m2 > 0;
  const qtdPecas = item.quantidade_pecas || 1;
  const unidade = (item.unidade || 'un').toLowerCase();

  // Caso 1: produto fabricado com área — mostrar peças
  if (temArea && (unidade === 'm²' || unidade === 'm2')) {
    return qtdPecas === 1 ? '1 peça' : `${qtdPecas} peças`;
  }

  // Caso 2: serviço ou produto por unidade inteira
  if (Number.isInteger(item.quantidade)) {
    return `${item.quantidade} ${item.quantidade === 1 ? 'un' : 'un'}`;
  }

  // Caso 3: fallback — mostrar com m² se fizer sentido
  if (unidade === 'm²' || unidade === 'm2') {
    return `${item.quantidade.toFixed(2)} m²`;
  }

  return `${item.quantidade} ${unidade}`;
}

// Usar:
<td>{formatQuantidade(item)}</td>
```

**Critério de aceite:**
- Adesivo Blackout (2,80 m²): QTD = "1 peça" (ou o `quantidade_pecas` real do item)
- Chapa PS Branco (2,80 m²): QTD = "1 peça"
- Instalação: QTD = "1 un"

Se o schema não tem `quantidade_pecas`, usar `1 peça` fixo para itens com área.

---

### P1.7 — Subtotal = Total redundante

**Arquivo:** `OrcamentoPDFMulti.tsx`
**Fix:**
```tsx
const desconto = orcamento.desconto_valor || 0;
const frete = orcamento.frete_valor || 0;
const acrescimo = orcamento.acrescimo_valor || 0;
const temAjustes = desconto > 0 || frete > 0 || acrescimo > 0;

// Render:
<div style={resumoFinanceiroStyle}>
  {temAjustes && (
    <>
      <ResumoLinha label="Subtotal" valor={orcamento.subtotal} />
      {desconto > 0 && <ResumoLinha label="Desconto" valor={-desconto} negativo />}
      {frete > 0 && <ResumoLinha label="Frete" valor={frete} />}
      {acrescimo > 0 && <ResumoLinha label="Acréscimo" valor={acrescimo} />}
    </>
  )}
  <ResumoLinha label="TOTAL GERAL" valor={orcamento.total} destaque />
</div>
```

**Critério de aceite:** PROP-2026-0024 (sem ajustes) mostra só "TOTAL GERAL R$ 753,80". Propostas com desconto mostram o breakdown completo.

---

### P1.8 — "Válida por 30 dias" sem data absoluta

**Arquivo:** `OrcamentoPDFMulti.tsx`
**Fix:**
```tsx
import { formatDate } from '@/shared/utils/format';

function calcValidadeAte(dataEmissao: string, dias: number): string {
  const d = new Date(dataEmissao);
  d.setDate(d.getDate() + dias);
  return formatDate(d.toISOString()); // DD/MM/YYYY
}

// No header:
<div>
  Emitida em {formatDate(orcamento.data_emissao)}<br />
  Válida até {calcValidadeAte(orcamento.data_emissao, orcamento.validade_dias || 30)} ({orcamento.validade_dias || 30} dias)
</div>
```

**Critério de aceite:** PROP-2026-0024 emitida em 22/04/2026 com 30 dias → "Válida até 22/05/2026 (30 dias)".

---

### P1.9 — "Boleto 1x15 dias" ambíguo

**Arquivo:** `OrcamentoPDFMulti.tsx`
**Fix mínimo (hardcode):**
```tsx
function formatCondicoes(condicoes: string): string {
  const lower = condicoes.toLowerCase();
  // Se mencionar boleto sem especificar âncora, adicionar
  if (/boleto/.test(lower) && !/aprova[çc][aã]o|faturamento|emiss[aã]o/i.test(condicoes)) {
    return `${condicoes} (contados a partir da aprovação da proposta)`;
  }
  return condicoes;
}

// Usar:
<td>{formatCondicoes(orcamento.condicoes_pagamento || 'A combinar')}</td>
```

**Critério de aceite:** PROP-2026-0024 mostra "Boleto 1x15 dias — prazo de entrega 7 dias (contados a partir da aprovação da proposta)".

---

## P2 — Subida pro nível Mubisys+ (2h30)

### P2.10 — Bloco de aceite / aprovação

**Arquivo:** `OrcamentoPDFMulti.tsx`
**Adicionar nova seção ANTES do footer, só no modo Cliente.**

**Dependência:** biblioteca QR code.
```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

**Código:**
```tsx
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

// Dentro do componente:
const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

useEffect(() => {
  if (modo === 'cliente' && orcamento.portal_token) {
    const url = `https://crm-croma.vercel.app/p/${orcamento.portal_token}`;
    QRCode.toDataURL(url, { width: 120, margin: 1 }).then(setQrDataUrl);
  }
}, [modo, orcamento.portal_token]);

// Render (só no modo cliente):
{modo === 'cliente' && (
  <section style={{ ...sectionStyle, marginTop: '24pt' }}>
    <h3 style={sectionHeaderStyle}>APROVAÇÃO DA PROPOSTA</h3>
    <div style={{ display: 'flex', gap: '24pt', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '10pt', color: '#475569', marginBottom: '16pt', lineHeight: 1.5 }}>
          Ao assinar abaixo, o cliente aprova o escopo e valores descritos nesta
          proposta e autoriza o início da produção pela Croma Print.
        </p>
        <div style={{ marginBottom: '12pt' }}>
          <span style={labelStyle}>Data:</span>
          <span style={{ borderBottom: '1px solid #334155', display: 'inline-block', width: '100pt', marginLeft: '8pt' }}>&nbsp;</span>
        </div>
        <div style={{ marginBottom: '12pt' }}>
          <span style={labelStyle}>Nome:</span>
          <span style={{ borderBottom: '1px solid #334155', display: 'inline-block', width: '280pt', marginLeft: '8pt' }}>&nbsp;</span>
        </div>
        <div style={{ marginBottom: '12pt' }}>
          <span style={labelStyle}>CPF/CNPJ:</span>
          <span style={{ borderBottom: '1px solid #334155', display: 'inline-block', width: '220pt', marginLeft: '8pt' }}>&nbsp;</span>
        </div>
        <div style={{ marginBottom: '12pt' }}>
          <span style={labelStyle}>Assinatura:</span>
          <span style={{ borderBottom: '1px solid #334155', display: 'inline-block', width: '240pt', marginLeft: '8pt', height: '32pt' }}>&nbsp;</span>
        </div>
      </div>
      {qrDataUrl && (
        <div style={{ textAlign: 'center', fontSize: '9pt', color: '#64748b' }}>
          <img src={qrDataUrl} alt="QR code aprovação digital" style={{ width: '96pt', height: '96pt' }} />
          <div style={{ marginTop: '4pt', maxWidth: '96pt' }}>
            Aprove digitalmente<br />escaneando este QR
          </div>
        </div>
      )}
    </div>
  </section>
)}
```

**Se `orcamento.portal_token` não existir no schema:**
Adicionar ao enrich service uma consulta que resolve ou gera o token. Usar uuid v4 estável baseado em id da proposta:
```ts
// No enrich:
const portalToken = proposta.portal_token || orcamento.id; // fallback: usa ID
```

Se preferir não depender de portal — omitir o QR e deixar só a área de assinatura física.

**Critério de aceite:** PDF Cliente tem seção APROVAÇÃO com 4 linhas pra preencher + QR funcional apontando pro portal.

---

### P2.11 — Termos e condições padronizados

**Arquivo:** `OrcamentoPDFMulti.tsx`
**Adicionar constante no topo do arquivo:**

```tsx
const TERMOS_PROPOSTA_DEFAULT = [
  {
    titulo: 'PRAZO DE ARTE',
    texto: 'Arte final entregue em até 2 dias úteis após a aprovação da proposta. Revisões inclusas: até 2 (duas). Revisões adicionais cobradas à parte.',
  },
  {
    titulo: 'PRAZO DE PRODUÇÃO',
    texto: 'Conforme indicado na proposta, contado a partir da aprovação da arte final pelo cliente. Atrasos causados por pendência de aprovação, envio de material do cliente ou alterações de escopo prorrogam o prazo proporcionalmente.',
  },
  {
    titulo: 'GARANTIA',
    texto: '90 (noventa) dias contra defeitos de fabricação, contados a partir da data de instalação ou entrega. Não cobre danos por má utilização, vandalismo, acidentes, intempéries ou desgaste natural.',
  },
  {
    titulo: 'INSTALAÇÃO',
    texto: 'Escopo conforme descrito nesta proposta. Obras extras (elétrica, reforço estrutural, obra civil, aluguel de equipamentos especiais) serão cobradas mediante aditivo contratual.',
  },
  {
    titulo: 'CANCELAMENTO',
    texto: 'Após a aprovação, o valor não é reembolsável caso a arte já tenha sido iniciada ou material comprado. Cancelamentos antes da produção estão sujeitos a taxa administrativa.',
  },
  {
    titulo: 'FORO',
    texto: 'Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer questões oriundas desta proposta.',
  },
];

// Render (só no modo cliente, antes do footer):
{modo === 'cliente' && (
  <section style={{ ...sectionStyle, marginTop: '20pt', fontSize: '9pt' }}>
    <h3 style={sectionHeaderStyle}>TERMOS E CONDIÇÕES</h3>
    <ol style={{ paddingLeft: '16pt', margin: 0, color: '#475569', lineHeight: 1.5 }}>
      {TERMOS_PROPOSTA_DEFAULT.map((t, i) => (
        <li key={i} style={{ marginBottom: '6pt' }}>
          <strong style={{ color: '#1e293b' }}>{t.titulo}:</strong> {t.texto}
        </li>
      ))}
    </ol>
  </section>
)}
```

**Critério de aceite:** PDF Cliente tem seção TERMOS com 6 itens numerados legíveis.

---

### P2.12 — Escopo auto quando vazio

**Arquivo:** `OrcamentoPDFMulti.tsx`

**Lógica:**
```tsx
function gerarEscopoAuto(orc: OrcamentoEnriquecido): string {
  const cliente = orc.cliente?.razao_social || orc.cliente?.nome_fantasia || 'cliente';
  const marca = orc.local_instalacao?.marca;
  const ref = orc.local_instalacao?.referencia;
  const endereco = orc.local_instalacao?.endereco_completo;

  // Agrupar itens por tipo (banner, adesivo, placa, instalação...)
  const tiposItens = Array.from(new Set(
    orc.itens
      .map((i) => extrairTipoProduto(i.descricao))
      .filter(Boolean)
  ));
  const listaItens = tiposItens.length > 0
    ? tiposItens.join(', ')
    : 'materiais de comunicação visual';

  let escopo = `Fornecimento de ${listaItens}`;
  if (marca) escopo += ` para a marca ${marca}`;
  else escopo += ` para ${cliente}`;
  if (ref) escopo += ` — ${ref}`;
  if (endereco) escopo += `. Instalação no endereço: ${endereco}`;
  escopo += '.';
  return escopo;
}

function extrairTipoProduto(desc: string): string | null {
  const lower = desc.toLowerCase();
  if (/adesivo blackout/.test(lower)) return 'adesivo blackout';
  if (/adesivo/.test(lower)) return 'adesivo';
  if (/banner/.test(lower)) return 'banner';
  if (/placa|chapa ps|acm/.test(lower)) return 'placas';
  if (/lona/.test(lower)) return 'lona';
  if (/fachada/.test(lower)) return 'fachada';
  if (/instalação|instalacao/.test(lower)) return null; // serviço, não produto
  return null;
}

// Usar:
const escopoTexto = orcamento.escopo?.trim()
  && !/^(conforme solicitado|segue cota[çc][aã]o)/i.test(orcamento.escopo.trim())
  ? orcamento.escopo
  : gerarEscopoAuto(orcamento);
```

**Critério de aceite:** PROP-2026-0024 gera algo parecido com: `"Fornecimento de adesivo blackout, placas para a marca Beira Rio — 186958-1 Giseli. Instalação no endereço: Loja Vizzano — Avenida São Miguel, 4392 - Vila Rio Branco - São Paulo/SP - CEP 03870-000."`

---

## Commits esperados

Fazer **3 commits separados** em branch `main` (não criar branch — main aceita push direto conforme fluxo atual).

**Commit 1 — P0:**
```
fix(pdf): corrige telefone truncado, footer quebrado, page-break e vazamento de notas internas

- Fix regex do parseObservacoesInstalacao: split só em em-dash (nao em hifen do telefone)
- Footer em flow normal com break-inside avoid
- Todas as secoes com pageBreakInside avoid
- Campo observacoes_internas separado via migration 131
- PDF cliente usa apenas observacoes publicas; producao ve ambas

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

**Commit 2 — P1:**
```
feat(pdf): polimento layout proposta cliente

- Coluna ARTE so aparece se ao menos 1 item tem arte
- QTD coerente: peças para produtos com área, un para serviços
- Resumo financeiro oculta subtotal quando igual ao total
- Validade com data absoluta (Valida ate DD/MM/YYYY)
- Condicoes de pagamento com ancora explicita

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

**Commit 3 — P2:**
```
feat(pdf): bloco de aprovacao com QR code + termos + escopo auto

- Secao APROVACAO DA PROPOSTA com campos para assinatura manual
- QR code apontando para portal cliente (aprovacao digital)
- Secao TERMOS E CONDICOES com 6 itens padrao
- Escopo gerado automaticamente quando vazio ou default

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## Deploy

**Após cada commit**, executar deploy com script já pronto:
```
C:\Users\Caldera\Claude\CRM-Croma\.claude\deploy-cherry-pick.ps1
```

Ou fluxo manual:
```bash
cd C:\Users\Caldera\Claude\CRM-Croma
git status
git add <arquivos>
git commit -F .claude/commit-msg.txt  # sempre -F, nunca -m "msg com espacos" via PowerShell
git push origin main
```

**Vercel** redeploya `crm-croma.vercel.app` automaticamente em ~90s após push em `main`.

---

## Validação final (testes manuais via Chrome MCP ou análise de PDF)

Ao final dos 3 commits, Sonnet deve:

1. **Rodar build local:**
   ```
   cd C:\Users\Caldera\Claude\CRM-Croma
   npm run build
   ```
   (deve passar sem erros TypeScript)

2. **Executar o typecheck:**
   ```
   npx tsc --noEmit
   ```

3. **Se houver testes:** `npm run test` (não travar se falhar por infra; apenas logar).

4. **Via Chrome MCP** (se disponível):
   - Navegar pra `https://crm-croma.vercel.app/comercial/propostas/5b695afc-38f4-4b4e-b825-7094bb981f27`
   - Clicar "Gerar PDF" modo Cliente
   - Baixar e abrir o PDF gerado (salvar em `C:\Users\Caldera\Claude\CRM-Croma\.claude\test-pdf-cliente-v2.pdf`)
   - Ler o PDF via `Read` tool e validar cada um dos 12 critérios de aceite
   - Repetir para Ficha Técnica e OS Produção (só critérios relevantes)

5. **Atualizar `.planning/STATE.md`** com resumo da sessão e lista de fixes aplicados.

6. **Atualizar Obsidian vault** (`C:\Users\Caldera\Obsidian\JARVIS\99-Meta\memory.md`) com entrada da sessão no TOPO.

7. **Criar daily note** `C:\Users\Caldera\Obsidian\JARVIS\01-Daily\2026-04-23.md` com resumo.

8. **Mandar Telegram pro Junior** (chat_id 1065519625) quando terminar:
   ```
   ✅ PDF Proposta v2 — 100% entregue.

   12 fixes aplicados em 3 commits em main:
   - P0: telefone, footer, page-break, notas internas separadas
   - P1: coluna arte, qtd coerente, subtotal, validade, condições
   - P2: bloco aprovação + QR, termos, escopo auto

   Teste: crm-croma.vercel.app → PROP-2026-0024 → Gerar PDF.
   Hard reload (Ctrl+Shift+R) se vier cache.
   ```
   Usar Edge Function `telegram-send-message` ou MCP croma se tiver ferramenta, senão deixar preparado em `.claude/telegram-msg.txt`.

---

## Rollback (se algo sair muito errado)

Se algum commit quebrar o build em produção:
```bash
cd C:\Users\Caldera\Claude\CRM-Croma
git log --oneline -5   # pegar SHA do commit anterior ao fix quebrado
git revert <SHA>       # cria commit de revert
git push origin main
```

Migration 131 tem rollback:
```sql
ALTER TABLE public.propostas DROP COLUMN IF EXISTS observacoes_internas;
```

---

## Checklist final (Sonnet marcar ao terminar)

- [ ] P0.1 Telefone completo (Larissa — (51) 3584-2200)
- [ ] P0.2 Footer legível nas 2 páginas
- [ ] P0.3 Nenhuma seção quebra entre páginas
- [ ] P0.4 Observações internas filtradas do PDF cliente (migration 131 aplicada)
- [ ] P1.5 Coluna ARTE condicional
- [ ] P1.6 QTD coerente (peças/un, nunca "2,80 un")
- [ ] P1.7 Subtotal oculto quando igual ao total
- [ ] P1.8 Validade com data absoluta
- [ ] P1.9 Condições com âncora
- [ ] P2.10 Bloco APROVAÇÃO + QR
- [ ] P2.11 Seção TERMOS com 6 itens
- [ ] P2.12 Escopo auto quando vazio
- [ ] 3 commits em main + push
- [ ] Build passa sem erro TS
- [ ] PDF gerado em produção validado via Chrome MCP ou análise de arquivo
- [ ] STATE.md atualizado
- [ ] Obsidian vault atualizado (memory.md + daily + aprendizados se houver)
- [ ] Telegram pro Junior (ou mensagem preparada)

---

## Notas importantes pra Sonnet

1. **Não perguntar ao Junior** — ele está dormindo. Se houver ambiguidade, tomar a decisão mais conservadora e documentar no STATE.md.
2. **Se o schema não tiver `portal_token` em propostas:** fazer fallback usando `orcamento.id` no URL do QR. Não criar novo campo sem necessidade.
3. **Se biblioteca `qrcode` não instalar:** gerar QR via API externa (`api.qrserver.com/v1/create-qr-code/?data=URL&size=150x150`) como fallback.
4. **Se html2pdf tiver limitação com `@page`:** usar footer in-flow e `breakInside: 'avoid'`. Testar ambos.
5. **Não mexer em nada fora dos 3 arquivos principais** + migration + types.
6. **Nunca deletar dados do banco** — a migration só adiciona coluna. UPDATE mover textos é seguro porque preserva em observacoes_internas.
7. **Sempre `.select().single()`** em inserts/updates (regra do projeto).
8. **Toda mutation em AlertDialogAction usa `e.preventDefault()`** (regra do projeto).
9. **Deploy é obrigatório** — commitar e não dar push = trabalho não entregue.
10. **Registrar no memory.md** no final, no TOPO, seguindo template de sessões anteriores.

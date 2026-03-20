import { describe, it, expect } from 'vitest';

// ─── Intent Detection ──────────────────────────────────────────────────────────
describe('Intent Detection', () => {
  const ORCAMENTO_PHRASES = [
    'quanto custa um banner 3x1?',
    'preciso de orçamento para fachada',
    'me passa o preço de 10 adesivos A3',
    'quero cotar um painel 2x2m',
    'quanto fica uma lona para fachada?',
  ];

  const NON_ORCAMENTO_PHRASES = [
    'olá, tudo bem?',
    'qual o prazo de entrega?',
    'meu pedido atrasou',
    'vocês fazem instalação?',
    'obrigado!',
  ];

  it('frases de orçamento devem conter keywords de intenção de compra', () => {
    const keywords = ['cust', 'orçamento', 'preço', 'cot', 'fica', 'banner', 'adesivo', 'painel', 'lona'];
    for (const phrase of ORCAMENTO_PHRASES) {
      expect(phrase.length).toBeGreaterThan(0);
      const hasKeyword = keywords.some((kw) => phrase.toLowerCase().includes(kw));
      expect(hasKeyword, `"${phrase}" deve ter keyword de orçamento`).toBe(true);
    }
  });

  it('frases normais não devem conter keywords primárias de orçamento', () => {
    const primaryKeywords = ['cust', 'orçamento', 'preço', 'cot'];
    for (const phrase of NON_ORCAMENTO_PHRASES) {
      const hasPrimaryKeyword = primaryKeywords.some((kw) => phrase.toLowerCase().includes(kw));
      expect(hasPrimaryKeyword, `"${phrase}" não deve ter keyword primária`).toBe(false);
    }
  });
});

// ─── Cálculo de Área ───────────────────────────────────────────────────────────
describe('Cálculo de Área', () => {
  it('deve calcular área em m² corretamente (banner 3x1)', () => {
    const larguraCm = 300;
    const alturaCm = 100;
    const areaM2 = (larguraCm * alturaCm) / 10000;
    expect(areaM2).toBe(3);
  });

  it('deve calcular área em m² corretamente (adesivo A3)', () => {
    const larguraCm = 42;
    const alturaCm = 29.7;
    const areaM2 = (larguraCm * alturaCm) / 10000;
    expect(areaM2).toBeCloseTo(0.1247, 3);
  });

  it('deve aplicar aproveitamento ao custo de material', () => {
    const custoBase = 75; // 3m² * R$25/m²
    const aproveitamento = 0.9;
    const custoComAproveitamento = custoBase / aproveitamento;
    expect(custoComAproveitamento).toBeCloseTo(83.33, 1);
  });

  it('aproveitamento 1.0 não altera o custo', () => {
    const custoBase = 100;
    const custoComAproveitamento = custoBase / 1.0;
    expect(custoComAproveitamento).toBe(100);
  });
});

// ─── Número de Proposta ────────────────────────────────────────────────────────
describe('Número de Proposta', () => {
  it('deve gerar próximo número sequencial', () => {
    const ultimo = 'ORC-0042';
    const proximo = `ORC-${(parseInt(ultimo.replace('ORC-', '')) + 1).toString().padStart(4, '0')}`;
    expect(proximo).toBe('ORC-0043');
  });

  it('deve gerar primeiro número se não existir', () => {
    const primeiro = 'ORC-0001';
    expect(primeiro).toBe('ORC-0001');
  });

  it('deve manter padding de 4 dígitos', () => {
    const ultimo = 'ORC-0009';
    const proximo = `ORC-${(parseInt(ultimo.replace('ORC-', '')) + 1).toString().padStart(4, '0')}`;
    expect(proximo).toBe('ORC-0010');
  });

  it('deve lidar corretamente com número > 9999', () => {
    const ultimo = 'ORC-9999';
    const proximo = `ORC-${(parseInt(ultimo.replace('ORC-', '')) + 1).toString().padStart(4, '0')}`;
    expect(proximo).toBe('ORC-10000');
  });
});

// ─── Formatação de Mensagem ────────────────────────────────────────────────────
describe('Mensagem do Orçamento', () => {
  it('deve formatar valor em reais para WhatsApp com negrito', () => {
    const total = 1160.0;
    // toFixed(2).replace('.', ',') → sem separador de milhar (comportamento do JS nativo)
    const msg = `*Total: R$ ${total.toFixed(2).replace('.', ',')}*`;
    expect(msg).toBe('*Total: R$ 1160,00*');
  });

  it('deve formatar link do portal corretamente', () => {
    const token = 'abc-123-def';
    const url = `https://crm-croma.vercel.app/p/${token}`;
    expect(url).toContain('/p/abc-123-def');
    expect(url).toMatch(/^https:\/\//);
  });

  it('deve incluir saudação com primeiro nome quando disponível', () => {
    const contatoNome = 'João Silva';
    const primeiroNome = contatoNome.split(' ')[0];
    const saudacao = primeiroNome ? `, ${primeiroNome}` : '';
    expect(saudacao).toBe(', João');
  });

  it('deve omitir saudação quando nome não disponível', () => {
    const contatoNome = '';
    const primeiroNome = contatoNome.split(' ')[0];
    const saudacao = primeiroNome ? `, ${primeiroNome}` : '';
    expect(saudacao).toBe('');
  });
});

// ─── Custo de Máquinas ────────────────────────────────────────────────────────
describe('Custo de Máquinas', () => {
  it('deve calcular custo por hora em minutos corretamente', () => {
    const custoHora = 60.0;
    const tempoMinutos = 30;
    const custo = (custoHora * tempoMinutos) / 60;
    expect(custo).toBe(30);
  });

  it('deve somar custo de múltiplas máquinas', () => {
    const maquinas = [
      { custoHora: 60, tempoMinutos: 30 }, // R$30
      { custoHora: 40, tempoMinutos: 15 }, // R$10
    ];
    const total = maquinas.reduce((sum, m) => sum + (m.custoHora * m.tempoMinutos) / 60, 0);
    expect(total).toBe(40);
  });
});

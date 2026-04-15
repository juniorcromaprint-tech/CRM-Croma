import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatDateRelative,
} from '../format';

// ===========================================================================
// formatDate — DATE puro do Postgres (regressão do bug de fuso horário)
// ===========================================================================
//
// Bug reproduzido em 2026-04-14: campo `scheduled_date` (tipo `date`) era
// renderizado como -1 dia em SP (UTC-3) porque `new Date("2026-04-15")`
// vira UTC 00:00 → SP 14/04 21:00 → "14/04/2026".
// Estes testes garantem que o caminho DATE puro NÃO passa por `Date()` e
// portanto NÃO depende do timezone do runtime.
// ===========================================================================

describe('formatDate — DATE puro (YYYY-MM-DD)', () => {
  it('deve formatar "2026-04-15" como "15/04/2026" independente do TZ', () => {
    expect(formatDate('2026-04-15')).toBe('15/04/2026');
  });

  it('deve formatar primeiro dia do ano sem shift', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });

  it('deve formatar último dia do ano sem shift', () => {
    expect(formatDate('2025-12-31')).toBe('31/12/2025');
  });

  it('deve preservar dia mesmo em DATE de transição de horário de verão', () => {
    // Antiga data de início de horário de verão em SP (terceiro domingo de outubro)
    expect(formatDate('2026-10-18')).toBe('18/10/2026');
    expect(formatDate('2026-02-15')).toBe('15/02/2026');
  });

  it('deve manter o padding de zero para dia/mês de 1 dígito', () => {
    expect(formatDate('2026-03-05')).toBe('05/03/2026');
    expect(formatDate('2026-09-09')).toBe('09/09/2026');
  });
});

describe('formatDate — timestamps ISO completos', () => {
  it('deve formatar timestamp UTC convertendo para timezone local', () => {
    // Meio-dia UTC garante o mesmo dia em qualquer fuso (-12 a +14)
    expect(formatDate('2026-04-15T12:00:00Z')).toBe('15/04/2026');
  });

  it('deve formatar timestamp com offset explícito', () => {
    // 2026-04-15T15:00:00 em UTC-3 (SP) é o mesmo que 18:00 UTC
    const result = formatDate('2026-04-15T15:00:00-03:00');
    expect(result).toBe('15/04/2026');
  });

  it('deve formatar instância de Date', () => {
    const date = new Date(2026, 3, 15, 14, 30); // 15 abril 2026, 14:30 local
    expect(formatDate(date)).toBe('15/04/2026');
  });
});

describe('formatDate — edge cases', () => {
  it('deve retornar string vazia para null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('deve retornar string vazia para undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('deve retornar string vazia para string vazia', () => {
    expect(formatDate('')).toBe('');
  });

  it('deve retornar string vazia para string inválida', () => {
    expect(formatDate('isso não é uma data')).toBe('');
    expect(formatDate('2026-13-99')).toBe('');
  });

  it('deve retornar string vazia para Date inválido', () => {
    expect(formatDate(new Date('totalmente quebrado'))).toBe('');
  });
});

// ===========================================================================
// formatDateTime — sempre converte para timezone local
// ===========================================================================

describe('formatDateTime', () => {
  it('deve formatar timestamp ISO com hora', () => {
    // Usa hora local — testamos só o formato. Intl pt-BR insere vírgula entre data e hora.
    const result = formatDateTime('2026-04-15T14:30:00Z');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4},?\s\d{2}:\d{2}$/);
  });

  it('deve formatar instância de Date', () => {
    const date = new Date(2026, 3, 15, 14, 30);
    // Intl pt-BR retorna "15/04/2026, 14:30" (com vírgula)
    expect(formatDateTime(date)).toBe('15/04/2026, 14:30');
  });

  it('deve retornar string vazia para null/undefined/vazio', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
    expect(formatDateTime('')).toBe('');
  });

  it('deve retornar string vazia para entrada inválida', () => {
    expect(formatDateTime('xpto')).toBe('');
  });
});

// ===========================================================================
// formatDateRelative — também respeita DATE puro (não shifta -1 dia)
// ===========================================================================

describe('formatDateRelative — DATE puro não vira -1 dia', () => {
  it('deve tratar a data de hoje (DATE puro local) sem retornar "ontem"', () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const result = formatDateRelative(`${yyyy}-${mm}-${dd}`);
    // "hoje" se a hora atual for próxima do meio-dia, "há Xh" / "agora mesmo" / "há X min"
    // se for outra hora — o que NÃO pode aparecer é "ontem" (esse seria o bug do fuso).
    expect(result).not.toBe('ontem');
    expect(result).toMatch(/^(hoje|agora mesmo|há \d+ ?(min|h))$/);
  });

  it('deve tratar a data de amanhã (DATE puro local) como "amanhã" ou "em 1 dias"', () => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const result = formatDateRelative(`${yyyy}-${mm}-${dd}`);
    expect(result).not.toBe('hoje');
    expect(['amanhã', 'em 1 dias']).toContain(result);
  });
});

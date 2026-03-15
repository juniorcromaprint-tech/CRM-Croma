import { describe, it, expect } from 'vitest';
import { validarCNPJ } from '../cnpj';

describe('validarCNPJ', () => {
  it('should accept a valid CNPJ', () => {
    // 11.444.777/0001-61 is a mathematically valid CNPJ
    expect(validarCNPJ('11.444.777/0001-61')).toBe(true);
    expect(validarCNPJ('11444777000161')).toBe(true);
  });

  it('should reject an invalid CNPJ', () => {
    expect(validarCNPJ('00.000.000/0000-00')).toBe(false);
    expect(validarCNPJ('11.444.777/0001-99')).toBe(false);
    expect(validarCNPJ('12345678901234')).toBe(false);
  });

  it('should reject strings with all same digits', () => {
    expect(validarCNPJ('11.111.111/1111-11')).toBe(false);
    expect(validarCNPJ('00000000000000')).toBe(false);
  });

  it('should return true for empty/null (CNPJ is optional)', () => {
    expect(validarCNPJ('')).toBe(true);
    expect(validarCNPJ(null)).toBe(true);
    expect(validarCNPJ(undefined)).toBe(true);
  });

  it('should handle partial/short input', () => {
    expect(validarCNPJ('123')).toBe(false);
    expect(validarCNPJ('123456')).toBe(false);
  });
});

// src/domains/dados/__tests__/validators-common.test.ts
import { describe, it, expect } from 'vitest';
import { validateCNPJ, validateCPF, validateEmail, validatePhone, validateUF, parseBRDate } from '../engine/validators/common';

describe('common validators', () => {
  describe('validateCNPJ', () => {
    it('should accept valid CNPJ', () => {
      expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
    });
    it('should accept unformatted CNPJ', () => {
      expect(validateCNPJ('11222333000181')).toBe(true);
    });
    it('should reject invalid CNPJ', () => {
      expect(validateCNPJ('11.111.111/1111-11')).toBe(false);
    });
    it('should reject empty', () => {
      expect(validateCNPJ('')).toBe(false);
    });
  });

  describe('validateCPF', () => {
    it('should accept valid CPF', () => {
      expect(validateCPF('529.982.247-25')).toBe(true);
    });
    it('should reject all same digits', () => {
      expect(validateCPF('111.111.111-11')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
    });
    it('should reject invalid email', () => {
      expect(validateEmail('not-email')).toBe(false);
    });
    it('should accept empty (optional field)', () => {
      expect(validateEmail('')).toBe(true);
    });
  });

  describe('validateUF', () => {
    it('should accept valid UF', () => {
      expect(validateUF('SP')).toBe(true);
      expect(validateUF('RJ')).toBe(true);
    });
    it('should reject invalid UF', () => {
      expect(validateUF('XX')).toBe(false);
    });
  });

  describe('parseBRDate', () => {
    it('should parse DD/MM/YYYY', () => {
      expect(parseBRDate('15/03/2026')).toBe('2026-03-15');
    });
    it('should pass through YYYY-MM-DD', () => {
      expect(parseBRDate('2026-03-15')).toBe('2026-03-15');
    });
    it('should return null for invalid', () => {
      expect(parseBRDate('invalid')).toBeNull();
    });
  });
});

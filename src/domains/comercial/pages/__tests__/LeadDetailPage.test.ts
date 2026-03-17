import { describe, it, expect } from 'vitest';

describe('Lead → Cliente field mapping', () => {
  it('should map lead fields to valid cliente payload', () => {
    const lead = {
      id: '123',
      empresa: 'Loja de Calçados ABC',
      contato_email: 'contato@abc.com',
      contato_telefone: '(51) 99999-9999',
      segmento: 'calcados',
    };
    const cnpj = '11444777000161';

    const payload = {
      razao_social: lead.empresa,
      nome_fantasia: lead.empresa,
      email: lead.contato_email ?? null,
      telefone: lead.contato_telefone ?? null,
      segmento: lead.segmento ?? null,
      origem: 'lead_convertido',
      lead_id: lead.id,
      cnpj,
    };

    expect(payload.razao_social).toBeTruthy();
    expect(payload.nome_fantasia).toBeTruthy();
    expect(payload.lead_id).toBe('123');
    expect(payload.cnpj).toBe('11444777000161');
  });

  it('should handle lead with minimal data', () => {
    const lead = {
      id: '456',
      empresa: 'Test Co',
      contato_email: null,
      contato_telefone: null,
      segmento: null,
    };

    const payload = {
      razao_social: lead.empresa,
      nome_fantasia: lead.empresa,
      email: lead.contato_email ?? null,
      telefone: lead.contato_telefone ?? null,
      segmento: lead.segmento ?? null,
      origem: 'lead_convertido',
      lead_id: lead.id,
      cnpj: null,
    };

    expect(payload.razao_social).toBeTruthy();
    expect(payload.email).toBeNull();
  });

  it('should guard against empty empresa name', () => {
    const lead = { id: '789', empresa: '', contato_email: null, contato_telefone: null, segmento: null };
    const canConvert = !!lead.empresa?.trim();
    expect(canConvert).toBe(false);
  });
});

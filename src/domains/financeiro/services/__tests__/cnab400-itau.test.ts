// ─── CNAB 400 Itaú — Unit Tests ──────────────────────────────────────────────
// Verifica que cada função gera linhas de exatamente 400 caracteres e que
// campos obrigatórios (tipo de registro, código do banco) estão posicionados
// corretamente conforme o layout CNAB 400 do Itaú (banco 341).

import { describe, it, expect } from 'vitest';
import {
  generateHeader,
  generateDetail,
  generateTrailer,
  generateRemessaFile,
} from '../cnab400-itau.service';
import type { BankAccount, BankSlipWithClient } from '../../types/boleto.types';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockAccount: BankAccount = {
  id: 'acc-001',
  nome: 'Conta Principal Croma',
  banco_codigo: '341',
  banco_nome: 'Banco Itau S.A.',
  agencia: '1234',
  agencia_digito: '5',
  conta: '12345',
  conta_digito: '6',
  carteira: '109',
  convenio: null,
  cedente_nome: 'Croma Print Comunicacao Visual Ltda',
  cedente_cnpj: '12.345.678/0001-99',
  cedente_endereco: 'Rua das Flores, 100',
  cedente_cidade: 'Sao Paulo',
  cedente_estado: 'SP',
  cedente_cep: '01310-100',
  nosso_numero_sequencial: 1,
  instrucoes_padrao: null,
  juros_ao_mes: 1.0,
  multa_percentual: 2.0,
  dias_protesto: 0,
  ativo: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockSlip: BankSlipWithClient = {
  id: 'slip-001',
  bank_account_id: 'acc-001',
  conta_receber_id: null,
  pedido_id: null,
  cliente_id: 'cli-001',
  nosso_numero: '00000001',
  seu_numero: 'DOC-001',
  valor_nominal: 1500.75,
  valor_juros: 0,
  valor_multa: 0,
  valor_desconto: 0,
  valor_pago: null,
  data_emissao: '2026-03-01',
  data_vencimento: '2026-04-01',
  data_pagamento: null,
  data_credito: null,
  data_limite_desconto: null,
  sacado_nome: 'João da Silva Comercio ME',
  sacado_cpf_cnpj: '98.765.432/0001-10',
  sacado_endereco: 'Av. Paulista, 1000',
  sacado_cidade: 'Sao Paulo',
  sacado_estado: 'SP',
  sacado_cep: '01310-000',
  instrucoes: null,
  status: 'pronto_remessa',
  motivo_rejeicao: null,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  clientes: { nome_fantasia: 'Silva Comercio', razao_social: 'Joao da Silva Comercio ME' },
};

const mockDate = new Date(2026, 2, 14); // 14/03/2026

// ─── generateHeader ───────────────────────────────────────────────────────────

describe('generateHeader', () => {
  it('deve retornar exatamente 400 caracteres', () => {
    const line = generateHeader(mockAccount, 1, mockDate);
    expect(line.length).toBe(400);
  });

  it('deve começar com "0" (tipo de registro = Header)', () => {
    const line = generateHeader(mockAccount, 1, mockDate);
    expect(line[0]).toBe('0');
  });

  it('deve conter "341" como código do banco Itaú (posições 077-079)', () => {
    const line = generateHeader(mockAccount, 1, mockDate);
    // Posição 77-79 (0-indexed: 76-78)
    expect(line.substring(76, 79)).toBe('341');
  });

  it('deve conter "REMESSA" na posição correta (pos 003-009)', () => {
    const line = generateHeader(mockAccount, 1, mockDate);
    // Posição 3-9 (0-indexed: 2-8)
    expect(line.substring(2, 9)).toBe('REMESSA');
  });

  it('deve conter "01" como código de serviço de cobrança (pos 010-011)', () => {
    const line = generateHeader(mockAccount, 1, mockDate);
    expect(line.substring(9, 11)).toBe('01');
  });

  it('deve conter o número sequencial "000001" nas últimas 6 posições', () => {
    const line = generateHeader(mockAccount, 1, mockDate);
    expect(line.substring(394, 400)).toBe('000001');
  });

  it('deve incluir a data de geração no formato DDMMAA (pos 095-100)', () => {
    const line = generateHeader(mockAccount, 1, mockDate);
    // 14/03/26
    expect(line.substring(94, 100)).toBe('140326');
  });
});

// ─── generateDetail ───────────────────────────────────────────────────────────

describe('generateDetail', () => {
  it('deve retornar exatamente 400 caracteres', () => {
    const line = generateDetail(mockSlip, mockAccount, 2);
    expect(line.length).toBe(400);
  });

  it('deve começar com "1" (tipo de registro = Detalhe)', () => {
    const line = generateDetail(mockSlip, mockAccount, 2);
    expect(line[0]).toBe('1');
  });

  it('deve formatar valor de R$ 1500,75 como 150075 nos 13 dígitos de valor (pos 127-139)', () => {
    const line = generateDetail(mockSlip, mockAccount, 2);
    // Posição 127-139 (0-indexed: 126-138) = 13 chars, centavos com zero-padding
    const valorField = line.substring(126, 139);
    expect(valorField).toBe('0000000150075');
  });

  it('deve incluir o código do banco cobrador 341 (pos 140-142)', () => {
    const line = generateDetail(mockSlip, mockAccount, 2);
    // Posição 140-142 (0-indexed: 139-141)
    expect(line.substring(139, 142)).toBe('341');
  });

  it('deve incluir a data de vencimento no formato DDMMAA (pos 121-126)', () => {
    const line = generateDetail(mockSlip, mockAccount, 2);
    // data_vencimento = '2026-04-01' → 010426
    expect(line.substring(120, 126)).toBe('010426');
  });

  it('deve incluir o nosso número (pos 063-070)', () => {
    const line = generateDetail(mockSlip, mockAccount, 2);
    // nosso_numero = '00000001' → 8 dígitos (pos 63-70, 0-indexed: 62-69)
    expect(line.substring(62, 70)).toBe('00000001');
  });

  it('deve incluir o número sequencial do registro nas últimas 6 posições', () => {
    const line = generateDetail(mockSlip, mockAccount, 2);
    expect(line.substring(394, 400)).toBe('000002');
  });

  it('deve identificar sacado CNPJ com tipo "02" (pos 219-220)', () => {
    // sacado_cpf_cnpj tem 14 dígitos → CNPJ
    const line = generateDetail(mockSlip, mockAccount, 2);
    expect(line.substring(218, 220)).toBe('02');
  });

  it('deve identificar sacado CPF com tipo "01" quando CPF informado', () => {
    const slipCpf: BankSlipWithClient = {
      ...mockSlip,
      sacado_cpf_cnpj: '123.456.789-09',
    };
    const line = generateDetail(slipCpf, mockAccount, 2);
    expect(line.substring(218, 220)).toBe('01');
  });

  it('deve conter aceite "N" (pos 150)', () => {
    const line = generateDetail(mockSlip, mockAccount, 2);
    // Posição 150 (0-indexed: 149)
    expect(line[149]).toBe('N');
  });

  it('deve tratar boleto com desconto — campo de desconto preenchido (pos 180-192)', () => {
    const slipWithDiscount: BankSlipWithClient = {
      ...mockSlip,
      valor_desconto: 50.0,
      data_limite_desconto: '2026-03-30',
    };
    const line = generateDetail(slipWithDiscount, mockAccount, 2);
    // Posição 180-192 (0-indexed: 179-191)
    const descontoField = line.substring(179, 192);
    expect(descontoField).toBe('0000000005000');
  });
});

// ─── generateTrailer ──────────────────────────────────────────────────────────

describe('generateTrailer', () => {
  it('deve retornar exatamente 400 caracteres', () => {
    const line = generateTrailer(3);
    expect(line.length).toBe(400);
  });

  it('deve começar com "9" (tipo de registro = Trailer)', () => {
    const line = generateTrailer(3);
    expect(line[0]).toBe('9');
  });

  it('deve ter o total de linhas nas últimas 6 posições', () => {
    const line = generateTrailer(10);
    expect(line.substring(394, 400)).toBe('000010');
  });

  it('deve preencher posições 002-394 com espaços em branco', () => {
    const line = generateTrailer(1);
    const blanks = line.substring(1, 394);
    expect(blanks).toBe(' '.repeat(393));
  });
});

// ─── generateRemessaFile ──────────────────────────────────────────────────────

describe('generateRemessaFile', () => {
  it('deve retornar header + N detalhes + trailer com todas as linhas de 400 chars', () => {
    const result = generateRemessaFile(mockAccount, [mockSlip], 1, mockDate);
    const lines = result.content.split('\r\n');

    // 1 header + 1 detalhe + 1 trailer = 3 linhas
    expect(lines.length).toBe(3);
    for (const line of lines) {
      expect(line.length).toBe(400);
    }
  });

  it('header deve começar com "0"', () => {
    const result = generateRemessaFile(mockAccount, [mockSlip], 1, mockDate);
    const lines = result.content.split('\r\n');
    expect(lines[0][0]).toBe('0');
  });

  it('cada linha de detalhe deve começar com "1"', () => {
    const result = generateRemessaFile(mockAccount, [mockSlip, mockSlip], 1, mockDate);
    const lines = result.content.split('\r\n');
    // linhas 1 e 2 (0-indexed) são detalhes
    expect(lines[1][0]).toBe('1');
    expect(lines[2][0]).toBe('1');
  });

  it('trailer deve começar com "9"', () => {
    const result = generateRemessaFile(mockAccount, [mockSlip], 1, mockDate);
    const lines = result.content.split('\r\n');
    expect(lines[lines.length - 1][0]).toBe('9');
  });

  it('deve gerar arquivo com múltiplos boletos mantendo todas as linhas em 400 chars', () => {
    const slips = [mockSlip, mockSlip, mockSlip];
    const result = generateRemessaFile(mockAccount, slips, 2, mockDate);
    const lines = result.content.split('\r\n');

    // 1 header + 3 detalhes + 1 trailer = 5 linhas
    expect(lines.length).toBe(5);
    for (const line of lines) {
      expect(line.length).toBe(400);
    }
  });

  it('deve calcular totalRegistros corretamente', () => {
    const result = generateRemessaFile(mockAccount, [mockSlip, mockSlip], 1, mockDate);
    expect(result.totalRegistros).toBe(2);
  });

  it('deve calcular valorTotal corretamente', () => {
    const result = generateRemessaFile(mockAccount, [mockSlip, mockSlip], 1, mockDate);
    // 2 × 1500.75 = 3001.50
    expect(result.valorTotal).toBeCloseTo(3001.5, 2);
  });

  it('deve gerar nome de arquivo no formato CB{DDMM}{seq}.REM', () => {
    const result = generateRemessaFile(mockAccount, [mockSlip], 1, mockDate);
    // data = 14/03, seq = 1 → CB14031.REM
    expect(result.filename).toBe('CB14031.REM');
  });

  it('deve funcionar com lista vazia de boletos (apenas header + trailer)', () => {
    const result = generateRemessaFile(mockAccount, [], 1, mockDate);
    const lines = result.content.split('\r\n');
    expect(lines.length).toBe(2);
    expect(lines[0][0]).toBe('0');
    expect(lines[1][0]).toBe('9');
    for (const line of lines) {
      expect(line.length).toBe(400);
    }
  });

  it('deve usar separador CRLF entre linhas', () => {
    const result = generateRemessaFile(mockAccount, [mockSlip], 1, mockDate);
    expect(result.content).toContain('\r\n');
  });
});

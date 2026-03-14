import { describe, it, expect } from 'vitest';
import {
  parseRetornoFile,
  parseRetornoLine,
  parseRetornoHeader,
  parseRetornoTrailer,
  getOcorrenciaLabel,
} from '../cnab400-retorno.service';

describe('CNAB 400 Retorno Parser', () => {
  const pad = (s: string, len = 400) => s.padEnd(len, ' ');

  describe('parseRetornoHeader', () => {
    it('deve identificar banco Itaú pelo código 341', () => {
      // Position 76-79 = bank code
      const line = '0' + ' '.repeat(75) + '341' + ' '.repeat(321);
      const header = parseRetornoHeader(line);
      expect(header.codigoRegistro).toBe('0');
      expect(header.nomeBanco).toBe('Itaú');
    });

    it('deve retornar Desconhecido para outros bancos', () => {
      const line = '0' + ' '.repeat(75) + '237' + ' '.repeat(321);
      const header = parseRetornoHeader(line);
      expect(header.nomeBanco).toBe('Desconhecido');
    });
  });

  describe('parseRetornoLine', () => {
    it('deve retornar null para linhas que não são detalhe (código 0)', () => {
      const line = pad('0' + 'X'.repeat(10));
      expect(parseRetornoLine(line, 0)).toBeNull();
    });

    it('deve retornar null para linhas que não são detalhe (código 9)', () => {
      const line = pad('9' + 'X'.repeat(10));
      expect(parseRetornoLine(line, 0)).toBeNull();
    });

    it('deve extrair nosso_numero de detalhe (posições 62-70)', () => {
      const line = pad('1' + '0'.repeat(61) + '12345678' + '0'.repeat(330));
      const detail = parseRetornoLine(line, 1);
      expect(detail).not.toBeNull();
      expect(detail!.nossoNumero).toBe('12345678');
    });

    it('deve extrair código de ocorrência (posições 108-110)', () => {
      const line = pad('1' + '0'.repeat(107) + '06' + '0'.repeat(291));
      const detail = parseRetornoLine(line, 1);
      expect(detail!.codigoOcorrencia).toBe('06');
    });
  });

  describe('parseRetornoTrailer', () => {
    it('deve extrair código de registro 9', () => {
      const line = pad('9' + '0'.repeat(399));
      const trailer = parseRetornoTrailer(line);
      expect(trailer.codigoRegistro).toBe('9');
    });
  });

  describe('parseRetornoFile', () => {
    it('deve lançar erro para conteúdo vazio', () => {
      expect(() => parseRetornoFile('')).toThrow('inválido');
    });

    it('deve lançar erro para apenas 1 linha', () => {
      expect(() => parseRetornoFile(pad('0'))).toThrow('inválido');
    });

    it('deve lançar erro se header não começa com 0', () => {
      const header = pad('9' + '0'.repeat(75) + '341' + ' '.repeat(321));
      const trailer = pad('9' + '0'.repeat(399));
      expect(() => parseRetornoFile(header + '\n' + trailer)).toThrow('Header inválido');
    });

    it('deve retornar liquidacoes filtradas por código 06/09/10/17', () => {
      const header = '0' + ' '.repeat(75) + '341' + ' '.repeat(321);
      const det06 = '1' + '0'.repeat(107) + '06' + '0'.repeat(291); // liquidação normal
      const det02 = '1' + '0'.repeat(107) + '02' + '0'.repeat(291); // confirmação entrada (não é liquidação)
      const trailer = '9' + '0'.repeat(399);
      const content = [header, det06, det02, trailer].map(l => l.padEnd(400, ' ')).join('\n');
      const result = parseRetornoFile(content);
      expect(result.liquidacoes.length).toBe(1);
      expect(result.liquidacoes[0].codigoOcorrencia).toBe('06');
    });
  });

  describe('getOcorrenciaLabel', () => {
    it('deve retornar label para liquidação normal (06)', () => {
      expect(getOcorrenciaLabel('06')).toBe('Liquidação normal');
    });

    it('deve retornar label para confirmação de entrada (02)', () => {
      expect(getOcorrenciaLabel('02')).toBe('Confirmação de entrada');
    });

    it('deve retornar fallback para código desconhecido', () => {
      expect(getOcorrenciaLabel('99')).toBe('Ocorrência 99');
    });
  });
});

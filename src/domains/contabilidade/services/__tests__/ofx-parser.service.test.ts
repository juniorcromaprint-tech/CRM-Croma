import { describe, it, expect } from 'vitest';
import { parseOFX, formatOFXDate } from '../ofx-parser.service';

const OFX_SAMPLE = `OFXHEADER:100
DATA:OFXSGML
VERSION:151
SECURITY:NONE
ENCODING:UTF-8
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
      <DTSERVER>20260301120000</DTSERVER>
      <LANGUAGE>POR</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>1</TRNUID>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>341</BANKID>
          <ACCTID>12345-6</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20260301000000</DTSTART>
          <DTEND>20260331000000</DTEND>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>20260305120000</DTPOSTED>
            <TRNAMT>1500.00</TRNAMT>
            <FITID>TRN001</FITID>
            <MEMO>PIX RECEBIDO - CLIENTE ABC</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260310120000</DTPOSTED>
            <TRNAMT>-350.00</TRNAMT>
            <FITID>TRN002</FITID>
            <MEMO>PAGTO BOLETO - FORNECEDOR XYZ</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260315120000</DTPOSTED>
            <TRNAMT>-89.90</TRNAMT>
            <FITID>TRN003</FITID>
            <MEMO>ENERGIA ELETRICA 03/2026</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>5000.00</BALAMT>
          <DTASOF>20260331120000</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

describe('Parser OFX', () => {
  it('parseia um OFX com 3 transações', () => {
    const result = parseOFX(OFX_SAMPLE);
    expect(result.transactions).toHaveLength(3);
  });

  it('extrai o bankId corretamente', () => {
    const result = parseOFX(OFX_SAMPLE);
    expect(result.bankId).toBe('341');
  });

  it('extrai o acctId corretamente', () => {
    const result = parseOFX(OFX_SAMPLE);
    expect(result.acctId).toBe('12345-6');
  });

  it('extrai datas de início e fim', () => {
    const result = parseOFX(OFX_SAMPLE);
    expect(result.dtStart).toBe('2026-03-01');
    expect(result.dtEnd).toBe('2026-03-31');
  });

  it('primeira transação: crédito de R$1.500,00', () => {
    const result = parseOFX(OFX_SAMPLE);
    const trn = result.transactions[0];
    expect(trn.trntype).toBe('CREDIT');
    expect(trn.trnamt).toBe(1500.00);
    expect(trn.fitid).toBe('TRN001');
    expect(trn.memo).toBe('PIX RECEBIDO - CLIENTE ABC');
  });

  it('segunda transação: débito de -R$350,00', () => {
    const result = parseOFX(OFX_SAMPLE);
    const trn = result.transactions[1];
    expect(trn.trntype).toBe('DEBIT');
    expect(trn.trnamt).toBe(-350.00);
    expect(trn.fitid).toBe('TRN002');
  });

  it('terceira transação: débito de -R$89,90', () => {
    const result = parseOFX(OFX_SAMPLE);
    const trn = result.transactions[2];
    expect(trn.trnamt).toBe(-89.90);
    expect(trn.memo).toBe('ENERGIA ELETRICA 03/2026');
  });

  it('dtposted das transações está no formato YYYYMMDD', () => {
    const result = parseOFX(OFX_SAMPLE);
    // dtposted raw should have 8 chars from substring(0,8)
    expect(result.transactions[0].dtposted).toBe('20260305');
    expect(result.transactions[1].dtposted).toBe('20260310');
  });

  it('OFX vazio retorna array de transações vazio', () => {
    const result = parseOFX('<OFX></OFX>');
    expect(result.transactions).toHaveLength(0);
  });

  it('string sem tag <OFX> ainda tenta parsear', () => {
    const result = parseOFX('sem conteudo valido');
    expect(result.transactions).toHaveLength(0);
  });
});

describe('formatOFXDate', () => {
  it('converte YYYYMMDD para YYYY-MM-DD', () => {
    expect(formatOFXDate('20260301')).toBe('2026-03-01');
    expect(formatOFXDate('20261231')).toBe('2026-12-31');
  });

  it('aceita YYYYMMDDHHMMSS e usa só os 8 primeiros dígitos', () => {
    // A função formata usando substring(0,4) etc, assim funciona com strings de qualquer comprimento >= 8
    expect(formatOFXDate('20260305120000')).toBe('2026-03-05');
  });

  it('retorna string vazia para input inválido', () => {
    expect(formatOFXDate('')).toBe('');
    expect(formatOFXDate('123')).toBe('');
  });
});

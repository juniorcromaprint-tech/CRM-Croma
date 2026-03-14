/** Resultado padronizado retornado por todos os endpoints do nfe-service */
export interface NFeServiceResult {
  sucesso: boolean;
  retorno?: unknown;
  mensagem_erro?: string;
}

/** Payload de emissao enviado pela Edge Function */
export interface EmitirPayload {
  NFe: {
    infNFe: Record<string, unknown>;
  };
}

/** Status SEFAZ — cStat mais comuns */
export const SEFAZ_STATUS = {
  AUTORIZADO: '100',
  EM_PROCESSAMENTO: '103',
  DENEGADO: '110',
  DUPLICIDADE: '204',
  NAO_CONSTA: '217',
  NAO_ENCONTRADO: '302',
} as const;

/** Ambiente fiscal */
export type AmbienteNFe = 1 | 2; // 1=producao, 2=homologacao

/** Regime tributario */
export enum RegimeTributario {
  SIMPLES_NACIONAL = '1',
  SIMPLES_NACIONAL_EXCESSO = '2',
  REGIME_NORMAL = '3',
}

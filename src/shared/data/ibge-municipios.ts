// Mapeamento de municípios brasileiros para código IBGE
// Formato: "CIDADE-UF" (uppercase) → código IBGE de 7 dígitos
// Fonte: IBGE — https://www.ibge.gov.br/explica/codigos-dos-municipios.php

export const IBGE_MUNICIPIOS: Record<string, string> = {
  // Capitais
  'SAO PAULO-SP': '3550308',
  'RIO DE JANEIRO-RJ': '3304557',
  'SALVADOR-BA': '2927408',
  'FORTALEZA-CE': '2304400',
  'BELO HORIZONTE-MG': '3106200',
  'MANAUS-AM': '1302603',
  'CURITIBA-PR': '4106902',
  'RECIFE-PE': '2611606',
  'PORTO ALEGRE-RS': '4314902',
  'BELEM-PA': '1501402',
  'GOIANIA-GO': '5208707',
  'FLORIANOPOLIS-SC': '4205407',
  'MACEIO-AL': '2704302',
  'NATAL-RN': '2408102',
  'TERESINA-PI': '2211001',
  'CAMPO GRANDE-MS': '5002704',
  'JOAO PESSOA-PB': '2507507',
  'ARACAJU-SE': '2800308',
  'CUIABA-MT': '5103403',
  'MACAPA-AP': '1600303',
  'PORTO VELHO-RO': '1100205',
  'RIO BRANCO-AC': '1200401',
  'BOA VISTA-RR': '1400100',
  'PALMAS-TO': '1721000',
  'VITORIA-ES': '3205309',
  'SAO LUIS-MA': '2111300',
  'BRASILIA-DF': '5300108',
  // Grandes cidades e polos industriais
  'GUARULHOS-SP': '3518800',
  'CAMPINAS-SP': '3509502',
  'SAO BERNARDO DO CAMPO-SP': '3548708',
  'SANTO ANDRE-SP': '3547809',
  'OSASCO-SP': '3534401',
  'RIBEIRAO PRETO-SP': '3543402',
  'SAO JOSE DOS CAMPOS-SP': '3549904',
  'SOROCABA-SP': '3552205',
  'SANTOS-SP': '3548304',
  'CONTAGEM-MG': '3118601',
  'UBERLANDIA-MG': '3170206',
  'JUIZ DE FORA-MG': '3136702',
  'BETIM-MG': '3106705',
  'NITEROI-RJ': '3303302',
  'DUQUE DE CAXIAS-RJ': '3301702',
  'NOVA IGUACU-RJ': '3303500',
  'SAO GONCALO-RJ': '3304904',
  'LONDRINA-PR': '4113700',
  'MARINGA-PR': '4115200',
  'PONTA GROSSA-PR': '4119905',
  'CASCAVEL-PR': '4104808',
  'SAO JOSE-SC': '4216602',
  'JOINVILLE-SC': '4209102',
  'BLUMENAU-SC': '4202404',
  'CAXIAS DO SUL-RS': '4305108',
  'PELOTAS-RS': '4314407',
  'CANOAS-RS': '4304606',
  'FEIRA DE SANTANA-BA': '2910800',
  'VITORIA DA CONQUISTA-BA': '2933307',
  'CARUARU-PE': '2604106',
  'CAMPINA GRANDE-PB': '2504009',
  'MOSSORO-RN': '2408003',
  'APARECIDA DE GOIANIA-GO': '5201405',
  'ANAPOLIS-GO': '5201108',
  'RONDONOPOLIS-MT': '5107602',
  'TRES LAGOAS-MS': '5008305',
  'DOURADOS-MS': '5003702',
  'IMPERATRIZ-MA': '2105302',
  'PARAUAPEBAS-PA': '1505536',
  'SANTAREM-PA': '1506807',
  'CARAPICUIBA-SP': '3510609',
  'MOGI DAS CRUZES-SP': '3530706',
  'DIADEMA-SP': '3513801',
  'FRANCA-SP': '3516200',
  'LIMEIRA-SP': '3526902',
  'PIRACICABA-SP': '3538709',
  'JUNDIAI-SP': '3525904',
  'BAURU-SP': '3506003',
  'TAUBATE-SP': '3554102',
  'MONTES CLAROS-MG': '3143302',
  'GOVERNADOR VALADARES-MG': '3127701',
  'IPATINGA-MG': '3131307',
  'PETROPOLIS-RJ': '3303906',
  'VOLTA REDONDA-RJ': '3306305',
  'MACAE-RJ': '3302403',
  'MARABA-PA': '1504208',
  'CRICIUMA-SC': '4204608',
  'CHAPECO-SC': '4204202',
  'ITAJAI-SC': '4208203',
};

/**
 * Retorna o código IBGE do município.
 * Normaliza a entrada removendo acentos e convertendo para maiúsculas.
 * @param cidade Nome da cidade (ex: "São Paulo")
 * @param uf Sigla do estado (ex: "SP")
 * @returns Código IBGE de 7 dígitos ou '9999999' como fallback
 */
export function getCodigoIBGE(cidade: string, uf: string): string {
  const normalize = (s: string) =>
    s
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const key = `${normalize(cidade)}-${normalize(uf)}`;
  return IBGE_MUNICIPIOS[key] ?? '9999999';
}

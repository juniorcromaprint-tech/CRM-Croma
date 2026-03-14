import NFeWizard from 'nfewizard-io';
import { loadCertificate } from './_cert';
import type { AmbienteNFe } from './_types';

/**
 * Cria e inicializa uma instancia do NFeWizard com a configuracao
 * carregada das variaveis de ambiente. Reutilizar em todos os endpoints.
 */
export async function createNFeWizard(): Promise<InstanceType<typeof NFeWizard>> {
  const { certPath, certPassword } = loadCertificate();
  const ambiente = parseInt(process.env.NFE_AMBIENTE ?? '2') as AmbienteNFe;
  const uf = process.env.NFE_UF ?? 'SP';
  const cnpj = process.env.NFE_CNPJ_EMITENTE ?? '';

  const nfe = new NFeWizard();

  await nfe.NFE_LoadEnvironment({
    config: {
      dfe: {
        pathCertificado: certPath,
        senhaCertificado: certPassword,
        UF: uf,
        CPFCNPJ: cnpj,
        armazenarXMLAutorizacao: false,
        armazenarXMLConsulta: false,
        armazenarXMLRetorno: false,
      },
      nfe: {
        ambiente,
        versaoDF: '4.00',
      },
      lib: {
        connection: { timeout: 30000 }, // 30s — SEFAZ pode levar 15-45s
        useForSchemaValidation: 'validateSchemaJsBased', // Vercel nao tem Java
      },
    },
  });

  return nfe;
}

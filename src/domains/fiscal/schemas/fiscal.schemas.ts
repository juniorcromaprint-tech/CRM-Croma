import { z } from 'zod';

export const CriarDraftNFeSchema = z.object({
  pedido_id: z.string().uuid('Pedido inválido'),
  regra_operacao_id: z.string().uuid('Regra fiscal inválida'),
  observacoes: z.string().optional(),
  informacoes_contribuinte: z.string().optional(),
});

export const CancelarNFeSchema = z.object({
  documento_id: z.string().uuid('Documento inválido'),
  justificativa: z.string()
    .min(15, 'Justificativa deve ter no mínimo 15 caracteres')
    .max(255, 'Justificativa deve ter no máximo 255 caracteres'),
});

export const FiscalRegraOperacaoSchema = z.object({
  nome: z.string().min(3, 'Nome é obrigatório'),
  codigo: z.string().optional(),
  tipo_documento: z.enum(['nfe', 'nfse']),
  natureza_operacao: z.string().min(3, 'Natureza da operação é obrigatória'),
  finalidade_nfe: z.enum(['normal', 'complementar', 'ajuste', 'devolucao']).default('normal'),
  cfop: z.string().regex(/^\d{4}$/, 'CFOP deve ter 4 dígitos').optional(),
  ncm_padrao: z.string().regex(/^\d{8}$/, 'NCM deve ter 8 dígitos').optional(),
  cst_padrao: z.string().optional(),
  csosn_padrao: z.string().optional(),
  serie_id: z.string().uuid().nullable().optional(),
  ambiente_id: z.string().uuid().nullable().optional(),
  consumidor_final: z.boolean().optional(),
  contribuinte_icms: z.boolean().optional(),
  gerar_financeiro_apos_autorizacao: z.boolean().default(true),
  observacoes: z.string().optional(),
  ativo: z.boolean().default(true),
  prioridade_regra: z.number().int().min(0).default(0),
});

export const FiscalCertificadoUploadSchema = z.object({
  nome: z.string().min(3, 'Nome é obrigatório'),
  cnpj_titular: z.string().min(14, 'CNPJ inválido').max(18, 'CNPJ inválido'),
  validade_inicio: z.string().optional(),
  validade_fim: z.string().optional(),
  ambiente_id: z.string().uuid().nullable().optional(),
  observacoes: z.string().optional(),
});

export type CriarDraftNFeInput = z.infer<typeof CriarDraftNFeSchema>;
export type CancelarNFeInput = z.infer<typeof CancelarNFeSchema>;
export type FiscalRegraOperacaoInput = z.infer<typeof FiscalRegraOperacaoSchema>;
export type FiscalCertificadoUploadInput = z.infer<typeof FiscalCertificadoUploadSchema>;

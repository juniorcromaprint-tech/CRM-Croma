// src/domains/dados/engine/validators/contas-pagar.ts
// Note: 'fornecedor_cnpj' is a lookup field (resolved to fornecedor_id UUID by the import engine).
// 'valor_original' is the actual DB column (not 'valor').
// Date fields accept DD/MM/YYYY or YYYY-MM-DD formats via parseBRDate.
import { z } from 'zod';
import { parseBRDate } from './common';

const numOrNull = (v: string | undefined) =>
  v && v.trim() !== '' ? parseFloat(v.replace(',', '.')) : null;

const dateOrNull = (v: string | undefined) =>
  v && v.trim() !== '' ? parseBRDate(v) : null;

const FORMAS_PAGAMENTO = ['boleto', 'pix', 'cartao_credito', 'transferencia', 'dinheiro', 'cheque', 'debito_automatico'] as const;
const STATUS = ['pendente', 'pago', 'vencido', 'cancelado', 'parcial'] as const;

export const contasPagarImportSchema = z.object({
  valor_original: z.string()
    .min(1, 'Valor é obrigatório')
    .transform(v => parseFloat(v.replace(',', '.')))
    .pipe(z.number().positive('Valor deve ser > 0')),
  data_vencimento: z.string()
    .min(1, 'Data de vencimento é obrigatória')
    .transform(dateOrNull)
    .pipe(z.string({ invalid_type_error: 'Data de vencimento inválida. Use DD/MM/AAAA ou AAAA-MM-DD' }).min(1)),
  fornecedor_cnpj: z.string().optional().default(''),
  numero_titulo: z.string().optional().default(''),
  numero_nf: z.string().optional().default(''),
  categoria: z.string().optional().default(''),
  data_emissao: z.string().optional()
    .transform(dateOrNull)
    .pipe(z.string().nullable()),
  data_pagamento: z.string().optional()
    .transform(dateOrNull)
    .pipe(z.string().nullable()),
  valor_pago: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0, 'Valor pago deve ser >= 0').nullable()),
  forma_pagamento: z.string().optional()
    .refine(v => !v || v.trim() === '' || (FORMAS_PAGAMENTO as readonly string[]).includes(v), {
      message: `Forma de pagamento inválida. Use: ${FORMAS_PAGAMENTO.join(', ')}`,
    })
    .transform(v => v && v.trim() !== '' ? v : null),
  status: z.string().optional()
    .refine(v => !v || v.trim() === '' || (STATUS as readonly string[]).includes(v), {
      message: `Status inválido. Use: ${STATUS.join(', ')}`,
    })
    .transform(v => v && v.trim() !== '' ? v : 'pendente'),
  observacoes: z.string().optional().default(''),
});

export type ContasPagarImportRow = z.infer<typeof contasPagarImportSchema>;

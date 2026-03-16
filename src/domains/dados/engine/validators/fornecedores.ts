// src/domains/dados/engine/validators/fornecedores.ts
import { z } from 'zod';
import { validateCNPJ, validateEmail } from './common';

const numOrNull = (v: string | undefined) =>
  v && v.trim() !== '' ? parseFloat(v.replace(',', '.')) : null;

export const fornecedoresImportSchema = z.object({
  cnpj: z.string()
    .min(1, 'CNPJ é obrigatório')
    .refine(validateCNPJ, { message: 'CNPJ inválido' }),
  razao_social: z.string().min(1, 'Razão Social é obrigatória'),
  nome_fantasia: z.string().optional().default(''),
  email: z.string().optional()
    .refine(v => !v || validateEmail(v), { message: 'Email inválido' })
    .transform(v => v ?? ''),
  telefone: z.string().optional().default(''),
  contato_nome: z.string().optional().default(''),
  condicao_pagamento: z.string().optional().default(''),
  lead_time_dias: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().int('Lead time deve ser um número inteiro').min(0, 'Lead time deve ser >= 0').nullable()),
  observacoes: z.string().optional().default(''),
  ativo: z.string().optional()
    .transform(v => v === '' || v === undefined ? true : v === 'true' || v === '1' || v === 'sim'),
});

export type FornecedoresImportRow = z.infer<typeof fornecedoresImportSchema>;

// src/domains/dados/engine/validators/clientes.ts
import { z } from 'zod';
import { validateCNPJorCPF, validateEmail, validateUF } from './common';

const numOrNull = (v: string | undefined) =>
  v && v.trim() !== '' ? parseFloat(v.replace(',', '.')) : null;

export const clientesImportSchema = z.object({
  cpf_cnpj: z.string()
    .min(1, 'CPF/CNPJ é obrigatório')
    .refine(validateCNPJorCPF, { message: 'CPF/CNPJ inválido' }),
  razao_social: z.string().min(1, 'Razão Social é obrigatória'),
  nome_fantasia: z.string().optional().default(''),
  email: z.string().optional()
    .refine(v => !v || validateEmail(v), { message: 'Email inválido' })
    .transform(v => v ?? ''),
  telefone: z.string().optional().default(''),
  endereco: z.string().optional().default(''),
  numero: z.string().optional().default(''),
  complemento: z.string().optional().default(''),
  bairro: z.string().optional().default(''),
  cidade: z.string().optional().default(''),
  estado: z.string().optional()
    .refine(v => !v || v.trim() === '' || validateUF(v), { message: 'UF inválida' })
    .transform(v => v ? v.toUpperCase().trim() : ''),
  cep: z.string().optional().default(''),
  segmento: z.string().optional().default(''),
  classificacao: z.string().optional().default(''),
  tipo_cliente: z.string().optional().default(''),
  contato_financeiro: z.string().optional().default(''),
  limite_credito: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0, 'Limite de crédito deve ser >= 0').nullable()),
  observacoes: z.string().optional().default(''),
  ativo: z.string().optional()
    .transform(v => v === '' || v === undefined ? true : v === 'true' || v === '1' || v === 'sim'),
  // Flattened contacts (contact 1-3)
  contato_1_nome: z.string().optional().default(''),
  contato_1_email: z.string().optional()
    .refine(v => !v || validateEmail(v), { message: 'Email do contato 1 inválido' })
    .transform(v => v ?? ''),
  contato_1_telefone: z.string().optional().default(''),
  contato_1_cargo: z.string().optional().default(''),
  contato_2_nome: z.string().optional().default(''),
  contato_2_email: z.string().optional()
    .refine(v => !v || validateEmail(v), { message: 'Email do contato 2 inválido' })
    .transform(v => v ?? ''),
  contato_2_telefone: z.string().optional().default(''),
  contato_2_cargo: z.string().optional().default(''),
  contato_3_nome: z.string().optional().default(''),
  contato_3_email: z.string().optional()
    .refine(v => !v || validateEmail(v), { message: 'Email do contato 3 inválido' })
    .transform(v => v ?? ''),
  contato_3_telefone: z.string().optional().default(''),
  contato_3_cargo: z.string().optional().default(''),
});

export type ClientesImportRow = z.infer<typeof clientesImportSchema>;

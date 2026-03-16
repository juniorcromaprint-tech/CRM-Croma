// src/domains/dados/engine/validators/materiais.ts
import { z } from 'zod';

const numOrNull = (v: string | undefined) =>
  v && v.trim() !== '' ? parseFloat(v.replace(',', '.')) : null;

export const materiaisImportSchema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório'),
  nome: z.string().min(1, 'Nome é obrigatório'),
  categoria: z.string().optional().default(''),
  unidade: z.string().optional().default(''),
  preco_medio: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0, 'Preço deve ser >= 0').nullable()),
  estoque_minimo: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0, 'Estoque mínimo deve ser >= 0').nullable()),
  aproveitamento: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0).max(100, 'Aproveitamento deve ser entre 0 e 100').nullable()),
  localizacao: z.string().optional().default(''),
  ncm: z.string().optional().default(''),
  venda_direta: z.string().optional()
    .transform(v => v === '' || v === undefined ? false : v === 'true' || v === '1' || v === 'sim'),
  ativo: z.string().optional()
    .transform(v => v === '' || v === undefined ? true : v === 'true' || v === '1' || v === 'sim'),
});

export type MateriaisImportRow = z.infer<typeof materiaisImportSchema>;

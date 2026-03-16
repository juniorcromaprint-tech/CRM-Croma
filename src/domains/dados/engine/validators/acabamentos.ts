// src/domains/dados/engine/validators/acabamentos.ts
import { z } from 'zod';

const numOrNull = (v: string | undefined) =>
  v && v.trim() !== '' ? parseFloat(v.replace(',', '.')) : null;

const UNIDADES = ['un', 'm', 'm²', 'par', 'conjunto'] as const;

export const acabamentosImportSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional().default(''),
  custo_unitario: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0, 'Custo unitário deve ser >= 0').nullable()),
  unidade: z.string().optional()
    .refine(v => !v || v.trim() === '' || (UNIDADES as readonly string[]).includes(v), {
      message: `Unidade inválida. Use: ${UNIDADES.join(', ')}`,
    })
    .transform(v => v && v.trim() !== '' ? v : null),
  ordem: z.string().optional()
    .transform(v => v && v.trim() !== '' ? parseInt(v, 10) : null)
    .pipe(z.number().int('Ordem deve ser um número inteiro').min(0).nullable()),
  ativo: z.string().optional()
    .transform(v => v === '' || v === undefined ? true : v === 'true' || v === '1' || v === 'sim'),
});

export type AcabamentosImportRow = z.infer<typeof acabamentosImportSchema>;

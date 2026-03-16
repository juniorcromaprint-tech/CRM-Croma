// src/domains/dados/engine/validators/servicos.ts
import { z } from 'zod';

const numOrNull = (v: string | undefined) =>
  v && v.trim() !== '' ? parseFloat(v.replace(',', '.')) : null;

const CATEGORIAS = ['instalacao', 'arte', 'transporte', 'montagem', 'manutencao', 'outros'] as const;

export const servicosImportSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional().default(''),
  categoria: z.string().optional()
    .refine(v => !v || v.trim() === '' || (CATEGORIAS as readonly string[]).includes(v), {
      message: `Categoria inválida. Use: ${CATEGORIAS.join(', ')}`,
    })
    .transform(v => v && v.trim() !== '' ? v : null),
  custo_hora: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0, 'Custo/hora deve ser >= 0').nullable()),
  horas_estimadas: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0, 'Horas estimadas deve ser >= 0').nullable()),
  preco_fixo: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0, 'Preço fixo deve ser >= 0').nullable()),
  ativo: z.string().optional()
    .transform(v => v === '' || v === undefined ? true : v === 'true' || v === '1' || v === 'sim'),
});

export type ServicosImportRow = z.infer<typeof servicosImportSchema>;

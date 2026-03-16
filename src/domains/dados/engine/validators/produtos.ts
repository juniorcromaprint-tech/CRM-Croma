// src/domains/dados/engine/validators/produtos.ts
import { z } from 'zod';

const numOrNull = (v: string | undefined) =>
  v && v.trim() !== '' ? parseFloat(v.replace(',', '.')) : null;

const CATEGORIAS = ['banner', 'adesivo', 'fachada', 'placa', 'letreiro', 'painel', 'totem', 'backdrop', 'pdv', 'envelopamento', 'outros'] as const;
const UNIDADES = ['m²', 'm', 'un', 'conjunto', 'par'] as const;

export const produtosImportSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  categoria: z.enum(CATEGORIAS, { errorMap: () => ({ message: `Categoria inválida. Use: ${CATEGORIAS.join(', ')}` }) }),
  codigo: z.string().optional().default(''),
  descricao: z.string().optional().default(''),
  markup_padrao: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0, 'Markup deve ser >= 0').nullable()),
  margem_minima: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0).nullable()),
  unidade_padrao: z.string().optional()
    .refine(v => !v || v.trim() === '' || (UNIDADES as readonly string[]).includes(v), {
      message: `Unidade inválida. Use: ${UNIDADES.join(', ')}`,
    })
    .transform(v => v && v.trim() !== '' ? v : null),
  requer_instalacao: z.string().optional()
    .transform(v => v === '' || v === undefined ? false : v === 'true' || v === '1' || v === 'sim'),
  ativo: z.string().optional()
    .transform(v => v === '' || v === undefined ? true : v === 'true' || v === '1' || v === 'sim'),
});

export type ProdutosImportRow = z.infer<typeof produtosImportSchema>;

// src/domains/dados/engine/validators/modelo-materiais.ts
import { z } from 'zod';

const TIPOS = ['principal', 'auxiliar', 'acabamento'] as const;
const UNIDADES = ['m²', 'm', 'un', 'kg', 'litro', 'rolo', 'folha', 'par', 'cx'] as const;

export const modeloMateriaisImportSchema = z.object({
  produto_codigo: z.string().min(1, 'Código do produto é obrigatório'),
  modelo_nome: z.string().min(1, 'Nome do modelo é obrigatório'),
  material_codigo: z.string().min(1, 'Código do material é obrigatório'),
  quantidade_por_unidade: z.string()
    .min(1, 'Quantidade por unidade é obrigatória')
    .transform(v => parseFloat(v.replace(',', '.')))
    .pipe(z.number().positive('Quantidade deve ser > 0')),
  unidade: z.string().optional()
    .refine(v => !v || v.trim() === '' || (UNIDADES as readonly string[]).includes(v), {
      message: `Unidade inválida. Use: ${UNIDADES.join(', ')}`,
    })
    .transform(v => v && v.trim() !== '' ? v : null),
  tipo: z.string().optional()
    .refine(v => !v || v.trim() === '' || (TIPOS as readonly string[]).includes(v), {
      message: `Tipo inválido. Use: ${TIPOS.join(', ')}`,
    })
    .transform(v => v && v.trim() !== '' ? v : null),
});

export type ModeloMateriaisImportRow = z.infer<typeof modeloMateriaisImportSchema>;

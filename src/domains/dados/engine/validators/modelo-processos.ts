// src/domains/dados/engine/validators/modelo-processos.ts
import { z } from 'zod';

const TIPOS_PROCESSO = ['impressao', 'corte', 'acabamento', 'instalacao', 'montagem', 'expedicao'] as const;

const numOrNull = (v: string | undefined) =>
  v && v.trim() !== '' ? parseFloat(v.replace(',', '.')) : null;

export const modeloProcessosImportSchema = z.object({
  produto_codigo: z.string().min(1, 'Código do produto é obrigatório'),
  modelo_nome: z.string().min(1, 'Nome do modelo é obrigatório'),
  etapa: z.string().min(1, 'Etapa é obrigatória'),
  tempo_por_unidade_min: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().positive('Tempo deve ser > 0').nullable()),
  tipo_processo: z.string().optional()
    .refine(v => !v || v.trim() === '' || (TIPOS_PROCESSO as readonly string[]).includes(v), {
      message: `Tipo de processo inválido. Use: ${TIPOS_PROCESSO.join(', ')}`,
    })
    .transform(v => v && v.trim() !== '' ? v : null),
  ordem: z.string().optional()
    .transform(v => v && v.trim() !== '' ? parseInt(v, 10) : null)
    .pipe(z.number().int('Ordem deve ser um número inteiro').min(0).nullable()),
});

export type ModeloProcessosImportRow = z.infer<typeof modeloProcessosImportSchema>;

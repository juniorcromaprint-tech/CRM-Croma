// src/domains/dados/engine/validators/leads.ts
// Note: required field is 'empresa' (not 'nome') per the actual DB schema.
// 'origem_id' is a UUID FK — not importable directly; users import by text fields only.
import { z } from 'zod';
import { validateEmail } from './common';

const numOrNull = (v: string | undefined) =>
  v && v.trim() !== '' ? parseFloat(v.replace(',', '.')) : null;

const STATUS = ['novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'] as const;
const TEMPERATURAS = ['frio', 'morno', 'quente'] as const;
const SEGMENTOS = ['varejo', 'franquia', 'industria', 'servicos', 'governo', 'outros'] as const;

export const leadsImportSchema = z.object({
  empresa: z.string().min(1, 'Empresa é obrigatória'),
  contato_nome: z.string().optional().default(''),
  email: z.string().optional()
    .refine(v => !v || validateEmail(v), { message: 'Email inválido' })
    .transform(v => v ?? ''),
  contato_email: z.string().optional()
    .refine(v => !v || validateEmail(v), { message: 'Email do contato inválido' })
    .transform(v => v ?? ''),
  telefone: z.string().optional().default(''),
  contato_telefone: z.string().optional().default(''),
  cargo: z.string().optional().default(''),
  segmento: z.string().optional()
    .refine(v => !v || v.trim() === '' || (SEGMENTOS as readonly string[]).includes(v), {
      message: `Segmento inválido. Use: ${SEGMENTOS.join(', ')}`,
    })
    .transform(v => v && v.trim() !== '' ? v : null),
  status: z.string().optional()
    .refine(v => !v || v.trim() === '' || (STATUS as readonly string[]).includes(v), {
      message: `Status inválido. Use: ${STATUS.join(', ')}`,
    })
    .transform(v => v && v.trim() !== '' ? v : 'novo'),
  temperatura: z.string().optional()
    .refine(v => !v || v.trim() === '' || (TEMPERATURAS as readonly string[]).includes(v), {
      message: `Temperatura inválida. Use: ${TEMPERATURAS.join(', ')}`,
    })
    .transform(v => v && v.trim() !== '' ? v : null),
  score: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0).max(100, 'Score deve ser entre 0 e 100').nullable()),
  valor_estimado: z.string().optional()
    .transform(numOrNull)
    .pipe(z.number().min(0, 'Valor estimado deve ser >= 0').nullable()),
  observacoes: z.string().optional().default(''),
});

export type LeadsImportRow = z.infer<typeof leadsImportSchema>;

import { z } from "zod";

// ─── Cliente Schemas ────────────────────────────────────────────────────────

export const clienteClassificacaoEnum = z.enum(["A", "B", "C", "D"]);
export const clienteTipoEnum = z.enum(["agencia", "cliente_final", "revenda"]);

export const clienteSchema = z.object({
  id: z.string().uuid().optional(),
  razao_social: z.string().min(2, "Razão social é obrigatória (mín. 2 caracteres)"),
  nome_fantasia: z.string().optional().nullable(),
  cnpj: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val) return true;
        const digits = val.replace(/\D/g, "");
        if (digits.length !== 14) return false;
        if (/^(\d)\1{13}$/.test(digits)) return false;
        const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        let sum = 0;
        for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * w1[i];
        let r = sum % 11;
        if (parseInt(digits[12]) !== (r < 2 ? 0 : 11 - r)) return false;
        const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        sum = 0;
        for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * w2[i];
        r = sum % 11;
        if (parseInt(digits[13]) !== (r < 2 ? 0 : 11 - r)) return false;
        return true;
      },
      { message: "CNPJ inválido — dígito verificador incorreto" }
    ),
  inscricao_estadual: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  site: z.string().url("URL inválida").optional().nullable(),
  segmento: z.string().optional().nullable(),
  classificacao: clienteClassificacaoEnum.default("C"),
  tipo_cliente: clienteTipoEnum.optional().nullable(),
  origem: z.string().optional().nullable(),
  vendedor_id: z.string().uuid().optional().nullable(),
  sla_dias: z.number().int().nonnegative().optional().nullable(),
  limite_credito: z.number().nonnegative().optional().nullable(),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z
    .string()
    .length(2, "UF deve ter 2 caracteres")
    .optional()
    .nullable(),
  cep: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido")
    .optional()
    .nullable(),
  observacoes: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
  lead_id: z.string().uuid().optional().nullable(),
});

export const clienteCreateSchema = clienteSchema.omit({ id: true });
export const clienteUpdateSchema = clienteSchema.partial().required({ id: true });

export type Cliente = z.infer<typeof clienteSchema>;
export type ClienteCreate = z.infer<typeof clienteCreateSchema>;
export type ClienteUpdate = z.infer<typeof clienteUpdateSchema>;

// ─── Unidade do Cliente ─────────────────────────────────────────────────────

export const clienteUnidadeSchema = z.object({
  id: z.string().uuid().optional(),
  cliente_id: z.string().uuid(),
  nome: z.string().min(1, "Nome da unidade é obrigatório"),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().length(2).optional().nullable(),
  cep: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  contato_local: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  ativo: z.boolean().default(true),
});

export const clienteUnidadeCreateSchema = clienteUnidadeSchema.omit({ id: true });

export type ClienteUnidade = z.infer<typeof clienteUnidadeSchema>;
export type ClienteUnidadeCreate = z.infer<typeof clienteUnidadeCreateSchema>;

// ─── Contato do Cliente ─────────────────────────────────────────────────────

export const clienteContatoSchema = z.object({
  id: z.string().uuid().optional(),
  cliente_id: z.string().uuid(),
  nome: z.string().min(2, "Nome do contato é obrigatório"),
  cargo: z.string().optional().nullable(),
  departamento: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  e_decisor: z.boolean().default(false),
  principal: z.boolean().default(false),
  observacoes: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
});

export const clienteContatoCreateSchema = clienteContatoSchema.omit({ id: true });

export type ClienteContato = z.infer<typeof clienteContatoSchema>;
export type ClienteContatoCreate = z.infer<typeof clienteContatoCreateSchema>;

// ─── Documento do Cliente ─────────────────────────────────────────────────

export const clienteDocumentoTipoEnum = z.enum(["contrato", "certidao", "logo", "procuracao", "outro"]);

export const clienteDocumentoSchema = z.object({
  id: z.string().uuid().optional(),
  cliente_id: z.string().uuid(),
  tipo: clienteDocumentoTipoEnum,
  nome: z.string().min(1, "Nome do documento é obrigatório"),
  url: z.string().url("URL do documento é obrigatória"),
  validade: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  uploaded_by: z.string().uuid().optional().nullable(),
});

export const clienteDocumentoCreateSchema = clienteDocumentoSchema.omit({ id: true });

export type ClienteDocumento = z.infer<typeof clienteDocumentoSchema>;
export type ClienteDocumentoCreate = z.infer<typeof clienteDocumentoCreateSchema>;

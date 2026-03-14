// ─── Boleto Schemas (Zod) ───────────────────────────────────────────────────
// Croma Print ERP — Validação de formulários de boleto e conta bancária
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const boletoStatusEnum = z.enum([
  'rascunho', 'emitido', 'pronto_remessa', 'remetido',
  'registrado', 'pago', 'rejeitado', 'cancelado',
]);

export const remessaStatusEnum = z.enum([
  'gerado', 'baixado', 'enviado', 'processado', 'erro',
]);

export const bankCodeEnum = z.enum(['341', '237', '001', '033']);

// ─── Bank Account ────────────────────────────────────────────────────────────

export const bankAccountCreateSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  banco_codigo: z.string().min(1, 'Código do banco é obrigatório'),
  banco_nome: z.string().min(1, 'Nome do banco é obrigatório'),
  agencia: z.string().min(1, 'Agência é obrigatória').max(10),
  agencia_digito: z.string().max(2).optional().nullable(),
  conta: z.string().min(1, 'Conta é obrigatória').max(15),
  conta_digito: z.string().min(1, 'Dígito é obrigatório').max(2),
  carteira: z.string().default('109'),
  convenio: z.string().optional().nullable(),
  cedente_nome: z.string().min(1, 'Razão social do cedente é obrigatória'),
  cedente_cnpj: z.string().min(14, 'CNPJ deve ter 14 dígitos').max(18),
  cedente_endereco: z.string().optional().nullable(),
  cedente_cidade: z.string().optional().nullable(),
  cedente_estado: z.string().length(2, 'UF deve ter 2 caracteres').optional().nullable(),
  cedente_cep: z.string().optional().nullable(),
  instrucoes_padrao: z.string().optional().nullable(),
  juros_ao_mes: z.coerce.number().min(0).max(99).default(2),
  multa_percentual: z.coerce.number().min(0).max(99).default(2),
  dias_protesto: z.coerce.number().int().min(0).default(0),
});

export type BankAccountFormData = z.infer<typeof bankAccountCreateSchema>;

// ─── Bank Slip (Boleto) ─────────────────────────────────────────────────────

export const bankSlipCreateSchema = z.object({
  bank_account_id: z.string().uuid('Selecione uma conta bancária'),
  conta_receber_id: z.string().uuid().optional().nullable(),
  pedido_id: z.string().uuid().optional().nullable(),
  cliente_id: z.string().uuid('Selecione um cliente'),
  valor_nominal: z.coerce.number().positive('Valor deve ser maior que zero'),
  data_vencimento: z.string()
    .min(1, 'Data de vencimento é obrigatória')
    .refine(
      (val) => new Date(val) >= new Date(new Date().setHours(0, 0, 0, 0)),
      { message: 'Data de vencimento não pode ser no passado' }
    ),
  sacado_nome: z.string().min(1, 'Nome do pagador é obrigatório'),
  sacado_cpf_cnpj: z.string().min(11, 'CPF/CNPJ é obrigatório'),
  sacado_endereco: z.string().optional().nullable(),
  sacado_cidade: z.string().optional().nullable(),
  sacado_estado: z.string().optional().nullable(),
  sacado_cep: z.string().optional().nullable(),
  seu_numero: z.string().optional().nullable(),
  valor_desconto: z.coerce.number().min(0).default(0),
  data_limite_desconto: z.string().optional().nullable(),
  instrucoes: z.string().optional().nullable(),
});

export type BankSlipFormData = z.infer<typeof bankSlipCreateSchema>;

// ─── Filters ─────────────────────────────────────────────────────────────────

export const bankSlipFilterSchema = z.object({
  status: boletoStatusEnum.optional(),
  cliente_id: z.string().uuid().optional(),
  bank_account_id: z.string().uuid().optional(),
  data_vencimento_de: z.string().optional(),
  data_vencimento_ate: z.string().optional(),
});

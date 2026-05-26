// src/domains/portal/components/PortalEditarDadosDialog.tsx
// =============================================================================
// Modal de edicao de dados cadastrais pelo cliente no portal /p/:token.
//
// Permite editar:
//   - Contato: nome, telefone, email
//   - Endereco: CEP (com auto-fill via ViaCEP), endereco, numero, complemento,
//     bairro, cidade, UF (dropdown 27 estados)
//
// Dados imutaveis (apenas display): razao_social, CNPJ.
//
// Validacao client-side antes de submeter para portal_atualizar_cliente.
// O componente NAO conhece a logica de refetch — quem chama deve invalidar
// a query (FASE 3 cuida disso em PortalOrcamentoPage).
// =============================================================================
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { atualizarDadosCliente, type PortalCliente, type ClienteEditavel } from '../services/portal.service';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return '—';
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatCepInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatPhoneInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function isValidEmail(email: string): boolean {
  if (!email) return true; // campo opcional
  // regex pragmatica (RFC5322 simplificada)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone: string): boolean {
  if (!phone) return true;
  const d = phone.replace(/\D/g, '');
  return d.length === 10 || d.length === 11;
}

function isValidCep(cep: string): boolean {
  if (!cep) return true;
  return cep.replace(/\D/g, '').length === 8;
}

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

async function buscarCep(cep: string): Promise<ViaCepResponse | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  cliente: PortalCliente;
  /** Callback chamado apos sucesso (FASE 3 vai usar para refetch). */
  onSuccess?: () => void;
}

interface FormState {
  contato_nome: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

function clienteToForm(c: PortalCliente): FormState {
  return {
    contato_nome: c.contato_nome ?? '',
    telefone: c.telefone ? formatPhoneInput(c.telefone) : '',
    email: c.email ?? '',
    cep: c.cep ? formatCepInput(c.cep) : '',
    endereco: c.endereco ?? '',
    numero: c.numero ?? '',
    complemento: c.complemento ?? '',
    bairro: c.bairro ?? '',
    cidade: c.cidade ?? '',
    estado: c.estado ?? '',
  };
}

export function PortalEditarDadosDialog({ open, onOpenChange, token, cliente, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>(() => clienteToForm(cliente));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Resetar form quando o dialog abrir (pega snapshot fresco do cliente).
  useEffect(() => {
    if (open) {
      setForm(clienteToForm(cliente));
      setErrors({});
      setSubmitError(null);
    }
  }, [open, cliente]);

  // ── ViaCEP auto-fill ──
  async function handleCepBlur() {
    const clean = form.cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setCepLoading(true);
    const result = await buscarCep(form.cep);
    setCepLoading(false);
    if (!result) {
      setErrors((prev) => ({ ...prev, cep: 'CEP nao encontrado' }));
      return;
    }
    setErrors((prev) => ({ ...prev, cep: undefined }));
    setForm((prev) => ({
      ...prev,
      endereco: result.logradouro || prev.endereco,
      bairro: result.bairro || prev.bairro,
      cidade: result.localidade || prev.cidade,
      estado: result.uf || prev.estado,
    }));
  }

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (form.email && !isValidEmail(form.email)) e.email = 'Email invalido';
    if (form.telefone && !isValidPhone(form.telefone)) e.telefone = 'Telefone deve ter 10 ou 11 digitos';
    if (form.cep && !isValidCep(form.cep)) e.cep = 'CEP deve ter 8 digitos';
    if (form.estado && form.estado.length !== 2) e.estado = 'UF invalida';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);

    // Strip mascaras antes de enviar (numero puro no banco)
    const payload: ClienteEditavel = {
      contato_nome: form.contato_nome.trim() || null,
      telefone: form.telefone ? form.telefone.replace(/\D/g, '') : null,
      email: form.email.trim() || null,
      cep: form.cep ? form.cep.replace(/\D/g, '') : null,
      endereco: form.endereco.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim().toUpperCase() || null,
    };

    try {
      await atualizarDadosCliente(token, payload);
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Falha ao salvar dados');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alterar dados cadastrais</DialogTitle>
          <DialogDescription>
            Atualize os dados de contato e endereco. CNPJ e razao social nao sao editaveis.
          </DialogDescription>
        </DialogHeader>

        {/* Dados imutaveis (so leitura) */}
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa</p>
          <p className="text-sm font-medium text-slate-900 break-words">
            {cliente.razao_social || cliente.nome_fantasia || '—'}
          </p>
          <p className="text-xs text-slate-600">CNPJ: {formatCnpj(cliente.cnpj)}</p>
        </section>

        {/* Contato */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Contato</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="contato_nome">Nome do contato</Label>
              <Input
                id="contato_nome"
                value={form.contato_nome}
                onChange={(e) => setField('contato_nome', e.target.value)}
                placeholder="Joao da Silva"
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone / Celular</Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={(e) => setField('telefone', formatPhoneInput(e.target.value))}
                placeholder="(11) 99999-9999"
                disabled={submitting}
                inputMode="tel"
                aria-invalid={!!errors.telefone}
              />
              {errors.telefone && <p className="text-xs text-red-600 mt-1">{errors.telefone}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="contato@empresa.com.br"
                disabled={submitting}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>
          </div>
        </section>

        {/* Endereco */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Endereco</h3>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="cep">CEP</Label>
              <div className="relative">
                <Input
                  id="cep"
                  value={form.cep}
                  onChange={(e) => setField('cep', formatCepInput(e.target.value))}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  disabled={submitting}
                  inputMode="numeric"
                  aria-invalid={!!errors.cep}
                />
                {cepLoading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>
              {errors.cep && <p className="text-xs text-red-600 mt-1">{errors.cep}</p>}
            </div>
            <div className="sm:col-span-4">
              <Label htmlFor="endereco">Endereco (rua/avenida)</Label>
              <Input
                id="endereco"
                value={form.endereco}
                onChange={(e) => setField('endereco', e.target.value)}
                placeholder="Av. Brasil"
                disabled={submitting}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="numero">Numero</Label>
              <Input
                id="numero"
                value={form.numero}
                onChange={(e) => setField('numero', e.target.value)}
                placeholder="123"
                disabled={submitting}
              />
            </div>
            <div className="sm:col-span-4">
              <Label htmlFor="complemento">Complemento</Label>
              <Input
                id="complemento"
                value={form.complemento}
                onChange={(e) => setField('complemento', e.target.value)}
                placeholder="Sala 4, Bloco B (opcional)"
                disabled={submitting}
              />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                value={form.bairro}
                onChange={(e) => setField('bairro', e.target.value)}
                placeholder="Centro"
                disabled={submitting}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={form.cidade}
                onChange={(e) => setField('cidade', e.target.value)}
                placeholder="Sao Paulo"
                disabled={submitting}
              />
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor="estado">UF</Label>
              <select
                id="estado"
                value={form.estado}
                onChange={(e) => setField('estado', e.target.value)}
                disabled={submitting}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-invalid={!!errors.estado}
              >
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
              {errors.estado && <p className="text-xs text-red-600 mt-1">{errors.estado}</p>}
            </div>
          </div>
        </section>

        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Salvando...' : 'Salvar alteracoes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

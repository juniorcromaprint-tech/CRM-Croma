import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCliente, useUpdateCliente, type ClienteInput } from "@/domains/clientes/hooks/useClientes";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clienteToEdit?: any;
  onSaved?: (data: any) => void;
}

interface FormState {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  telefone: string;
  email: string;
  website: string;
  segmento: string;
  classificacao: string;
  origem: string;
  observacoes: string;
  endereco_rua: string;
  endereco_cidade: string;
  endereco_estado: string;
  endereco_cep: string;
}

const EMPTY_FORM: FormState = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  telefone: "",
  email: "",
  website: "",
  segmento: "",
  classificacao: "",
  origem: "prospeccao",
  observacoes: "",
  endereco_rua: "",
  endereco_cidade: "",
  endereco_estado: "",
  endereco_cep: "",
};

function toFormState(cliente: any): FormState {
  return {
    razao_social: cliente.razao_social ?? "",
    nome_fantasia: cliente.nome_fantasia ?? "",
    cnpj: cliente.cnpj ?? "",
    telefone: cliente.telefone ?? "",
    email: cliente.email ?? "",
    // DB column is `website`; legacy data may also have `site`
    website: cliente.website ?? cliente.site ?? "",
    segmento: cliente.segmento ?? "",
    classificacao: cliente.classificacao ?? "",
    origem: cliente.origem ?? "prospeccao",
    observacoes: cliente.observacoes ?? "",
    // DB columns use `endereco_*` prefix
    endereco_rua: cliente.endereco_rua ?? cliente.endereco ?? "",
    endereco_cidade: cliente.endereco_cidade ?? cliente.cidade ?? "",
    endereco_estado: cliente.endereco_estado ?? cliente.estado ?? "",
    endereco_cep: cliente.endereco_cep ?? cliente.cep ?? "",
  };
}

export default function ClienteFormSheet({ isOpen, onClose, clienteToEdit, onSaved }: Props) {
  const isEditing = !!clienteToEdit;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente();

  const isPending = createCliente.isPending || updateCliente.isPending;

  // Populate form when editing
  useEffect(() => {
    if (isOpen) {
      setForm(clienteToEdit ? toFormState(clienteToEdit) : EMPTY_FORM);
    }
  }, [clienteToEdit, isOpen]);

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.razao_social.trim()) return;

    // Build only the fields that exist in the DB schema
    // DB columns: site (not website), endereco/cidade/estado/cep (not endereco_*)
    const input: ClienteInput = {
      razao_social: form.razao_social.trim(),
      nome_fantasia: form.nome_fantasia.trim() || null,
      cnpj: form.cnpj.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      site: form.website.trim() || null,
      segmento: form.segmento || null,
      classificacao: form.classificacao || null,
      origem: form.origem || null,
      observacoes: form.observacoes.trim() || null,
      endereco: form.endereco_rua.trim() || null,
      cidade: form.endereco_cidade.trim() || null,
      estado: form.endereco_estado.trim().toUpperCase().slice(0, 2) || null,
      cep: form.endereco_cep.trim() || null,
    };

    if (isEditing && clienteToEdit?.id) {
      updateCliente.mutate(
        { id: clienteToEdit.id, ...input },
        {
          onSuccess: (data) => {
            onSaved?.(data);
            onClose();
          },
        },
      );
    } else {
      createCliente.mutate(input, {
        onSuccess: (data) => {
          onSaved?.(data);
          onClose();
        },
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{isEditing ? "Editar Cliente" : "Novo Cliente"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Razão Social *</Label>
            <Input
              value={form.razao_social}
              onChange={(e) => set("razao_social", e.target.value)}
              placeholder="Nome da empresa"
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Nome Fantasia</Label>
            <Input
              value={form.nome_fantasia}
              onChange={(e) => set("nome_fantasia", e.target.value)}
              placeholder="Nome comercial"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label>CNPJ</Label>
            <Input
              value={form.cnpj}
              onChange={(e) => set("cnpj", e.target.value)}
              placeholder="00.000.000/0001-00"
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                placeholder="(00) 00000-0000"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="contato@empresa.com"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Site</Label>
            <Input
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="www.empresa.com.br"
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Segmento</Label>
              <Select value={form.segmento} onValueChange={(v) => set("segmento", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="varejo">Varejo</SelectItem>
                  <SelectItem value="industria">Indústria</SelectItem>
                  <SelectItem value="franquia">Franquia</SelectItem>
                  <SelectItem value="agencia">Agência</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Classificação</Label>
              <Select value={form.classificacao} onValueChange={(v) => set("classificacao", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A — Premium</SelectItem>
                  <SelectItem value="B">B — Regular</SelectItem>
                  <SelectItem value="C">C — Básico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Como nos encontrou</Label>
            <Select value={form.origem} onValueChange={(v) => set("origem", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prospeccao">Prospecção</SelectItem>
                <SelectItem value="indicacao">Indicação</SelectItem>
                <SelectItem value="internet">Internet</SelectItem>
                <SelectItem value="carteira">Carteira</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Endereço</Label>
            <Input
              value={form.endereco_rua}
              onChange={(e) => set("endereco_rua", e.target.value)}
              placeholder="Rua, número, bairro"
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Cidade</Label>
              <Input
                value={form.endereco_cidade}
                onChange={(e) => set("endereco_cidade", e.target.value)}
                placeholder="São Paulo"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>UF</Label>
              <Input
                value={form.endereco_estado}
                onChange={(e) => set("endereco_estado", e.target.value.toUpperCase().slice(0, 2))}
                placeholder="SP"
                maxLength={2}
                className="rounded-xl uppercase"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>CEP</Label>
            <Input
              value={form.endereco_cep}
              onChange={(e) => set("endereco_cep", e.target.value)}
              placeholder="00000-000"
              className="rounded-xl w-40"
            />
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              placeholder="Informações adicionais sobre o cliente..."
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-xl"
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700"
              disabled={!form.razao_social.trim() || isPending}
            >
              {isPending
                ? isEditing
                  ? "Salvando..."
                  : "Cadastrando..."
                : isEditing
                  ? "Salvar Alterações"
                  : "Cadastrar Cliente"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

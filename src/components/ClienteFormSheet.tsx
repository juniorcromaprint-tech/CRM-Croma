import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { showSuccess } from "@/utils/toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clienteToEdit?: any;
  onSaved?: (data: any) => void;
}

export default function ClienteFormSheet({ isOpen, onClose, clienteToEdit, onSaved }: Props) {
  const isEditing = !!clienteToEdit;

  const [form, setForm] = useState({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    telefone: "",
    email: "",
    site: "",
    tipo_cliente: "cliente_final",
    origem: "prospeccao",
    tipo_atendimento: "ativo",
    vendedor: "edmar",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    observacoes: "",
  });

  // Populate form when editing
  useEffect(() => {
    if (clienteToEdit) {
      setForm({
        razao_social: clienteToEdit.razao_social || "",
        nome_fantasia: clienteToEdit.nome_fantasia || "",
        cnpj: clienteToEdit.cnpj || "",
        telefone: clienteToEdit.telefone || "",
        email: clienteToEdit.email || "",
        site: clienteToEdit.site || "",
        tipo_cliente: clienteToEdit.tipo_cliente || "cliente_final",
        origem: clienteToEdit.origem || "prospeccao",
        tipo_atendimento: clienteToEdit.tipo_atendimento || "ativo",
        vendedor: clienteToEdit.vendedor || "edmar",
        endereco: clienteToEdit.endereco || "",
        cidade: clienteToEdit.cidade || "",
        estado: clienteToEdit.estado || "",
        cep: clienteToEdit.cep || "",
        observacoes: clienteToEdit.observacoes || "",
      });
    } else {
      setForm({
        razao_social: "", nome_fantasia: "", cnpj: "", telefone: "", email: "", site: "",
        tipo_cliente: "cliente_final", origem: "prospeccao", tipo_atendimento: "ativo",
        vendedor: "edmar", endereco: "", cidade: "", estado: "", cep: "", observacoes: "",
      });
    }
  }, [clienteToEdit, isOpen]);

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.razao_social.trim()) return;
    showSuccess(isEditing ? "Cliente atualizado!" : "Cliente cadastrado com sucesso!");
    onSaved?.({ ...form, id: clienteToEdit?.id || `new-${Date.now()}` });
    onClose();
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
              onChange={e => set("razao_social", e.target.value)}
              placeholder="Nome da empresa"
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Nome Fantasia</Label>
            <Input
              value={form.nome_fantasia}
              onChange={e => set("nome_fantasia", e.target.value)}
              placeholder="Nome comercial"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label>CNPJ</Label>
            <Input
              value={form.cnpj}
              onChange={e => set("cnpj", e.target.value)}
              placeholder="00.000.000/0001-00"
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={e => set("telefone", e.target.value)}
                placeholder="(00) 00000-0000"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="contato@empresa.com"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Site</Label>
            <Input
              value={form.site}
              onChange={e => set("site", e.target.value)}
              placeholder="www.empresa.com.br"
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo de Cliente</Label>
              <Select value={form.tipo_cliente} onValueChange={v => set("tipo_cliente", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente_final">Cliente Final</SelectItem>
                  <SelectItem value="agencia">Agência</SelectItem>
                  <SelectItem value="revenda">Revenda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Como nos encontrou</Label>
              <Select value={form.origem} onValueChange={v => set("origem", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospeccao">Prospecção</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="internet">Internet</SelectItem>
                  <SelectItem value="carteira">Carteira</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo de Atendimento</Label>
              <Select value={form.tipo_atendimento} onValueChange={v => set("tipo_atendimento", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="receptivo">Receptivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Vendedor</Label>
              <Select value={form.vendedor} onValueChange={v => set("vendedor", v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="edmar">Edmar Júnior</SelectItem>
                  <SelectItem value="regiane">Regiane Penninck</SelectItem>
                  <SelectItem value="viviane">Viviane Penninck</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Endereço</Label>
            <Input
              value={form.endereco}
              onChange={e => set("endereco", e.target.value)}
              placeholder="Rua, número, bairro"
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Cidade</Label>
              <Input
                value={form.cidade}
                onChange={e => set("cidade", e.target.value)}
                placeholder="São Paulo"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>UF</Label>
              <Input
                value={form.estado}
                onChange={e => set("estado", e.target.value.toUpperCase().slice(0, 2))}
                placeholder="SP"
                maxLength={2}
                className="rounded-xl uppercase"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>CEP</Label>
            <Input
              value={form.cep}
              onChange={e => set("cep", e.target.value)}
              placeholder="00000-000"
              className="rounded-xl w-40"
            />
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={e => set("observacoes", e.target.value)}
              placeholder="Informações adicionais sobre o cliente..."
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700"
              disabled={!form.razao_social.trim()}
            >
              {isEditing ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

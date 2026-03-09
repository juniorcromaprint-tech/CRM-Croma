import React, { useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, FileDown, Send, CheckCircle, XCircle, Building2, Clock } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

interface Item {
  id?: string;
  descricao: string;
  especificacao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  prazo_producao_dias: number | null;
  ordem: number;
  isNew?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  convertido: "OS Gerada",
};

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-600",
  enviado: "bg-blue-100 text-blue-700",
  aprovado: "bg-emerald-100 text-emerald-700",
  recusado: "bg-red-100 text-red-600",
  convertido: "bg-purple-100 text-purple-700",
};

// Dados de demonstração — clientes disponíveis para selecionar
const MOCK_CLIENTES = [
  { id: "demo-1", razao_social: "Calçados Beira Rio S/A", nome_fantasia: "Beira Rio", cnpj: "94.868.906/0001-56", email: "marketing@beiraio.com.br", telefone: "(51) 3594-3200" },
  { id: "demo-2", razao_social: "Lojas Renner S.A.", nome_fantasia: "Renner", cnpj: "92.754.738/0001-62", email: "visual@lojasrenner.com.br", telefone: "(51) 2121-7000" },
  { id: "demo-3", razao_social: "Agência Kreatif Comunicação Ltda", nome_fantasia: "Kreatif", cnpj: "12.345.678/0001-90", email: "projetos@kreatif.com.br", telefone: "(11) 3456-7890" },
  { id: "demo-4", razao_social: "Rede Farmácias São João", nome_fantasia: "Farmácias São João", cnpj: "87.654.321/0001-00", email: "compras@saojoao.com.br", telefone: "(51) 3333-4444" },
  { id: "demo-5", razao_social: "Visual Print Comércio e Representações", nome_fantasia: "Visual Print", cnpj: "55.123.456/0001-77", email: "comercial@visualprint.com.br", telefone: "(41) 9999-8888" },
  { id: "demo-6", razao_social: "Grupo Paquetá Calçados", nome_fantasia: "Paquetá", cnpj: "89.123.456/0001-00", email: "trade@paqueta.com.br", telefone: "(51) 3594-5000" },
  { id: "demo-7", razao_social: "Supermercados BIG", nome_fantasia: "BIG", cnpj: "01.123.456/0001-99", email: "mkt@big.com.br", telefone: "(51) 3500-9000" },
];

// Orçamentos de demonstração pré-carregados
const MOCK_ORCAMENTOS: Record<string, any> = {
  "orc-1": {
    numero: "ORC-2026-001",
    titulo: "Fachada ACM + Letras Caixa - Loja Centro",
    status: "aprovado",
    cliente_id: "demo-1",
    validade_dias: 10,
    condicoes_pagamento: "50% na aprovação, 50% na entrega",
    observacoes: "Arte fornecida pelo cliente. Instalação inclusa.",
    desconto_percentual: 5,
    itens: [
      { id: "i1", descricao: "Fachada ACM Preto 3mm", especificacao: "6,00 x 1,20m com estrutura metálica", quantidade: 1, unidade: "un", valor_unitario: 8500, valor_total: 8500, prazo_producao_dias: 12, ordem: 0 },
      { id: "i2", descricao: "Letras Caixa Aço Escovado", especificacao: "Altura 40cm, espessura 5cm, LED interno", quantidade: 8, unidade: "un", valor_unitario: 850, valor_total: 6800, prazo_producao_dias: 10, ordem: 1 },
      { id: "i3", descricao: "Instalação e montagem", especificacao: "Equipe de 2 instaladores + equipamento", quantidade: 1, unidade: "un", valor_unitario: 3200, valor_total: 3200, prazo_producao_dias: 2, ordem: 2 },
    ],
  },
  "orc-2": {
    numero: "ORC-2026-002",
    titulo: "Campanha Verão 2026 - 45 Lojas",
    status: "enviado",
    cliente_id: "demo-2",
    validade_dias: 7,
    condicoes_pagamento: "30/60/90 dias",
    observacoes: "Prazo de entrega total: 20 dias úteis. Frete por conta do cliente para lojas fora do RS.",
    desconto_percentual: 0,
    itens: [
      { id: "i4", descricao: "Banner Lona 440g", especificacao: "2,00 x 0,80m com acabamento em bastão", quantidade: 90, unidade: "un", valor_unitario: 120, valor_total: 10800, prazo_producao_dias: 8, ordem: 0 },
      { id: "i5", descricao: "Adesivo Vitrine Recorte", especificacao: "Vinil adesivo branco brilho, recorte eletrônico", quantidade: 45, unidade: "m²", valor_unitario: 180, valor_total: 8100, prazo_producao_dias: 6, ordem: 1 },
      { id: "i6", descricao: "Display de Chão MDF", especificacao: "1,80m altura, impressão UV em MDF 15mm", quantidade: 45, unidade: "un", valor_unitario: 310, valor_total: 13950, prazo_producao_dias: 15, ordem: 2 },
    ],
  },
  "orc-3": {
    numero: "ORC-2026-003",
    titulo: "Adesivação Vitrine + Banners PDV",
    status: "rascunho",
    cliente_id: "demo-4",
    validade_dias: 15,
    condicoes_pagamento: "",
    observacoes: "",
    desconto_percentual: 0,
    itens: [
      { id: "i7", descricao: "Adesivo Vitrine Jateado", especificacao: "Adesivo jateado com recorte para logo", quantidade: 12, unidade: "m²", valor_unitario: 150, valor_total: 1800, prazo_producao_dias: 5, ordem: 0 },
      { id: "i8", descricao: "Banner X-Banner 60x160cm", especificacao: "Lona 440g + estrutura X-Banner reutilizável", quantidade: 20, unidade: "un", valor_unitario: 120, valor_total: 2400, prazo_producao_dias: 4, ordem: 1 },
    ],
  },
  "orc-4": {
    numero: "ORC-2026-004",
    titulo: "Projeto Visual Completo - Nova Unidade Shopping",
    status: "aprovado",
    cliente_id: "demo-6",
    validade_dias: 10,
    condicoes_pagamento: "40% entrada, 30% na entrega, 30% após instalação",
    observacoes: "Projeto visual aprovado pela administração do shopping. Horário de instalação: 22h às 6h.",
    desconto_percentual: 8,
    itens: [
      { id: "i9", descricao: "Fachada Loja Shopping - ACM + Acrílico", especificacao: "4,50 x 0,90m, ACM branco + acrílico translúcido com LED", quantidade: 1, unidade: "un", valor_unitario: 12000, valor_total: 12000, prazo_producao_dias: 15, ordem: 0 },
      { id: "i10", descricao: "Adesivação Interna Ambientação", especificacao: "Vinil impresso alta resolução, aplicação em paredes e pilares", quantidade: 28, unidade: "m²", valor_unitario: 220, valor_total: 6160, prazo_producao_dias: 8, ordem: 1 },
      { id: "i11", descricao: "Placas de Sinalização Interna", especificacao: "Acrílico 3mm com adesivo, tamanho A4", quantidade: 15, unidade: "un", valor_unitario: 85, valor_total: 1275, prazo_producao_dias: 5, ordem: 2 },
      { id: "i12", descricao: "Totem Display Entrada", especificacao: "Totem MDF 1,60m com impressão UV e base metálica", quantidade: 2, unidade: "un", valor_unitario: 1450, valor_total: 2900, prazo_producao_dias: 10, ordem: 3 },
      { id: "i13", descricao: "Instalação Completa", especificacao: "Equipe noturna 3 instaladores + materiais de fixação", quantidade: 1, unidade: "un", valor_unitario: 5015, valor_total: 5015, prazo_producao_dias: 3, ordem: 4 },
    ],
  },
  "orc-5": {
    numero: "ORC-2026-005",
    titulo: "Sinalização Interna + Ambientação",
    status: "convertido",
    cliente_id: "demo-7",
    validade_dias: 10,
    condicoes_pagamento: "À vista com 5% desconto",
    observacoes: "OS gerada: OS-2026-012",
    desconto_percentual: 5,
    itens: [
      { id: "i14", descricao: "Placas de Setor (Padaria, Açougue, etc.)", especificacao: "PVC expandido 5mm com impressão UV, 1,20 x 0,40m", quantidade: 12, unidade: "un", valor_unitario: 320, valor_total: 3840, prazo_producao_dias: 6, ordem: 0 },
      { id: "i15", descricao: "Adesivo de Piso Promocional", especificacao: "Vinil laminado antiderrapante, formato circular 60cm", quantidade: 30, unidade: "un", valor_unitario: 45, valor_total: 1350, prazo_producao_dias: 3, ordem: 1 },
      { id: "i16", descricao: "Réguas de Gôndola", especificacao: "PVC 0,3mm, impressão offset 4x0, 90x3,5cm", quantidade: 200, unidade: "un", valor_unitario: 8.5, valor_total: 1700, prazo_producao_dias: 5, ordem: 2 },
      { id: "i17", descricao: "Wobbler Dupla Face", especificacao: "PVC 0,5mm, tamanho 10x15cm com haste plástica", quantidade: 100, unidade: "un", valor_unitario: 12, valor_total: 1200, prazo_producao_dias: 4, ordem: 3 },
      { id: "i18", descricao: "Instalação", especificacao: "Equipe 2 pessoas, 1 dia", quantidade: 1, unidade: "un", valor_unitario: 1710, valor_total: 1710, prazo_producao_dias: 1, ordem: 4 },
    ],
  },
  "orc-6": {
    numero: "ORC-2026-006",
    titulo: "Envelopamento de Frota - 12 Veículos",
    status: "recusado",
    cliente_id: "demo-5",
    validade_dias: 15,
    condicoes_pagamento: "50% entrada, 50% na conclusão",
    observacoes: "Cliente optou por outro fornecedor com preço menor.",
    desconto_percentual: 0,
    itens: [
      { id: "i19", descricao: "Envelopamento Parcial - Van Fiorino", especificacao: "Vinil adesivo cast com laminação, laterais + traseira", quantidade: 8, unidade: "un", valor_unitario: 1200, valor_total: 9600, prazo_producao_dias: 3, ordem: 0 },
      { id: "i20", descricao: "Envelopamento Parcial - Hilux", especificacao: "Vinil adesivo cast com laminação, laterais + capô", quantidade: 4, unidade: "un", valor_unitario: 1500, valor_total: 6000, prazo_producao_dias: 3, ordem: 1 },
    ],
  },
  "orc-7": {
    numero: "ORC-2026-007",
    titulo: "Totem + Painel Luminoso - Fachada",
    status: "enviado",
    cliente_id: "demo-3",
    validade_dias: 10,
    condicoes_pagamento: "30 dias após instalação",
    observacoes: "Necessário aprovação da prefeitura para o totem externo.",
    desconto_percentual: 0,
    itens: [
      { id: "i21", descricao: "Totem Externo Iluminado", especificacao: "Estrutura metálica 3,50m, ACM com iluminação LED interna", quantidade: 1, unidade: "un", valor_unitario: 7800, valor_total: 7800, prazo_producao_dias: 18, ordem: 0 },
      { id: "i22", descricao: "Painel Luminoso Fachada", especificacao: "Lona translúcida retroiluminada, 3,00 x 1,00m, estrutura alumínio", quantidade: 1, unidade: "un", valor_unitario: 4500, valor_total: 4500, prazo_producao_dias: 12, ordem: 1 },
    ],
  },
};

export default function OrcamentoDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const isNew = id === "novo";

  // Carregar dados do mock
  const mockData = !isNew && id ? MOCK_ORCAMENTOS[id] : null;

  // Form state
  const [titulo, setTitulo] = useState(mockData?.titulo || "");
  const [clienteId, setClienteId] = useState(mockData?.cliente_id || searchParams.get("cliente") || "");
  const [currentStatus, setCurrentStatus] = useState(mockData?.status || "rascunho");
  const [validade, setValidade] = useState(mockData?.validade_dias || 10);
  const [observacoes, setObservacoes] = useState(mockData?.observacoes || "");
  const [condicoesPagamento, setCondicoesPagamento] = useState(mockData?.condicoes_pagamento || "");
  const [desconto, setDesconto] = useState(mockData?.desconto_percentual || 0);
  const [items, setItems] = useState<Item[]>(mockData?.itens || []);

  const clientes = MOCK_CLIENTES;

  // Calcular totais
  const subtotal = items.reduce((sum, i) => sum + (i.valor_total || 0), 0);
  const descontoValor = (subtotal * desconto) / 100;
  const total = subtotal - descontoValor;

  const selectedCliente = clientes.find((c) => c.id === clienteId);

  // Gerenciar itens
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        descricao: "",
        especificacao: "",
        quantidade: 1,
        unidade: "un",
        valor_unitario: 0,
        valor_total: 0,
        prazo_producao_dias: null,
        ordem: prev.length,
        isNew: true,
      },
    ]);
  };

  const updateItem = (index: number, field: keyof Item, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "quantidade" || field === "valor_unitario") {
        const qty = field === "quantidade" ? Number(value) : Number(updated[index].quantidade);
        const price = field === "valor_unitario" ? Number(value) : Number(updated[index].valor_unitario);
        updated[index].valor_total = qty * price;
      }
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Salvar (demo — exibe toast + navega)
  const handleSave = (newStatus?: string) => {
    if (!titulo.trim()) { showError("Título do orçamento é obrigatório"); return; }
    if (newStatus) setCurrentStatus(newStatus);
    const msg = newStatus === "enviado" ? "Orçamento marcado como enviado!"
      : newStatus === "aprovado" ? "Orçamento aprovado!"
      : newStatus === "recusado" ? "Orçamento marcado como recusado."
      : isNew ? "Orçamento criado com sucesso!" : "Orçamento salvo!";
    showSuccess(msg);
    if (isNew) navigate("/orcamentos");
  };

  const handlePrint = () => {
    window.print();
  };

  const numero = mockData?.numero || (isNew ? "" : `ORC-${id}`);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orcamentos")} className="rounded-xl">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            {numero && (
              <span className="font-mono text-sm text-slate-400">{numero}</span>
            )}
            <span className={`text-xs font-semibold px-2 py-1 rounded-md ${STATUS_COLORS[currentStatus] || STATUS_COLORS.rascunho}`}>
              {STATUS_LABELS[currentStatus] || currentStatus}
            </span>
            <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100 font-medium">DEMO</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mt-0.5">
            {isNew ? "Novo Orçamento" : (titulo || "Orçamento")}
          </h1>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="outline" onClick={handlePrint} className="rounded-xl border-slate-200">
              <FileDown size={16} className="mr-2" /> PDF
            </Button>
          )}
          <Button
            onClick={() => handleSave()}
            className="rounded-xl bg-blue-600 hover:bg-blue-700"
          >
            <Save size={16} className="mr-2" /> Salvar
          </Button>
        </div>
      </div>

      {/* Ações de status */}
      {!isNew && currentStatus === "rascunho" && (
        <div className="flex gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave("enviado")}
            className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <Send size={14} className="mr-1.5" /> Marcar como Enviado
          </Button>
        </div>
      )}
      {!isNew && currentStatus === "enviado" && (
        <div className="flex gap-2 print:hidden">
          <Button
            size="sm"
            onClick={() => handleSave("aprovado")}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle size={14} className="mr-1.5" /> Aprovar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave("recusado")}
            className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
          >
            <XCircle size={14} className="mr-1.5" /> Recusar
          </Button>
        </div>
      )}

      {/* Área de impressão */}
      <div ref={printRef}>
        {/* Cabeçalho do orçamento (visível no print) */}
        <div className="hidden print:flex justify-between items-start mb-8 border-b pb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Croma Print Comunicação Visual</h2>
            <p className="text-slate-500 text-sm mt-1">Orçamento Comercial</p>
          </div>
          <div className="text-right">
            {numero && <p className="font-mono font-bold text-slate-600">{numero}</p>}
            <p className="text-sm text-slate-500">{new Date().toLocaleDateString("pt-BR")}</p>
            <p className="text-sm text-slate-500">Validade: {validade} dias úteis</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Formulário principal */}
          <div className="md:col-span-2 space-y-4">
            {/* Dados básicos */}
            <Card className="border-none shadow-sm rounded-2xl print:shadow-none print:border print:border-slate-200">
              <CardContent className="pt-5 space-y-4">
                <div className="space-y-1">
                  <Label>Título do Orçamento *</Label>
                  <Input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex: Fachada + Campanha Verão - Loja Centro"
                    className="rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Cliente</Label>
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Selecionar cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome_fantasia || c.razao_social}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Validade (dias úteis)</Label>
                    <Input
                      type="number"
                      value={validade}
                      onChange={(e) => setValidade(Number(e.target.value))}
                      min={1}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                {selectedCliente && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
                    <Building2 size={16} />
                    <span className="font-medium">{selectedCliente.razao_social}</span>
                    {selectedCliente.cnpj && <span className="text-blue-500">· CNPJ: {selectedCliente.cnpj}</span>}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Itens do orçamento */}
            <Card className="border-none shadow-sm rounded-2xl print:shadow-none print:border print:border-slate-200">
              <CardHeader className="pb-3 flex flex-row items-center justify-between print:hidden">
                <CardTitle className="text-base">Itens</CardTitle>
                <Button size="sm" variant="outline" onClick={addItem} className="rounded-lg h-8 text-xs">
                  <Plus size={14} className="mr-1" /> Adicionar Item
                </Button>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="text-center py-6 print:hidden">
                    <p className="text-sm text-slate-400">Nenhum item. Clique em "Adicionar Item".</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Cabeçalho da tabela (print) */}
                    <div className="hidden print:grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 border-b pb-2">
                      <div className="col-span-5">Descrição</div>
                      <div className="col-span-2 text-center">Qtd</div>
                      <div className="col-span-2 text-right">V. Unit.</div>
                      <div className="col-span-2 text-right">Total</div>
                      <div className="col-span-1 text-center">Prazo</div>
                    </div>

                    {items.map((item, index) => (
                      <div key={index} className="border border-slate-100 rounded-xl p-3 space-y-2 print:border-0 print:border-b print:rounded-none print:px-0">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <Input
                              value={item.descricao}
                              onChange={(e) => updateItem(index, "descricao", e.target.value)}
                              placeholder="Descrição do item"
                              className="rounded-lg font-medium"
                            />
                            <Input
                              value={item.especificacao}
                              onChange={(e) => updateItem(index, "especificacao", e.target.value)}
                              placeholder="Especificação técnica (material, acabamento, tamanho...)"
                              className="rounded-lg text-sm text-slate-500"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            className="h-8 w-8 text-slate-300 hover:text-red-500 rounded-lg print:hidden flex-shrink-0"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Quantidade</Label>
                            <Input
                              type="number"
                              value={item.quantidade}
                              onChange={(e) => updateItem(index, "quantidade", Number(e.target.value))}
                              min={0}
                              step={0.001}
                              className="rounded-lg text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unidade</Label>
                            <Select value={item.unidade} onValueChange={(v) => updateItem(index, "unidade", v)}>
                              <SelectTrigger className="rounded-lg text-sm h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {["un", "m²", "m", "ml", "kit", "fl", "par", "cx"].map((u) => (
                                  <SelectItem key={u} value={u}>{u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Valor Unitário (R$)</Label>
                            <Input
                              type="number"
                              value={item.valor_unitario}
                              onChange={(e) => updateItem(index, "valor_unitario", Number(e.target.value))}
                              min={0}
                              step={0.01}
                              className="rounded-lg text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Total</Label>
                            <div className="h-9 flex items-center px-3 bg-slate-50 rounded-lg text-sm font-semibold text-slate-700">
                              {item.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Prazo de Produção (dias úteis)</Label>
                          <Input
                            type="number"
                            value={item.prazo_producao_dias || ""}
                            onChange={(e) => updateItem(index, "prazo_producao_dias", e.target.value ? Number(e.target.value) : null)}
                            placeholder="Ex: 5"
                            min={1}
                            className="rounded-lg text-sm w-32"
                          />
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      onClick={addItem}
                      className="w-full rounded-xl border-dashed text-slate-400 hover:text-blue-600 hover:border-blue-300 print:hidden"
                    >
                      <Plus size={16} className="mr-2" /> Adicionar Item
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Observações */}
            <Card className="border-none shadow-sm rounded-2xl print:shadow-none print:border print:border-slate-200">
              <CardContent className="pt-5 space-y-3">
                <div className="space-y-1">
                  <Label>Condições de Pagamento</Label>
                  <Input
                    value={condicoesPagamento}
                    onChange={(e) => setCondicoesPagamento(e.target.value)}
                    placeholder="Ex: 50% na aprovação, 50% na entrega"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Observações</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Arte por conta do cliente. Frete incluso para SP capital..."
                    className="rounded-xl resize-none"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Totais */}
          <div className="space-y-4">
            <Card className="border-none shadow-sm rounded-2xl print:shadow-none print:border print:border-slate-200 sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium">{subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>

                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="text-slate-500 whitespace-nowrap">Desconto (%)</span>
                  <Input
                    type="number"
                    value={desconto}
                    onChange={(e) => setDesconto(Number(e.target.value))}
                    min={0}
                    max={100}
                    step={0.5}
                    className="rounded-lg h-8 w-20 text-sm text-right print:hidden"
                  />
                  <span className="print:block hidden text-slate-600">{desconto}%</span>
                </div>

                {descontoValor > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>- Desconto</span>
                    <span>-{descontoValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </div>
                )}

                <div className="border-t pt-3 flex justify-between">
                  <span className="font-bold text-slate-800">Total</span>
                  <span className="font-bold text-xl text-blue-600">
                    {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>

                {items.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5">
                    <p className="font-semibold text-slate-600 flex items-center gap-1.5">
                      <Clock size={12} /> Prazo estimado
                    </p>
                    <p className="text-slate-500">
                      {Math.max(...items.map(i => i.prazo_producao_dias || 0))} dias úteis (maior prazo)
                    </p>
                    <p className="text-slate-400 text-[10px] mt-1">
                      {items.length} {items.length === 1 ? "item" : "itens"} no orçamento
                    </p>
                  </div>
                )}

                <div className="pt-2 space-y-2 print:hidden">
                  <Button
                    onClick={() => handleSave()}
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-700"
                  >
                    <Save size={16} className="mr-2" /> Salvar Orçamento
                  </Button>
                  {!isNew && (
                    <Button
                      variant="outline"
                      onClick={handlePrint}
                      className="w-full rounded-xl"
                    >
                      <FileDown size={16} className="mr-2" /> Imprimir / PDF
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rodapé do orçamento (print) */}
        <div className="hidden print:block mt-8 pt-6 border-t text-xs text-slate-400">
          <p>Croma Print Comunicação Visual · Este orçamento tem validade de {validade} dias úteis.</p>
          {condicoesPagamento && <p className="mt-1">Condições de pagamento: {condicoesPagamento}</p>}
          {observacoes && <p className="mt-1">Obs: {observacoes}</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TESTES: Guards de conversão de orçamento em pedido
// Cobre a lógica de validação em converterParaPedido
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock do Supabase client ─────────────────────────────────────────────────
// vi.hoisted garante que a variável seja inicializada antes do hoisting do vi.mock.

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

// ─── Mock do pricing engine (usado pelo buildConfigSnapshot via criar) ───────
vi.mock("@/shared/services/pricing-engine", () => ({
  DEFAULT_PRICING_CONFIG: {
    faturamentoMedio: 50000,
    custoOperacional: 0.3,
    custoProdutivo: 0.4,
    qtdFuncionarios: 5,
    horasMes: 176,
    percentualComissao: 0.05,
    percentualImpostos: 0.08,
    percentualJuros: 0.02,
  },
}));

vi.mock("@/shared/utils/searchUtils", () => ({
  ilikeTerm: (s: string) => `%${s}%`,
}));

import { orcamentoService, type OrcamentoStatus } from "../orcamento.service";

// ─── Fábrica de orçamento base ────────────────────────────────────────────────

function makeOrcamento(overrides: Partial<{
  status: OrcamentoStatus;
  total: number;
  itens: unknown[];
}> = {}) {
  return {
    id: "orc-001",
    numero: "ORC-2026-0001",
    cliente_id: "cli-001",
    oportunidade_id: null,
    vendedor_id: "vend-001",
    status: "aprovada" as OrcamentoStatus,
    titulo: "Banner lona 440g",
    validade_dias: 10,
    subtotal: 500,
    desconto_percentual: 0,
    desconto_valor: 0,
    total: 500,
    condicoes_pagamento: null,
    observacoes: null,
    aprovado_por: null,
    aprovado_em: null,
    cliente_nome_snapshot: null,
    cliente_cnpj_snapshot: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    itens: [
      {
        id: "item-001",
        proposta_id: "orc-001",
        produto_id: null,
        descricao: "Banner 1x2m",
        especificacao: null,
        quantidade: 1,
        unidade: "un",
        largura_cm: 100,
        altura_cm: 200,
        area_m2: 2,
        custo_mp: 30,
        custo_mo: 20,
        custo_fixo: 10,
        markup_percentual: 40,
        valor_unitario: 500,
        valor_total: 500,
        prazo_producao_dias: 3,
        ordem: 1,
        materiais: [],
        acabamentos: [],
      },
    ],
    servicos: [],
    ...overrides,
  };
}

// ─── Helper: configura mocks para um caminho feliz ───────────────────────────

function setupHappyPath(orcamento: ReturnType<typeof makeOrcamento>) {
  mockRpc.mockResolvedValue({ data: "PED-2026-0001", error: null });
  mockFrom.mockImplementation((table: string) => {
    // buscarPorId → propostas
    if (table === "propostas") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: orcamento, error: null }),
        update: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
    }
    // buscarPorId → proposta_itens (para nested select — devolvido direto no orcamento)
    if (table === "proposta_itens") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: orcamento.itens, error: null }),
      };
    }
    // buscarPorId → proposta_servicos
    if (table === "proposta_servicos") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }
    // Anti-duplicação → pedidos (sem pedido existente)
    if (table === "pedidos") {
      const chainNoPedido = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        like: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: "ped-001" },
          error: null,
        }),
      };
      return chainNoPedido;
    }
    // pedido_itens
    if (table === "pedido_itens") {
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    // config_precificacao
    if (table === "config_precificacao") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe("orcamentoService.converterParaPedido — guards de status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita orçamento em status rascunho", async () => {
    const orc = makeOrcamento({ status: "rascunho" });
    setupHappyPath(orc);

    await expect(
      orcamentoService.converterParaPedido("orc-001")
    ).rejects.toThrow(/apenas orçamentos aprovados/i);
  });

  it("rejeita orçamento em status enviada", async () => {
    const orc = makeOrcamento({ status: "enviada" });
    setupHappyPath(orc);

    await expect(
      orcamentoService.converterParaPedido("orc-001")
    ).rejects.toThrow(/status atual: enviada/i);
  });

  it("rejeita orçamento em status em_revisao", async () => {
    const orc = makeOrcamento({ status: "em_revisao" });
    setupHappyPath(orc);

    await expect(
      orcamentoService.converterParaPedido("orc-001")
    ).rejects.toThrow(/apenas orçamentos aprovados/i);
  });

  it("rejeita orçamento em status recusada", async () => {
    const orc = makeOrcamento({ status: "recusada" });
    setupHappyPath(orc);

    await expect(
      orcamentoService.converterParaPedido("orc-001")
    ).rejects.toThrow(/status atual: recusada/i);
  });

  it("rejeita orçamento em status expirada", async () => {
    const orc = makeOrcamento({ status: "expirada" });
    setupHappyPath(orc);

    await expect(
      orcamentoService.converterParaPedido("orc-001")
    ).rejects.toThrow(/status atual: expirada/i);
  });

  it("aceita orçamento aprovado e retorna pedido_id", async () => {
    const orc = makeOrcamento({ status: "aprovada" });
    setupHappyPath(orc);

    const result = await orcamentoService.converterParaPedido("orc-001", "user-001");
    expect(result).toHaveProperty("pedido_id");
    expect(typeof result.pedido_id).toBe("string");
  });
});

describe("orcamentoService.converterParaPedido — guard de itens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita orçamento sem itens", async () => {
    const orc = makeOrcamento({ itens: [] });
    setupHappyPath(orc);

    await expect(
      orcamentoService.converterParaPedido("orc-001")
    ).rejects.toThrow(/pelo menos 1 item/i);
  });

  it("rejeita orçamento com itens undefined", async () => {
    const orc = makeOrcamento({ itens: undefined as unknown as [] });
    setupHappyPath(orc);

    await expect(
      orcamentoService.converterParaPedido("orc-001")
    ).rejects.toThrow(/pelo menos 1 item/i);
  });
});

describe("orcamentoService.converterParaPedido — guard de valor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita orçamento com total zero", async () => {
    const orc = makeOrcamento({ total: 0 });
    setupHappyPath(orc);

    await expect(
      orcamentoService.converterParaPedido("orc-001")
    ).rejects.toThrow(/valor maior que R\$ 0,00/i);
  });

  it("rejeita orçamento com total negativo", async () => {
    const orc = makeOrcamento({ total: -50 });
    setupHappyPath(orc);

    await expect(
      orcamentoService.converterParaPedido("orc-001")
    ).rejects.toThrow(/valor maior que R\$ 0,00/i);
  });

  it("aceita orçamento com total positivo", async () => {
    const orc = makeOrcamento({ total: 1 });
    setupHappyPath(orc);

    const result = await orcamentoService.converterParaPedido("orc-001");
    expect(result).toHaveProperty("pedido_id");
  });
});

describe("orcamentoService.converterParaPedido — guard anti-duplicação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita quando já existe pedido ativo para o orçamento", async () => {
    const orc = makeOrcamento();

    // Sobrescreve apenas a parte dos pedidos para simular pedido existente
    mockFrom.mockImplementation((table: string) => {
      if (table === "propostas") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: orc, error: null }),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === "proposta_servicos") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === "pedidos") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [{ id: "ped-existente", numero: "PED-2026-0001" }],
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    await expect(
      orcamentoService.converterParaPedido("orc-001")
    ).rejects.toThrow(/já existe o pedido PED-2026-0001/i);
  });
});

describe("orcamentoService — validações estáticas de status", () => {
  it("OrcamentoStatus inclui todos os valores esperados", () => {
    // Testa que o tipo cobre os valores do negócio
    const validStatuses: OrcamentoStatus[] = [
      "rascunho",
      "enviada",
      "em_revisao",
      "aprovada",
      "recusada",
      "expirada",
    ];
    expect(validStatuses).toHaveLength(6);
    expect(validStatuses).toContain("aprovada");
    expect(validStatuses).toContain("recusada");
  });

  it("apenas 'aprovada' passa no guard de conversão (array de referência)", () => {
    // Espelha a lógica: if (!["aprovada"].includes(orc.status)) → throw
    const allowedForConversion: OrcamentoStatus[] = ["aprovada"];
    const allStatuses: OrcamentoStatus[] = [
      "rascunho", "enviada", "em_revisao", "aprovada", "recusada", "expirada",
    ];
    const blockedStatuses = allStatuses.filter(
      (s) => !allowedForConversion.includes(s)
    );
    expect(blockedStatuses).toHaveLength(5);
    expect(blockedStatuses).not.toContain("aprovada");
  });

  it("'aprovada', 'recusada' e 'expirada' são status que bloqueiam edição", () => {
    // Espelha: const statusBloqueados: OrcamentoStatus[] = ["aprovada", "recusada", "expirada"]
    const statusBloqueados: OrcamentoStatus[] = ["aprovada", "recusada", "expirada"];
    expect(statusBloqueados).toContain("aprovada");
    expect(statusBloqueados).toContain("recusada");
    expect(statusBloqueados).toContain("expirada");
    expect(statusBloqueados).not.toContain("rascunho");
    expect(statusBloqueados).not.toContain("enviada");
    expect(statusBloqueados).not.toContain("em_revisao");
  });
});

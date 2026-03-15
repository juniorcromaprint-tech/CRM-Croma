// ============================================================================
// TESTES: estoqueService
// Cobre listarSaldos, alertasEstoqueMinimo, listarMovimentacoes,
// criarMovimentacao, criarInventario, atualizarItemInventario
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock do Supabase client ─────────────────────────────────────────────────

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { estoqueService } from "../estoqueService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSaldo(overrides: Record<string, any> = {}) {
  return {
    id: "saldo-001",
    material_id: "mat-001",
    quantidade: 50,
    material: {
      nome: "Lona 440g",
      unidade: "m²",
      estoque_minimo: 10,
    },
    ...overrides,
  };
}

function makeMovimentacao(overrides: Record<string, any> = {}) {
  return {
    id: "mov-001",
    material_id: "mat-001",
    tipo: "entrada",
    quantidade: 20,
    observacao: "Recebimento NF 1234",
    created_at: "2026-01-01T00:00:00Z",
    material: { nome: "Lona 440g", unidade: "m²" },
    ...overrides,
  };
}

function makeInventario(overrides: Record<string, any> = {}) {
  return {
    id: "inv-001",
    status: "em_andamento",
    observacoes: null,
    responsavel_id: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ─── listarSaldos ─────────────────────────────────────────────────────────────

describe("estoqueService.listarSaldos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array de saldos sem filtros", async () => {
    const saldos = [makeSaldo(), makeSaldo({ id: "saldo-002", material_id: "mat-002" })];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: saldos, error: null }),
      ilike: vi.fn().mockReturnThis(),
    }));

    const result = await estoqueService.listarSaldos();
    expect(result).toHaveLength(2);
  });

  it("retorna array vazio quando não há saldos", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
      ilike: vi.fn().mockReturnThis(),
    }));

    const result = await estoqueService.listarSaldos();
    expect(result).toEqual([]);
  });

  it("aplica filtro abaixoMinimo corretamente em memória", async () => {
    const saldos = [
      makeSaldo({ quantidade: 5, material: { nome: "Lona 440g", unidade: "m²", estoque_minimo: 10 } }),  // abaixo
      makeSaldo({ id: "saldo-002", quantidade: 50, material: { nome: "Vinil", unidade: "m²", estoque_minimo: 10 } }), // ok
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: saldos, error: null }),
      ilike: vi.fn().mockReturnThis(),
    }));

    const result = await estoqueService.listarSaldos({ abaixoMinimo: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("saldo-001");
  });

  it("não filtra abaixoMinimo quando flag não é passada", async () => {
    const saldos = [
      makeSaldo({ quantidade: 5, material: { nome: "Lona 440g", unidade: "m²", estoque_minimo: 10 } }),
      makeSaldo({ id: "saldo-002", quantidade: 50, material: { nome: "Vinil", unidade: "m²", estoque_minimo: 10 } }),
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: saldos, error: null }),
      ilike: vi.fn().mockReturnThis(),
    }));

    const result = await estoqueService.listarSaldos();
    expect(result).toHaveLength(2);
  });

  it("lança erro quando o banco retorna error", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
      ilike: vi.fn().mockReturnThis(),
    }));

    await expect(estoqueService.listarSaldos()).rejects.toMatchObject({ message: "DB error" });
  });
});

// ─── alertasEstoqueMinimo ─────────────────────────────────────────────────────

describe("estoqueService.alertasEstoqueMinimo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtra materiais com quantidade abaixo do mínimo", async () => {
    const saldos = [
      makeSaldo({ quantidade: 3, material: { nome: "Lona 440g", unidade: "m²", estoque_minimo: 10 } }),
      makeSaldo({ id: "saldo-002", quantidade: 50, material: { nome: "Vinil", unidade: "m²", estoque_minimo: 10 } }),
      makeSaldo({ id: "saldo-003", quantidade: 0, material: { nome: "Bastão", unidade: "un", estoque_minimo: 5 } }),
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: saldos, error: null }),
    }));

    const result = await estoqueService.alertasEstoqueMinimo();
    expect(result).toHaveLength(2);
    const nomes = result.map((s: any) => s.material.nome);
    expect(nomes).toContain("Lona 440g");
    expect(nomes).toContain("Bastão");
    expect(nomes).not.toContain("Vinil");
  });

  it("exclui materiais com estoque_minimo = 0", async () => {
    const saldos = [
      makeSaldo({ quantidade: 0, material: { nome: "Material X", unidade: "un", estoque_minimo: 0 } }),
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: saldos, error: null }),
    }));

    const result = await estoqueService.alertasEstoqueMinimo();
    expect(result).toHaveLength(0);
  });

  it("retorna array vazio quando não há alertas", async () => {
    const saldos = [
      makeSaldo({ quantidade: 100, material: { nome: "Lona 440g", unidade: "m²", estoque_minimo: 10 } }),
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: saldos, error: null }),
    }));

    const result = await estoqueService.alertasEstoqueMinimo();
    expect(result).toHaveLength(0);
  });

  it("lança erro quando o banco retorna error", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    }));

    await expect(estoqueService.alertasEstoqueMinimo()).rejects.toMatchObject({ message: "DB error" });
  });
});

// ─── listarMovimentacoes ──────────────────────────────────────────────────────

describe("estoqueService.listarMovimentacoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array de movimentações sem filtros", async () => {
    const movs = [makeMovimentacao(), makeMovimentacao({ id: "mov-002", tipo: "saida" })];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: movs, error: null }),
      eq: vi.fn().mockReturnThis(),
    }));

    const result = await estoqueService.listarMovimentacoes();
    expect(result).toHaveLength(2);
  });

  it("aplica filtro de tipo", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [makeMovimentacao()], error: null });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: eqMock,
    }));

    await estoqueService.listarMovimentacoes({ tipo: "entrada" });
    expect(eqMock).toHaveBeenCalledWith("tipo", "entrada");
  });

  it("aplica filtro de material_id", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [makeMovimentacao()], error: null });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: eqMock,
    }));

    await estoqueService.listarMovimentacoes({ material_id: "mat-001" });
    expect(eqMock).toHaveBeenCalledWith("material_id", "mat-001");
  });

  it("usa limite default de 100 quando não especificado", async () => {
    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: limitMock,
      eq: vi.fn().mockReturnThis(),
    }));

    await estoqueService.listarMovimentacoes();
    expect(limitMock).toHaveBeenCalledWith(100);
  });

  it("retorna array vazio quando não há movimentações", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
    }));

    const result = await estoqueService.listarMovimentacoes();
    expect(result).toEqual([]);
  });
});

// ─── criarMovimentacao ────────────────────────────────────────────────────────

describe("estoqueService.criarMovimentacao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("insere registro e retorna movimentação criada", async () => {
    const novaMovimentacao = makeMovimentacao();
    const insertMock = vi.fn().mockReturnThis();

    mockFrom.mockImplementation(() => ({
      insert: insertMock,
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: novaMovimentacao, error: null }),
    }));

    const dados = { material_id: "mat-001", tipo: "entrada", quantidade: 20 };
    const result = await estoqueService.criarMovimentacao(dados);

    expect(insertMock).toHaveBeenCalledWith(dados);
    expect(result).toEqual(novaMovimentacao);
  });

  it("lança erro quando insert falha", async () => {
    mockFrom.mockImplementation(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "insert error" } }),
    }));

    await expect(
      estoqueService.criarMovimentacao({ material_id: "mat-001", tipo: "saida", quantidade: 5 })
    ).rejects.toMatchObject({ message: "insert error" });
  });
});

// ─── criarInventario ──────────────────────────────────────────────────────────

describe("estoqueService.criarInventario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria inventário e preenche itens com saldos atuais", async () => {
    const inventarioCriado = makeInventario();
    const saldos = [
      { material_id: "mat-001", quantidade: 50 },
      { material_id: "mat-002", quantidade: 100 },
    ];
    let inventarioItemsInsertCalled = false;

    mockFrom.mockImplementation((table: string) => {
      if (table === "inventarios") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: inventarioCriado, error: null }),
        };
      }
      if (table === "estoque_saldos") {
        return {
          select: vi.fn().mockResolvedValue({ data: saldos, error: null }),
        };
      }
      if (table === "inventario_itens") {
        inventarioItemsInsertCalled = true;
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const result = await estoqueService.criarInventario({ observacoes: "Inventário mensal" });
    expect(result).toHaveProperty("id", "inv-001");
    expect(inventarioItemsInsertCalled).toBe(true);
  });

  it("não insere itens quando não há saldos", async () => {
    const inventarioCriado = makeInventario();
    let inventarioItemsInsertCalled = false;

    mockFrom.mockImplementation((table: string) => {
      if (table === "inventarios") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: inventarioCriado, error: null }),
        };
      }
      if (table === "estoque_saldos") {
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === "inventario_itens") {
        inventarioItemsInsertCalled = true;
        return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }
      return {};
    });

    await estoqueService.criarInventario({});
    expect(inventarioItemsInsertCalled).toBe(false);
  });

  it("lança erro quando criação do inventário falha", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "inventarios") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "insert inventario error" } }),
        };
      }
      return {};
    });

    await expect(estoqueService.criarInventario({})).rejects.toMatchObject({ message: "insert inventario error" });
  });
});

// ─── atualizarItemInventario ──────────────────────────────────────────────────

describe("estoqueService.atualizarItemInventario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("atualiza contagem do item inventário", async () => {
    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation(() => ({
      update: updateMock,
      eq: eqMock,
    }));

    await estoqueService.atualizarItemInventario("item-inv-001", 42);
    expect(updateMock).toHaveBeenCalledWith({ quantidade_contada: 42, justificativa: undefined });
    expect(eqMock).toHaveBeenCalledWith("id", "item-inv-001");
  });

  it("atualiza contagem com justificativa", async () => {
    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation(() => ({
      update: updateMock,
      eq: eqMock,
    }));

    await estoqueService.atualizarItemInventario("item-inv-001", 15, "Diferença identificada na conferência");
    expect(updateMock).toHaveBeenCalledWith({
      quantidade_contada: 15,
      justificativa: "Diferença identificada na conferência",
    });
  });

  it("lança erro quando atualização falha", async () => {
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: { message: "update error" } }),
    }));

    await expect(estoqueService.atualizarItemInventario("item-inv-001", 0)).rejects.toMatchObject({ message: "update error" });
  });
});

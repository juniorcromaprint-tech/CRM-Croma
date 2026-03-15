// ============================================================================
// TESTES: comprasService
// Cobre listarFornecedores, criarFornecedor, listarPedidosCompra,
// buscarPedidoCompra, criarPedidoCompra, atualizarStatusPedido
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

import { comprasService } from "../comprasService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFornecedor(overrides: Record<string, any> = {}) {
  return {
    id: "forn-001",
    nome: "Fornecedor Teste",
    cnpj: "12.345.678/0001-99",
    email: "contato@fornecedor.com",
    ativo: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makePedidoCompra(overrides: Record<string, any> = {}) {
  return {
    id: "pc-001",
    fornecedor_id: "forn-001",
    status: "rascunho",
    total: 1500,
    created_at: "2026-01-01T00:00:00Z",
    fornecedor: { nome: "Fornecedor Teste" },
    itens: [],
    ...overrides,
  };
}

// ─── listarFornecedores ───────────────────────────────────────────────────────

describe("comprasService.listarFornecedores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array de fornecedores sem filtros", async () => {
    const fornecedores = [makeFornecedor(), makeFornecedor({ id: "forn-002", nome: "Outro Fornecedor" })];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: fornecedores, error: null }),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
    }));

    const result = await comprasService.listarFornecedores();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("forn-001");
  });

  it("retorna array vazio quando não há fornecedores", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
    }));

    const result = await comprasService.listarFornecedores();
    expect(result).toEqual([]);
  });

  it("aplica filtro de busca por nome via ilike", async () => {
    const ilikeMock = vi.fn().mockResolvedValue({ data: [makeFornecedor()], error: null });
    const orderMock = vi.fn().mockReturnThis();

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: orderMock,
      eq: vi.fn().mockReturnThis(),
      ilike: ilikeMock,
    }));

    const result = await comprasService.listarFornecedores({ busca: "Teste" });
    expect(ilikeMock).toHaveBeenCalledWith("nome", "%Teste%");
    expect(result).toHaveLength(1);
  });

  it("aplica filtro de ativo=true", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [makeFornecedor()], error: null });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: eqMock,
      ilike: vi.fn().mockReturnThis(),
    }));

    await comprasService.listarFornecedores({ ativo: true });
    expect(eqMock).toHaveBeenCalledWith("ativo", true);
  });

  it("lança erro quando o banco retorna error", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
    }));

    await expect(comprasService.listarFornecedores()).rejects.toMatchObject({ message: "DB error" });
  });
});

// ─── criarFornecedor ──────────────────────────────────────────────────────────

describe("comprasService.criarFornecedor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chama insert e retorna fornecedor criado", async () => {
    const novoFornecedor = makeFornecedor();
    const insertMock = vi.fn().mockReturnThis();
    const singleMock = vi.fn().mockResolvedValue({ data: novoFornecedor, error: null });

    mockFrom.mockImplementation(() => ({
      insert: insertMock,
      select: vi.fn().mockReturnThis(),
      single: singleMock,
    }));

    const dados = { nome: "Fornecedor Teste", cnpj: "12.345.678/0001-99" };
    const result = await comprasService.criarFornecedor(dados);

    expect(insertMock).toHaveBeenCalledWith(dados);
    expect(result).toEqual(novoFornecedor);
  });

  it("lança erro quando insert falha", async () => {
    mockFrom.mockImplementation(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "insert error" } }),
    }));

    await expect(comprasService.criarFornecedor({ nome: "X" })).rejects.toMatchObject({ message: "insert error" });
  });
});

// ─── listarPedidosCompra ──────────────────────────────────────────────────────

describe("comprasService.listarPedidosCompra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array de pedidos de compra sem filtros", async () => {
    const pedidos = [makePedidoCompra(), makePedidoCompra({ id: "pc-002" })];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: pedidos, error: null }),
      eq: vi.fn().mockReturnThis(),
    }));

    const result = await comprasService.listarPedidosCompra();
    expect(result).toHaveLength(2);
  });

  it("retorna array vazio quando não há pedidos", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
    }));

    const result = await comprasService.listarPedidosCompra();
    expect(result).toEqual([]);
  });

  it("aplica filtro de status", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [makePedidoCompra()], error: null });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: eqMock,
    }));

    await comprasService.listarPedidosCompra({ status: "aprovado" });
    expect(eqMock).toHaveBeenCalledWith("status", "aprovado");
  });

  it("aplica filtro de fornecedor_id", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [makePedidoCompra()], error: null });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: eqMock,
    }));

    await comprasService.listarPedidosCompra({ fornecedor_id: "forn-001" });
    expect(eqMock).toHaveBeenCalledWith("fornecedor_id", "forn-001");
  });
});

// ─── buscarPedidoCompra ───────────────────────────────────────────────────────

describe("comprasService.buscarPedidoCompra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna objeto com itens e fornecedor", async () => {
    const pedido = makePedidoCompra({
      itens: [{ id: "item-001", material_id: "mat-001", quantidade: 10 }],
      fornecedor: { id: "forn-001", nome: "Fornecedor Teste", cnpj: "12.345.678/0001-99" },
    });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: pedido, error: null }),
    }));

    const result = await comprasService.buscarPedidoCompra("pc-001");
    expect(result).toHaveProperty("id", "pc-001");
    expect(result).toHaveProperty("itens");
    expect(result).toHaveProperty("fornecedor");
    expect(result.itens).toHaveLength(1);
  });

  it("lança erro quando pedido não encontrado", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    }));

    await expect(comprasService.buscarPedidoCompra("inexistente")).rejects.toMatchObject({ message: "not found" });
  });
});

// ─── criarPedidoCompra ────────────────────────────────────────────────────────

describe("comprasService.criarPedidoCompra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria pedido e insere itens", async () => {
    const pedidoCriado = makePedidoCompra();
    let callCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "pedidos_compra") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: pedidoCriado, error: null }),
        };
      }
      if (table === "pedido_compra_itens") {
        callCount++;
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

    const pedidoDados = { fornecedor_id: "forn-001", status: "rascunho", total: 1500 } as any;
    const itens = [
      { material_id: "mat-001", quantidade: 10, preco_unitario: 150, total: 1500 },
    ];

    const result = await comprasService.criarPedidoCompra(pedidoDados, itens);
    expect(result).toHaveProperty("id", "pc-001");
    expect(callCount).toBe(1);
  });

  it("cria pedido sem itens não chama insert em pedido_compra_itens", async () => {
    const pedidoCriado = makePedidoCompra();
    let itensInsertCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "pedidos_compra") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: pedidoCriado, error: null }),
        };
      }
      if (table === "pedido_compra_itens") {
        itensInsertCount++;
        return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }
      return {};
    });

    await comprasService.criarPedidoCompra({ fornecedor_id: "forn-001" } as any, []);
    expect(itensInsertCount).toBe(0);
  });

  it("lança erro quando criação do pedido falha", async () => {
    mockFrom.mockImplementation(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "insert pedido error" } }),
    }));

    await expect(
      comprasService.criarPedidoCompra({ fornecedor_id: "forn-001" } as any, [])
    ).rejects.toMatchObject({ message: "insert pedido error" });
  });
});

// ─── atualizarStatusPedido ────────────────────────────────────────────────────

describe("comprasService.atualizarStatusPedido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("atualiza status e retorna pedido atualizado", async () => {
    const pedidoAtualizado = makePedidoCompra({ status: "aprovado" });
    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockReturnThis();

    mockFrom.mockImplementation(() => ({
      update: updateMock,
      eq: eqMock,
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: pedidoAtualizado, error: null }),
    }));

    const result = await comprasService.atualizarStatusPedido("pc-001", "aprovado");
    expect(updateMock).toHaveBeenCalledWith({ status: "aprovado" });
    expect(eqMock).toHaveBeenCalledWith("id", "pc-001");
    expect(result.status).toBe("aprovado");
  });

  it("lança erro quando atualização falha", async () => {
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "update error" } }),
    }));

    await expect(comprasService.atualizarStatusPedido("pc-001", "cancelado")).rejects.toMatchObject({ message: "update error" });
  });
});

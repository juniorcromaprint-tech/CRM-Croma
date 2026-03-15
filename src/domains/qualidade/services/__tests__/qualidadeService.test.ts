// ============================================================================
// TESTES: qualidadeService
// Cobre listarOcorrencias, buscarOcorrencia, criarOcorrencia,
// adicionarTratativa, buscarKPIs
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

import { qualidadeService } from "../qualidadeService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOcorrencia(overrides: Record<string, any> = {}) {
  return {
    id: "ocr-001",
    descricao: "Impressão com defeito",
    tipo: "producao",
    prioridade: "media",
    status: "aberta",
    responsavel_id: "user-001",
    created_at: "2026-01-15T10:00:00Z",
    resolved_at: null,
    responsavel: { first_name: "João", last_name: "Silva" },
    tratativas: [],
    ...overrides,
  };
}

function makeTratativa(overrides: Record<string, any> = {}) {
  return {
    id: "trat-001",
    ocorrencia_id: "ocr-001",
    acao_corretiva: "Verificação realizada",
    prazo: null,
    data_conclusao: null,
    observacoes: null,
    responsavel_id: "user-001",
    created_at: "2026-01-15T11:00:00Z",
    ...overrides,
  };
}

// ─── listarOcorrencias ────────────────────────────────────────────────────────

describe("qualidadeService.listarOcorrencias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array de ocorrências sem filtros", async () => {
    const ocorrencias = [makeOcorrencia(), makeOcorrencia({ id: "ocr-002", descricao: "Atraso na entrega" })];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: ocorrencias, error: null }),
      eq: vi.fn().mockReturnThis(),
    }));

    const result = await qualidadeService.listarOcorrencias();
    expect(result).toHaveLength(2);
  });

  it("retorna array vazio quando não há ocorrências", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
    }));

    const result = await qualidadeService.listarOcorrencias();
    expect(result).toEqual([]);
  });

  it("aplica filtro de status", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [makeOcorrencia()], error: null });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: eqMock,
    }));

    await qualidadeService.listarOcorrencias({ status: "aberta" });
    expect(eqMock).toHaveBeenCalledWith("status", "aberta");
  });

  it("aplica filtro de prioridade", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [makeOcorrencia()], error: null });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: eqMock,
    }));

    await qualidadeService.listarOcorrencias({ prioridade: "alta" });
    expect(eqMock).toHaveBeenCalledWith("prioridade", "alta");
  });

  it("aplica filtro de tipo", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: [makeOcorrencia()], error: null });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: eqMock,
    }));

    await qualidadeService.listarOcorrencias({ tipo: "producao" });
    expect(eqMock).toHaveBeenCalledWith("tipo", "producao");
  });

  it("lança erro quando o banco retorna error", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
      eq: vi.fn().mockReturnThis(),
    }));

    await expect(qualidadeService.listarOcorrencias()).rejects.toMatchObject({ message: "DB error" });
  });
});

// ─── buscarOcorrencia ─────────────────────────────────────────────────────────

describe("qualidadeService.buscarOcorrencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna ocorrência com tratativas", async () => {
    const ocorrencia = makeOcorrencia({
      tratativas: [
        makeTratativa(),
        makeTratativa({ id: "trat-002", acao_corretiva: "Correção aplicada" }),
      ],
    });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: ocorrencia, error: null }),
    }));

    const result = await qualidadeService.buscarOcorrencia("ocr-001");
    expect(result).toHaveProperty("id", "ocr-001");
    expect(result).toHaveProperty("tratativas");
    expect(result.tratativas).toHaveLength(2);
  });

  it("retorna ocorrência com responsável", async () => {
    const ocorrencia = makeOcorrencia({
      responsavel: { first_name: "Maria", last_name: "Souza" },
    });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: ocorrencia, error: null }),
    }));

    const result = await qualidadeService.buscarOcorrencia("ocr-001");
    expect(result.responsavel.first_name).toBe("Maria");
  });

  it("lança erro quando ocorrência não encontrada", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    }));

    await expect(qualidadeService.buscarOcorrencia("inexistente")).rejects.toMatchObject({ message: "not found" });
  });
});

// ─── criarOcorrencia ──────────────────────────────────────────────────────────

describe("qualidadeService.criarOcorrencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("insere registro e retorna ocorrência criada", async () => {
    const novaOcorrencia = makeOcorrencia();
    const insertMock = vi.fn().mockReturnThis();

    mockFrom.mockImplementation(() => ({
      insert: insertMock,
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: novaOcorrencia, error: null }),
    }));

    const dados = {
      descricao: "Impressão com defeito",
      tipo: "producao",
      prioridade: "media",
      status: "aberta",
    };
    const result = await qualidadeService.criarOcorrencia(dados);

    expect(insertMock).toHaveBeenCalledWith(dados);
    expect(result).toEqual(novaOcorrencia);
  });

  it("lança erro quando insert falha", async () => {
    mockFrom.mockImplementation(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "insert error" } }),
    }));

    await expect(
      qualidadeService.criarOcorrencia({ descricao: "Teste", tipo: "qualidade" })
    ).rejects.toMatchObject({ message: "insert error" });
  });
});

// ─── adicionarTratativa ───────────────────────────────────────────────────────

describe("qualidadeService.adicionarTratativa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("insere tratativa e retorna registro criado", async () => {
    const novaTratativa = makeTratativa();
    const insertMock = vi.fn().mockReturnThis();

    mockFrom.mockImplementation(() => ({
      insert: insertMock,
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: novaTratativa, error: null }),
    }));

    const dados = {
      ocorrencia_id: "ocr-001",
      acao_corretiva: "Verificação realizada",
      prazo: null,
      data_conclusao: null,
      responsavel_id: "user-001",
    };
    const result = await qualidadeService.adicionarTratativa(dados);

    expect(insertMock).toHaveBeenCalledWith(dados);
    expect(result).toEqual(novaTratativa);
    expect(result).toHaveProperty("ocorrencia_id", "ocr-001");
  });

  it("lança erro quando insert de tratativa falha", async () => {
    mockFrom.mockImplementation(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "tratativa error" } }),
    }));

    await expect(
      qualidadeService.adicionarTratativa({
        ocorrencia_id: "ocr-001",
        acao_corretiva: "Ação corretiva",
      })
    ).rejects.toMatchObject({ message: "tratativa error" });
  });
});

// ─── buscarKPIs ───────────────────────────────────────────────────────────────

describe("qualidadeService.buscarKPIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcula total de ocorrências corretamente", async () => {
    const ocorrencias = [
      makeOcorrencia({ status: "aberta" }),
      makeOcorrencia({ id: "ocr-002", status: "resolvida", resolved_at: new Date().toISOString() }),
      makeOcorrencia({ id: "ocr-003", status: "encerrada", resolved_at: new Date().toISOString() }),
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: ocorrencias, error: null }),
    }));

    const kpis = await qualidadeService.buscarKPIs();
    expect(kpis.total_ocorrencias).toBe(3);
  });

  it("conta ocorrências abertas (excluindo resolvida e encerrada)", async () => {
    const ocorrencias = [
      makeOcorrencia({ status: "aberta" }),
      makeOcorrencia({ id: "ocr-002", status: "em_tratativa" }),
      makeOcorrencia({ id: "ocr-003", status: "resolvida", resolved_at: new Date().toISOString() }),
      makeOcorrencia({ id: "ocr-004", status: "encerrada", resolved_at: new Date().toISOString() }),
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: ocorrencias, error: null }),
    }));

    const kpis = await qualidadeService.buscarKPIs();
    expect(kpis.abertas).toBe(2);
  });

  it("calcula MTTR em horas corretamente", async () => {
    // 2 horas de resolução
    const createdAt = new Date("2026-01-15T08:00:00Z").toISOString();
    const resolvedAt = new Date("2026-01-15T10:00:00Z").toISOString();

    const ocorrencias = [
      makeOcorrencia({
        status: "resolvida",
        created_at: createdAt,
        resolved_at: resolvedAt,
      }),
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: ocorrencias, error: null }),
    }));

    const kpis = await qualidadeService.buscarKPIs();
    expect(kpis.mttr_horas).toBe(2);
  });

  it("retorna mttr_horas = 0 quando não há ocorrências resolvidas", async () => {
    const ocorrencias = [
      makeOcorrencia({ status: "aberta", resolved_at: null }),
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: ocorrencias, error: null }),
    }));

    const kpis = await qualidadeService.buscarKPIs();
    expect(kpis.mttr_horas).toBe(0);
  });

  it("agrupa ocorrências por tipo", async () => {
    const ocorrencias = [
      makeOcorrencia({ tipo: "producao" }),
      makeOcorrencia({ id: "ocr-002", tipo: "producao" }),
      makeOcorrencia({ id: "ocr-003", tipo: "qualidade" }),
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: ocorrencias, error: null }),
    }));

    const kpis = await qualidadeService.buscarKPIs();
    expect(kpis.por_tipo).toBeInstanceOf(Array);

    const producao = kpis.por_tipo.find((t: any) => t.tipo === "producao");
    const qualidade = kpis.por_tipo.find((t: any) => t.tipo === "qualidade");

    expect(producao?.count).toBe(2);
    expect(qualidade?.count).toBe(1);
  });

  it("agrupa ocorrências por prioridade", async () => {
    const ocorrencias = [
      makeOcorrencia({ prioridade: "alta" }),
      makeOcorrencia({ id: "ocr-002", prioridade: "alta" }),
      makeOcorrencia({ id: "ocr-003", prioridade: "baixa" }),
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: ocorrencias, error: null }),
    }));

    const kpis = await qualidadeService.buscarKPIs();
    expect(kpis.por_prioridade).toBeInstanceOf(Array);

    const alta = kpis.por_prioridade.find((p: any) => p.prioridade === "alta");
    const baixa = kpis.por_prioridade.find((p: any) => p.prioridade === "baixa");

    expect(alta?.count).toBe(2);
    expect(baixa?.count).toBe(1);
  });

  it("conta resolvidas_mes apenas no mês corrente", async () => {
    const agora = new Date();
    const resolvedAtMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 10).toISOString();
    const resolvedAtMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 10).toISOString();

    const ocorrencias = [
      makeOcorrencia({
        id: "ocr-001",
        status: "resolvida",
        created_at: resolvedAtMesAnterior,
        resolved_at: resolvedAtMesAtual,
      }),
      makeOcorrencia({
        id: "ocr-002",
        status: "resolvida",
        created_at: resolvedAtMesAnterior,
        resolved_at: resolvedAtMesAnterior,
      }),
    ];

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: ocorrencias, error: null }),
    }));

    const kpis = await qualidadeService.buscarKPIs();
    expect(kpis.resolvidas_mes).toBe(1);
  });

  it("retorna zeros quando não há ocorrências", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    const kpis = await qualidadeService.buscarKPIs();
    expect(kpis.total_ocorrencias).toBe(0);
    expect(kpis.abertas).toBe(0);
    expect(kpis.resolvidas_mes).toBe(0);
    expect(kpis.mttr_horas).toBe(0);
    expect(kpis.por_tipo).toEqual([]);
    expect(kpis.por_prioridade).toEqual([]);
  });

  it("lança erro quando o banco retorna error", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    }));

    await expect(qualidadeService.buscarKPIs()).rejects.toMatchObject({ message: "DB error" });
  });
});

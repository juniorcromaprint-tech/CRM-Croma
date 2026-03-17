import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock supabase client before importing service
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import { supabase } from '@/integrations/supabase/client';
import {
  iniciarEtapa,
  pausarEtapa,
  concluirEtapa,
  listarApontamentosPorOp,
  apontamentoAberto,
} from '../apontamento.service';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
const mockGetUser = supabase.auth.getUser as ReturnType<typeof vi.fn>;

// Helper to build chainable mock
function buildChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const resolve = () => Promise.resolve({ data, error });
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.order = vi.fn(() => resolve());
  chain.update = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.single = vi.fn(() => resolve());
  chain.maybeSingle = vi.fn(() => resolve());
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    resolve().then(onFulfilled, onRejected);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// iniciarEtapa
// ---------------------------------------------------------------------------
describe('iniciarEtapa', () => {
  it('lança erro quando usuário não está autenticado', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    await expect(iniciarEtapa('etapa-1', 'op-1')).rejects.toThrow('Usuário não autenticado');
  });

  it('cria apontamento e atualiza etapa quando autenticado', async () => {
    const fakeUser = { id: 'user-uuid' };
    mockGetUser.mockResolvedValueOnce({ data: { user: fakeUser } });

    const fakeApontamento = {
      id: 'apto-1',
      producao_etapa_id: 'etapa-1',
      ordem_producao_id: 'op-1',
      operador_id: 'user-uuid',
      inicio: new Date().toISOString(),
      fim: null,
      tipo: 'producao',
    };

    // Call 1: producao_etapas update
    const etapasChain = buildChain(null);
    const etapasUpdate = etapasChain.update as ReturnType<typeof vi.fn>;
    etapasUpdate.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    });

    // Call 2: ordens_producao update
    const opChain = buildChain(null);
    const opUpdate = opChain.update as ReturnType<typeof vi.fn>;
    opUpdate.mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
      }),
    });

    // Call 3: producao_apontamentos insert
    const apontamentoChain = buildChain(fakeApontamento);
    const insertMock = apontamentoChain.insert as ReturnType<typeof vi.fn>;
    insertMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: fakeApontamento, error: null }),
      }),
    });

    mockFrom
      .mockReturnValueOnce(etapasChain)
      .mockReturnValueOnce(opChain)
      .mockReturnValueOnce(apontamentoChain);

    const result = await iniciarEtapa('etapa-1', 'op-1');

    expect(mockFrom).toHaveBeenCalledWith('producao_etapas');
    expect(mockFrom).toHaveBeenCalledWith('ordens_producao');
    expect(mockFrom).toHaveBeenCalledWith('producao_apontamentos');
    expect(result).toEqual(fakeApontamento);
  });

  it('usa tipo producao por padrão', async () => {
    const fakeUser = { id: 'user-uuid' };
    mockGetUser.mockResolvedValueOnce({ data: { user: fakeUser } });

    const fakeApontamento = { id: 'apto-1', tipo: 'producao' };

    const etapasChain = buildChain(null);
    (etapasChain.update as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    });

    const opChain = buildChain(null);
    (opChain.update as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
      }),
    });

    const apontamentoChain = buildChain(null);
    const insertMock = apontamentoChain.insert as ReturnType<typeof vi.fn>;
    insertMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({ data: fakeApontamento, error: null }),
      }),
    });

    mockFrom
      .mockReturnValueOnce(etapasChain)
      .mockReturnValueOnce(opChain)
      .mockReturnValueOnce(apontamentoChain);

    await iniciarEtapa('etapa-1', 'op-1');

    // insertMock first arg should contain tipo: 'producao'
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'producao' })
    );
  });
});

// ---------------------------------------------------------------------------
// pausarEtapa
// ---------------------------------------------------------------------------
describe('pausarEtapa', () => {
  it('atualiza producao_apontamentos com fim = now', async () => {
    const chain = buildChain(null);
    const updateMock = chain.update as ReturnType<typeof vi.fn>;
    updateMock.mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        is: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
      }),
    });
    mockFrom.mockReturnValueOnce(chain);

    await pausarEtapa('apto-123');

    expect(mockFrom).toHaveBeenCalledWith('producao_apontamentos');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ fim: expect.any(String) })
    );
  });

  it('lança erro quando supabase retorna error', async () => {
    const chain = buildChain(null);
    const updateMock = chain.update as ReturnType<typeof vi.fn>;
    updateMock.mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        is: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } }),
      }),
    });
    mockFrom.mockReturnValueOnce(chain);

    await expect(pausarEtapa('apto-123')).rejects.toThrow('Update failed');
  });
});

// ---------------------------------------------------------------------------
// concluirEtapa
// ---------------------------------------------------------------------------
describe('concluirEtapa', () => {
  it('marca etapa como concluida', async () => {
    // Call 1: fechar apontamento aberto (when apontamentoId provided)
    const apontamentoChain = buildChain(null);
    (apontamentoChain.update as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        is: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
      }),
    });

    // Call 2: update producao_etapas
    const etapasChain = buildChain(null);
    const etapasUpdate = etapasChain.update as ReturnType<typeof vi.fn>;
    etapasUpdate.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    });

    mockFrom
      .mockReturnValueOnce(apontamentoChain)
      .mockReturnValueOnce(etapasChain);

    await concluirEtapa('etapa-1', 'apto-1');

    expect(mockFrom).toHaveBeenCalledWith('producao_apontamentos');
    expect(mockFrom).toHaveBeenCalledWith('producao_etapas');
    expect(etapasUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'concluida' })
    );
  });

  it('não tenta fechar apontamento quando apontamentoId é null', async () => {
    const etapasChain = buildChain(null);
    const etapasUpdate = etapasChain.update as ReturnType<typeof vi.fn>;
    etapasUpdate.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce(etapasChain);

    await concluirEtapa('etapa-1', null);

    // Only producao_etapas should be called (not producao_apontamentos)
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('producao_etapas');
  });

  it('inclui observacoes quando fornecidas', async () => {
    const etapasChain = buildChain(null);
    const etapasUpdate = etapasChain.update as ReturnType<typeof vi.fn>;
    etapasUpdate.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce(etapasChain);

    await concluirEtapa('etapa-1', null, 'Retrabalho necessário');

    expect(etapasUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ observacoes: 'Retrabalho necessário' })
    );
  });
});

// ---------------------------------------------------------------------------
// listarApontamentosPorOp
// ---------------------------------------------------------------------------
describe('listarApontamentosPorOp', () => {
  it('busca apontamentos da tabela correta para a OP', async () => {
    const apontamentos = [
      { id: 'a1', ordem_producao_id: 'op-1', tipo: 'producao', inicio: '2026-01-01T10:00:00Z', fim: null },
      { id: 'a2', ordem_producao_id: 'op-1', tipo: 'setup', inicio: '2026-01-01T09:00:00Z', fim: '2026-01-01T09:30:00Z' },
    ];
    mockFrom.mockReturnValueOnce(buildChain(apontamentos));

    const result = await listarApontamentosPorOp('op-1');

    expect(mockFrom).toHaveBeenCalledWith('producao_apontamentos');
    expect(result).toHaveLength(2);
  });

  it('retorna array vazio quando não há apontamentos', async () => {
    mockFrom.mockReturnValueOnce(buildChain(null));

    const result = await listarApontamentosPorOp('op-99');

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// apontamentoAberto
// ---------------------------------------------------------------------------
describe('apontamentoAberto', () => {
  it('retorna null quando usuário não está autenticado', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await apontamentoAberto('etapa-1');

    expect(result).toBeNull();
    // supabase.from should NOT be called when user is null
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('retorna null quando não há apontamento aberto', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid' } } });

    const chain = buildChain(null);
    const isMock = chain.is as ReturnType<typeof vi.fn>;
    isMock.mockReturnValueOnce({
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce(chain);

    const result = await apontamentoAberto('etapa-1');

    expect(result).toBeNull();
  });

  it('retorna apontamento aberto existente', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid' } } });

    const fakeApontamento = {
      id: 'apto-open',
      producao_etapa_id: 'etapa-1',
      operador_id: 'user-uuid',
      inicio: '2026-01-01T10:00:00Z',
      fim: null,
      tipo: 'producao',
    };

    const chain = buildChain(null);
    const isMock = chain.is as ReturnType<typeof vi.fn>;
    isMock.mockReturnValueOnce({
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: fakeApontamento, error: null }),
    });
    mockFrom.mockReturnValueOnce(chain);

    const result = await apontamentoAberto('etapa-1');

    expect(result).toEqual(fakeApontamento);
    expect(mockFrom).toHaveBeenCalledWith('producao_apontamentos');
  });

  it('passa etapaId e operadorId corretos na query', async () => {
    const userId = 'user-uuid-123';
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: userId } } });

    const chain = buildChain(null);
    const eqMock = chain.eq as ReturnType<typeof vi.fn>;
    eqMock.mockReturnValueOnce(chain); // first .eq (producao_etapa_id)
    eqMock.mockReturnValueOnce(chain); // second .eq (operador_id)

    const isMock = chain.is as ReturnType<typeof vi.fn>;
    isMock.mockReturnValueOnce({
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce(chain);

    await apontamentoAberto('etapa-xyz');

    expect(eqMock).toHaveBeenCalledWith('producao_etapa_id', 'etapa-xyz');
    expect(eqMock).toHaveBeenCalledWith('operador_id', userId);
  });
});

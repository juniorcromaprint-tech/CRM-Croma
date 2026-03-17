import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock supabase client before importing service
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';
import {
  listarSetores,
  listarOpsAtivas,
  listarCapacidadeSetores,
  calcularKpis,
  moverOpParaSetor,
  atualizarStatusOp,
  listarRoutingRules,
} from '../pcp.service';

// Helper to build a chainable mock that resolves with { data, error }
function buildChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const resolve = () => Promise.resolve({ data, error, count: Array.isArray(data) ? (data as unknown[]).length : null });
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.order = vi.fn(() => resolve());
  chain.update = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.single = vi.fn(() => resolve());
  chain.maybeSingle = vi.fn(() => resolve());
  // Make the chain itself awaitable (for calls like .update().eq() without terminal)
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    resolve().then(onFulfilled, onRejected);
  return chain;
}

// Specific chain for count queries (select with head:true)
function buildCountChain(count: number) {
  const chain: Record<string, unknown> = {};
  const resolve = () => Promise.resolve({ data: null, error: null, count });
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => resolve());
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    resolve().then(onFulfilled, onRejected);
  return chain;
}

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// listarSetores
// ---------------------------------------------------------------------------
describe('listarSetores', () => {
  it('retorna lista de setores ativos', async () => {
    const setores = [
      { id: '1', nome: 'Impressão', codigo: 'IMP', cor: '#FF0000', ordem: 1, ativo: true, capacidade_diaria_min: 480 },
    ];
    mockFrom.mockReturnValueOnce(buildChain(setores));

    const result = await listarSetores();

    expect(mockFrom).toHaveBeenCalledWith('setores_producao');
    expect(result).toEqual(setores);
  });

  it('retorna array vazio quando não há setores', async () => {
    mockFrom.mockReturnValueOnce(buildChain(null));

    const result = await listarSetores();

    expect(result).toEqual([]);
  });

  it('lança erro quando supabase retorna error', async () => {
    const chain = buildChain(null, { message: 'DB error' });
    // order must return the error
    (chain.order as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValueOnce(chain);

    await expect(listarSetores()).rejects.toThrow('DB error');
  });
});

// ---------------------------------------------------------------------------
// listarOpsAtivas
// ---------------------------------------------------------------------------
describe('listarOpsAtivas', () => {
  it('retorna OPs ativas da view', async () => {
    const ops = [
      { id: 'op-1', numero: 'OP-001', status: 'em_producao', prioridade: 5, atrasada: false, dias_atraso: 0 },
      { id: 'op-2', numero: 'OP-002', status: 'em_fila', prioridade: 3, atrasada: true, dias_atraso: 2 },
    ];
    mockFrom.mockReturnValueOnce(buildChain(ops));

    const result = await listarOpsAtivas();

    expect(mockFrom).toHaveBeenCalledWith('v_pcp_ops_ativas');
    expect(result).toHaveLength(2);
    expect(result[0].numero).toBe('OP-001');
  });

  it('retorna array vazio quando não há OPs', async () => {
    mockFrom.mockReturnValueOnce(buildChain([]));

    const result = await listarOpsAtivas();

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// calcularKpis — core logic tests
// ---------------------------------------------------------------------------
describe('calcularKpis', () => {
  it('retorna KPIs zerados quando não há OPs nem capacidade', async () => {
    // listarOpsAtivas -> v_pcp_ops_ativas
    mockFrom.mockReturnValueOnce(buildChain([]));
    // listarCapacidadeSetores -> v_pcp_capacidade_setor
    mockFrom.mockReturnValueOnce(buildChain([]));
    // concluidas_hoje count query -> ordens_producao
    mockFrom.mockReturnValueOnce(buildCountChain(0));

    const kpis = await calcularKpis();

    expect(kpis.total_ops_ativas).toBe(0);
    expect(kpis.ops_atrasadas).toBe(0);
    expect(kpis.ops_em_producao).toBe(0);
    expect(kpis.concluidas_hoje).toBe(0);
    expect(kpis.capacidade_media_pct).toBe(0);
  });

  it('conta corretamente ops_atrasadas', async () => {
    const ops = [
      { id: 'op-1', status: 'em_producao', atrasada: true, prioridade: 5 },
      { id: 'op-2', status: 'em_fila', atrasada: true, prioridade: 3 },
      { id: 'op-3', status: 'em_producao', atrasada: false, prioridade: 4 },
    ];
    mockFrom.mockReturnValueOnce(buildChain(ops));
    mockFrom.mockReturnValueOnce(buildChain([]));
    mockFrom.mockReturnValueOnce(buildCountChain(1));

    const kpis = await calcularKpis();

    expect(kpis.total_ops_ativas).toBe(3);
    expect(kpis.ops_atrasadas).toBe(2);
    expect(kpis.concluidas_hoje).toBe(1);
  });

  it('conta corretamente ops_em_producao', async () => {
    const ops = [
      { id: 'op-1', status: 'em_producao', atrasada: false, prioridade: 5 },
      { id: 'op-2', status: 'em_fila', atrasada: false, prioridade: 3 },
      { id: 'op-3', status: 'em_producao', atrasada: false, prioridade: 4 },
    ];
    mockFrom.mockReturnValueOnce(buildChain(ops));
    mockFrom.mockReturnValueOnce(buildChain([]));
    mockFrom.mockReturnValueOnce(buildCountChain(0));

    const kpis = await calcularKpis();

    expect(kpis.ops_em_producao).toBe(2);
  });

  it('calcula capacidade_media_pct como média dos setores', async () => {
    const ops: unknown[] = [];
    const cap = [
      { setor_id: 's1', setor_nome: 'Impressão', cor: '#FF0', utilizacao_pct: 80 },
      { setor_id: 's2', setor_nome: 'Acabamento', cor: '#0F0', utilizacao_pct: 40 },
    ];
    mockFrom.mockReturnValueOnce(buildChain(ops));
    mockFrom.mockReturnValueOnce(buildChain(cap));
    mockFrom.mockReturnValueOnce(buildCountChain(0));

    const kpis = await calcularKpis();

    // (80 + 40) / 2 = 60
    expect(kpis.capacidade_media_pct).toBe(60);
  });

  it('capacidade_media_pct arredonda corretamente', async () => {
    const ops: unknown[] = [];
    const cap = [
      { setor_id: 's1', utilizacao_pct: 70 },
      { setor_id: 's2', utilizacao_pct: 50 },
      { setor_id: 's3', utilizacao_pct: 45 },
    ];
    mockFrom.mockReturnValueOnce(buildChain(ops));
    mockFrom.mockReturnValueOnce(buildChain(cap));
    mockFrom.mockReturnValueOnce(buildCountChain(0));

    const kpis = await calcularKpis();

    // (70 + 50 + 45) / 3 = 55
    expect(kpis.capacidade_media_pct).toBe(55);
  });
});

// ---------------------------------------------------------------------------
// moverOpParaSetor
// ---------------------------------------------------------------------------
describe('moverOpParaSetor', () => {
  it('chama update em ordens_producao com setor_atual_id', async () => {
    const chain = buildChain(null);
    const updateMock = chain.update as ReturnType<typeof vi.fn>;
    updateMock.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce(chain);

    await moverOpParaSetor('op-123', 'setor-456');

    expect(mockFrom).toHaveBeenCalledWith('ordens_producao');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ setor_atual_id: 'setor-456' })
    );
  });

  it('aceita setor null (remove OP do setor)', async () => {
    const chain = buildChain(null);
    const updateMock = chain.update as ReturnType<typeof vi.fn>;
    updateMock.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce(chain);

    await expect(moverOpParaSetor('op-123', null)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// atualizarStatusOp
// ---------------------------------------------------------------------------
describe('atualizarStatusOp', () => {
  it('chama update com o status correto', async () => {
    const chain = buildChain(null);
    const updateMock = chain.update as ReturnType<typeof vi.fn>;
    updateMock.mockReturnValueOnce({
      eq: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    });
    mockFrom.mockReturnValueOnce(chain);

    await atualizarStatusOp('op-123', 'finalizado');

    expect(mockFrom).toHaveBeenCalledWith('ordens_producao');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'finalizado' })
    );
  });
});

// ---------------------------------------------------------------------------
// listarRoutingRules
// ---------------------------------------------------------------------------
describe('listarRoutingRules', () => {
  it('busca da tabela routing_rules', async () => {
    const rules = [
      { id: 'r1', nome: 'Banner grande → Impressão', ativo: true, prioridade: 10 },
    ];
    mockFrom.mockReturnValueOnce(buildChain(rules));

    const result = await listarRoutingRules();

    expect(mockFrom).toHaveBeenCalledWith('routing_rules');
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe('Banner grande → Impressão');
  });

  it('retorna array vazio quando não há regras', async () => {
    mockFrom.mockReturnValueOnce(buildChain(null));

    const result = await listarRoutingRules();

    expect(result).toEqual([]);
  });
});

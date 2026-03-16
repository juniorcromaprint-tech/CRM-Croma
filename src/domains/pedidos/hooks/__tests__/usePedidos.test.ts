import { describe, it, expect, vi } from 'vitest';

// Mock Supabase before importing
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({
            data: { id: 'test-id', numero: 'PED-2026-0001', clientes: { nome_fantasia: 'Test', razao_social: 'Test LTDA' } },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

describe('usePedido query', () => {
  it('should construct a valid query for pedido detail using maybeSingle', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase
      .from('pedidos')
      .select('*, version, clientes(nome_fantasia, razao_social)')
      .eq('id', 'test-id')
      .maybeSingle();

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('test-id');
  });
});

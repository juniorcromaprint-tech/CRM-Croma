/**
 * Testes do AuthContext — verificação de roles e permissões
 * Rodar: `npx vitest run src/contexts/__tests__/useAuth.test.tsx`
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../AuthContext';

// ---------------------------------------------------------------------------
// Mock do Supabase — evita erros de variáveis de ambiente ausentes
// vi.hoisted garante que as variáveis existam antes do hoist de vi.mock
// ---------------------------------------------------------------------------

const { mockGetSession, mockOnAuthStateChange, mockSignOut, mockFrom } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignOut: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
    from: mockFrom,
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

function makeUser(id = 'user-123') {
  return { id, email: 'test@croma.com' };
}

function makeSession(userId = 'user-123') {
  return { user: makeUser(userId), access_token: 'token-abc' };
}

function makeProfile(role: string | null, userId = 'user-123') {
  return { id: userId, first_name: 'Test', last_name: 'User', role };
}

/** Configura mocks para simular usuário autenticado com perfil */
function setupAuthenticatedUser(role: string | null, userId = 'user-123') {
  const session = makeSession(userId);

  mockGetSession.mockResolvedValue({ data: { session } });
  mockOnAuthStateChange.mockImplementation((_event: unknown, _callback: unknown) => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  }));

  const mockSingle = vi.fn().mockResolvedValue({
    data: makeProfile(role, userId),
    error: null,
  });
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

/** Configura mocks para simular usuário não autenticado */
function setupUnauthenticatedUser() {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockImplementation((_event: unknown, _callback: unknown) => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  }));
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Estado não autenticado ─────────────────────────────────────────────

  describe('estado não autenticado', () => {
    it('deve expor user como null quando não há sessão', async () => {
      setupUnauthenticatedUser();

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.profile).toBeNull();
    });

    it('deve expor isLoading como false após resolução sem sessão', async () => {
      setupUnauthenticatedUser();

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isLoading).toBe(false);
    });

    it('sem sessão deve negar permissão para módulo admin (fallback = comercial)', async () => {
      setupUnauthenticatedUser();

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Sem perfil → effectiveRole = 'comercial' → sem acesso a admin
      expect(result.current.can('admin', 'ver')).toBe(false);
      expect(result.current.can('admin', 'criar')).toBe(false);
      expect(result.current.can('admin', 'excluir')).toBe(false);
    });

    it('accessibleModules sem sessão deve conter apenas módulos de comercial', async () => {
      setupUnauthenticatedUser();

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Fallback 'comercial' pode ver: comercial, clientes, pedidos
      expect(result.current.accessibleModules).toContain('comercial');
      expect(result.current.accessibleModules).toContain('clientes');
      expect(result.current.accessibleModules).not.toContain('admin');
      expect(result.current.accessibleModules).not.toContain('financeiro');
    });
  });

  // ── 2. Role admin — acesso total ──────────────────────────────────────────

  describe('role admin', () => {
    it('deve permitir todas as ações no módulo admin', async () => {
      setupAuthenticatedUser('admin');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.can('admin', 'ver')).toBe(true);
      expect(result.current.can('admin', 'criar')).toBe(true);
      expect(result.current.can('admin', 'editar')).toBe(true);
      expect(result.current.can('admin', 'excluir')).toBe(true);
      expect(result.current.can('admin', 'aprovar')).toBe(true);
      expect(result.current.can('admin', 'exportar')).toBe(true);
    });

    it('deve permitir todas as ações em módulos financeiro e fiscal', async () => {
      setupAuthenticatedUser('admin');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.can('financeiro', 'excluir')).toBe(true);
      expect(result.current.can('fiscal', 'aprovar')).toBe(true);
    });

    it('deve ter acesso a todos os módulos', async () => {
      setupAuthenticatedUser('admin');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const modules = result.current.accessibleModules ?? [];
      expect(modules).toContain('admin');
      expect(modules).toContain('financeiro');
      expect(modules).toContain('producao');
      expect(modules).toContain('fiscal');
      expect(modules).toContain('instalacao');
    });

    it('deve expor profile com role admin corretamente', async () => {
      setupAuthenticatedUser('admin');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.profile?.role).toBe('admin');
    });
  });

  // ── 3. Role comercial — acesso restrito ───────────────────────────────────

  describe('role comercial', () => {
    it('NÃO deve ter permissão para nenhuma ação no módulo admin', async () => {
      setupAuthenticatedUser('comercial');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.can('admin', 'ver')).toBe(false);
      expect(result.current.can('admin', 'criar')).toBe(false);
      expect(result.current.can('admin', 'editar')).toBe(false);
      expect(result.current.can('admin', 'excluir')).toBe(false);
      expect(result.current.can('admin', 'aprovar')).toBe(false);
      expect(result.current.can('admin', 'exportar')).toBe(false);
    });

    it('NÃO deve ter acesso ao módulo financeiro (excluir/aprovar)', async () => {
      setupAuthenticatedUser('comercial');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.can('financeiro', 'ver')).toBe(false);
      expect(result.current.can('financeiro', 'criar')).toBe(false);
      expect(result.current.can('financeiro', 'excluir')).toBe(false);
      expect(result.current.can('financeiro', 'aprovar')).toBe(false);
    });

    it('deve ter permissão para ver/criar/editar em módulo comercial', async () => {
      setupAuthenticatedUser('comercial');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.can('comercial', 'ver')).toBe(true);
      expect(result.current.can('comercial', 'criar')).toBe(true);
      expect(result.current.can('comercial', 'editar')).toBe(true);
    });

    it('NÃO deve poder excluir ou aprovar em módulo comercial', async () => {
      setupAuthenticatedUser('comercial');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.can('comercial', 'excluir')).toBe(false);
      expect(result.current.can('comercial', 'aprovar')).toBe(false);
    });

    it('NÃO deve ter admin nos módulos acessíveis', async () => {
      setupAuthenticatedUser('comercial');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.accessibleModules).not.toContain('admin');
      expect(result.current.accessibleModules).not.toContain('producao');
      expect(result.current.accessibleModules).not.toContain('financeiro');
    });
  });

  // ── 4. signOut ────────────────────────────────────────────────────────────

  describe('signOut', () => {
    it('deve chamar supabase.auth.signOut ao chamar signOut()', async () => {
      setupUnauthenticatedUser();
      mockSignOut.mockResolvedValue({});

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSignOut).toHaveBeenCalledOnce();
    });
  });

  // ── 5. useAuth fora do Provider lança erro ────────────────────────────────

  describe('uso fora do Provider', () => {
    it('deve lançar erro se useAuth for usado fora do AuthProvider', () => {
      // Suprime console.error do React durante o teste de erro esperado
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth deve ser usado dentro de um AuthProvider');

      consoleSpy.mockRestore();
    });
  });
});

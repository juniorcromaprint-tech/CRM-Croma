import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { executeActions } from '../appliers/registry';
import '../appliers/registerAll'; // side-effect: register all appliers
import type { AIActionableResponse, ApplierResult } from '../types/ai.types';
import { showSuccess, showError } from '@/utils/toast';

interface UseAISidebarOptions {
  entityType: string;
  entityId: string;
  onActionsApplied?: () => void;
}

export function useAISidebar({ entityType, entityId, onActionsApplied }: UseAISidebarOptions) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [response, setResponse] = useState<AIActionableResponse | null>(null);

  const open = useCallback((data: AIActionableResponse) => {
    setResponse(data);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const applyActions = useCallback(
    async (actionIds: string[]): Promise<Map<string, ApplierResult>> => {
      if (!response || !user) return new Map();

      const actionsToApply = response.actions.filter((a) => actionIds.includes(a.id));

      const results = await executeActions(actionsToApply, {
        supabase,
        userId: user.id,
        entityId,
        entityType,
      });

      const successes = [...results.values()].filter((r) => r.success).length;
      const failures = [...results.values()].filter((r) => !r.success).length;

      if (successes > 0) {
        showSuccess(`${successes} ação(ões) aplicada(s) com sucesso`);
        onActionsApplied?.();
      }
      if (failures > 0) {
        showError(`${failures} ação(ões) falharam`);
      }

      return results;
    },
    [response, user, entityId, entityType, onActionsApplied]
  );

  return {
    isOpen,
    response,
    open,
    close,
    applyActions,
    setResponse,
  };
}

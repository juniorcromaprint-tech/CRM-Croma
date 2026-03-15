import type { AIActionType, AIAction, ApplierContext, ApplierResult, ApplierFn } from '../types/ai.types';

const applierRegistry = new Map<AIActionType, ApplierFn>();

export function registerApplier(type: AIActionType, fn: ApplierFn): void {
  applierRegistry.set(type, fn);
}

export async function executeAction(
  action: AIAction,
  context: ApplierContext
): Promise<ApplierResult> {
  const applier = applierRegistry.get(action.tipo);
  if (!applier) {
    return {
      success: false,
      message: `Tipo de ação desconhecido: ${action.tipo}`,
    };
  }

  try {
    return await applier(action, context);
  } catch (error) {
    return {
      success: false,
      message: `Erro ao aplicar ${action.tipo}: ${(error as Error).message}`,
    };
  }
}

export async function executeActions(
  actions: AIAction[],
  context: ApplierContext
): Promise<Map<string, ApplierResult>> {
  const results = new Map<string, ApplierResult>();
  for (const action of actions) {
    const result = await executeAction(action, context);
    results.set(action.id, result);
  }
  return results;
}

export function getRegisteredTypes(): AIActionType[] {
  return [...applierRegistry.keys()];
}

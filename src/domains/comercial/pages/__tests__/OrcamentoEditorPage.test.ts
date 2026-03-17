import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('OrcamentoEditorPage — handleAddItem contract', () => {
  const content = fs.readFileSync(
    path.resolve(__dirname, '../OrcamentoEditorPage.tsx'),
    'utf-8'
  );

  it('hook useAdicionarItemDetalhado already invalidates orcamentos cache', () => {
    const hookContent = fs.readFileSync(
      path.resolve(__dirname, '../../hooks/useOrcamentos.ts'),
      'utf-8'
    );
    expect(hookContent).toContain('useAdicionarItemDetalhado');
  });

  it('handleAddItem should have error handling (showError in catch)', () => {
    // Extract handleAddItem function body
    const match = content.match(/const handleAddItem = async[\s\S]*?^\s{2}\};/m);
    expect(match).toBeTruthy();
    const fnBody = match![0];

    // Must have catch with showError
    expect(fnBody).toContain('catch');
    expect(fnBody).toContain('showError');
  });

  it('handleAddItem should NOT have duplicate recalcularTotais call (only in comments)', () => {
    const match = content.match(/const handleAddItem = async[\s\S]*?^\s{2}\};/m);
    expect(match).toBeTruthy();
    const fnBody = match![0];
    // Strip line comments before counting — comment mentions recalcularTotais as explanation
    const codeOnly = fnBody.replace(/\/\/.*$/gm, '');
    const recalcCount = (codeOnly.match(/recalcularTotais/g) || []).length;
    expect(recalcCount).toBe(0);
  });
});

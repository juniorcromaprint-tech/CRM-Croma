import { describe, it, expect } from 'vitest';

describe('exportPdf module', () => {
  it('should import without require() errors', async () => {
    const mod = await import('../exportPdf');
    expect(mod).toBeDefined();
    expect(typeof mod.exportPdf).toBe('function');
  });
});

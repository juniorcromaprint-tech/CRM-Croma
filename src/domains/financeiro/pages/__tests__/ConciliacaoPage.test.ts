import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('ConciliacaoPage — render loop fix', () => {
  const content = fs.readFileSync(
    path.resolve(__dirname, '../ConciliacaoPage.tsx'),
    'utf-8'
  );

  it('should use useEffect (not useMemo) to sync lancamentosRaw into state', () => {
    // Must import useEffect
    expect(content).toContain('useEffect');

    // The sync block must use useEffect
    expect(content).toMatch(/useEffect\(\(\) => \{[\s\S]*?setLancamentos\(lancamentosRaw/);
  });

  it('should NOT use useMemo calling setState (render loop pattern)', () => {
    // The dangerous pattern: useMemo(() => { setLancamentos(...)
    const dangerousPattern = /useMemo\(\(\) => \{[\s\S]*?setLancamentos\(/;
    expect(content).not.toMatch(dangerousPattern);
  });
});

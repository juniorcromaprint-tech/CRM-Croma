import { describe, it, expect } from 'vitest';
import { COMPONENTE_CORES, COMPONENTE_LABELS, type ComponenteCusto } from '../precificacao.types';

const COMPONENTES: ComponenteCusto[] = ['MP', 'CF', 'MO', 'TF', 'CI', 'CE', 'TB', 'TR', 'DT', 'ML'];

describe('COMPONENTE_CORES', () => {
  it('tem uma cor para cada um dos 10 componentes', () => {
    COMPONENTES.forEach(c => {
      expect(COMPONENTE_CORES[c]).toBeDefined();
      expect(COMPONENTE_CORES[c]).toMatch(/^bg-/);
    });
  });
});

describe('COMPONENTE_LABELS', () => {
  it('tem um label em português para cada componente', () => {
    COMPONENTES.forEach(c => {
      expect(COMPONENTE_LABELS[c]).toBeDefined();
      expect(COMPONENTE_LABELS[c].length).toBeGreaterThan(2);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AISidebar from '../AISidebar';
import type { AIActionableResponse } from '../../types/ai.types';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const mockResponse: AIActionableResponse = {
  summary: '3 sugestões encontradas',
  kpis: { margem_atual: 18, margem_sugerida: 35 },
  actions: [
    {
      id: 'act_1', tipo: 'preco', severidade: 'critica',
      titulo: 'Margem baixa', descricao: 'Margem de 18%',
      campo_alvo: 'itens', valor_atual: { preco: 500 }, valor_sugerido: { preco: 680 },
      impacto: '+R$ 180', aplicavel: true,
    },
  ],
  model_used: 'openai/gpt-4.1-mini',
  tokens_used: 1200,
};

describe('AISidebar', () => {
  it('renders title and summary when open', () => {
    render(
      <AISidebar
        isOpen={true}
        response={mockResponse}
        isLoading={false}
        onClose={() => {}}
        onApply={async () => new Map()}
        onReanalyze={() => {}}
        isReanalyzing={false}
      />,
      { wrapper }
    );
    expect(screen.getByText('Croma AI')).toBeTruthy();
    expect(screen.getByText('3 sugestões encontradas')).toBeTruthy();
  });

  it('renders action cards', () => {
    render(
      <AISidebar
        isOpen={true}
        response={mockResponse}
        isLoading={false}
        onClose={() => {}}
        onApply={async () => new Map()}
        onReanalyze={() => {}}
        isReanalyzing={false}
      />,
      { wrapper }
    );
    expect(screen.getByText('Margem baixa')).toBeTruthy();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <AISidebar
        isOpen={false}
        response={null}
        isLoading={false}
        onClose={() => {}}
        onApply={async () => new Map()}
        onReanalyze={() => {}}
        isReanalyzing={false}
      />,
      { wrapper }
    );
    expect(container.querySelector('[data-testid="ai-sidebar"]')).toBeNull();
  });
});

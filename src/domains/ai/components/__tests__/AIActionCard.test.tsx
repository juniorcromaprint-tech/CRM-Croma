import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIActionCard from '../AIActionCard';
import type { AIAction } from '../../types/ai.types';

const mockAction: AIAction = {
  id: 'act_1',
  tipo: 'preco',
  severidade: 'critica',
  titulo: 'Margem baixa',
  descricao: 'Margem de 18% está abaixo do mínimo',
  campo_alvo: 'itens',
  valor_atual: { item_id: '1', preco: 500 },
  valor_sugerido: { item_id: '1', preco: 680 },
  impacto: '+R$ 180',
  aplicavel: true,
};

describe('AIActionCard', () => {
  it('renders action title and description', () => {
    render(<AIActionCard action={mockAction} selected={false} status="idle" onToggle={() => {}} />);
    expect(screen.getByText('Margem baixa')).toBeTruthy();
    expect(screen.getByText('Margem de 18% está abaixo do mínimo')).toBeTruthy();
  });

  it('shows impact badge', () => {
    render(<AIActionCard action={mockAction} selected={false} status="idle" onToggle={() => {}} />);
    expect(screen.getByText('+R$ 180')).toBeTruthy();
  });

  it('calls onToggle when checkbox clicked', () => {
    const onToggle = vi.fn();
    render(<AIActionCard action={mockAction} selected={false} status="idle" onToggle={onToggle} />);
    // Radix Checkbox renders with role="checkbox"
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('act_1');
  });

  it('disables checkbox when status is applied', () => {
    render(<AIActionCard action={mockAction} selected={true} status="applied" onToggle={() => {}} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveProperty('disabled', true);
  });
});

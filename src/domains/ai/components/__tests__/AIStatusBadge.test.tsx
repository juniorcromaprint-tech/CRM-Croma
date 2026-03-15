import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AIStatusBadge from '../AIStatusBadge';

describe('AIStatusBadge', () => {
  it('renders idle state with no visible badge', () => {
    const { container } = render(<AIStatusBadge status="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders applying state with spinner', () => {
    render(<AIStatusBadge status="applying" />);
    expect(screen.getByText('Aplicando...')).toBeTruthy();
  });

  it('renders applied state with check', () => {
    render(<AIStatusBadge status="applied" />);
    expect(screen.getByText('Aplicado')).toBeTruthy();
  });

  it('renders error state with message', () => {
    render(<AIStatusBadge status="error" message="Falha no banco" />);
    expect(screen.getByText('Falha no banco')).toBeTruthy();
  });
});

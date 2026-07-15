import { render, screen, within } from '@testing-library/react';
import InterconsultasEmptyState from './interconsultas-empty-state.component';

describe('InterconsultasEmptyState', () => {
  it('renders a consistent, accessible empty state for every tray', () => {
    render(
      <InterconsultasEmptyState
        title="No hay interconsultas para mostrar"
        helperText="Comprobar los filtros anteriores"
      />,
    );

    const status = screen.getByRole('status');

    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(
      within(status).getByRole('heading', { level: 3, name: 'No hay interconsultas para mostrar' }),
    ).toBeInTheDocument();
    expect(within(status).getByText('Comprobar los filtros anteriores')).toBeInTheDocument();
  });
});

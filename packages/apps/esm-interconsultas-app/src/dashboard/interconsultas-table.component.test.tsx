import { render, screen } from '@testing-library/react';
import { useInterconsultas } from '../interconsultas.resource';
import InterconsultasTable from './interconsultas-table.component';

const mockUseInterconsultas = vi.mocked(useInterconsultas);

vi.mock('../interconsultas.resource', () => ({
  deriveStatus: vi.fn(),
  useInterconsultas: vi.fn(),
}));

describe('InterconsultasTable', () => {
  it('uses the shared empty-state card when a tray has no interconsultations', () => {
    mockUseInterconsultas.mockReturnValue({
      interconsultas: [],
      isLoading: false,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(async () => undefined),
    });

    render(<InterconsultasTable filter="REQUESTED" />);

    expect(mockUseInterconsultas).toHaveBeenCalledWith('REQUESTED');
    expect(screen.getByRole('heading', { level: 3, name: 'No hay interconsultas para mostrar' })).toBeInTheDocument();
    expect(screen.getByText('Comprobar los filtros anteriores')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Paciente' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

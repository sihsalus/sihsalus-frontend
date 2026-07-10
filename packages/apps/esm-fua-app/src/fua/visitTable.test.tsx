import { showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  FuaGenerationError,
  generateFuaFromVisit,
  generateFuasFromVisits,
  useVisits,
} from '../hooks/useVisit';

import VisitTable from './visitTable';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showSnackbar: vi.fn(),
}));

vi.mock('@sihsalus/esm-rbac', async () => {
  const React = await import('react');

  return {
    RequirePrivilege: ({ children }: { children?: ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

vi.mock('../hooks/useVisit', async () => ({
  ...(await vi.importActual('../hooks/useVisit')),
  generateFuaFromVisit: vi.fn(),
  generateFuasFromVisits: vi.fn(),
  useVisits: vi.fn(),
}));

const mockGenerateFuaFromVisit = vi.mocked(generateFuaFromVisit);
const mockGenerateFuasFromVisits = vi.mocked(generateFuasFromVisits);
const mockUseVisits = vi.mocked(useVisits);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockMutate = vi.fn();

describe('VisitTable FUA generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVisits.mockReturnValue({
      visits: [
        {
          uuid: 'visit-uuid',
          patient: { person: { names: [{ display: 'Paciente de prueba' }] } },
          location: { display: 'Consulta externa' },
          startDatetime: '2026-07-10T10:00:00.000Z',
        },
      ],
      isLoading: false,
      isError: null,
      isValidating: false,
      mutate: mockMutate,
    });
    mockGenerateFuasFromVisits.mockResolvedValue({ successful: 0, failed: 0 });
  });

  it('keeps the user on the table and restores the button after a 401 generation failure', async () => {
    let rejectGeneration: (error: FuaGenerationError) => void;
    mockGenerateFuaFromVisit.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectGeneration = reject;
      }),
    );

    render(<VisitTable />);

    const generateButton = screen.getByRole('button', { name: 'Generar FUA' });
    fireEvent.click(generateButton);
    expect(generateButton).toBeDisabled();

    if (!rejectGeneration) {
      throw new Error('The generation request was not started');
    }
    rejectGeneration(new FuaGenerationError(401, { error: 'Contract mismatch' }));

    await waitFor(() => expect(generateButton).toBeEnabled());
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'error',
      title: 'Ocurrió un error al generar el FUA',
      subtitle:
        'El servidor rechazó la generación del FUA. Su sesión permanece activa; inténtelo nuevamente o contacte al administrador.',
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });
});

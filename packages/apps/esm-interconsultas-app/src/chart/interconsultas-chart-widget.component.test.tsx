import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserHasAccess } from '@openmrs/esm-framework';
import type { ReactNode } from 'react';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { useInterconsultaResponse, usePatientInterconsultas } from '../interconsultas.resource';
import InterconsultasChartWidget from './interconsultas-chart-widget.component';

vi.mock('../interconsultas.resource', async () => {
  const actual = await vi.importActual('../interconsultas.resource');

  return {
    ...actual,
    useInterconsultaResponse: vi.fn(),
    usePatientInterconsultas: vi.fn(),
  };
});

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const actual = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...actual,
    useLaunchWorkspaceRequiringVisit: vi.fn(),
  };
});

const order = {
  uuid: 'order-1',
  dateActivated: '2026-08-10T10:00:00.000Z',
  concept: { uuid: 'service-1', display: 'Cardiología' },
  orderer: { uuid: 'provider-1', display: 'Dra. Torres' },
  instructions: 'Evaluación especializada',
  urgency: 'ROUTINE',
  fulfillerStatus: 'RECEIVED',
} as never;

describe('InterconsultasChartWidget privileges', () => {
  const launchWorkspace = vi.fn();

  beforeEach(() => {
    launchWorkspace.mockClear();
    vi.mocked(useLaunchWorkspaceRequiringVisit).mockReturnValue(launchWorkspace);
    vi.mocked(usePatientInterconsultas).mockReturnValue({
      interconsultas: [order],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    vi.mocked(useInterconsultaResponse).mockReturnValue({
      responseObs: [],
      isLoading: false,
      error: undefined,
    } as never);
  });

  it('shows the interconsultation list but not the request button with read-only access', () => {
    vi.mocked(UserHasAccess).mockImplementation(({ fallback }: { fallback?: ReactNode }) => fallback);

    render(<InterconsultasChartWidget patientUuid="patient-1" />);

    expect(screen.getByRole('button', { name: /Cardiología/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solicitar interconsulta' })).not.toBeInTheDocument();
    expect(vi.mocked(UserHasAccess).mock.calls[0][0]).toEqual(
      expect.objectContaining({ privilege: 'app:hoja.clinica.interconsultas.editar' }),
    );
  });

  it('shows and enables the request button with edit access', async () => {
    vi.mocked(UserHasAccess).mockImplementation(({ children }: { children?: ReactNode }) => children);
    const user = userEvent.setup();

    render(<InterconsultasChartWidget patientUuid="patient-1" />);
    await user.click(screen.getByRole('button', { name: 'Solicitar interconsulta' }));

    expect(launchWorkspace).toHaveBeenCalledOnce();
  });
});

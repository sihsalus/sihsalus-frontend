import {
  type FetchResponse,
  openmrsFetch,
  showSnackbar,
  updateVisit,
  useVisit,
  type Visit,
} from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockCurrentVisit } from 'test-utils';

import EndVisitDialog from './end-visit-dialog.component';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: vi.fn(),
}));

const endVisitPayload = {
  stopDatetime: expect.any(Date),
};

const mockCloseModal = vi.fn();
const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockMutate = vi.fn();
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseVisit = vi.mocked(useVisit);
const mockUpdateVisit = vi.mocked(updateVisit);

describe('End visit dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVisit.mockReturnValue({
      activeVisit: mockCurrentVisit,
      currentVisit: mockCurrentVisit,
      currentVisitIsRetrospective: false,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });
  });

  test('only shows cancel and end visit with FUA actions', () => {
    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finalizar consulta y generar fua/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close visit/i })).not.toBeInTheDocument();
  });

  test('ends the visit and generates FUA when required visit summary fields are present', async () => {
    const user = userEvent.setup();
    let resolveGenerateFua!: (value: FetchResponse) => void;
    const generateFuaPromise = new Promise<FetchResponse>((resolve) => {
      resolveGenerateFua = resolve;
    });

    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              diagnoses: [{ rank: 1, voided: false }],
              obs: [{ formFieldPath: 'codigo-prestacional', value: '056' }],
            },
          ],
        },
      } as FetchResponse)
      .mockReturnValueOnce(generateFuaPromise);
    mockUpdateVisit.mockResolvedValue({
      status: 200,
      data: {
        visitType: {
          display: 'Facility Visit',
        },
      },
    } as unknown as FetchResponse<Visit>);

    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    expect(
      screen.getByRole('heading', { name: /are you sure you want to end this active visit?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you can add additional encounters to this visit in the visit summary/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /finalizar consulta y generar fua/i }));

    await waitFor(() =>
      expect(updateVisit).toHaveBeenCalledWith(mockCurrentVisit.uuid, endVisitPayload, expect.anything()),
    );
    expect(screen.getAllByText(/generando fua/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    await act(async () => {
      resolveGenerateFua({ data: {} } as FetchResponse);
      await generateFuaPromise;
    });

    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      subtitle: 'Visit ended and FUA Generated',
      kind: 'success',
      title: 'Visit ended and FUA Generated',
    });
  });

  test('opens visit summary and does not end the visit when required fields are missing', async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            diagnoses: [],
            obs: [{ formFieldPath: 'codigo-prestacional', value: '' }],
          },
        ],
      },
    } as FetchResponse);

    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    await user.click(screen.getByRole('button', { name: /finalizar consulta y generar fua/i }));

    await waitFor(() =>
      expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('visit-notes-form-workspace', {
        formContext: 'creating',
        openedFrom: 'end-visit-dialog',
      }),
    );
    expect(mockCloseModal).toHaveBeenCalled();
    expect(updateVisit).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      title: 'Missing required visit summary data',
      kind: 'warning',
      isLowContrast: true,
      subtitle: 'Complete Primary diagnosis, Codigo Prestacional in Resumen de consulta before finalizing the visit.',
    });
  });

  test('displays an error snackbar if there was a problem ending a visit or generating FUA', async () => {
    const user = userEvent.setup();

    const error = {
      message: 'Internal error message',
      response: {
        status: 500,
        statusText: 'Internal server error',
      },
    };

    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            diagnoses: [{ rank: 1, voided: false }],
            obs: [{ formFieldPath: 'codigo-prestacional', value: '056' }],
          },
        ],
      },
    } as FetchResponse);
    mockUpdateVisit.mockRejectedValue(error);

    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    expect(
      screen.getByText(/you can add additional encounters to this visit in the visit summary/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /finalizar consulta y generar fua/i }));

    await waitFor(() =>
      expect(updateVisit).toHaveBeenCalledWith(mockCurrentVisit.uuid, endVisitPayload, expect.anything()),
    );
    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        subtitle: 'Internal error message',
        kind: 'error',
        title: 'Error ending visit or generating FUA',
        isLowContrast: false,
      }),
    );
  });
});

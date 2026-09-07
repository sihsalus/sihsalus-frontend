import { type FetchResponse, openmrsFetch, showSnackbar, useVisit } from '@openmrs/esm-framework';
import { fetchVisitInsurance, getSisFinancingState, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockCurrentVisit } from 'test-utils';

import EndVisitDialog from './end-visit-dialog.component';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  fetchVisitInsurance: vi.fn(),
  getSisFinancingState: vi.fn(),
  launchPatientWorkspace: vi.fn(),
}));

const mockCloseModal = vi.fn();
const mockFetchVisitInsurance = vi.mocked(fetchVisitInsurance);
const mockGetSisFinancingState = vi.mocked(getSisFinancingState);
const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockMutate = vi.fn();
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseVisit = vi.mocked(useVisit);
const primaryDiagnosisWithCie10 = {
  rank: 1,
  voided: false,
  diagnosis: {
    coded: {
      names: [{ display: 'K710', conceptNameType: 'SHORT' }],
    },
  },
};

describe('End visit dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchVisitInsurance.mockResolvedValue({
      financiadorUuid: 'sis-concept',
      insuranceNumber: 'SIS-123',
      accreditationStatusUuid: 'vigente-concept',
      accreditationCheckedAt: '2026-08-17',
    });
    mockGetSisFinancingState.mockReturnValue('active');
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

  test('shows a neutral end-visit action while eligibility is verified on submit', () => {
    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finalizar consulta$/i })).toBeInTheDocument();
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
              diagnoses: [primaryDiagnosisWithCie10],
              obs: [{ formFieldPath: 'codigo-prestacional', value: '056' }],
            },
          ],
        },
      } as FetchResponse)
      .mockResolvedValueOnce({
        status: 200,
        data: {
          visitType: {
            display: 'Facility Visit',
          },
        },
      } as FetchResponse)
      .mockReturnValueOnce(generateFuaPromise);

    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    expect(
      screen.getByRole('heading', {
        name: /are you sure you want to end this active visit?/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you can add additional encounters to this visit in the visit summary/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /finalizar consulta$/i }));

    await waitFor(() =>
      expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
        2,
        '/ws/rest/v1/clinicalvisitclosure',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            visitUuid: mockCurrentVisit.uuid,
            stopDatetime: expect.any(String),
          }),
        }),
      ),
    );
    expect(screen.getAllByText(/finalizando consulta/i).length).toBeGreaterThan(0);
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

    await user.click(screen.getByRole('button', { name: /finalizar consulta$/i }));

    await waitFor(() =>
      expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('visit-notes-form-workspace', {
        formContext: 'creating',
        openedFrom: 'end-visit-dialog',
      }),
    );
    expect(mockCloseModal).toHaveBeenCalled();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      title: 'Missing required visit summary data',
      kind: 'warning',
      isLowContrast: true,
      subtitle: 'Complete Primary diagnosis, Codigo Prestacional in Resumen de consulta before finalizing the visit.',
    });
  });

  test('ends a non-SIS visit without validating or generating a FUA', async () => {
    const user = userEvent.setup();
    mockGetSisFinancingState.mockReturnValue('notApplicable');
    mockOpenmrsFetch.mockResolvedValueOnce({
      status: 200,
      data: {},
    } as FetchResponse);

    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    await user.click(screen.getByRole('button', { name: /finalizar consulta$/i }));

    await waitFor(() =>
      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        '/ws/rest/v1/clinicalvisitclosure',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenmrsFetch).not.toHaveBeenCalledWith(expect.stringContaining('/ws/module/fua'), expect.anything());
    expect(mockLaunchPatientWorkspace).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'success',
      subtitle: 'Visit ended',
      title: 'Visit ended',
    });
  });

  test('does not accept a primary diagnosis without a catalogued CIE-10 code', async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'encounter-1',
            diagnoses: [{ rank: 1, voided: false, diagnosis: { coded: { names: [] } } }],
            obs: [{ formFieldPath: 'codigo-prestacional', value: '056' }],
          },
        ],
      },
    } as FetchResponse);

    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    await user.click(screen.getByRole('button', { name: /finalizar consulta$/i }));

    await waitFor(() => expect(mockLaunchPatientWorkspace).toHaveBeenCalled());
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        subtitle: 'Complete Primary diagnosis in Resumen de consulta before finalizing the visit.',
      }),
    );
  });

  test('validates encounters beyond the first page before ending a SIS visit', async () => {
    const user = userEvent.setup();
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      uuid: `encounter-${index}`,
      diagnoses: [],
      obs: [],
    }));

    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: { results: firstPage, totalCount: 101 },
      } as FetchResponse)
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              uuid: 'encounter-100',
              diagnoses: [primaryDiagnosisWithCie10],
              obs: [{ formFieldPath: 'codigo-prestacional', value: '056' }],
            },
          ],
          totalCount: 101,
        },
      } as FetchResponse)
      .mockResolvedValueOnce({ status: 200, data: {} } as FetchResponse)
      .mockResolvedValueOnce({ data: {} } as FetchResponse);

    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    await user.click(screen.getByRole('button', { name: /finalizar consulta$/i }));

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, expect.stringContaining('startIndex=100')));
    await waitFor(() =>
      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        '/ws/rest/v1/clinicalvisitclosure',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  test('displays an error snackbar without claiming success if ending the visit fails', async () => {
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
            diagnoses: [primaryDiagnosisWithCie10],
            obs: [{ formFieldPath: 'codigo-prestacional', value: '056' }],
          },
        ],
      },
    } as FetchResponse);
    mockOpenmrsFetch.mockRejectedValueOnce(error);

    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    expect(
      screen.getByText(/you can add additional encounters to this visit in the visit summary/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /finalizar consulta$/i }));

    await waitFor(() =>
      expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
        2,
        '/ws/rest/v1/clinicalvisitclosure',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            visitUuid: mockCurrentVisit.uuid,
            stopDatetime: expect.any(String),
          }),
        }),
      ),
    );
    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        subtitle: 'The visit could not be confirmed as ended. Verify its status before retrying.',
        kind: 'error',
        title: 'Error ending visit',
        isLowContrast: false,
      }),
    );
  });

  test('asks the user to verify the FUA when generation fails after the visit was closed', async () => {
    const user = userEvent.setup();
    const fuaError = {
      message: 'FUA module unavailable',
      response: {
        status: 503,
        statusText: 'Service unavailable',
      },
    };

    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              diagnoses: [primaryDiagnosisWithCie10],
              obs: [{ formFieldPath: 'codigo-prestacional', value: '056' }],
            },
          ],
        },
      } as FetchResponse)
      .mockResolvedValueOnce({ status: 200, data: {} } as FetchResponse)
      .mockRejectedValueOnce(fuaError);

    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    await user.click(screen.getByRole('button', { name: /finalizar consulta$/i }));

    await waitFor(() =>
      expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
        3,
        `/ws/module/fua/generateFromVisit/${encodeURIComponent(mockCurrentVisit.uuid)}`,
        { method: 'POST' },
      ),
    );
    expect(mockMutate).toHaveBeenCalled();
    expect(mockCloseModal).toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'warning',
      subtitle:
        'The visit was closed, but FUA generation could not be confirmed. Check FUA Management before retrying.',
      title: 'Visit ended; verify FUA',
    });
  });
});

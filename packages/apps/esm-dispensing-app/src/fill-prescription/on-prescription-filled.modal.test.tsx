import { showSnackbar, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  initiateMedicationDispenseBody,
  saveMedicationDispense,
  useProviders,
} from '../medication-dispense/medication-dispense.resource';
import {
  updateMedicationRequestFulfillerStatus,
  usePrescriptionDetails,
} from '../medication-request/medication-request.resource';
import {
  type MedicationDispense,
  MedicationDispenseStatus,
  MedicationRequestFulfillerStatus,
  MedicationRequestStatus,
} from '../types';
import { revalidate } from '../utils';
import OnPrescriptionFilledModal from './on-prescription-filled.modal';

vi.mock('../medication-dispense/medication-dispense.resource');
vi.mock('../medication-request/medication-request.resource');
vi.mock('../utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils')>()),
  revalidate: vi.fn(),
}));
vi.mock('../components/medication-event.component', () => ({
  default: ({ medicationEvent }) => <div>{medicationEvent.medicationReference.display}</div>,
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUseProviders = vi.mocked(useProviders);
const mockUsePrescriptionDetails = vi.mocked(usePrescriptionDetails);
const mockInitiateMedicationDispenseBody = vi.mocked(initiateMedicationDispenseBody);
const mockSaveMedicationDispense = vi.mocked(saveMedicationDispense);
const mockUpdateMedicationRequestFulfillerStatus = vi.mocked(updateMedicationRequestFulfillerStatus);
const mockRevalidate = vi.mocked(revalidate);
const mockShowSnackbar = vi.mocked(showSnackbar);

const patient = {
  resourceType: 'Patient',
  id: 'synthetic-patient',
  name: [{ given: ['Paciente'], family: 'Sintético' }],
} as fhir.Patient;

const createMedicationRequestBundle = (id: string, display: string) =>
  ({
    request: {
      id,
      resourceType: 'MedicationRequest',
      status: MedicationRequestStatus.active,
      medicationReference: { display },
      dispenseRequest: {
        numberOfRepeatsAllowed: 0,
        quantity: { value: 30, unit: 'tablet', code: 'tablet' },
      },
    },
    dispenses: [],
  }) as ReturnType<typeof usePrescriptionDetails>['medicationRequestBundles'][number];

const createCompletedDispense = (requestId: string): MedicationDispense =>
  ({
    id: `dispense-${requestId}`,
    resourceType: 'MedicationDispense',
    status: MedicationDispenseStatus.completed,
    authorizingPrescription: [{ reference: `MedicationRequest/${requestId}`, type: 'MedicationRequest' }],
    quantity: { value: 30, unit: 'tablet', code: 'tablet' },
  }) as MedicationDispense;

const prescriptionDetailsResult = (
  medicationRequestBundles: ReturnType<typeof usePrescriptionDetails>['medicationRequestBundles'],
  options: { error?: Error; isLoading?: boolean } = {},
) =>
  ({
    medicationRequestBundles,
    prescriptionDate: new Date('2026-08-25T08:00:00-05:00'),
    error: options.error,
    isLoading: options.isLoading ?? false,
    isValidating: false,
    mutate: vi.fn(),
  }) as ReturnType<typeof usePrescriptionDetails>;

describe('OnPrescriptionFilledModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      dispenserProviderRoles: [],
      dispensingLocationUuid: 'synthetic-pharmacy-location',
    });
    mockUseProviders.mockReturnValue([]);
    mockInitiateMedicationDispenseBody.mockImplementation((request) => ({
      resourceType: 'MedicationDispense',
      status: MedicationDispenseStatus.completed,
      authorizingPrescription: [{ reference: `MedicationRequest/${request.id}`, type: 'MedicationRequest' }],
      medicationReference: request.medicationReference,
      subject: { reference: 'Patient/synthetic-patient', type: 'Patient' },
      performer: [],
      location: { reference: 'Location/synthetic-pharmacy-location', type: 'Location' },
      quantity: { value: 30, unit: 'tablet', code: 'tablet' },
    }));
    mockSaveMedicationDispense.mockResolvedValue({
      ok: true,
      status: 201,
    } as Awaited<ReturnType<typeof saveMedicationDispense>>);
    mockUpdateMedicationRequestFulfillerStatus.mockResolvedValue({
      ok: true,
      status: 200,
    } as Awaited<ReturnType<typeof updateMedicationRequestFulfillerStatus>>);
    mockRevalidate.mockResolvedValue(undefined);
  });

  it('makes the already registered orders explicit before offering dispensing', () => {
    mockUsePrescriptionDetails.mockReturnValue(
      prescriptionDetailsResult([
        createMedicationRequestBundle('request-1', 'Paracetamol 500 mg'),
        createMedicationRequestBundle('request-2', 'Amoxicilina 500 mg'),
      ]),
    );

    render(<OnPrescriptionFilledModal close={vi.fn()} encounterUuid="synthetic-encounter" patient={patient} />);

    expect(screen.getByText('Prescription registered')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Registered medication orders (2)' })).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500 mg')).toBeInTheDocument();
    expect(screen.getByText('Amoxicilina 500 mg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave pending for dispensing' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Dispense now' })).toBeEnabled();
  });

  it('does not offer dispensing before the registered orders have loaded', () => {
    mockUsePrescriptionDetails.mockReturnValue(prescriptionDetailsResult([], { isLoading: true }));

    render(<OnPrescriptionFilledModal close={vi.fn()} encounterUuid="synthetic-encounter" patient={patient} />);

    expect(screen.getByText('Loading registered medication orders...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dispense now' })).toBeDisabled();
  });

  it('keeps the prescription pending when its saved orders cannot be displayed', () => {
    mockUsePrescriptionDetails.mockReturnValue(
      prescriptionDetailsResult([], { error: new Error('synthetic network failure') }),
    );

    render(<OnPrescriptionFilledModal close={vi.fn()} encounterUuid="synthetic-encounter" patient={patient} />);

    expect(screen.getByText('Could not load the registered orders')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave pending for dispensing' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Dispense now' })).toBeDisabled();
  });

  it('marks each fully dispensed registered order as completed', async () => {
    const close = vi.fn();
    let finishRefresh!: () => void;
    mockRevalidate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    mockUsePrescriptionDetails.mockReturnValue(
      prescriptionDetailsResult([createMedicationRequestBundle('request-1', 'Synthetic medication')]),
    );

    render(<OnPrescriptionFilledModal close={close} encounterUuid="synthetic-encounter" patient={patient} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dispense now' }));

    await waitFor(() =>
      expect(mockUpdateMedicationRequestFulfillerStatus).toHaveBeenCalledWith(
        'request-1',
        MedicationRequestFulfillerStatus.completed,
      ),
    );
    expect(mockRevalidate).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();

    finishRefresh();
    await waitFor(() => expect(close).toHaveBeenCalled());
  });

  it('keeps a registered order active when only part of its quantity is dispensed', async () => {
    mockInitiateMedicationDispenseBody.mockImplementation((request) => ({
      resourceType: 'MedicationDispense',
      status: MedicationDispenseStatus.completed,
      authorizingPrescription: [{ reference: `MedicationRequest/${request.id}`, type: 'MedicationRequest' }],
      medicationReference: request.medicationReference,
      subject: { reference: 'Patient/synthetic-patient', type: 'Patient' },
      performer: [],
      location: { reference: 'Location/synthetic-pharmacy-location', type: 'Location' },
      quantity: { value: 10, unit: 'tablet', code: 'tablet' },
    }));
    mockUsePrescriptionDetails.mockReturnValue(
      prescriptionDetailsResult([createMedicationRequestBundle('request-1', 'Synthetic medication')]),
    );

    render(<OnPrescriptionFilledModal close={vi.fn()} encounterUuid="synthetic-encounter" patient={patient} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dispense now' }));

    await waitFor(() => expect(mockSaveMedicationDispense).toHaveBeenCalledTimes(1));
    expect(mockUpdateMedicationRequestFulfillerStatus).toHaveBeenCalledWith(
      'request-1',
      MedicationRequestFulfillerStatus.in_progress,
    );
  });

  it('does not dispense an order again when completed quantities already cover it', async () => {
    const completedBundle = createMedicationRequestBundle('request-1', 'Synthetic medication');
    completedBundle.dispenses = [createCompletedDispense('request-1')];
    mockUsePrescriptionDetails.mockReturnValue(prescriptionDetailsResult([completedBundle]));

    render(<OnPrescriptionFilledModal close={vi.fn()} encounterUuid="synthetic-encounter" patient={patient} />);

    expect(screen.getByRole('button', { name: 'Dispense now' })).toBeDisabled();
    expect(mockSaveMedicationDispense).not.toHaveBeenCalled();
  });

  it('skips a fully dispensed line and saves only the pending medication line', async () => {
    const completedBundle = createMedicationRequestBundle('request-1', 'First synthetic medication');
    completedBundle.dispenses = [createCompletedDispense('request-1')];
    const pendingBundle = createMedicationRequestBundle('request-2', 'Second synthetic medication');
    mockUsePrescriptionDetails.mockReturnValue(prescriptionDetailsResult([completedBundle, pendingBundle]));

    render(<OnPrescriptionFilledModal close={vi.fn()} encounterUuid="synthetic-encounter" patient={patient} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dispense now' }));

    await waitFor(() => expect(mockSaveMedicationDispense).toHaveBeenCalledTimes(1));
    expect(mockSaveMedicationDispense).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizingPrescription: [expect.objectContaining({ reference: 'MedicationRequest/request-2' })],
      }),
      MedicationDispenseStatus.completed,
    );
  });

  it('does not invite a duplicate dispense when status persistence fails after saving', async () => {
    mockUpdateMedicationRequestFulfillerStatus.mockRejectedValue(new Error('synthetic status failure'));
    mockUsePrescriptionDetails.mockReturnValue(
      prescriptionDetailsResult([createMedicationRequestBundle('request-1', 'Synthetic medication')]),
    );

    render(<OnPrescriptionFilledModal close={vi.fn()} encounterUuid="synthetic-encounter" patient={patient} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dispense now' }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'warning',
          subtitle: expect.stringContaining('Do not dispense it again'),
        }),
      ),
    );
    expect(mockSaveMedicationDispense).toHaveBeenCalledTimes(1);
    expect(mockRevalidate).toHaveBeenCalled();
  });
});

import { useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { useProviders } from '../medication-dispense/medication-dispense.resource';
import { usePrescriptionDetails } from '../medication-request/medication-request.resource';
import OnPrescriptionFilledModal from './on-prescription-filled.modal';

vi.mock('../medication-dispense/medication-dispense.resource');
vi.mock('../medication-request/medication-request.resource');
vi.mock('../components/medication-event.component', () => ({
  default: ({ medicationEvent }) => <div>{medicationEvent.medicationReference.display}</div>,
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUseProviders = vi.mocked(useProviders);
const mockUsePrescriptionDetails = vi.mocked(usePrescriptionDetails);

const patient = {
  resourceType: 'Patient',
  id: 'synthetic-patient',
  name: [{ given: ['Paciente'], family: 'Sintético' }],
} as fhir.Patient;

const createMedicationRequestBundle = (id: string, display: string) =>
  ({
    request: {
      id,
      medicationReference: { display },
    },
    dispenses: [],
  }) as ReturnType<typeof usePrescriptionDetails>['medicationRequestBundles'][number];

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
    mockUseConfig.mockReturnValue({
      dispenserProviderRoles: [],
      dispensingLocationUuid: 'synthetic-pharmacy-location',
    });
    mockUseProviders.mockReturnValue([]);
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
});

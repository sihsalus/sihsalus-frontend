import { usePatient, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { type MedicationRequestBundle } from '../types';
import PrescriptionsPrintout from './prescription-printout.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  usePatient: vi.fn(),
  useSession: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const mockUsePatient = vi.mocked(usePatient);
const mockUseSession = vi.mocked(useSession);

describe('PrescriptionsPrintout', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      sessionLocation: {
        display: 'Central Pharmacy',
      },
    } as any);
  });

  it('renders the patient name and DNI on separate lines', () => {
    mockUsePatient.mockReturnValue({
      patient: {
        identifier: [
          {
            value: 'HCE-0012345',
            type: {
              text: 'N° Historia Clínica',
            },
          },
          {
            value: '12345678',
            type: {
              text: 'DNI',
            },
          },
        ],
      },
    } as any);

    const medicationRequests: Array<MedicationRequestBundle> = [
      {
        request: {
          id: 'request-1',
          subject: {
            reference: 'Patient/patient-1',
            display: 'Perez, Maria',
          },
          requester: {
            display: 'Dr. Test',
          },
          authoredOn: '2026-05-29T00:00:00.000Z',
          dosageInstruction: [],
          medicationReference: {
            reference: 'Medication/med-1',
            display: 'Test medication',
          },
          dispenseRequest: {
            numberOfRepeatsAllowed: 0,
            quantity: {
              value: 1,
              code: '001',
            },
            validityPeriod: {
              start: '2026-05-29',
            },
          },
        } as any,
        dispenses: [],
      },
    ];

    render(
      <PrescriptionsPrintout
        excludedPrescription={[]}
        medicationRequests={medicationRequests}
        patientUuid="patient-1"
      />,
    );

    expect(screen.getByText('Perez, Maria')).toBeInTheDocument();
    expect(screen.getByText('DNI: 12345678')).toBeInTheDocument();
    expect(screen.queryByText('DNI: HCE-0012345')).not.toBeInTheDocument();
  });
});

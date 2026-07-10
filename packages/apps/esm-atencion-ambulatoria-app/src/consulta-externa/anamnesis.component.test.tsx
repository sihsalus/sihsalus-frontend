import { useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAnamnesis } from '../hooks/useAnamnesis';
import { patientFormEntryWorkspace } from '../utils/constants';
import Anamnesis from './anamnesis.component';

vi.mock('../hooks/useAnamnesis', () => ({
  useAnamnesis: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const actual = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...actual,
    launchPatientWorkspace: vi.fn(),
  };
});

const mockUseAnamnesis = vi.mocked(useAnamnesis);
const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockUseConfig = vi.mocked(useConfig);
const pagination = {
  currentPage: 1,
  totalPages: 1,
  onPageChange: vi.fn(),
};

describe('Anamnesis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      encounterTypes: {
        externalConsultation: 'external-consultation',
      },
      formsList: {
        anamnesisForm: 'CE-ANAM-001-ANAMNESIS',
        consultaExternaForm: 'CE-001-CONSULTA EXTERNA',
      },
      concepts: {
        chiefComplaintUuid: 'chief',
        anamnesisUuid: 'anamnesis',
      },
    });
  });

  it('renders empty state when the patient has no anamnesis entries', () => {
    mockUseAnamnesis.mockReturnValue({
      anamnesisEntries: [],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate: vi.fn(),
      pagination,
    });

    render(<Anamnesis patientUuid="patient-uuid" />);

    expect(screen.getByText('Historial de Anamnesis')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /(?:Record|Registrar) anamnesis/i })).toBeInTheDocument();
  });

  it('renders anamnesis data and launches the split anamnesis form', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseAnamnesis.mockReturnValue({
      anamnesisEntries: [
        {
          encounterUuid: 'encounter-uuid',
          encounterDatetime: '2026-04-27T10:00:00.000Z',
          provider: 'Dra. Perez',
          chiefComplaint: 'Dolor abdominal',
          illnessDuration: '3 dias',
          onsetType: 'Insidioso',
          course: 'Progresivo',
          narrative: 'Dolor posterior a ingesta de alimentos.',
          biologicalFunctions: {
            appetite: 'Disminuido',
            thirst: 'Conservada',
            sleep: 'Alterado',
            mood: 'Ansioso',
            urine: 'Normal',
            bowelMovements: 'Disminuidas',
          },
        },
      ],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate,
      pagination,
    });

    render(<Anamnesis patientUuid="patient-uuid" />);

    expect(screen.getByText('Dolor abdominal')).toBeInTheDocument();
    expect(screen.getByText('Dolor posterior a ingesta de alimentos.')).toBeInTheDocument();
    expect(screen.getByText(/Disminuido/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dra\. Perez/ })).toHaveTextContent(/\d{1,2}:\d{2}/);

    await user.click(screen.getByRole('button', { name: 'Registrar Anamnesis' }));

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith(patientFormEntryWorkspace, {
      mutateForm: mutate,
      formInfo: {
        patientUuid: 'patient-uuid',
        formUuid: 'CE-ANAM-001-ANAMNESIS',
      },
    });
  });
});

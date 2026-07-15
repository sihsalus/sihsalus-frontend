import { useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAnamnesis } from '../hooks/useAnamnesis';
import { useOutpatientFormLauncher } from '../hooks/useOutpatientFormLauncher';
import Anamnesis from './anamnesis.component';

vi.mock('../hooks/useAnamnesis', () => ({
  useAnamnesis: vi.fn(),
}));

vi.mock('../hooks/useOutpatientFormLauncher', () => {
  return {
    useOutpatientFormLauncher: vi.fn(),
  };
});

const mockUseAnamnesis = vi.mocked(useAnamnesis);
const mockUseOutpatientFormLauncher = vi.mocked(useOutpatientFormLauncher);
const mockUseConfig = vi.mocked(useConfig);
const mockLaunchForm = vi.fn().mockResolvedValue(true);
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
    mockUseOutpatientFormLauncher.mockReturnValue({
      error: undefined,
      form: undefined,
      formIdentifier: 'CE-ANAM-001-ANAMNESIS',
      isLaunching: false,
      isLoading: false,
      launchForm: mockLaunchForm,
    });
  });

  it('renders the standard empty state and launches anamnesis registration', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseAnamnesis.mockReturnValue({
      anamnesisEntries: [],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate,
      pagination,
    });

    render(<Anamnesis patientUuid="patient-uuid" />);

    expect(screen.getByText('Historial de Anamnesis')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /(?:Record|Registrar) anamnesis/i }));

    expect(mockUseOutpatientFormLauncher).toHaveBeenCalledWith({
      fallbackDisplay: 'Anamnesis',
      identifier: 'CE-ANAM-001-ANAMNESIS',
      onSaved: mutate,
      patientUuid: 'patient-uuid',
    });
    expect(mockLaunchForm).toHaveBeenCalledTimes(1);
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

    expect(mockUseOutpatientFormLauncher).toHaveBeenCalledWith({
      fallbackDisplay: 'Anamnesis',
      identifier: 'CE-ANAM-001-ANAMNESIS',
      onSaved: mutate,
      patientUuid: 'patient-uuid',
    });
    expect(mockLaunchForm).toHaveBeenCalledTimes(1);
  });
});

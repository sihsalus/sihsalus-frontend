import { render, screen } from '@testing-library/react';

import { useActiveVisitSummary } from '../resources/admissions.resource';
import ClinicalIdentitySummary from './clinical-identity-summary.component';

vi.mock('../resources/admissions.resource', () => ({
  useActiveVisitSummary: vi.fn(),
}));

const mockUseActiveVisitSummary = vi.mocked(useActiveVisitSummary);

const patient = {
  id: 'patient-uuid',
  birthDate: '1994-05-10',
  gender: 'female',
  name: [{ given: ['Ada'], family: 'Lovelace' }],
  identifier: [
    { type: { text: 'DNI' }, value: '12345678' },
    { type: { text: 'Historia clinica' }, value: 'HC-99' },
  ],
} as fhir.Patient;

describe('ClinicalIdentitySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the minimum patient identification set with active service and location', () => {
    mockUseActiveVisitSummary.mockReturnValue({
      visit: { service: 'Consulta externa', location: 'Admision Central' },
      error: undefined,
      isLoading: false,
    });

    render(<ClinicalIdentitySummary patient={patient} patientUuid="patient-uuid" />);

    expect(screen.getByLabelText(/identificación mínima del paciente/i)).toBeInTheDocument();
    expect(screen.getByText('Paciente')).toBeInTheDocument();
    expect(screen.getByText('HC/documento')).toBeInTheDocument();
    expect(screen.getByText('Historia clinica: HC-99')).toBeInTheDocument();
    expect(screen.getByText('Edad/nacimiento/sexo')).toBeInTheDocument();
    expect(screen.getByText(/1994-05-10 \/ female/)).toBeInTheDocument();
    expect(screen.getByText('Consulta externa / Admision Central')).toBeInTheDocument();
    expect(mockUseActiveVisitSummary).toHaveBeenCalledWith('patient-uuid');
  });

  it('falls back to document identifier and empty service markers', () => {
    mockUseActiveVisitSummary.mockReturnValue({ visit: null, error: undefined, isLoading: false });

    render(
      <ClinicalIdentitySummary
        patient={{ ...patient, identifier: [{ type: { text: 'DNI' }, value: '12345678' }] }}
        patientUuid="patient-uuid"
      />,
    );

    expect(screen.getByText('DNI: 12345678')).toBeInTheDocument();
    expect(screen.getByText('-', { selector: 'dd' })).toBeInTheDocument();
  });

  it('renders loading state while service and location are loading', () => {
    mockUseActiveVisitSummary.mockReturnValue({ visit: null, error: undefined, isLoading: true });

    render(<ClinicalIdentitySummary patient={patient} patientUuid="patient-uuid" />);

    expect(screen.getByText(/cargando visita/i)).toBeInTheDocument();
  });

  it('renders nothing without patient data', () => {
    mockUseActiveVisitSummary.mockReturnValue({ visit: null, error: undefined, isLoading: false });

    const { container } = render(<ClinicalIdentitySummary patient={null} patientUuid="patient-uuid" />);

    expect(container).toBeEmptyDOMElement();
  });
});

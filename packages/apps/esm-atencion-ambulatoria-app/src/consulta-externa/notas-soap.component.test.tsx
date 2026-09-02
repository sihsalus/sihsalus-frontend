import { useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConsultaExternaFormLauncher } from '../hooks/useConsultaExternaFormLauncher';
import { useSoapNotes } from '../hooks/useSoapNotes';
import ExamenFisico from './notas-soap.component';

vi.mock('../hooks/useConsultaExternaFormLauncher', () => ({
  useConsultaExternaFormLauncher: vi.fn(),
}));

vi.mock('../hooks/useSoapNotes', () => ({
  useSoapNotes: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUseSoapNotes = vi.mocked(useSoapNotes);
const mockUseConsultaExternaFormLauncher = vi.mocked(useConsultaExternaFormLauncher);
const mockLaunchForm = vi.fn();
const pagination = {
  currentPage: 1,
  totalPages: 1,
  onPageChange: vi.fn(),
};

describe('ExamenFisico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConsultaExternaFormLauncher.mockReturnValue(mockLaunchForm);
    mockUseConfig.mockReturnValue({
      encounterTypes: { externalConsultation: 'external-consultation' },
      formsList: {
        soapNoteForm: 'CE-SOAP-001-NOTA SOAP',
        consultaExternaForm: 'CE-001-CONSULTA EXTERNA',
      },
      visitTypes: { ambulatory: 'ambulatory-visit' },
      concepts: {
        soapSubjectiveUuid: 'subjective',
        soapObjectiveUuid: 'objective',
        soapAssessmentUuid: 'assessment',
        soapPlanUuid: 'plan',
      },
    });
  });

  it('shows only the outpatient physical examination while retaining legacy objective findings', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseSoapNotes.mockReturnValue({
      soapEntries: [
        {
          encounterUuid: 'encounter-uuid',
          encounterDatetime: '2026-09-02T10:00:00.000-05:00',
          provider: 'Dra. Sintética',
          subjective: 'Relato SOAP que no corresponde mostrar aquí',
          objective: 'Hallazgo objetivo histórico',
          assessment: 'Apreciación SOAP que no corresponde mostrar aquí',
          plan: 'Plan SOAP que no corresponde mostrar aquí',
          physicalExam: {
            generalState: null,
            consciousness: null,
            skinAndAppendages: null,
            headAndNeck: null,
            respiratory: null,
            cardiovascular: null,
            abdomenAndDigestive: null,
            genitourinary: null,
            musculoskeletal: null,
            neurological: null,
            otherFindings: null,
          },
        },
      ],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate,
      pagination,
      sourceErrors: [],
    });

    render(<ExamenFisico patientUuid="synthetic-patient-uuid" />);

    expect(screen.getByText('Historial de examen físico')).toBeInTheDocument();
    expect(screen.getByText('Hallazgo objetivo histórico')).toBeInTheDocument();
    expect(screen.queryByText(/Relato SOAP que no corresponde/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Apreciación SOAP que no corresponde/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Plan SOAP que no corresponde/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Registrar examen físico' }));

    expect(mockUseConsultaExternaFormLauncher).toHaveBeenCalledWith({
      patientUuid: 'synthetic-patient-uuid',
      formIdentifier: 'CE-SOAP-001-NOTA SOAP',
      encounterTypeUuid: 'external-consultation',
      ambulatoryVisitTypeUuid: 'ambulatory-visit',
      mutate,
      entryMode: 'one-per-visit',
    });
    expect(mockLaunchForm).toHaveBeenCalledOnce();
  });

  it('does not treat a legacy SOAP-only entry as an outpatient physical examination', () => {
    mockUseSoapNotes.mockReturnValue({
      soapEntries: [
        {
          encounterUuid: 'soap-only-encounter',
          encounterDatetime: '2026-09-02T09:00:00.000-05:00',
          provider: 'Dr. Sintético',
          subjective: 'Solo subjetivo',
          objective: null,
          assessment: 'Solo apreciación',
          plan: 'Solo plan',
          physicalExam: {
            generalState: null,
            consciousness: null,
            skinAndAppendages: null,
            headAndNeck: null,
            respiratory: null,
            cardiovascular: null,
            abdomenAndDigestive: null,
            genitourinary: null,
            musculoskeletal: null,
            neurological: null,
            otherFindings: null,
          },
        },
      ],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate: vi.fn(),
      pagination,
      sourceErrors: [],
    });

    render(<ExamenFisico patientUuid="synthetic-patient-uuid" />);

    expect(screen.getByText(/There are no registros de examen físico/i)).toBeInTheDocument();
    expect(screen.queryByText('Solo subjetivo')).not.toBeInTheDocument();
  });
});

import { useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConsultaExternaFormLauncher } from '../hooks/useConsultaExternaFormLauncher';
import { usePhysicalExam } from '../hooks/usePhysicalExam';
import ExamenFisico from './examen-fisico.component';

vi.mock('../hooks/useConsultaExternaFormLauncher', () => ({
  useConsultaExternaFormLauncher: vi.fn(),
}));

vi.mock('../hooks/usePhysicalExam', () => ({
  usePhysicalExam: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUsePhysicalExam = vi.mocked(usePhysicalExam);
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

  it.each([
    {
      name: 'legacy objective findings',
      legacyObjective: 'Hallazgo objetivo histórico',
      generalState: null,
      otherFindings: null,
      expectedFindings: ['Hallazgo objetivo histórico'],
    },
    {
      name: 'segmented physical examination findings',
      legacyObjective: null,
      generalState: 'Buen estado general',
      otherFindings: 'Hallazgos regionales sintéticos',
      expectedFindings: ['Buen estado general', 'Hallazgos regionales sintéticos'],
    },
    {
      name: 'additional findings without other examination sections',
      legacyObjective: null,
      generalState: null,
      otherFindings: 'Hallazgo aislado sintético',
      expectedFindings: ['Hallazgo aislado sintético'],
    },
  ])('shows $name and launches the configured physical examination form', async ({
    legacyObjective,
    generalState,
    otherFindings,
    expectedFindings,
  }) => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUsePhysicalExam.mockReturnValue({
      physicalExamEntries: [
        {
          encounterUuid: 'encounter-uuid',
          encounterDatetime: '2026-09-02T10:00:00.000-05:00',
          provider: 'Dra. Sintética',
          legacyObjective,
          physicalExam: {
            generalState,
            consciousness: null,
            skinAndAppendages: null,
            headAndNeck: null,
            respiratory: null,
            cardiovascular: null,
            abdomenAndDigestive: null,
            genitourinary: null,
            musculoskeletal: null,
            neurological: null,
            otherFindings,
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
    for (const finding of expectedFindings) {
      expect(screen.getByText(finding)).toBeInTheDocument();
    }

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

  it('shows the empty state when the history has no physical examinations', () => {
    mockUsePhysicalExam.mockReturnValue({
      physicalExamEntries: [],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate: vi.fn(),
      pagination,
      sourceErrors: [],
    });

    render(<ExamenFisico patientUuid="synthetic-patient-uuid" />);

    expect(screen.getByText(/There are no registros de examen físico/i)).toBeInTheDocument();
  });
});

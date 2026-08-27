import {
  getMissingPatientInstructionsRequirements,
  getMissingRecetaUnicaRequirements,
  getMissingVisitSummaryRequirements,
} from './outpatient-document-requirements';
import type { OutpatientVisitSummary } from './outpatient-visit-summary.resource';
import {
  hasOutpatientPatientInstructions,
  hasOutpatientRecetaUnicaContent,
  isOutpatientRecetaUnicaClinicallyReady,
} from './outpatient-visit-summary-pdf';

vi.mock('./outpatient-visit-summary-pdf', () => ({
  hasOutpatientPatientInstructions: vi.fn(() => true),
  hasOutpatientRecetaUnicaContent: vi.fn(() => true),
  isOutpatientRecetaUnicaClinicallyReady: vi.fn(() => true),
}));

const mockHasInstructions = vi.mocked(hasOutpatientPatientInstructions);
const mockHasRecetaContent = vi.mocked(hasOutpatientRecetaUnicaContent);
const mockIsRecetaReady = vi.mocked(isOutpatientRecetaUnicaClinicallyReady);

function buildSummary(overrides: Partial<OutpatientVisitSummary> = {}): OutpatientVisitSummary {
  return { hasClinicalContent: true, clinicalRecordIssues: [], ...overrides } as OutpatientVisitSummary;
}

beforeEach(() => {
  mockHasInstructions.mockReturnValue(true);
  mockHasRecetaContent.mockReturnValue(true);
  mockIsRecetaReady.mockReturnValue(true);
});

describe('getMissingVisitSummaryRequirements', () => {
  it('asks for nothing when the visit already has clinical content', () => {
    expect(getMissingVisitSummaryRequirements(buildSummary())).toEqual([]);
  });

  it('points an empty visit at the anamnesis tab', () => {
    expect(getMissingVisitSummaryRequirements(buildSummary({ hasClinicalContent: false }))).toEqual([
      { id: 'clinicalContent', tab: 'anamnesis' },
    ]);
  });
});

describe('getMissingPatientInstructionsRequirements', () => {
  it('asks for nothing when the sheet has something to say', () => {
    expect(getMissingPatientInstructionsRequirements(buildSummary(), null)).toEqual([]);
  });

  it('names every alternative, because any one of them would have been enough', () => {
    mockHasInstructions.mockReturnValue(false);

    expect(getMissingPatientInstructionsRequirements(buildSummary(), null)).toEqual([
      { id: 'followUpDate', tab: 'treatment' },
      { id: 'therapeuticIndications', tab: 'treatment' },
      { id: 'medications', tab: 'treatment' },
    ]);
  });

  it('passes the scheduled appointment through, so a booked control counts', () => {
    const appointment = { uuid: 'appointment-uuid' } as Parameters<typeof getMissingPatientInstructionsRequirements>[1];
    const summary = buildSummary();

    getMissingPatientInstructionsRequirements(summary, appointment);

    expect(mockHasInstructions).toHaveBeenCalledWith(summary, appointment);
  });
});

describe('getMissingRecetaUnicaRequirements', () => {
  it('asks for nothing when the clinical contract and the medication are both in place', () => {
    expect(getMissingRecetaUnicaRequirements(buildSummary())).toEqual([]);
  });

  it('translates each clinical record issue into the tab that owns it', () => {
    mockIsRecetaReady.mockReturnValue(false);

    expect(
      getMissingRecetaUnicaRequirements(
        buildSummary({
          clinicalRecordIssues: [
            'primary-diagnosis-cie10-mapping-missing',
            'responsible-provider-missing-or-ambiguous',
          ],
        }),
      ),
    ).toEqual([
      { id: 'primaryDiagnosisCie10', tab: 'diagnosis' },
      { id: 'responsibleProfessional', tab: 'soap' },
    ]);
  });

  it('still names the clinical encounter when the contract fails without a reported issue', () => {
    mockIsRecetaReady.mockReturnValue(false);

    expect(getMissingRecetaUnicaRequirements(buildSummary())).toEqual([{ id: 'clinicalEncounter', tab: 'soap' }]);
  });

  it('adds the medication requirement on top of the clinical ones', () => {
    mockIsRecetaReady.mockReturnValue(false);
    mockHasRecetaContent.mockReturnValue(false);

    expect(
      getMissingRecetaUnicaRequirements(
        buildSummary({ clinicalRecordIssues: ['primary-diagnosis-missing-or-ambiguous'] }),
      ),
    ).toEqual([
      { id: 'primaryDiagnosis', tab: 'diagnosis' },
      { id: 'medicationsByResponsibleProfessional', tab: 'treatment' },
    ]);
  });

  it('lists a repeated issue once', () => {
    mockIsRecetaReady.mockReturnValue(false);

    expect(
      getMissingRecetaUnicaRequirements(
        buildSummary({
          clinicalRecordIssues: ['canonical-encounter-missing', 'canonical-encounter-missing'],
        }),
      ),
    ).toEqual([{ id: 'clinicalEncounter', tab: 'soap' }]);
  });
});

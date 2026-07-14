import { useConfig, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { mockSession } from 'test-utils';
import CurrentVisitDetails from './current-visit-details.component';

const mockUseConfig = vi.mocked(useConfig);
const mockUseSession = vi.mocked(useSession);

vi.mock('../hooks/useVitalsConceptMetadata', () => ({
  useVitalsFromObs: vi.fn(() => []),
}));

vi.mock('./visit-note.component', () => ({
  default: () => <div>Clinical visit summary</div>,
}));

vi.mock('./vitals.component', () => ({
  default: () => <div>Patient vitals</div>,
}));

describe('CurrentVisitDetails', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      concepts: {
        generalPatientNoteConceptUuid: 'general-note',
        problemListConceptUuid: 'problem-list',
        visitDiagnosesConceptUuid: 'visit-diagnoses',
      },
      visitNoteEncounterTypeUuid: 'visit-note-encounter',
    });
    mockUseSession.mockReturnValue(mockSession.data);
  });

  it('shows the visit summary and vitals to non-admission users', () => {
    render(<CurrentVisitDetails encounters={[]} patientUuid="patient-uuid" />);

    expect(screen.getByText('Clinical visit summary')).toBeInTheDocument();
    expect(screen.getByText('Patient vitals')).toBeInTheDocument();
  });

  it('hides the visit summary from admission users while retaining vitals', () => {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        roles: [{ display: 'Admisión', name: 'Admisión', uuid: 'admission-role-uuid' }],
      },
    });

    render(<CurrentVisitDetails encounters={[]} patientUuid="patient-uuid" />);

    expect(screen.queryByText('Clinical visit summary')).not.toBeInTheDocument();
    expect(screen.getByText('Patient vitals')).toBeInTheDocument();
  });
});

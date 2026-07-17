import { useConfig, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { mockSession } from 'test-utils';
import { visitNotesPrivilege, vitalsPrivilege } from '../../constants';
import CurrentVisitDetails from './current-visit-details.component';

const mockUseConfig = vi.mocked(useConfig);
const mockUseSession = vi.mocked(useSession);
const privilege = (name: string) => ({ uuid: `privilege-${name}`, display: name, name, links: [] });

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
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [...mockSession.data.user.privileges, privilege(visitNotesPrivilege), privilege(vitalsPrivilege)],
      },
    } as ReturnType<typeof useSession>);
  });

  it('shows clinical sections when their privileges are present', () => {
    render(<CurrentVisitDetails encounters={[]} patientUuid="patient-uuid" />);

    expect(screen.getByText('Clinical visit summary')).toBeInTheDocument();
    expect(screen.getByText('Patient vitals')).toBeInTheDocument();
  });

  it('hides the visit summary without its privilege while retaining authorized vitals', () => {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [privilege(vitalsPrivilege)],
        roles: [
          {
            display: 'Any operational role',
            name: 'Any operational role',
            uuid: 'operational-role-uuid',
            links: [],
          },
        ],
      },
    });

    render(<CurrentVisitDetails encounters={[]} patientUuid="patient-uuid" />);

    expect(screen.queryByText('Clinical visit summary')).not.toBeInTheDocument();
    expect(screen.getByText('Patient vitals')).toBeInTheDocument();
  });

  it('hides vitals without their privilege while retaining the authorized visit summary', () => {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [privilege(visitNotesPrivilege)],
      },
    } as ReturnType<typeof useSession>);

    render(<CurrentVisitDetails encounters={[]} patientUuid="patient-uuid" />);

    expect(screen.getByText('Clinical visit summary')).toBeInTheDocument();
    expect(screen.queryByText('Patient vitals')).not.toBeInTheDocument();
  });
});

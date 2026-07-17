import { launchWorkspace2, usePatient, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient, mockSession } from 'test-utils';
import { serviceQueuesVisitNotesWorkspace, visitNotesEditPrivilege, visitNotesPrivilege } from '../../constants';
import VisitNote from './visit-note.component';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUsePatient = vi.mocked(usePatient);
const mockUseSession = vi.mocked(useSession);
const privilege = (name: string) => ({ uuid: `privilege-${name}`, display: name, name, links: [] });

const note = {
  concept: { uuid: 'note-concept-uuid', display: 'Clinical note' },
  note: 'Clinical summary',
  provider: { name: 'Test Provider', role: 'Clinician' },
  time: '10:30',
};

describe('VisitNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePatient.mockReturnValue({ patient: mockPatient } as unknown as ReturnType<typeof usePatient>);
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [privilege(visitNotesPrivilege)],
      },
    } as ReturnType<typeof useSession>);
  });

  it('allows read-only users to see an existing note without exposing creation', () => {
    render(<VisitNote diagnoses={[]} notes={[note]} patientUuid={mockPatient.id} />);

    expect(screen.getByText('Clinical summary')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Visit note form' })).not.toBeInTheDocument();
  });

  it('opens the note workspace only with the edit privilege', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [privilege(visitNotesPrivilege), privilege(visitNotesEditPrivilege)],
      },
    } as ReturnType<typeof useSession>);

    render(<VisitNote diagnoses={[]} notes={[]} patientUuid={mockPatient.id} />);
    await user.click(screen.getByRole('button', { name: 'Visit note form' }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      serviceQueuesVisitNotesWorkspace,
      { formContext: 'creating' },
      null,
      expect.objectContaining({ patientUuid: mockPatient.id }),
    );
  });
});

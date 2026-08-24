import { launchWorkspace2, showSnackbar, usePatient, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient, mockSession } from 'test-utils';
import { serviceQueuesVisitNotesWorkspace, visitNotesEditPrivilege } from '../../constants';
import VisitNote from './visit-note.component';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUsePatient = vi.mocked(usePatient);
const mockUseSession = vi.mocked(useSession);
const privilege = (name: string) => ({ uuid: `privilege-${name}`, display: name, name, links: [] });

const note = {
  concept: { uuid: 'note-concept-uuid', display: 'Clinical note' },
  note: 'Clinical summary',
  provider: { name: 'Test Provider', role: 'Clinician' },
  time: '10:30',
};
const visit = { uuid: 'visit-uuid', location: { uuid: 'location-uuid' } };

describe('VisitNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLaunchWorkspace2.mockResolvedValue(true);
    mockUsePatient.mockReturnValue({ patient: mockPatient } as unknown as ReturnType<typeof usePatient>);
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [privilege(visitNotesEditPrivilege)],
      },
    } as ReturnType<typeof useSession>);
  });

  it('shows an existing note and offers the canonical edit action', () => {
    render(<VisitNote diagnoses={[]} notes={[note]} patientUuid={mockPatient.id} visit={visit as never} />);

    expect(screen.getByText('Clinical summary')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit visit summary' })).toBeInTheDocument();
  });

  it('opens the note workspace with the section privilege', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      user: {
        ...mockSession.data.user,
        privileges: [privilege(visitNotesEditPrivilege)],
      },
    } as ReturnType<typeof useSession>);

    render(<VisitNote diagnoses={[]} notes={[]} patientUuid={mockPatient.id} visit={visit as never} />);
    await user.click(screen.getByRole('button', { name: 'Visit note form' }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      serviceQueuesVisitNotesWorkspace,
      {},
      null,
      expect.objectContaining({ patientUuid: mockPatient.id, visitContext: visit }),
    );
  });

  it('does not offer creation without a verified visit context', () => {
    render(<VisitNote diagnoses={[]} notes={[]} patientUuid={mockPatient.id} />);

    expect(screen.queryByRole('button', { name: 'Visit note form' })).not.toBeInTheDocument();
  });

  it('does not offer creation when the visit has no verified location', () => {
    render(
      <VisitNote
        diagnoses={[]}
        notes={[]}
        patientUuid={mockPatient.id}
        visit={{ uuid: 'visit-without-location' } as never}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Visit note form' })).not.toBeInTheDocument();
  });

  it('reports a safe toast when Workspace2 rejects the launch', async () => {
    const user = userEvent.setup();
    mockLaunchWorkspace2.mockResolvedValue(false);
    render(<VisitNote diagnoses={[]} notes={[]} patientUuid={mockPatient.id} visit={visit as never} />);

    await user.click(screen.getByRole('button', { name: 'Visit note form' }));

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        title: 'Could not open the visit summary',
      }),
    );
  });
});

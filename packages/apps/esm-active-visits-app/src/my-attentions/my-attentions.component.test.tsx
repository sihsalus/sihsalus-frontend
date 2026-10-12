import { useSession } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import MyAttentionsPage from './my-attentions.component';
import { myAttentionsPrivileges, useMyAttentions } from './my-attentions.resource';
import MyAttentionsLink from './my-attentions-link.component';

vi.mock('@openmrs/esm-framework', async () => {
  const framework = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');
  return {
    ...framework,
    UserHasAccess: ({ privilege, children, fallback }) =>
      framework.userHasAccess(privilege, framework.useSession().user) ? children : fallback,
  };
});

vi.mock('./my-attentions.resource', async () => ({
  ...(await vi.importActual('./my-attentions.resource')),
  useMyAttentions: vi.fn(),
}));
vi.mock('../visits-summary/visit-detail.component', () => ({
  default: ({ visitUuid }: { visitUuid: string }) => <div>Visit {visitUuid}</div>,
}));
const session = (privileges = [...myAttentionsPrivileges, 'app:hoja.clinica'], authenticated = true) =>
  ({
    authenticated,
    user: { uuid: 'synthetic-provider', privileges: privileges.map((display) => ({ display })) },
  }) as unknown as ReturnType<typeof useSession>;
const attention = {
  id: 'v:visit-a',
  visitUuid: 'visit-a',
  encounterUuid: 'enc-a',
  patientUuid: 'patient-a',
  patientName: 'Synthetic Child',
  identifier: 'TEST-001',
  visitType: 'Outpatient',
  location: 'Synthetic clinic',
  status: 'open',
  encounterCount: 3,
  lastEncounterDatetime: '2026-10-12T12:00:00Z',
};
const mockHook = vi.mocked(useMyAttentions);
const response = { hasProvider: true, results: [], totalCount: 0, startIndex: 0, limit: 20 };
const result = (data: unknown, error?: unknown, loading = false) =>
  ({ data, error, isLoading: loading, isValidating: false, mutate: vi.fn() }) as ReturnType<typeof useMyAttentions>;

describe('my attentions screen', () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue(session());
    mockHook.mockReturnValue(result(response));
  });
  it('shows a real empty state after a successful response', () => {
    render(<MyAttentionsPage />);
    expect(screen.getByText('No care records for these filters')).toBeInTheDocument();
  });
  it('does not present a failed request as an empty clinical history', () => {
    mockHook.mockReturnValue(result(undefined, new Error('private SQL error')));
    render(<MyAttentionsPage />);
    expect(screen.getByText('Could not load your care records.')).toBeInTheDocument();
    expect(screen.queryByText('No care records for these filters')).not.toBeInTheDocument();
    expect(screen.queryByText('private SQL error')).not.toBeInTheDocument();
  });
  it('explains missing provider linkage', () => {
    mockHook.mockReturnValue(result({ ...response, hasProvider: false }));
    render(<MyAttentionsPage />);
    expect(screen.getByText('Your account has no linked provider.')).toBeInTheDocument();
  });
  it('shows multiple records as one consultation and uses its native status', () => {
    mockHook.mockReturnValue(
      result({
        ...response,
        totalCount: 1,
        results: [
          {
            id: 'v:visit-a',
            visitUuid: 'visit-a',
            encounterUuid: 'enc-a',
            patientUuid: 'patient-a',
            patientName: 'Synthetic Child',
            identifier: 'TEST-001',
            visitType: 'Outpatient',
            location: 'Synthetic clinic',
            status: 'open',
            encounterCount: 3,
            lastEncounterDatetime: '2026-10-12T12:00:00Z',
          },
        ],
      }),
    );
    render(<MyAttentionsPage />);
    expect(screen.getByText('Synthetic Child')).toBeInTheDocument();
    expect(screen.getByText('Open consultation', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
  it('applies search only on submission', () => {
    render(<MyAttentionsPage />);
    fireEvent.change(screen.getByLabelText('Patient name or identifier'), { target: { value: 'Niño' } });
    expect(mockHook.mock.lastCall?.[0].q).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(mockHook.mock.lastCall?.[0].q).toBe('Niño');
  });
  it.each(myAttentionsPrivileges)('denies the page and menu when %s is missing', (missing) => {
    vi.mocked(useSession).mockReturnValue(session(myAttentionsPrivileges.filter((p) => p !== missing)));
    render(
      <>
        <MyAttentionsPage />
        <MyAttentionsLink />
      </>,
    );
    expect(screen.getByText('You do not have permission to review care.')).toBeInTheDocument();
    expect(mockHook).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'My care' })).not.toBeInTheDocument();
  });
  it('removes records when the session expires', () => {
    mockHook.mockReturnValue(result({ ...response, totalCount: 1, results: [attention] }));
    const { rerender } = render(<MyAttentionsPage />);
    expect(screen.getByText('Synthetic Child')).toBeInTheDocument();
    vi.mocked(useSession).mockReturnValue(session([], false));
    rerender(<MyAttentionsPage />);
    expect(screen.getByText('Sign in again to review your care records.')).toBeInTheDocument();
    expect(screen.queryByText('Synthetic Child')).not.toBeInTheDocument();
  });
  it('keeps the consultation summary readable without granting chart access', () => {
    vi.mocked(useSession).mockReturnValue(session(myAttentionsPrivileges));
    mockHook.mockReturnValue(result({ ...response, totalCount: 1, results: [attention] }));
    render(<MyAttentionsPage />);
    expect(screen.getByText('Synthetic Child')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View consultation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open chart' })).not.toBeInTheDocument();
    expect(screen.queryByText('Visit visit-a')).not.toBeInTheDocument();
  });
  it('opens authorized consultation details and links to the patient chart', () => {
    mockHook.mockReturnValue(result({ ...response, totalCount: 1, results: [attention] }));
    render(<MyAttentionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'View consultation' }));
    expect(screen.getByRole('button', { name: 'View consultation' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Visit visit-a')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open chart' })).toHaveAttribute(
      'href',
      expect.stringContaining('/patient/patient-a/chart'),
    );
  });
  it('keeps unlinked encounters visible without offering consultation details', () => {
    mockHook.mockReturnValue(
      result({ ...response, totalCount: 1, results: [{ ...attention, visitUuid: null, status: 'unlinked' }] }),
    );
    render(<MyAttentionsPage />);
    expect(screen.getByText('No linked consultation', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View consultation' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open chart' })).toBeInTheDocument();
  });
  it('loads a new page and resets pagination when filters change', () => {
    mockHook.mockReturnValue(result({ ...response, totalCount: 41, results: [attention] }));
    render(<MyAttentionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(mockHook.mock.lastCall?.slice(1)).toEqual([2, 20]);
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(mockHook.mock.lastCall?.slice(1)).toEqual([1, 20]);
  });
  it('preserves overlong patient filters and prevents invalid submission', () => {
    render(<MyAttentionsPage />);
    const input = screen.getByLabelText('Patient name or identifier');
    fireEvent.change(input, { target: { value: 'ñ'.repeat(101) } });
    expect(input).toHaveValue('ñ'.repeat(101));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Apply filters' })).toBeDisabled();
    expect(mockHook.mock.lastCall?.[0].q).toBe('');
  });
  it('shows loading and supports explicit retry', () => {
    const state = result(undefined, undefined, true);
    mockHook.mockReturnValue(state);
    render(<MyAttentionsPage />);
    expect(screen.getByRole('progressbar', { name: 'Loading your care records' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(state.mutate).toHaveBeenCalledOnce();
  });
  it.each([
    [401, 'Sign in again to review your care records.'],
    [403, 'You do not have permission to review care.'],
  ])('explains a server authorization error %s and hides cached results', (status, message) => {
    mockHook.mockReturnValue(
      result(
        { ...response, totalCount: 1, results: [attention] },
        { response: { status }, message: 'private backend error' },
      ),
    );
    render(<MyAttentionsPage />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText('Synthetic Child')).not.toBeInTheDocument();
    expect(screen.queryByText('private backend error')).not.toBeInTheDocument();
  });
});

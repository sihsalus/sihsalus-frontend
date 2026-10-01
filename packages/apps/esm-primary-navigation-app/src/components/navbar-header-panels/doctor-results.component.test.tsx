import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { DoctorResultsButton, DoctorResultsPanel } from './doctor-results.component';
import { type ResultInbox, type useDoctorResults } from '../../doctor-results.resource';
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  extensions: [{ id: 'lab-result' }],
  snackbar: vi.fn(),
}));
vi.mock('@openmrs/esm-framework', () => ({
  restBaseUrl: '/openmrs/ws/rest/v1',
  openmrsFetch: mocks.fetch,
  showSnackbar: mocks.snackbar,
  useAssignedExtensions: () => mocks.extensions,
  ExtensionSlot: ({ state }: { state: { order: { uuid: string } } }) => <div>Result {state.order.uuid}</div>,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, options?: { count?: number }) =>
      fallback.replace('{{count}}', String(options?.count)),
    i18n: { resolvedLanguage: 'en' },
  }),
}));
const result = {
  id: 8,
  orderUuid: 'order',
  patientUuid: 'patient',
  patientName: 'SYNTHETIC Inbox',
  testName: 'Glucose',
  createdAt: '2026-09-30T20:00:00Z',
};
function makeInbox(overrides: Partial<ReturnType<typeof useDoctorResults>> = {}): ReturnType<typeof useDoctorResults> {
  const data: ResultInbox = { results: [result], total: 1, hasMore: false };
  return {
    data,
    error: undefined,
    isLoading: false,
    isValidating: false,
    allowed: true,
    sessionKey: 'own-session',
    mutate: vi.fn(async () => data),
    review: vi.fn(async () => undefined),
    ...overrides,
  };
}
function renderPanel(inbox = makeInbox()) {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DoctorResultsPanel inbox={inbox} offset={0} setOffset={vi.fn()} />
    </SWRConfig>,
  );
  return inbox;
}
beforeEach(() => {
  mocks.fetch.mockReset().mockResolvedValue({
    data: {
      uuid: 'order',
      patient: { uuid: 'patient' },
      fulfillerStatus: 'COMPLETED',
    },
  });
  mocks.extensions = [{ id: 'lab-result' }];
  mocks.snackbar.mockReset();
});
it('hides unauthorized entry and exposes count and button activation', async () => {
  const toggle = vi.fn();
  const { rerender } = render(
    <DoctorResultsButton inbox={makeInbox({ allowed: false })} expanded={false} toggle={toggle} />,
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(
    <DoctorResultsButton
      inbox={makeInbox({ data: { results: [], total: 103, hasMore: true } })}
      expanded
      toggle={toggle}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: '103 results pending review' }));
  expect(toggle).toHaveBeenCalledOnce();
  expect(screen.getByText('99+')).toBeInTheDocument();
});
it('opening panel and viewing a result never mark it reviewed', async () => {
  const inbox = renderPanel();
  expect(screen.getByText('SYNTHETIC Inbox')).toBeInTheDocument();
  expect(inbox.review).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'View result' }));
  await screen.findByText('Result order');
  expect(inbox.review).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }));
  await waitFor(() => expect(inbox.review).toHaveBeenCalledWith(8));
  expect(mocks.snackbar).toHaveBeenCalledOnce();
});
it('failed review retains detail and gives retry feedback without claiming success', async () => {
  renderPanel(
    makeInbox({
      review: vi.fn(async () => {
        throw new Error('server failure');
      }),
    }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'View result' }));
  await screen.findByText('Result order');
  await userEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }));
  await screen.findByText('Could not mark the result as reviewed. It remains pending.');
  expect(mocks.snackbar).not.toHaveBeenCalled();
});
it('rejects mismatched patient or unavailable consumer and prevents review', async () => {
  mocks.fetch.mockResolvedValue({
    data: {
      uuid: 'order',
      patient: { uuid: 'other' },
      fulfillerStatus: 'COMPLETED',
    },
  });
  const inbox = renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'View result' }));
  await screen.findByText('The result is unavailable. It remains pending review.');
  expect(screen.getByRole('button', { name: 'Mark as reviewed' })).toBeDisabled();
  expect(inbox.review).not.toHaveBeenCalled();
});
it('initial loading and read failures never appear as an empty inbox', () => {
  renderPanel(
    makeInbox({
      data: undefined,
      error: new Error('unavailable'),
      isLoading: false,
    }),
  );
  expect(screen.getByText('Could not load pending results. Retry to confirm the current list.')).toBeInTheDocument();
  expect(screen.queryByText('No results pending review')).not.toBeInTheDocument();
});
it('shows the established empty state once the server confirms zero', () => {
  renderPanel(makeInbox({ data: { results: [], total: 0, hasMore: false } }));
  expect(screen.getByText('No results pending review')).toBeInTheDocument();
});

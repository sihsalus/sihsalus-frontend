import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import LaboratoryResultNotification from './laboratory-result-notification.component';
import { type NotificationDetailState } from '@openmrs/esm-framework';
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  snackbar: vi.fn(),
  extensions: [{ id: 'result-viewer' }],
  allowed: true,
}));
vi.mock('@openmrs/esm-framework', () => ({
  restBaseUrl: '/openmrs/ws/rest/v1',
  openmrsFetch: mocks.fetch,
  showSnackbar: mocks.snackbar,
  userHasAccess: () => mocks.allowed,
  useSession: () => ({
    authenticated: mocks.allowed,
    user: {
      privileges: ['app:hoja.clinica.ordenes', 'Get Orders', 'Get Patients', 'Get Observations'].map((name) => ({
        name,
      })),
    },
  }),
  useAssignedExtensions: () => mocks.extensions,
  ExtensionSlot: ({ state }: { state: { order: { uuid: string } } }) => <div>Result {state.order.uuid}</div>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
function preview() {
  const props: NotificationDetailState = {
    notification: {
      id: 8,
      type: 'laboratory-result-ready',
      subjectUuid: 'order',
      createdAt: '2026-09-30T20:00:00Z',
      content: { title: 'SYNTHETIC Inbox', subtitle: 'Glucose', patientUuid: 'patient' },
    },
    sessionKey: 'own-session',
    back: vi.fn(),
    markRead: vi.fn(async () => undefined),
  };
  return props;
}
function show(props = preview()) {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <LaboratoryResultNotification {...props} />
    </SWRConfig>,
  );
  return props;
}
beforeEach(() => {
  mocks.fetch
    .mockReset()
    .mockResolvedValue({ data: { uuid: 'order', patient: { uuid: 'patient' }, fulfillerStatus: 'COMPLETED' } });
  mocks.extensions = [{ id: 'result-viewer' }];
  mocks.allowed = true;
  mocks.snackbar.mockReset();
});
it('viewing a result does not mark it read; explicit acknowledgement is not clinical review', async () => {
  const props = show();
  await screen.findByText('Result order');
  expect(props.markRead).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
  await waitFor(() => expect(props.markRead).toHaveBeenCalledOnce());
  expect(props.back).toHaveBeenCalledOnce();
  expect(mocks.snackbar).toHaveBeenCalledOnce();
});
it('failed acknowledgement stays unread and gives retry feedback', async () => {
  const props = preview();
  props.markRead = vi.fn(async () => {
    throw new Error('failed');
  });
  show(props);
  await screen.findByText('Result order');
  await userEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
  await screen.findByText('Could not mark the notification as read. It remains unread.');
  expect(props.back).not.toHaveBeenCalled();
  expect(mocks.snackbar).not.toHaveBeenCalled();
});
it('mismatched patient prevents rendering and acknowledgement', async () => {
  mocks.fetch.mockResolvedValue({ data: { uuid: 'order', patient: { uuid: 'other' }, fulfillerStatus: 'COMPLETED' } });
  const props = show();
  await screen.findByText('The result is unavailable. The notification remains unread.');
  expect(screen.getByRole('button', { name: 'Mark as read' })).toBeDisabled();
  expect(props.markRead).not.toHaveBeenCalled();
});
it('missing result viewer cannot acknowledge unseen details', async () => {
  mocks.extensions = [];
  const props = show();
  await screen.findByText('The result is unavailable. The notification remains unread.');
  expect(screen.getByRole('button', { name: 'Mark as read' })).toBeDisabled();
  expect(props.markRead).not.toHaveBeenCalled();
});
it('denied session or unknown notification type cannot fetch or acknowledge', () => {
  mocks.allowed = false;
  const props = show();
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(props.markRead).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Mark as read' })).toBeDisabled();
});

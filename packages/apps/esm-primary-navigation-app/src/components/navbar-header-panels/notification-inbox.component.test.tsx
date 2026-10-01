import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { NotificationInboxButton, NotificationInboxPanel } from './notification-inbox.component';
import { type NotificationInbox, type useNotificationInbox } from '../../notification-inbox.resource';
const mocks = vi.hoisted(() => ({
  extensions: [{ id: 'referral-detail', meta: { notificationType: 'interconsultation-ready' } }],
}));
vi.mock('@openmrs/esm-framework', () => ({
  useAssignedExtensions: () => mocks.extensions,
  ExtensionSlot: ({ state }: { state: import('@openmrs/esm-framework').NotificationDetailState }) => (
    <div>
      Referral {state.notification.subjectUuid}
      <button type="button" onClick={() => void state.markRead()}>
        Acknowledge referral
      </button>
    </div>
  ),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, options?: { count?: number }) =>
      fallback.replace('{{count}}', String(options?.count)),
    i18n: { resolvedLanguage: 'en' },
  }),
}));
const item = {
  id: 8,
  type: 'interconsultation-ready',
  subjectUuid: 'referral',
  createdAt: '2026-09-30T20:00:00Z',
  content: { title: 'SYNTHETIC Referral', subtitle: 'Answered' },
};
function makeInbox(
  overrides: Partial<ReturnType<typeof useNotificationInbox>> = {},
): ReturnType<typeof useNotificationInbox> {
  const data: NotificationInbox = { items: [item], total: 1, hasMore: false };
  return {
    data,
    error: undefined,
    isLoading: false,
    isValidating: false,
    allowed: true,
    sessionKey: 'own-session',
    mutate: vi.fn(async () => data),
    markRead: vi.fn(async () => undefined),
    ...overrides,
  };
}
function renderPanel(inbox = makeInbox()) {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <NotificationInboxPanel inbox={inbox} offset={0} setOffset={vi.fn()} />
    </SWRConfig>,
  );
  return inbox;
}
beforeEach(() => {
  mocks.extensions = [{ id: 'referral-detail', meta: { notificationType: 'interconsultation-ready' } }];
});
it('hides unauthorized entry and exposes count and button activation', async () => {
  const toggle = vi.fn();
  const { rerender } = render(
    <NotificationInboxButton inbox={makeInbox({ allowed: false })} expanded={false} toggle={toggle} />,
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(
    <NotificationInboxButton
      inbox={makeInbox({ data: { items: [], total: 103, hasMore: true } })}
      expanded
      toggle={toggle}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: '103 unread notifications' }));
  expect(toggle).toHaveBeenCalledOnce();
  expect(screen.getByText('99+')).toBeInTheDocument();
});
it('renders another module through the registered detail slot without acknowledging on open', async () => {
  const inbox = renderPanel();
  expect(screen.getByText('SYNTHETIC Referral')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Open notification' }));
  await screen.findByText('Referral referral');
  expect(inbox.markRead).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Acknowledge referral' }));
  expect(inbox.markRead).toHaveBeenCalledWith(8);
});
it('unknown or duplicate detail extensions fail closed and preserve unread state', async () => {
  mocks.extensions = [];
  const inbox = renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Open notification' }));
  expect(screen.getByText('This notification is unavailable. It remains unread.')).toBeInTheDocument();
  expect(inbox.markRead).not.toHaveBeenCalled();
});
it('duplicate type renderers are not selected arbitrarily', async () => {
  mocks.extensions.push({ id: 'duplicate', meta: { notificationType: 'interconsultation-ready' } });
  const inbox = renderPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Open notification' }));
  expect(screen.queryByText('Referral referral')).not.toBeInTheDocument();
  expect(inbox.markRead).not.toHaveBeenCalled();
});
it('loading or read failures never appear as an empty inbox', () => {
  renderPanel(makeInbox({ data: undefined, error: new Error('unavailable'), isLoading: false }));
  expect(screen.getByText('Could not load notifications. Retry to confirm the current list.')).toBeInTheDocument();
  expect(screen.queryByText('No unread notifications')).not.toBeInTheDocument();
});
it('shows empty only when the server confirms zero', () => {
  renderPanel(makeInbox({ data: { items: [], total: 0, hasMore: false } }));
  expect(screen.getByText('No unread notifications')).toBeInTheDocument();
});

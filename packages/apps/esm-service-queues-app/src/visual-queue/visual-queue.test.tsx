import { getDefaultsFromConfigSchema, navigate, useConfig, useConnectivity } from '@openmrs/esm-framework';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockQueueEntries } from 'test-utils';

import { configSchema } from '../config-schema';
import { serviceQueuesBasePath } from '../constants';
import { useOperationalQueueEntries } from '../hooks/useOperationalQueueEntries';
import useQueueStatuses from '../hooks/useQueueStatuses';
import { useServiceQueuesStore } from '../store/store';
import { type Concept } from '../types';

import VisualQueue, { buildQueueBoardColumns } from './visual-queue.component';

const refreshCache = vi.hoisted(() => vi.fn());
vi.mock('swr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('swr')>()),
  useSWRConfig: () => ({ mutate: refreshCache }),
}));

vi.mock('../hooks/useOperationalQueueEntries', () => ({ useOperationalQueueEntries: vi.fn() }));
vi.mock('../hooks/useQueueStatuses', () => ({ default: vi.fn() }));
vi.mock('../store/store', () => ({ useServiceQueuesStore: vi.fn() }));
vi.mock('../patient-queue-header/patient-queue-header.component', () => ({
  default: () => <header data-testid="queue-filters">Queue filters</header>,
}));
vi.mock('../queue-table/default-queue-table.component', () => ({
  StatusSwitcher: () => <div>Queue status filters</div>,
}));

const defaultFilters = {
  queueLocationSelectionInitialized: true,
  selectedQueueLocationUuid: 'synthetic-upss',
  selectedQueueLocationName: 'UPSS de prueba',
  selectedServiceUuid: 'synthetic-service',
  selectedServiceDisplay: 'Servicio de prueba',
  selectedQueueStatusUuid: null,
  selectedQueueStatusDisplay: null,
  selectedAppointmentStatus: '',
  selectedQueueRoomTimestamp: new Date('2026-08-23T10:00:00Z'),
  isPermanentProviderQueueRoom: false,
};

const defaultQueueResult = {
  queueEntries: mockQueueEntries,
  totalCount: mockQueueEntries.length,
  isLoading: false,
  isValidating: false,
  error: undefined,
  mutate: vi.fn(),
};

const defaultStatuses = {
  statuses: mockQueueEntries.map(({ status }) => status) as Array<Concept>,
  isLoadingQueueStatuses: false,
  queueStatusesError: undefined,
};

describe('visual queue board', () => {
  it('groups entries by status and orders each lane by queue weight', () => {
    const entries = [
      { ...mockQueueEntries[0], sortWeight: 20 },
      { ...mockQueueEntries[1], sortWeight: 5, status: mockQueueEntries[0].status },
    ];
    const statuses = [mockQueueEntries[0].status, mockQueueEntries[1].status] as Array<Concept>;

    const columns = buildQueueBoardColumns(entries, statuses);

    expect(columns).toHaveLength(2);
    expect(columns[0].entries.map(({ uuid }) => uuid)).toEqual([mockQueueEntries[1].uuid, mockQueueEntries[0].uuid]);
    expect(columns[1].entries).toHaveLength(0);
  });

  it('returns only the selected status lane', () => {
    const selectedStatus = mockQueueEntries[0].status;

    const columns = buildQueueBoardColumns(mockQueueEntries, [selectedStatus], selectedStatus.uuid);

    expect(columns).toHaveLength(1);
    expect(columns[0].status.uuid).toBe(selectedStatus.uuid);
    expect(columns[0].entries.every(({ status }) => status.uuid === selectedStatus.uuid)).toBe(true);
  });
});

describe('visual queue controls and data states', () => {
  let fullscreenElement: Element | null;
  let requestFullscreen: ReturnType<typeof vi.fn>;
  let exitFullscreen: ReturnType<typeof vi.fn>;
  const fullscreenProperties = [
    { target: document, key: 'fullscreenElement' },
    { target: document, key: 'fullscreenEnabled' },
    { target: document, key: 'exitFullscreen' },
    { target: HTMLElement.prototype, key: 'requestFullscreen' },
  ].map(({ target, key }) => ({ target, key, descriptor: Object.getOwnPropertyDescriptor(target, key) }));

  beforeEach(() => {
    vi.mocked(useConnectivity).mockReturnValue(true);
    refreshCache.mockReset().mockResolvedValue([]);
    vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    vi.mocked(useServiceQueuesStore).mockReturnValue(defaultFilters);
    vi.mocked(useOperationalQueueEntries).mockReturnValue(defaultQueueResult);
    vi.mocked(useQueueStatuses).mockReturnValue(defaultStatuses);
    fullscreenElement = null;
    requestFullscreen = vi.fn(function (this: HTMLElement) {
      fullscreenElement = this;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });
    exitFullscreen = vi.fn(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });
    Object.defineProperties(document, {
      fullscreenElement: { configurable: true, get: () => fullscreenElement },
      fullscreenEnabled: { configurable: true, value: true },
      exitFullscreen: { configurable: true, value: exitFullscreen },
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
  });

  afterEach(() => {
    for (const { target, key, descriptor } of fullscreenProperties) {
      if (descriptor) {
        Object.defineProperty(target, key, descriptor);
      } else {
        Reflect.deleteProperty(target, key);
      }
    }
  });

  it('returns to the queue table from below the board while keeping the selected filters', async () => {
    const user = userEvent.setup();
    render(<VisualQueue />);

    const board = screen.getByRole('region', { name: 'Care flow' });
    const backButton = screen.getByRole('button', { name: 'Back to queue table' });
    expect(within(screen.getByTestId('queue-filters')).queryByRole('button')).not.toBeInTheDocument();
    expect(board.compareDocumentPosition(backButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(backButton);

    expect(navigate).toHaveBeenCalledWith({ to: serviceQueuesBasePath });
    expect(useOperationalQueueEntries).toHaveBeenLastCalledWith({
      location: defaultFilters.selectedQueueLocationUuid,
      service: defaultFilters.selectedServiceUuid,
      status: null,
      isEnded: false,
    });
  });

  it('expands only the board, preserves the entries and shows the selected scope until exiting', async () => {
    const user = userEvent.setup();
    render(<VisualQueue />);
    const board = screen.getByRole('region', { name: 'Care flow' });
    const cards = within(board).getAllByRole('article');

    await user.click(screen.getByRole('button', { name: 'Fullscreen' }));

    expect(document.fullscreenElement).toBe(board);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(within(board).getAllByRole('article')).toEqual(cards);
    expect(screen.getByText('UPSS: UPSS de prueba · Service: Servicio de prueba · Status: All')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Exit fullscreen' }));

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(document.fullscreenElement).toBeNull();
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toHaveFocus();
    expect(within(board).getAllByRole('article')).toEqual(cards);
  });

  it('restores the control and focus when the browser exits fullscreen with Escape', async () => {
    const user = userEvent.setup();
    render(<VisualQueue />);
    await user.click(screen.getByRole('button', { name: 'Fullscreen' }));
    screen.getAllByRole('link')[0].focus();

    // The browser owns Escape; the component must follow its fullscreenchange event.
    act(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    expect(screen.getByRole('button', { name: 'Fullscreen' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toHaveFocus();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it('keeps the board usable and offers a safe message when fullscreen is rejected', async () => {
    const user = userEvent.setup();
    requestFullscreen.mockRejectedValue(new Error('private browser detail'));
    render(<VisualQueue />);

    await user.click(screen.getByRole('button', { name: 'Fullscreen' }));

    expect(await screen.findByText('Could not change fullscreen mode')).toBeInTheDocument();
    expect(screen.queryByText('private browser detail')).not.toBeInTheDocument();
    expect(document.fullscreenElement).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(mockQueueEntries.length);
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('exits only its own fullscreen board when Escape is delivered to the page', async () => {
    const user = userEvent.setup();
    render(<VisualQueue />);
    await user.keyboard('{Escape}');
    expect(exitFullscreen).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Fullscreen' }));
    screen.getAllByRole('link')[0].focus();
    await user.keyboard('{Escape}');

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(document.fullscreenElement).toBeNull();
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toHaveFocus();

    act(() => {
      fullscreenElement = document.body;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    await user.keyboard('{Escape}');
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('keeps the exit control when the browser rejects leaving fullscreen', async () => {
    const user = userEvent.setup();
    render(<VisualQueue />);
    await user.click(screen.getByRole('button', { name: 'Fullscreen' }));
    exitFullscreen.mockRejectedValue(new Error('private exit detail'));

    await user.click(screen.getByRole('button', { name: 'Exit fullscreen' }));

    expect(await screen.findByText('Could not change fullscreen mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('private exit detail')).not.toBeInTheDocument();
  });

  it('explains when fullscreen is unavailable while retaining the normal board', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
    render(<VisualQueue />);

    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toHaveAccessibleDescription(
      'Fullscreen is not available in this browser.',
    );
    expect(screen.getAllByRole('article')).toHaveLength(mockQueueEntries.length);
  });

  it('does not replace loading or failed status data with an empty queue or a zero count', () => {
    vi.mocked(useQueueStatuses).mockReturnValue({ ...defaultStatuses, statuses: [], isLoadingQueueStatuses: true });
    const { rerender } = render(<VisualQueue />);

    expect(screen.getByText('Loading visual queue')).toBeInTheDocument();
    expect(screen.getByLabelText('Patient count unavailable')).toHaveTextContent('—');
    expect(screen.queryByText('No patients to display')).not.toBeInTheDocument();

    vi.mocked(useQueueStatuses).mockReturnValue({
      ...defaultStatuses,
      statuses: [],
      queueStatusesError: new Error('private status detail'),
    });
    rerender(<VisualQueue />);

    expect(screen.getByText('Error loading queue statuses')).toBeInTheDocument();
    expect(screen.queryByText('private status detail')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Patient count unavailable')).toHaveTextContent('—');
    expect(screen.queryByText('No patients to display')).not.toBeInTheDocument();
  });

  it('keeps the displayed entries while refreshing and reports entry errors safely', () => {
    vi.mocked(useOperationalQueueEntries).mockReturnValue({ ...defaultQueueResult, isValidating: true });
    const { rerender } = render(<VisualQueue />);
    expect(screen.getByText('Updating queue')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(mockQueueEntries.length);

    vi.mocked(useOperationalQueueEntries).mockReturnValue({
      ...defaultQueueResult,
      error: new Error('private entry detail'),
    });
    rerender(<VisualQueue />);

    expect(screen.getByText('Error loading queue entries')).toBeInTheDocument();
    expect(screen.queryByText('private entry detail')).not.toBeInTheDocument();
    expect(screen.queryByText('Updating queue')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Patient count unavailable')).toHaveTextContent('—');
  });

  it('shows a confirmed empty queue with the configured status lanes', () => {
    vi.mocked(useOperationalQueueEntries).mockReturnValue({ ...defaultQueueResult, queueEntries: [], totalCount: 0 });
    render(<VisualQueue />);

    expect(screen.getAllByText('No patients in this status')).toHaveLength(defaultStatuses.statuses.length);
    expect(screen.queryByLabelText('Patient count unavailable')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('marks the last loaded entries as unconfirmed while offline, including in fullscreen', async () => {
    const user = userEvent.setup();
    vi.mocked(useConnectivity).mockReturnValue(false);
    render(<VisualQueue />);

    await user.click(screen.getByRole('button', { name: 'Fullscreen' }));

    const board = screen.getByRole('region', { name: 'Care flow' });
    expect(within(board).getByText('No connection')).toBeInTheDocument();
    expect(
      within(board).getByText('Showing the last complete queue loaded in this view. It may have changed.'),
    ).toBeInTheDocument();
    expect(within(board).getAllByRole('article')).toHaveLength(mockQueueEntries.length);
    expect(screen.getByLabelText('Patient count unavailable')).toHaveTextContent('—');
    expect(screen.getByRole('button', { name: 'Refresh queue' })).toBeDisabled();
  });

  it('does not turn an offline first load into an empty queue or a zero count', () => {
    vi.mocked(useConnectivity).mockReturnValue(false);
    vi.mocked(useOperationalQueueEntries).mockReturnValue({ ...defaultQueueResult, queueEntries: [], isLoading: true });
    render(<VisualQueue />);

    expect(screen.getByText('No connection')).toBeInTheDocument();
    expect(screen.getByLabelText('Patient count unavailable')).toHaveTextContent('—');
    expect(screen.queryByText('No patients to display')).not.toBeInTheDocument();
    expect(screen.queryByText('No patients in this status')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading visual queue')).not.toBeInTheDocument();
  });

  it('retries both entries and queue metadata and prevents duplicate refreshes', async () => {
    const user = userEvent.setup();
    let finishRefresh: (value: unknown[]) => void;
    refreshCache.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve;
        }),
    );
    render(<VisualQueue />);
    const button = screen.getByRole('button', { name: 'Refresh queue' });

    await user.click(button);
    await user.click(button);

    expect(defaultQueueResult.mutate).toHaveBeenCalledOnce();
    expect(refreshCache).toHaveBeenCalledOnce();
    expect(refreshCache.mock.calls[0][0]('/ws/rest/v1/queue?v=synthetic')).toBe(true);
    expect(refreshCache.mock.calls[0][0]('/ws/rest/v1/patient')).toBe(false);
    expect(button).toBeDisabled();
    await act(async () => finishRefresh([]));
    expect(button).toBeEnabled();
  });

  it.each([401, 403])('hides prior entries if the server denies access with %s', (status) => {
    vi.mocked(useOperationalQueueEntries).mockReturnValue({
      ...defaultQueueResult,
      error: Object.assign(new Error('Synthetic access failure'), { response: { status } }),
    });
    render(<VisualQueue />);

    expect(screen.getByText('Error loading queue entries')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Showing the last complete queue loaded in this view. It may have changed.'),
    ).not.toBeInTheDocument();
  });

  it('prevents duplicate fullscreen requests while a transition is pending', async () => {
    const user = userEvent.setup();
    let completeRequest: () => void;
    requestFullscreen.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          completeRequest = resolve;
        }),
    );
    render(<VisualQueue />);
    const button = screen.getByRole('button', { name: 'Fullscreen' });

    await user.click(button);
    await user.click(button);

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await act(async () => completeRequest());
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'));
  });
});

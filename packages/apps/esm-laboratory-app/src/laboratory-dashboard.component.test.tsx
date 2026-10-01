import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LaboratoryDashboard from './laboratory-dashboard.component';

const mocks = vi.hoisted(() => ({
  invalidateLabOrders: vi.fn(),
  realtimeHook: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('@openmrs/esm-framework', () => ({
  LaboratoryPictogram: () => null,
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  showSnackbar: mocks.showSnackbar,
  useConfig: () => ({ enableRealtimeLabResultNotifications: true }),
  useDefineAppContext: vi.fn(),
}));

const translate = (_key: string, fallback: string) => fallback;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }));

vi.mock('./lab-tabs/laboratory-tabs.component', () => ({
  default: () => <div>Laboratory tabs</div>,
}));

vi.mock('./lab-tiles/laboratory-summary-tiles.component', () => ({
  default: () => <div>Laboratory summary</div>,
}));

vi.mock('./laboratory-notifications.resource', () => ({
  labOrderCreatedEventType: 'LAB_ORDER_CREATED',
  useLaboratoryNotifications: mocks.realtimeHook,
}));

vi.mock('./laboratory.resource', () => ({
  useInvalidateLabOrders: () => mocks.invalidateLabOrders,
}));

describe('Laboratory dashboard realtime notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.invalidateLabOrders.mockResolvedValue([]);
  });

  afterEach(() => vi.useRealTimers());

  it('refreshes laboratory orders and shows a generic notice when a result is ready', async () => {
    render(<LaboratoryDashboard />);

    expect(screen.getByRole('heading', { name: 'Laboratory' })).toBeInTheDocument();
    expect(mocks.realtimeHook).toHaveBeenCalledWith(true, expect.any(Function), expect.any(Function));
    const onNotification = mocks.realtimeHook.mock.calls[0][1] as (eventType: string) => void;

    act(() => onNotification('LAB_RESULT_READY'));

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(mocks.invalidateLabOrders).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'info',
      title: 'Laboratory result available',
      subtitle: 'The laboratory worklist was updated automatically.',
    });
  });

  it('refreshes laboratory orders and shows a generic notice when an order is created', async () => {
    render(<LaboratoryDashboard />);
    const onNotification = mocks.realtimeHook.mock.calls[0][1] as (eventType: string) => void;

    act(() => onNotification('LAB_ORDER_CREATED'));

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(mocks.invalidateLabOrders).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'info',
      title: 'New laboratory order',
      subtitle: 'A new order was added to the laboratory worklist.',
    });
  });

  it('silently refreshes laboratory orders when the replay cursor is unavailable', async () => {
    render(<LaboratoryDashboard />);
    const onResyncRequired = mocks.realtimeHook.mock.calls[0][2] as () => void;

    act(() => onResyncRequired());

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(mocks.invalidateLabOrders).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });
  it('groups 100 events and serializes the next refresh behind a slow request', async () => {
    let resolve: () => void;
    mocks.invalidateLabOrders.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const { unmount } = render(<LaboratoryDashboard />);
    const notify = mocks.realtimeHook.mock.calls[0][1];
    act(() => {
      for (let i = 0; i < 100; i++) notify('LAB_ORDER_CREATED');
    });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(mocks.invalidateLabOrders).toHaveBeenCalledOnce();
    act(() => notify('LAB_RESULT_READY'));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(mocks.invalidateLabOrders).toHaveBeenCalledOnce();
    await act(async () => resolve());
    expect(mocks.showSnackbar).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar.mock.calls[0][0].title).toBe('Laboratory worklist updated');
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(mocks.invalidateLabOrders).toHaveBeenCalledTimes(2);
    act(() => notify('LAB_ORDER_CREATED'));
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(mocks.invalidateLabOrders).toHaveBeenCalledTimes(2);
  });

  it('does not claim a successful refresh when the request fails', async () => {
    mocks.invalidateLabOrders.mockRejectedValueOnce(new Error('offline'));
    render(<LaboratoryDashboard />);
    act(() => mocks.realtimeHook.mock.calls[0][1]('LAB_ORDER_CREATED'));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });
});

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

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
  });

  it('refreshes laboratory orders and shows a generic notice when a result is ready', () => {
    render(<LaboratoryDashboard />);

    expect(screen.getByRole('heading', { name: 'Laboratory' })).toBeInTheDocument();
    expect(mocks.realtimeHook).toHaveBeenCalledWith(true, expect.any(Function), expect.any(Function));
    const onNotification = mocks.realtimeHook.mock.calls[0][1] as (eventType: string) => void;

    act(() => onNotification('LAB_RESULT_READY'));

    expect(mocks.invalidateLabOrders).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'info',
      title: 'Laboratory result available',
      subtitle: 'The laboratory worklist was updated automatically.',
    });
  });

  it('refreshes laboratory orders and shows a generic notice when an order is created', () => {
    render(<LaboratoryDashboard />);
    const onNotification = mocks.realtimeHook.mock.calls[0][1] as (eventType: string) => void;

    act(() => onNotification('LAB_ORDER_CREATED'));

    expect(mocks.invalidateLabOrders).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'info',
      title: 'New laboratory order',
      subtitle: 'A new order was added to the laboratory worklist.',
    });
  });

  it('silently refreshes laboratory orders when the replay cursor is unavailable', () => {
    render(<LaboratoryDashboard />);
    const onResyncRequired = mocks.realtimeHook.mock.calls[0][2] as () => void;

    act(() => onResyncRequired());

    expect(mocks.invalidateLabOrders).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });
});

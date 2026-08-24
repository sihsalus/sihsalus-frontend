import { ExtensionSlot, showSnackbar, useConfig, useSession } from '@openmrs/esm-framework';
import { useOrderBasket, useVisitOrOfflineVisit } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSessionDataResponse } from 'test-utils';

import { useMutatePatientOrders, useOrderEncounter } from '../api/api';
import { type ConfigObject } from '../config-schema';

import OrderBasket from './order-basket.workspace';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  getPatientUuidFromStore: () => 'patient-uuid',
  postOrders: vi.fn(),
  postOrdersOnNewEncounter: vi.fn(),
  useOrderBasket: vi.fn(),
  useVisitOrOfflineVisit: vi.fn(),
}));

vi.mock('../api/api', () => ({
  useMutatePatientOrders: vi.fn(),
  useOrderEncounter: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseSession = vi.mocked(useSession);
const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseOrderBasket = vi.mocked(useOrderBasket);
const mockUseVisitOrOfflineVisit = vi.mocked(useVisitOrOfflineVisit);
const mockUseOrderEncounter = vi.mocked(useOrderEncounter);
const mockUseMutatePatientOrders = vi.mocked(useMutatePatientOrders);

function renderOrderBasket(launchChildWorkspace = vi.fn().mockResolvedValue(true)) {
  const props = {
    closeWorkspace: vi.fn().mockResolvedValue(true),
    groupProps: { patientUuid: 'patient-uuid' },
    isRootWorkspace: true,
    launchChildWorkspace,
    showActionMenu: false,
    windowName: 'order-basket-window',
    windowProps: {},
    workspaceName: 'order-basket',
    workspaceProps: {},
  } as unknown as React.ComponentProps<typeof OrderBasket>;

  return { ...render(<OrderBasket {...props} />), launchChildWorkspace };
}

describe('OrderBasket provider guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      orderEncounterType: 'order-encounter-type-uuid',
      orderTypes: [],
    } as unknown as ConfigObject);
    mockUseSession.mockReturnValue(mockSessionDataResponse.data);
    mockUseVisitOrOfflineVisit.mockReturnValue({
      activeVisit: { uuid: 'visit-uuid', location: { uuid: 'location-uuid' } },
    } as ReturnType<typeof useVisitOrOfflineVisit>);
    mockUseOrderBasket.mockReturnValue({
      orders: [],
      clearOrders: vi.fn(),
      setOrders: vi.fn(),
    } as unknown as ReturnType<typeof useOrderBasket>);
    mockUseOrderEncounter.mockReturnValue({
      activeVisitRequired: true,
      encounterUuid: null,
      error: null,
      isLoading: false,
      mutate: vi.fn(),
    });
    mockUseMutatePatientOrders.mockReturnValue({ mutate: vi.fn() });
    mockExtensionSlot.mockImplementation(({ state }) => {
      const orderBasketState = state as {
        canCreateOrders: boolean;
        launchAddLabOrder: (orderTypeUuid: string) => void;
      };
      return (
        <button
          type="button"
          disabled={!orderBasketState.canCreateOrders}
          onClick={() => orderBasketState.launchAddLabOrder('lab-order-type-uuid')}
        >
          Add lab order
        </button>
      );
    });
  });

  it('blocks clinical ordering and explains the missing provider', () => {
    mockUseSession.mockReturnValue({
      ...mockSessionDataResponse.data,
      currentProvider: undefined,
    });

    renderOrderBasket();

    expect(screen.getByText('Clinical provider required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add lab order' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign and close' })).toBeDisabled();
  });

  it('opens a child order workspace for a clinical provider', async () => {
    const user = userEvent.setup();
    const { launchChildWorkspace } = renderOrderBasket();

    await user.click(screen.getByRole('button', { name: 'Add lab order' }));

    expect(launchChildWorkspace).toHaveBeenCalledWith('add-lab-order', {
      orderTypeUuid: 'lab-order-type-uuid',
    });
  });

  it('shows a safe message when workspace authorization rejects the launch', async () => {
    const user = userEvent.setup();
    renderOrderBasket(vi.fn().mockResolvedValue(false));

    await user.click(screen.getByRole('button', { name: 'Add lab order' }));

    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'error',
      title: 'Order form unavailable',
      subtitle: 'The order form could not be opened. Verify your permissions and try again.',
    });
  });
});

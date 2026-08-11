import {
  type ConfigObject,
  getDefaultsFromConfigSchema,
  getLocale,
  openmrsFetch,
  showSnackbar,
  useConfig,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import {
  getDrugOrderByUuid,
  getPatientUuidFromStore,
  type Order,
  useLaunchWorkspaceRequiringVisit,
  useOrderBasket,
  useOrderTypes,
  usePatientOrders,
} from '@openmrs/esm-patient-common-lib';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReactToPrint } from 'react-to-print';
import { mockOrders, mockSessionDataResponse } from 'test-utils';

import { configSchema } from '../config-schema';
import spanishTranslations from '../../translations/es.json';

import OrderDetailsTable from './orders-details-table.component';

const mockUsePatientOrders = usePatientOrders as vi.Mock;
const mockUseOrderTypes = useOrderTypes as vi.Mock;
const mockOpenmrsFetch = openmrsFetch as vi.Mock;
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockGetLocale = vi.mocked(getLocale);
const mockSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseReactToPrint = vi.mocked(useReactToPrint);
const mockGetDrugOrderByUuid = getDrugOrderByUuid as vi.Mock;
const mockGetPatientUuidFromStore = getPatientUuidFromStore as vi.Mock;
const mockUseLaunchWorkspaceRequiringVisit = useLaunchWorkspaceRequiringVisit as vi.Mock;
const mockUseOrderBasket = useOrderBasket as vi.Mock;
const mockSetOrders = vi.fn();
const mockLaunchOrderBasket = vi.fn();
const mockLaunchAddDrugOrder = vi.fn();
const mockLaunchModifyLabOrder = vi.fn();
const mockLaunchModifyGeneralOrder = vi.fn();
const mockLaunchCancelOrder = vi.fn();
let mockBasketOrders: Array<unknown> = [];
const translationMock = vi.hoisted(() => {
  const values: Record<string, string> = {};
  const t = (key: string, defaultValue?: string) => values[key] ?? defaultValue ?? key;
  return { t, values };
});

mockSession.mockReturnValue(mockSessionDataResponse.data);
mockGetLocale.mockReturnValue('en');
mockOpenmrsFetch.mockImplementation((url: string) => {
  if (url && url.includes('/fulfillerdetails')) {
    return Promise.resolve({ status: 200 });
  }
  return Promise.resolve({ data: { uuid: 'mock-uuid', display: 'Mock' } });
});

vi.mock('react-to-print', async () => ({
  ...(await vi.importActual('react-to-print')),
  useReactToPrint: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translationMock.t }),
}));

vi.mock('@carbon/react', async () => {
  const originalModule = await vi.importActual('@carbon/react');

  return {
    ...originalModule,
    DatePicker: ({ children }) => <div>{children}</div>,
    DatePickerInput: ({ labelText, ...props }) => <input aria-label={labelText ?? ''} {...props} />,
  };
});

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    getDrugOrderByUuid: vi.fn(),
    getPatientUuidFromStore: vi.fn(),
    useLaunchWorkspaceRequiringVisit: vi.fn(),
    useOrderBasket: vi.fn(),
    usePatientOrders: vi.fn(),
    useOrderTypes: vi.fn(),
    usePatient: vi.fn(),
  };
});

describe('OrderDetailsTable', () => {
  const user = userEvent.setup();
  const testOrderTypeUuid = '52a447d3-a64a-11e3-9aeb-50e549534c5e';
  const drugOrderTypeUuid = '131168f4-15f5-102d-96e4-000c29c2a5d7';
  const medicationsEditPrivilege = 'app:hoja.clinica.medicamentos.editar';
  const ordersEditPrivilege = 'app:hoja.clinica.ordenes.editar';
  const basketWindowPrivilege = 'app:hoja.clinica.canastaOrdenes';
  const drugOrder = mockOrders.find((order) => order.type === 'drugorder') as unknown as Order;
  const testOrder = mockOrders.find((order) => order.type === 'testorder') as unknown as Order;
  const hydratedDrugOrder = {
    ...drugOrder,
    encounter: {
      ...drugOrder.encounter,
      visit: undefined,
    },
  } as Order;
  const secondDrugOrder = {
    ...drugOrder,
    uuid: 'second-drug-order-uuid',
    orderNumber: 'ORD-SECOND',
    display: 'Second medication order',
  } as Order;
  const hydratedSecondDrugOrder = {
    ...hydratedDrugOrder,
    ...secondDrugOrder,
  } as Order;
  const generalOrder = {
    ...testOrder,
    uuid: 'general-order-uuid',
    display: 'General order',
    type: 'order',
    orderType: {
      ...testOrder.orderType,
      uuid: 'general-order-type-uuid',
      display: 'General Order',
      name: 'General Order',
    },
  } as unknown as Order;

  beforeEach(() => {
    mockBasketOrders = [];
    mockSetOrders.mockReset();
    mockLaunchOrderBasket.mockReset();
    mockLaunchAddDrugOrder.mockReset();
    mockLaunchModifyLabOrder.mockReset();
    mockLaunchModifyGeneralOrder.mockReset();
    mockLaunchCancelOrder.mockReset();
    mockShowSnackbar.mockReset();
    mockSession.mockReturnValue(mockSessionDataResponse.data);
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    mockUserHasAccess.mockReturnValue(true);
    mockGetDrugOrderByUuid.mockReset();
    mockGetDrugOrderByUuid.mockResolvedValue({ data: hydratedDrugOrder });
    mockGetPatientUuidFromStore.mockReset();
    mockGetPatientUuidFromStore.mockReturnValue('mock-patient-uuid');
    mockUseOrderBasket.mockReset();
    mockUseOrderBasket.mockImplementation(() => ({
      clearOrders: vi.fn(),
      orders: mockBasketOrders,
      setOrders: mockSetOrders,
    }));
    mockUseLaunchWorkspaceRequiringVisit.mockReset();
    mockUseLaunchWorkspaceRequiringVisit.mockImplementation((workspaceName: string) => {
      switch (workspaceName) {
        case 'order-basket':
          return mockLaunchOrderBasket;
        case 'add-drug-order':
          return mockLaunchAddDrugOrder;
        case 'add-lab-order':
          return mockLaunchModifyLabOrder;
        case 'orderable-concept-workspace':
          return mockLaunchModifyGeneralOrder;
        case 'patient-orders-form-workspace':
          return mockLaunchCancelOrder;
        default:
          return vi.fn();
      }
    });
  });

  function renderSingleOrder(order: Order, privileges: Array<string>, basketOrders: Array<unknown> = []) {
    return renderOrders([order], privileges, basketOrders);
  }

  function renderOrders(orders: Array<Order>, privileges: Array<string>, basketOrders: Array<unknown> = []) {
    mockBasketOrders = basketOrders;
    mockGetPatientUuidFromStore.mockReturnValue(orders[0].patient?.uuid ?? 'mock-patient-uuid');
    mockUserHasAccess.mockImplementation((privilege) =>
      Array.isArray(privilege)
        ? privilege.every((entry) => privileges.includes(entry))
        : privileges.includes(privilege),
    );
    mockUseOrderTypes.mockReturnValue({
      data: [orders[0].orderType],
      error: null,
      isLoading: false,
      isValidating: false,
    });
    mockUsePatientOrders.mockReturnValue({
      data: orders,
      error: undefined,
      isLoading: false,
      isValidating: false,
    });

    return render(
      <OrderDetailsTable
        patientUuid={orders[0].patient?.uuid ?? 'mock-patient-uuid'}
        showAddButton
        showPrintButton
        title="Patient Orders"
      />,
    );
  }

  async function openActionsMenu() {
    await user.click(screen.getByRole('button', { name: /options/i }));
  }

  function expectNoPreSaveMutation() {
    expect(mockSetOrders).toHaveBeenCalledTimes(0);
    expect(
      mockOpenmrsFetch.mock.calls.some(
        ([, options]) => (options as { method?: string } | undefined)?.method?.toUpperCase() === 'POST',
      ),
    ).toBe(false);
  }

  it('renders a loading state when fetching orders', async () => {
    mockUseOrderTypes.mockReturnValue({
      data: [],
      error: null,
      isLoading: true,
      isValidating: false,
    });
    mockUsePatientOrders.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: true,
      isValidating: false,
    });

    renderOrderDetailsTable();

    await screen.findByRole('combobox', { name: /select order type/i });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders an error state if there is a problem fetching orders', async () => {
    const error = {
      message: 'You are not logged in',
      response: {
        status: 401,
        statusText: 'Unauthorized',
      },
    };
    mockUseOrderTypes.mockReturnValue({
      data: [],
      error: error,
      isLoading: false,
      isValidating: false,
    });
    mockUsePatientOrders.mockReturnValue({
      data: [],
      error: error,
      isLoading: false,
      isValidating: false,
    });

    renderOrderDetailsTable();

    await screen.findByRole('combobox', { name: /select order type/i });
    expect(screen.getByText(/there was a problem displaying this information/i)).toBeInTheDocument();
  });

  it('renders a tabular overview of order data when data is available', async () => {
    mockUseOrderTypes.mockReturnValue({
      data: [
        {
          uuid: 'Drug Order',
          display: 'Routine',
        },
        {
          uuid: 'Lab Order',
          display: 'Urgent',
        },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
    });
    mockUsePatientOrders.mockReturnValue({
      data: mockOrders,
      error: undefined,
      isLoading: false,
      isValidating: false,
    });

    renderOrderDetailsTable();

    const columns = {
      orderNumber: /order number/,
      dateOfOrder: /date of order/,
      orderType: /order type/,
      order: /^order$/,
      priority: /priority/,
      orderedBy: /ordered by/,
      status: /status/,
    };

    await screen.findByRole('table');

    Object.values(columns).forEach((headerText) => {
      expect(screen.getAllByText(new RegExp(headerText, 'i')).length).toBeGreaterThan(0);
    });

    const expectedOrder = {
      orderNumber: 'ORD-321',
      date: '22-Nov-2024',
      type: 'Drug order',
      detailedInstructions: 'Permethrin: 1\\.0 Ampule\\(s\\) Oral Once daily 1 Days take after eating',
      orderedBy: 'admin - Super User',
    };

    Object.values(expectedOrder).forEach((content) => {
      expect(screen.getByRole('cell', { name: new RegExp(content, 'i') })).toBeInTheDocument();
    });
  });

  it('filters the orders list when the user types into the searchbox', async () => {
    mockUseOrderTypes.mockReturnValue({
      data: [
        { uuid: drugOrderTypeUuid, display: 'Drug Order' },
        { uuid: testOrderTypeUuid, display: 'Test Order' },
      ],
      isLoading: false,
      error: null,
      isValidating: false,
    });
    mockUsePatientOrders.mockReturnValue({
      data: mockOrders,
      error: undefined,
      isLoading: false,
      isValidating: false,
    });

    renderOrderDetailsTable();

    await screen.findByRole('table');

    const searchbox = screen.getByRole('searchbox');
    await user.type(searchbox, 'perm');

    expect(
      screen.getByRole('cell', {
        name: /\(NEW\) Permethrin: 1\.0 Ampule\(s\) Oral Once daily 1 Days take after eating/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('cell', {
        name: /serum chloride/i,
      }),
    ).not.toBeInTheDocument();

    await user.type(searchbox, 'marco polo');

    expect(screen.getByText(/no matching orders to display/i)).toBeInTheDocument();
    expect(screen.getByText(/check the filters above/i)).toBeInTheDocument();
  });

  it('filters the table to show only drug orders or test orders based on the dropdown filter', async () => {
    const allOrders = mockOrders;
    const testOrders = mockOrders.filter((order) => order.orderType.uuid === testOrderTypeUuid);

    mockUseOrderTypes.mockReturnValue({
      data: [
        { uuid: drugOrderTypeUuid, display: 'Drug Order' },
        { uuid: testOrderTypeUuid, display: 'Test Order' },
      ],
      isLoading: false,
      error: null,
      isValidating: false,
    });

    mockUsePatientOrders.mockImplementation((_patientUuid, _status, orderType) => ({
      data: orderType ? testOrders : allOrders,
      error: undefined,
      isLoading: false,
      isValidating: false,
    }));

    renderOrderDetailsTable();

    await screen.findByRole('table');

    const orderTypeSelector = screen.getByRole('combobox', {
      name: /select order type/i,
    });

    await user.click(orderTypeSelector);
    await user.click(screen.getByRole('option', { name: /test order/i }));

    expect(
      screen.queryByRole('cell', {
        name: /drug order/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('prints the orders in the list when the print button is clicked', async () => {
    const mockHandlePrint = vi.fn();

    mockUseReactToPrint.mockReturnValue(mockHandlePrint);
    mockUseOrderTypes.mockReturnValue({
      data: [
        { uuid: drugOrderTypeUuid, display: 'Drug Order' },
        { uuid: testOrderTypeUuid, display: 'Test Order' },
      ],
      error: null,
      isLoading: false,
      isValidating: false,
    });
    mockUsePatientOrders.mockReturnValue({
      data: mockOrders,
      error: undefined,
      isLoading: false,
      isValidating: false,
    });
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      showPrintButton: true,
    });

    renderOrderDetailsTable();

    const printButton = screen.getByRole('button', { name: /print/i });
    expect(printButton).toBeInTheDocument();

    await user.click(printButton);

    expect(mockHandlePrint).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      cancelVisible: true,
      label: 'allows medication modification with the medication edit privilege and basket access',
      modifyVisible: true,
      order: drugOrder,
      privileges: [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege],
    },
    {
      cancelVisible: false,
      label: 'offers no action without the basket window privilege, even with both edit privileges',
      modifyVisible: false,
      order: drugOrder,
      privileges: [medicationsEditPrivilege, ordersEditPrivilege],
    },
    {
      cancelVisible: false,
      label: 'offers no action without the orders edit privilege, even with the basket window',
      modifyVisible: false,
      order: drugOrder,
      privileges: [medicationsEditPrivilege, basketWindowPrivilege],
    },
    {
      cancelVisible: true,
      label: 'does not allow medication modification with only the orders edit privilege',
      modifyVisible: false,
      order: drugOrder,
      privileges: [ordersEditPrivilege, basketWindowPrivilege],
    },
    {
      cancelVisible: true,
      label: 'allows test-order modification with the orders edit privilege',
      modifyVisible: true,
      order: testOrder,
      privileges: [ordersEditPrivilege, basketWindowPrivilege],
    },
    {
      cancelVisible: false,
      label: 'does not allow test-order modification with only the medication edit privilege',
      modifyVisible: false,
      order: testOrder,
      privileges: [medicationsEditPrivilege],
    },
    {
      cancelVisible: true,
      label: 'allows general-order modification with the orders edit privilege',
      modifyVisible: true,
      order: generalOrder,
      privileges: [ordersEditPrivilege, basketWindowPrivilege],
    },
    {
      cancelVisible: false,
      label: 'does not allow general-order modification with only the medication edit privilege',
      modifyVisible: false,
      order: generalOrder,
      privileges: [medicationsEditPrivilege],
    },
  ])('$label', async ({ cancelVisible, modifyVisible, order, privileges }) => {
    renderSingleOrder(order, privileges);

    const actionsMenu = screen.queryByRole('button', { name: /options/i });
    if (!modifyVisible && !cancelVisible) {
      expect(actionsMenu).not.toBeInTheDocument();
      return;
    }

    expect(actionsMenu).toBeInTheDocument();
    if (!actionsMenu) {
      throw new Error('Expected an actions menu for an authorized order action.');
    }
    await user.click(actionsMenu);

    if (modifyVisible) {
      expect(screen.getByText('Modify order')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Modify order')).not.toBeInTheDocument();
    }
    if (cancelVisible) {
      expect(screen.getByText('Cancel order')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Cancel order')).not.toBeInTheDocument();
    }
  });

  it('hydrates a drug order and adds the revision to the basket opening the basket', async () => {
    renderSingleOrder(drugOrder, [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege]);

    await openActionsMenu();
    await user.click(screen.getByText('Modify order'));

    await waitFor(() => expect(mockSetOrders).toHaveBeenCalledTimes(1));
    expect(mockGetDrugOrderByUuid).toHaveBeenCalledWith(drugOrder.uuid);
    expect(mockSetOrders).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'REVISE',
          previousOrder: drugOrder.uuid,
        }),
      ]),
    );
    expect(mockLaunchOrderBasket).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: 'test order',
      order: testOrder,
    },
    {
      label: 'general order',
      order: generalOrder,
    },
  ])('adds the $label revision to the basket, and opens the basket', async ({ order }) => {
    renderSingleOrder(order, [ordersEditPrivilege, basketWindowPrivilege]);

    await openActionsMenu();
    await user.click(screen.getByText('Modify order'));

    await waitFor(() => expect(mockSetOrders).toHaveBeenCalledTimes(1));
    expect(mockSetOrders).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'REVISE',
          previousOrder: order.uuid,
        }),
      ]),
    );
    expect(mockLaunchOrderBasket).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      label: 'test order',
      order: testOrder,
    },
    {
      label: 'general order',
      order: generalOrder,
    },
  ])('does not modify the $label after the patient-chart store changes', async ({ order }) => {
    renderSingleOrder(order, [ordersEditPrivilege, basketWindowPrivilege]);

    await openActionsMenu();
    mockGetPatientUuidFromStore.mockReturnValue('another-patient-uuid');
    await user.click(screen.getByText('Modify order'));

    expect(mockSetOrders).not.toHaveBeenCalled();
    expect(mockLaunchOrderBasket).not.toHaveBeenCalled();
    expect(mockGetDrugOrderByUuid).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expectNoPreSaveMutation();
  });

  it('shows a visible error and does not modify the drug order when drug-order hydration fails', async () => {
    const hydrationError = new Error('Network unavailable');
    mockGetDrugOrderByUuid.mockRejectedValue(hydrationError);
    renderSingleOrder(drugOrder, [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege]);

    await openActionsMenu();
    await user.click(screen.getByText('Modify order'));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: 'The medication order could not be loaded. Please try again.',
          title: 'Error loading medication order',
        }),
      ),
    );
    expect(mockSetOrders).not.toHaveBeenCalled();
    expect(mockLaunchOrderBasket).not.toHaveBeenCalled();
    expectNoPreSaveMutation();
  });

  it('provides Spanish copy for the drug-order hydration error', () => {
    expect(spanishTranslations.errorLoadingDrugOrder).toBe('Error al cargar la orden de medicamento');
    expect(spanishTranslations.errorLoadingDrugOrderMessage).toBe(
      'No se pudo cargar la orden de medicamento. Intente nuevamente.',
    );
  });

  it('discards a drug hydration result after the patient context changes', async () => {
    const hydration = createDeferred<{ data: Order }>();
    mockGetDrugOrderByUuid.mockReturnValue(hydration.promise);
    const { rerender } = renderSingleOrder(drugOrder, [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege]);

    await openActionsMenu();
    await user.click(screen.getByText('Modify order'));
    expect(mockGetDrugOrderByUuid).toHaveBeenCalledTimes(1);

    rerender(
      <OrderDetailsTable patientUuid="another-patient-uuid" showAddButton showPrintButton title="Patient Orders" />,
    );
    await act(async () => {
      hydration.resolve({ data: hydratedDrugOrder });
      await hydration.promise;
    });

    expect(mockSetOrders).not.toHaveBeenCalled();
    expect(mockLaunchOrderBasket).not.toHaveBeenCalled();
    expectNoPreSaveMutation();
  });

  it('discards a drug hydration error after unmount without showing stale feedback', async () => {
    const hydration = createDeferred<{ data: Order }>();
    const settledHydration = hydration.promise.catch(() => undefined);
    mockGetDrugOrderByUuid.mockReturnValue(hydration.promise);
    const { unmount } = renderSingleOrder(drugOrder, [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege]);

    await openActionsMenu();
    await user.click(screen.getByText('Modify order'));
    expect(mockGetDrugOrderByUuid).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      hydration.reject(new Error('Late hydration failure'));
      await settledHydration;
    });

    expect(mockSetOrders).not.toHaveBeenCalled();
    expect(mockLaunchOrderBasket).not.toHaveBeenCalled();
    expectNoPreSaveMutation();
  });

  it('discards a drug hydration result after the authenticated session changes', async () => {
    const hydration = createDeferred<{ data: Order }>();
    mockGetDrugOrderByUuid.mockReturnValue(hydration.promise);
    const { rerender } = renderSingleOrder(drugOrder, [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege]);

    await openActionsMenu();
    await user.click(screen.getByText('Modify order'));
    expect(mockGetDrugOrderByUuid).toHaveBeenCalledTimes(1);

    mockSession.mockReturnValue({
      ...mockSessionDataResponse.data,
      sessionId: 'another-session-id',
    });
    rerender(
      <OrderDetailsTable
        patientUuid={drugOrder.patient.uuid}
        showAddButton
        showPrintButton
        title="Patient Orders"
      />,
    );
    await act(async () => {
      hydration.resolve({ data: hydratedDrugOrder });
      await hydration.promise;
    });

    expect(mockSetOrders).not.toHaveBeenCalled();
    expect(mockLaunchOrderBasket).not.toHaveBeenCalled();
    expectNoPreSaveMutation();
  });

  it('coalesces repeated Modify clicks while the same drug hydration is in flight', async () => {
    const hydration = createDeferred<{ data: Order }>();
    mockGetDrugOrderByUuid.mockReturnValue(hydration.promise);
    renderSingleOrder(drugOrder, [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege]);

    await openActionsMenu();
    const modifyButton = screen.getByText('Modify order').closest('button');
    if (!modifyButton) {
      throw new Error('Expected the Modify action to be available.');
    }
    act(() => {
      modifyButton.click();
      modifyButton.click();
    });

    expect(mockGetDrugOrderByUuid).toHaveBeenCalledTimes(1);
    await act(async () => {
      hydration.resolve({ data: hydratedDrugOrder });
      await hydration.promise;
    });

    expect(mockSetOrders).toHaveBeenCalledTimes(1);
    expect(mockLaunchOrderBasket).toHaveBeenCalledTimes(1);
  });

  it('modifies only the last-clicked drug order when two hydrations resolve in reverse order', async () => {
    const firstHydration = createDeferred<{ data: Order }>();
    const secondHydration = createDeferred<{ data: Order }>();
    mockGetDrugOrderByUuid.mockImplementation((orderUuid: string) => {
      if (orderUuid === drugOrder.uuid) {
        return firstHydration.promise;
      }
      if (orderUuid === secondDrugOrder.uuid) {
        return secondHydration.promise;
      }
      throw new Error(`Unexpected order UUID: ${orderUuid}`);
    });
    renderOrders([drugOrder, secondDrugOrder], [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege]);

    const actionMenus = screen.getAllByRole('button', { name: /options/i });
    expect(actionMenus).toHaveLength(2);
    await user.click(actionMenus[0]);
    await user.click(screen.getByText('Modify order'));
    await user.click(screen.getAllByRole('button', { name: /options/i })[1]);
    await user.click(screen.getByText('Modify order'));

    expect(mockGetDrugOrderByUuid.mock.calls).toEqual([[drugOrder.uuid], [secondDrugOrder.uuid]]);
    await act(async () => {
      secondHydration.resolve({ data: hydratedSecondDrugOrder });
      await secondHydration.promise;
    });
    expect(mockSetOrders).toHaveBeenCalledTimes(1);
    expect(mockSetOrders).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ previousOrder: secondDrugOrder.uuid }),
      ]),
    );

    await act(async () => {
      firstHydration.resolve({ data: hydratedDrugOrder });
      await firstHydration.promise;
    });
    expect(mockSetOrders).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'response UUID differs from the requested order',
      response: { ...hydratedDrugOrder, uuid: 'unexpected-order-uuid' } as Order,
    },
    {
      label: 'response patient differs from the current patient',
      response: {
        ...hydratedDrugOrder,
        patient: { ...hydratedDrugOrder.patient, uuid: 'unexpected-patient-uuid' },
      } as Order,
    },
  ])('fails closed when the hydrated drug-order $label', async ({ response }) => {
    mockGetDrugOrderByUuid.mockResolvedValue({ data: response });
    renderSingleOrder(drugOrder, [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege]);

    await openActionsMenu();
    await user.click(screen.getByText('Modify order'));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'Error loading medication order',
        }),
      ),
    );
    expect(mockSetOrders).not.toHaveBeenCalled();
    expect(mockLaunchOrderBasket).not.toHaveBeenCalled();
    expectNoPreSaveMutation();
  });

  it('discards a drug hydration when medication edit access is revoked before it resolves', async () => {
    const hydration = createDeferred<{ data: Order }>();
    mockGetDrugOrderByUuid.mockReturnValue(hydration.promise);
    const { rerender } = renderSingleOrder(drugOrder, [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege]);

    await openActionsMenu();
    await user.click(screen.getByText('Modify order'));
    expect(mockGetDrugOrderByUuid).toHaveBeenCalledTimes(1);

    mockUserHasAccess.mockReturnValue(false);
    rerender(
      <OrderDetailsTable
        patientUuid={drugOrder.patient.uuid}
        showAddButton
        showPrintButton
        title="Patient Orders"
      />,
    );
    await act(async () => {
      hydration.resolve({ data: hydratedDrugOrder });
      await hydration.promise;
    });

    expect(mockSetOrders).not.toHaveBeenCalled();
    expect(mockLaunchOrderBasket).not.toHaveBeenCalled();
    expectNoPreSaveMutation();
  });

  it('discards a drug hydration when only the patient-chart store changes', async () => {
    const hydration = createDeferred<{ data: Order }>();
    mockGetDrugOrderByUuid.mockReturnValue(hydration.promise);
    renderSingleOrder(drugOrder, [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege]);

    await openActionsMenu();
    await user.click(screen.getByText('Modify order'));
    expect(mockGetDrugOrderByUuid).toHaveBeenCalledTimes(1);

    mockGetPatientUuidFromStore.mockReturnValue('another-patient-uuid');
    await act(async () => {
      hydration.resolve({ data: hydratedDrugOrder });
      await hydration.promise;
    });

    expect(mockSetOrders).not.toHaveBeenCalled();
    expect(mockLaunchOrderBasket).not.toHaveBeenCalled();
    expectNoPreSaveMutation();
  });

  it('disables only Modify when the same revision is already in the basket and preserves Cancel', async () => {
    renderSingleOrder(
      testOrder,
      [ordersEditPrivilege, basketWindowPrivilege],
      [
        {
          action: 'REVISE',
          previousOrder: testOrder.uuid,
        },
      ],
    );

    expect(mockUseOrderBasket.mock.calls.some((args) => args.length === 0)).toBe(true);
    await openActionsMenu();

    const modifyButton = screen.getByText('Modify order').closest('button');
    const cancelButton = screen.getByText('Cancel order').closest('button');
    expect(modifyButton).toBeDisabled();
    expect(cancelButton).toBeEnabled();

    if (!cancelButton) {
      throw new Error('Expected the existing Cancel action to remain available.');
    }
    await user.click(cancelButton);
    expect(mockLaunchCancelOrder).toHaveBeenCalledWith({ order: testOrder });
    expectNoPreSaveMutation();
  });

  it.each([
    {
      basketOrder: {
        action: 'NEW',
        testType: { conceptUuid: testOrder.concept.uuid },
      },
      label: 'test order',
      order: testOrder,
    },
    {
      basketOrder: {
        action: 'NEW',
        concept: { uuid: generalOrder.concept.uuid },
      },
      label: 'general order',
      order: generalOrder,
    },
  ])('disables only Modify when a $label with the same concept is already in its basket', async ({ basketOrder, order }) => {
    renderSingleOrder(order, [ordersEditPrivilege, basketWindowPrivilege], [basketOrder]);

    await openActionsMenu();

    expect(screen.getByText('Modify order').closest('button')).toBeDisabled();
    expect(screen.getByText('Cancel order').closest('button')).toBeEnabled();
    expectNoPreSaveMutation();
  });

  it('does not apply the lab/general concept collision rule to drug orders', async () => {
    renderSingleOrder(
      drugOrder,
      [medicationsEditPrivilege, ordersEditPrivilege, basketWindowPrivilege],
      [
        {
          action: 'NEW',
          concept: { uuid: drugOrder.concept.uuid },
        },
      ],
    );

    await openActionsMenu();

    expect(screen.getByText('Modify order').closest('button')).toBeEnabled();
  });

  it('refreshes translated filter options when locale resources become available', async () => {
    mockUseOrderTypes.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
      isValidating: false,
    });
    mockUsePatientOrders.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
    });

    const { rerender } = renderOrderDetailsTable();
    expect(screen.getAllByText('All').length).toBeGreaterThan(0);

    translationMock.values.all = 'Todos';
    translationMock.values.allOrders = 'Todas las órdenes';
    await act(async () => {
      rerender(
        <OrderDetailsTable
          patientUuid="mock-patient-uuid"
          showAddButton
          showPrintButton
          title="Patient Orders"
        />,
      );
    });

    expect(screen.getAllByText('Todos').length).toBeGreaterThan(0);
    expect(screen.getByText('Todas las órdenes')).toBeInTheDocument();
  });
});

function renderOrderDetailsTable() {
  return render(
    <OrderDetailsTable patientUuid="mock-patient-uuid" showAddButton showPrintButton title="Patient Orders" />,
  );
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

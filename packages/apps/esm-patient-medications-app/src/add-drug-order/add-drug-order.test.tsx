/* eslint-disable testing-library/no-node-access */

import { ExtensionSlot, showSnackbar, UserHasAccess, useSession } from '@openmrs/esm-framework';
import {
  type DrugOrderBasketItem,
  type Order,
  type OrderBasketItem,
  type PostDataPrepFunction,
  postOrder,
  showOrderSuccessToast,
  useOrderBasket,
} from '@openmrs/esm-patient-common-lib';
import { _resetOrderBasketStore } from '@openmrs/esm-patient-common-lib/src/orders/store';
import { getPatientChartStore } from '@openmrs/esm-patient-common-lib/src/store/patient-chart-store';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getByTextWithMarkup,
  mockDrugOrderTemplateApiData,
  mockDrugSearchResultApiData,
  mockFhirPatient,
  mockPatientDrugOrdersApiData,
  mockSessionDataResponse,
} from 'test-utils';
import { buildMedicationOrder } from '../api/api';
import AddDrugOrderWorkspace from './add-drug-order.workspace';
import { getTemplateOrderBasketItem, useDrugSearch, useDrugTemplate } from './drug-search/drug-search.resource';
import ExportedAddDrugOrderWorkspace from './exported-add-drug-order.workspace';

const mockMutateOrders = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual('@openmrs/esm-framework');
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    ...actual,
    showSnackbar: vi.fn(),
    OpenmrsDatePicker: React.forwardRef(
      (_props: Record<string, unknown>, ref: import('react').ForwardedRef<HTMLSpanElement>) =>
        React.createElement('span', { ref }, 'OpenmrsDatePicker'),
    ),
  };
});

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  postOrder: vi.fn(),
  showOrderSuccessToast: vi.fn(),
  useMutatePatientOrders: () => ({ mutate: mockMutateOrders }),
}));

const mockCloseWorkspace = vi.fn();
const mockPostOrder = vi.mocked(postOrder);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockShowOrderSuccessToast = vi.mocked(showOrderSuccessToast);
const mockUseSession = vi.mocked(useSession);
const mockUseDrugSearch = vi.mocked(useDrugSearch);
const mockUseDrugTemplate = vi.mocked(useDrugTemplate);
const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockUserHasAccess = vi.mocked(UserHasAccess);
const usePatientOrdersMock = vi.fn();
const mockPatientB = { ...mockFhirPatient, id: 'patient-b-uuid' } as fhir.Patient;
const prepareIdentityPostData = ((order) => order) as unknown as PostDataPrepFunction;

mockUseSession.mockReturnValue(mockSessionDataResponse.data);
mockExtensionSlot.mockImplementation(() => null);
mockUserHasAccess.mockImplementation(({ children }) => <>{children}</>);

vi.mock('./drug-search/drug-search.resource', async () => ({
  ...(await vi.importActual('./drug-search/drug-search.resource')),
  useDrugSearch: vi.fn(),
  useDrugTemplate: vi.fn(),
}));

vi.mock('../api/api', async () => ({
  ...(await vi.importActual('../api/api')),
  useActivePatientOrders: () => usePatientOrdersMock(),
  useRequireOutpatientQuantity: vi.fn().mockReturnValue({
    requireOutpatientQuantity: false,
    error: null,
    isLoading: false,
  }),
}));

describe('AddDrugOrderWorkspace drug search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(mockSessionDataResponse.data);
    mockPostOrder.mockReset();
    _resetOrderBasketStore();
    getPatientChartStore().setState({
      patient: mockFhirPatient,
      patientUuid: mockFhirPatient.id,
      visitContext: null,
      mutateVisitContext: null,
    });

    mockUseDrugSearch.mockImplementation(() => ({
      isLoading: false,
      drugs: mockDrugSearchResultApiData,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    }));

    mockUseDrugTemplate.mockImplementation((drugUuid) => ({
      templates: mockDrugOrderTemplateApiData[drugUuid] ?? [],
      isLoading: false,
      error: null,
    }));

    usePatientOrdersMock.mockReturnValue({
      isLoading: false,
      data: [],
    });
  });

  test('fails closed when the session has no clinical provider', () => {
    mockUseSession.mockReturnValue({
      ...mockSessionDataResponse.data,
      currentProvider: undefined,
    });

    renderAddDrugOrderWorkspace();

    expect(screen.getByText('Clinical provider required')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  test('looks ok', async () => {
    const user = userEvent.setup();

    renderAddDrugOrderWorkspace();

    await user.type(screen.getByRole('searchbox'), 'Aspirin');
    await screen.findAllByRole('listitem');
    expect(screen.getAllByRole('listitem').length).toEqual(3);
    // Anotates results with dosing info if an order-template was found.
    const aspirin81 = getByTextWithMarkup(/Aspirin 81mg/i);
    expect(aspirin81).toBeInTheDocument();
    expect(aspirin81.closest('[role="listitem"]')).toHaveTextContent(/Aspirin.*81mg.*tablet.*twice daily.*oral/i);
    // Only displays drug name for results without a matching order template
    const aspirin325 = getByTextWithMarkup(/Aspirin 325mg/i);
    expect(aspirin325).toBeInTheDocument();
    expect(aspirin325.closest('[role="listitem"]')).toHaveTextContent(/Aspirin.*325mg.*tablet/i);
    const asprin162 = screen.getByText(/Aspirin 162.5mg/i);
    expect(asprin162).toBeInTheDocument();
    expect(asprin162.closest('[role="listitem"]')).toHaveTextContent(/Aspirin.*162.5mg.*tablet/i);
  });

  test('no buttons to click if the medication is already prescribed', async () => {
    usePatientOrdersMock.mockReturnValue({
      isLoading: false,
      data: [mockPatientDrugOrdersApiData[0]],
    });
    const user = userEvent.setup();

    renderAddDrugOrderWorkspace();

    await user.type(screen.getByRole('searchbox'), 'Aspirin');
    expect(screen.getAllByRole('listitem').length).toEqual(3);
    const aspirin162Div = getByTextWithMarkup(/Aspirin 162.5mg/i).closest('[role="listitem"]');
    expect(aspirin162Div).toHaveTextContent(/Already prescribed/i);
  });

  test('can add items directly to the basket', async () => {
    const user = userEvent.setup();

    renderAddDrugOrderWorkspace();

    await user.type(screen.getByRole('searchbox'), 'Aspirin');
    const { result: hookResult } = renderHook(() =>
      useOrderBasket('medications', ((x) => x) as unknown as PostDataPrepFunction),
    );

    const aspirin325Div = getByTextWithMarkup(/Aspirin 325mg/i).closest('[role="listitem"]') as HTMLElement;
    const aspirin325AddButton = within(aspirin325Div).getByText(/Add to basket/i);
    await user.click(aspirin325AddButton);

    expect(hookResult.current.orders).toEqual([
      expect.objectContaining({
        ...getTemplateOrderBasketItem(mockDrugSearchResultApiData[2], null),
        isOrderIncomplete: true,
        orderer: mockSessionDataResponse.data.currentProvider.uuid,
        startDate: expect.any(Date),
      }),
    ]);
    expect(mockCloseWorkspace).toHaveBeenCalled();
  });

  test('can open the drug form ', async () => {
    const user = userEvent.setup();

    renderAddDrugOrderWorkspace();

    await user.type(screen.getByRole('searchbox'), 'Aspirin');
    const aspirin81Div = getByTextWithMarkup(/Aspirin 81mg/i).closest('[role="listitem"]') as HTMLElement;
    const aspirin81OpenFormButton = within(aspirin81Div).getByText(/Order form/i);
    await user.click(aspirin81OpenFormButton);

    expect(screen.getByText(/Order Form/i)).toBeInTheDocument();
  });

  test('can open an item in the medication form and on saving, it should add the order in the order basket store', async () => {
    const user = userEvent.setup();

    renderAddDrugOrderWorkspace();

    const { result: hookResult } = renderHook(() =>
      useOrderBasket(mockFhirPatient, 'medications', prepareIdentityPostData),
    );
    const { result: patientBHookResult } = renderHook(() =>
      useOrderBasket(mockPatientB, 'medications', prepareIdentityPostData),
    );
    await user.type(screen.getByRole('searchbox'), 'Aspirin');
    const aspirin81Div = getByTextWithMarkup(/Aspirin 81mg/i).closest('[role="listitem"]') as HTMLElement;
    const openFormButton = within(aspirin81Div).getByText(/Order form/i);
    await user.click(openFormButton);

    expect(screen.getByText(/Order Form/i)).toBeInTheDocument();
    const indicationField = screen.getByRole('textbox', { name: 'Indication' });
    await user.type(indicationField, 'Hypertension');
    const freeTextDosageToggle = document.querySelector('#freeTextDosageToggle') as HTMLElement;
    await user.click(freeTextDosageToggle);
    await user.type(screen.getByPlaceholderText(/free text dosage/i), 'Take one tablet by mouth twice daily');
    const saveFormButton = screen.getByText(/Save order/i);
    await waitFor(() => expect(saveFormButton).toBeEnabled());
    act(() => {
      getPatientChartStore().setState({ patient: mockPatientB, patientUuid: mockPatientB.id });
    });
    await user.click(saveFormButton);

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(mockPostOrder).not.toHaveBeenCalled();
    expect(hookResult.current.orders).toEqual([
      expect.objectContaining({
        startDate: expect.any(Date),
        indication: 'Hypertension',
        orderer: mockSessionDataResponse.data.currentProvider.uuid,
      }),
    ]);
    expect(patientBHookResult.current.orders).toEqual([]);
  });

  test('discarding a new order returns to drug search', async () => {
    const user = userEvent.setup();

    renderAddDrugOrderWorkspace();

    await user.type(screen.getByRole('searchbox'), 'Aspirin');
    const aspirin81Div = getByTextWithMarkup(/Aspirin 81mg/i).closest('[role="listitem"]') as HTMLElement;
    await user.click(within(aspirin81Div).getByText(/Order form/i));

    expect(screen.getByText(/Order Form/i)).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();

    await user.click(screen.getByText(/Discard/i));

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
  });

  test('preserves search term when navigating back from order form', async () => {
    const user = userEvent.setup();

    renderAddDrugOrderWorkspace();

    await user.type(screen.getByRole('searchbox'), 'Aspirin');
    const aspirin81Div = getByTextWithMarkup(/Aspirin 81mg/i).closest('[role="listitem"]') as HTMLElement;
    await user.click(within(aspirin81Div).getByText(/Order form/i));

    expect(screen.getByText(/Order Form/i)).toBeInTheDocument();

    await user.click(screen.getByText(/Discard/i));

    expect(screen.getByRole('searchbox')).toHaveValue('Aspirin');
  });

  test('shows a validation error when dose is 0', async () => {
    const user = userEvent.setup();

    renderAddDrugOrderWorkspace();

    await user.type(screen.getByRole('searchbox'), 'Aspirin');
    const aspirin81Div = getByTextWithMarkup(/Aspirin 81mg/i).closest('[role="listitem"]') as HTMLElement;
    await user.click(within(aspirin81Div).getByText(/Order form/i));

    expect(screen.getByText(/Order Form/i)).toBeInTheDocument();

    // Clear the pre-filled dose value and enter 0
    const doseInput = screen.getByRole('spinbutton', { name: /dose/i });
    await user.clear(doseInput);
    await user.type(doseInput, '0');
    await user.click(screen.getByText(/Save order/i));

    expect(await screen.findByText(/dose must be greater than 0/i)).toBeInTheDocument();
  });

  test('updates only the exact REVISE draft for patient A without posting', async () => {
    const user = userEvent.setup();
    const revisedDraft = createRevisedOrder();
    const otherRevisionOfSameDrug = {
      ...revisedDraft,
      previousOrder: 'different-previous-order-uuid',
      indication: 'Keep this revision unchanged',
    };
    const unrelatedMedication = {
      ...revisedDraft,
      action: 'NEW' as const,
      uuid: 'unrelated-medication-order-uuid',
      previousOrder: null,
      commonMedicationName: 'Unrelated medication',
      display: 'Unrelated medication',
      drug: {
        ...revisedDraft.drug,
        uuid: 'unrelated-drug-uuid',
        display: 'Unrelated medication',
      },
    };
    const patientBMedication = {
      ...unrelatedMedication,
      uuid: 'patient-b-medication-order-uuid',
    };
    const { result: patientAHookResult } = renderHook(() =>
      useOrderBasket<DrugOrderBasketItem>(mockFhirPatient, 'medications', prepareIdentityPostData),
    );
    const { result: patientBHookResult } = renderHook(() =>
      useOrderBasket<DrugOrderBasketItem>(mockPatientB, 'medications', prepareIdentityPostData),
    );

    act(() => {
      patientAHookResult.current.setOrders([otherRevisionOfSameDrug, revisedDraft, unrelatedMedication]);
      patientBHookResult.current.setOrders([patientBMedication]);
    });

    renderAddDrugOrderWorkspace({ order: revisedDraft, orderToEditOrdererUuid: '' });

    const indicationField = screen.getByRole('textbox', { name: 'Indication' });
    await user.clear(indicationField);
    await user.type(indicationField, 'Updated draft for patient A');
    const saveButton = screen.getByRole('button', { name: /save order/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(mockPostOrder).not.toHaveBeenCalled();
    expect(patientAHookResult.current.orders).toEqual([
      otherRevisionOfSameDrug,
      expect.objectContaining({
        action: 'REVISE',
        indication: 'Updated draft for patient A',
        previousOrder: revisedDraft.previousOrder,
      }),
      unrelatedMedication,
    ]);
    expect(patientBHookResult.current.orders).toEqual([patientBMedication]);
  });

  test('awaits one backend REVISE POST and leaves every patient basket unchanged', async () => {
    const user = userEvent.setup();
    const revisedOrder = createRevisedOrder();
    const patientAMedication = {
      ...revisedOrder,
      action: 'NEW' as const,
      uuid: 'patient-a-unrelated-medication-uuid',
      previousOrder: null,
    };
    const patientALabOrder = {
      action: 'NEW' as const,
      display: 'Patient A lab order',
      uuid: 'patient-a-lab-order-uuid',
    };
    const patientBMedication = {
      ...patientAMedication,
      uuid: 'patient-b-medication-uuid',
    };
    const request = createDeferred<Awaited<ReturnType<typeof postOrder>>>();
    mockPostOrder.mockReturnValue(request.promise);
    const { result: patientAMedicationsHook } = renderHook(() =>
      useOrderBasket<DrugOrderBasketItem>(mockFhirPatient, 'medications', prepareIdentityPostData),
    );
    const { result: patientALabsHook } = renderHook(() =>
      useOrderBasket<OrderBasketItem>(mockFhirPatient, 'labs', prepareIdentityPostData),
    );
    const { result: patientBMedicationsHook } = renderHook(() =>
      useOrderBasket<DrugOrderBasketItem>(mockPatientB, 'medications', prepareIdentityPostData),
    );

    act(() => {
      patientAMedicationsHook.current.setOrders([patientAMedication]);
      patientALabsHook.current.setOrders([patientALabOrder]);
      patientBMedicationsHook.current.setOrders([patientBMedication]);
    });

    renderAddDrugOrderWorkspace({
      order: revisedOrder,
      orderToEditOrdererUuid: mockPatientDrugOrdersApiData[0].orderer.uuid,
    });

    const saveButton = screen.getByRole('button', { name: /save order/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    const orderForm = document.querySelector('#drugOrderForm') as HTMLFormElement;
    fireEvent.submit(orderForm);
    fireEvent.submit(orderForm);
    await waitFor(() => expect(mockPostOrder).toHaveBeenCalledTimes(1));
    expect(saveButton).toBeDisabled();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();

    await user.click(saveButton);
    expect(mockPostOrder).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve({ data: {} } as Awaited<ReturnType<typeof postOrder>>);
      await request.promise;
    });

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(mockPostOrder).toHaveBeenCalledTimes(1);
    expect(mockMutateOrders).toHaveBeenCalledTimes(1);
    expect(mockShowOrderSuccessToast).toHaveBeenCalledTimes(1);
    expect(mockCloseWorkspace).toHaveBeenCalledTimes(1);
    expect(patientAMedicationsHook.current.orders).toEqual([patientAMedication]);
    expect(patientALabsHook.current.orders).toEqual([patientALabOrder]);
    expect(patientBMedicationsHook.current.orders).toEqual([patientBMedication]);
  });

  test('suppresses stale success UI after navigating from patient A to patient B', async () => {
    const revisedOrder = createRevisedOrder();
    const patientBRevisedOrder = {
      ...createRevisedOrder(),
      uuid: 'stale-success-patient-b-revision-uuid',
      previousOrder: 'stale-success-patient-b-previous-order-uuid',
    };
    const patientAMedication = {
      ...revisedOrder,
      action: 'NEW' as const,
      uuid: 'stale-success-patient-a-medication-uuid',
      previousOrder: null,
    };
    const patientBMedication = {
      ...patientAMedication,
      uuid: 'stale-success-patient-b-medication-uuid',
    };
    const request = createDeferred<Awaited<ReturnType<typeof postOrder>>>();
    mockPostOrder.mockReturnValue(request.promise);
    const { result: patientAHookResult } = renderHook(() =>
      useOrderBasket<DrugOrderBasketItem>(mockFhirPatient, 'medications', prepareIdentityPostData),
    );
    const { result: patientBHookResult } = renderHook(() =>
      useOrderBasket<DrugOrderBasketItem>(mockPatientB, 'medications', prepareIdentityPostData),
    );
    act(() => {
      patientAHookResult.current.setOrders([patientAMedication]);
      patientBHookResult.current.setOrders([patientBMedication]);
    });

    const workspace = renderAddDrugOrderWorkspace({
      order: revisedOrder,
      orderToEditOrdererUuid: mockPatientDrugOrdersApiData[0].orderer.uuid,
    });
    fireEvent.submit(document.querySelector('#drugOrderForm') as HTMLFormElement);
    await waitFor(() => expect(mockPostOrder).toHaveBeenCalledTimes(1));

    act(() => {
      getPatientChartStore().setState({ patient: mockPatientB, patientUuid: mockPatientB.id });
    });
    workspace.rerender(
      getAddDrugOrderWorkspaceElement({
        order: patientBRevisedOrder,
        orderToEditOrdererUuid: mockPatientDrugOrdersApiData[0].orderer.uuid,
        patient: mockPatientB,
      }),
    );
    await act(async () => {
      request.resolve({ data: {} } as Awaited<ReturnType<typeof postOrder>>);
      await request.promise;
    });

    await waitFor(() => expect(mockMutateOrders).toHaveBeenCalledTimes(1));
    expect(mockShowOrderSuccessToast).not.toHaveBeenCalled();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
    expect(patientAHookResult.current.orders).toEqual([patientAMedication]);
    expect(patientBHookResult.current.orders).toEqual([patientBMedication]);
  });

  test('does not POST patient A form data after the patient chart switches to patient B', async () => {
    const revisedOrder = createRevisedOrder();
    renderAddDrugOrderWorkspace({
      order: revisedOrder,
      orderToEditOrdererUuid: mockPatientDrugOrdersApiData[0].orderer.uuid,
    });

    await act(async () => {
      fireEvent.submit(document.querySelector('#drugOrderForm') as HTMLFormElement);
      getPatientChartStore().setState({ patient: mockPatientB, patientUuid: mockPatientB.id });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPostOrder).not.toHaveBeenCalled();
    expect(mockMutateOrders).not.toHaveBeenCalled();
    expect(mockShowOrderSuccessToast).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
  });

  test('suppresses stale success UI when the submitting workspace is replaced for the same patient', async () => {
    const revisedOrder = createRevisedOrder();
    const request = createDeferred<Awaited<ReturnType<typeof postOrder>>>();
    mockPostOrder.mockReturnValue(request.promise);
    const firstWorkspace = renderAddDrugOrderWorkspace({
      order: revisedOrder,
      orderToEditOrdererUuid: mockPatientDrugOrdersApiData[0].orderer.uuid,
    });
    fireEvent.submit(document.querySelector('#drugOrderForm') as HTMLFormElement);
    await waitFor(() => expect(mockPostOrder).toHaveBeenCalledTimes(1));

    firstWorkspace.unmount();
    renderAddDrugOrderWorkspace({
      order: revisedOrder,
      orderToEditOrdererUuid: mockPatientDrugOrdersApiData[0].orderer.uuid,
    });
    await act(async () => {
      request.resolve({ data: {} } as Awaited<ReturnType<typeof postOrder>>);
      await request.promise;
    });

    await waitFor(() => expect(mockMutateOrders).toHaveBeenCalledTimes(1));
    expect(mockShowOrderSuccessToast).not.toHaveBeenCalled();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
  });

  test('suppresses a stale error after navigating to another patient', async () => {
    const revisedOrder = createRevisedOrder();
    const request = createDeferred<Awaited<ReturnType<typeof postOrder>>>();
    mockPostOrder.mockReturnValue(request.promise);
    renderAddDrugOrderWorkspace({
      order: revisedOrder,
      orderToEditOrdererUuid: mockPatientDrugOrdersApiData[0].orderer.uuid,
    });
    const saveButton = screen.getByRole('button', { name: /save order/i });
    fireEvent.submit(document.querySelector('#drugOrderForm') as HTMLFormElement);
    await waitFor(() => expect(mockPostOrder).toHaveBeenCalledTimes(1));

    act(() => {
      getPatientChartStore().setState({ patient: mockPatientB, patientUuid: mockPatientB.id });
    });
    await act(async () => {
      request.reject(new Error('Stale backend error'));
      await request.promise.catch(() => undefined);
    });

    await waitFor(() => expect(saveButton).toBeEnabled());
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
  });

  test('submits each exported patient transaction independently and only completes the current one', async () => {
    const patientARevisedOrder = createRevisedOrder();
    const patientBRevisedOrder = {
      ...createRevisedOrder(),
      uuid: 'exported-patient-b-revision-uuid',
      previousOrder: 'exported-patient-b-previous-order-uuid',
    };
    const patientARequest = createDeferred<Awaited<ReturnType<typeof postOrder>>>();
    const patientBRequest = createDeferred<Awaited<ReturnType<typeof postOrder>>>();
    mockPostOrder.mockReturnValueOnce(patientARequest.promise).mockReturnValueOnce(patientBRequest.promise);

    act(() => {
      // Exported workspaces can run outside the chart and must not depend on this global store.
      getPatientChartStore().setState({ patient: mockPatientB, patientUuid: mockPatientB.id });
    });
    const workspace = renderExportedAddDrugOrderWorkspace({
      order: patientARevisedOrder,
      orderToEditOrdererUuid: mockPatientDrugOrdersApiData[0].orderer.uuid,
      patient: mockFhirPatient,
    });
    fireEvent.submit(document.querySelector('#drugOrderForm') as HTMLFormElement);
    await waitFor(() => expect(mockPostOrder).toHaveBeenCalledTimes(1));

    workspace.rerender(
      getExportedAddDrugOrderWorkspaceElement({
        order: patientBRevisedOrder,
        orderToEditOrdererUuid: mockPatientDrugOrdersApiData[0].orderer.uuid,
        patient: mockPatientB,
      }),
    );
    fireEvent.submit(document.querySelector('#drugOrderForm') as HTMLFormElement);
    await waitFor(() => expect(mockPostOrder).toHaveBeenCalledTimes(2));
    expect(mockPostOrder.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        patient: mockFhirPatient.id,
        previousOrder: patientARevisedOrder.previousOrder,
      }),
    );
    expect(mockPostOrder.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        patient: mockPatientB.id,
        previousOrder: patientBRevisedOrder.previousOrder,
      }),
    );

    await act(async () => {
      patientARequest.resolve({ data: {} } as Awaited<ReturnType<typeof postOrder>>);
      await patientARequest.promise;
    });
    await waitFor(() => expect(mockMutateOrders).toHaveBeenCalledTimes(1));
    expect(mockShowOrderSuccessToast).not.toHaveBeenCalled();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();

    fireEvent.submit(document.querySelector('#drugOrderForm') as HTMLFormElement);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockPostOrder).toHaveBeenCalledTimes(2);

    await act(async () => {
      patientBRequest.resolve({ data: {} } as Awaited<ReturnType<typeof postOrder>>);
      await patientBRequest.promise;
    });
    await waitFor(() => expect(mockMutateOrders).toHaveBeenCalledTimes(2));
    expect(mockShowOrderSuccessToast).toHaveBeenCalledTimes(1);
    expect(mockCloseWorkspace).toHaveBeenCalledTimes(1);
    expect(mockCloseWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true });
  });

  test('keeps the backend REVISE workspace and basket intact when the POST fails', async () => {
    const user = userEvent.setup();
    const revisedOrder = createRevisedOrder();
    const { result: patientAHookResult } = renderHook(() =>
      useOrderBasket<DrugOrderBasketItem>(mockFhirPatient, 'medications', prepareIdentityPostData),
    );
    act(() => {
      patientAHookResult.current.setOrders([revisedOrder]);
    });
    mockPostOrder.mockRejectedValueOnce(new Error('Backend unavailable'));

    renderAddDrugOrderWorkspace({
      order: revisedOrder,
      orderToEditOrdererUuid: mockPatientDrugOrdersApiData[0].orderer.uuid,
    });

    const saveButton = screen.getByRole('button', { name: /save order/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', subtitle: 'Backend unavailable' }),
      ),
    );
    await waitFor(() => expect(saveButton).toBeEnabled());
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
    expect(screen.getByText(/order form/i)).toBeInTheDocument();
    expect(patientAHookResult.current.orders).toEqual([revisedOrder]);
  });
});

function createRevisedOrder(): DrugOrderBasketItem {
  const revisedOrder = buildMedicationOrder(mockPatientDrugOrdersApiData[0] as unknown as Order, 'REVISE');
  return {
    ...revisedOrder,
    dosage: null,
    freeTextDosage: 'Take one tablet by mouth once daily',
    frequency: null,
    isFreeTextDosage: true,
    patientInstructions: revisedOrder.patientInstructions ?? '',
    route: null,
    unit: null,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function renderAddDrugOrderWorkspace({
  order = null,
  orderToEditOrdererUuid = null,
  patient = mockFhirPatient,
}: {
  order?: DrugOrderBasketItem | null;
  orderToEditOrdererUuid?: string | null;
  patient?: fhir.Patient;
} = {}) {
  return render(getAddDrugOrderWorkspaceElement({ order, orderToEditOrdererUuid, patient }));
}

function getAddDrugOrderWorkspaceElement({
  order = null,
  orderToEditOrdererUuid = null,
  patient = mockFhirPatient,
}: {
  order?: DrugOrderBasketItem | null;
  orderToEditOrdererUuid?: string | null;
  patient?: fhir.Patient;
} = {}) {
  return (
    <AddDrugOrderWorkspace
      workspaceProps={{
        order,
        orderToEditOrdererUuid,
      }}
      groupProps={{
        patientUuid: patient.id,
        patient,
        visitContext: null,
        mutateVisitContext: null,
      }}
      workspaceName={''}
      launchChildWorkspace={vi.fn()}
      closeWorkspace={mockCloseWorkspace}
      windowProps={{
        encounterUuid: '',
      }}
      windowName={''}
      isRootWorkspace={false}
      showActionMenu={false}
    />
  );
}

function renderExportedAddDrugOrderWorkspace({
  order = null,
  orderToEditOrdererUuid = null,
  patient = mockFhirPatient,
}: {
  order?: DrugOrderBasketItem | null;
  orderToEditOrdererUuid?: string | null;
  patient?: fhir.Patient;
} = {}) {
  return render(getExportedAddDrugOrderWorkspaceElement({ order, orderToEditOrdererUuid, patient }));
}

function getExportedAddDrugOrderWorkspaceElement({
  order = null,
  orderToEditOrdererUuid = null,
  patient = mockFhirPatient,
}: {
  order?: DrugOrderBasketItem | null;
  orderToEditOrdererUuid?: string | null;
  patient?: fhir.Patient;
} = {}) {
  return (
    <ExportedAddDrugOrderWorkspace
      workspaceProps={{
        order,
        orderToEditOrdererUuid,
      }}
      groupProps={null}
      windowProps={{
        patientUuid: patient.id,
        patient,
        visitContext: null as never,
      }}
      workspaceName={''}
      launchChildWorkspace={vi.fn()}
      closeWorkspace={mockCloseWorkspace}
      windowName={''}
      isRootWorkspace={false}
      showActionMenu={false}
    />
  );
}

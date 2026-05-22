/* eslint-disable testing-library/no-node-access */

import { ExtensionSlot, UserHasAccess, useSession } from '@openmrs/esm-framework';
import { type PostDataPrepFunction, useOrderBasket } from '@openmrs/esm-patient-common-lib';
import { _resetOrderBasketStore } from '@openmrs/esm-patient-common-lib/src/orders/store';
import { getPatientChartStore } from '@openmrs/esm-patient-common-lib/src/store/patient-chart-store';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getByTextWithMarkup,
  mockDrugOrderTemplateApiData,
  mockDrugSearchResultApiData,
  mockFhirPatient,
  mockPatientDrugOrdersApiData,
  mockSessionDataResponse,
} from 'test-utils';
import AddDrugOrderWorkspace from './add-drug-order.workspace';
import { getTemplateOrderBasketItem, useDrugSearch, useDrugTemplate } from './drug-search/drug-search.resource';

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual('@openmrs/esm-framework');
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    ...actual,
    OpenmrsDatePicker: React.forwardRef(
      (_props: Record<string, unknown>, ref: import('react').ForwardedRef<HTMLSpanElement>) =>
        React.createElement('span', { ref }, 'OpenmrsDatePicker'),
    ),
  };
});

const mockCloseWorkspace = vi.fn();
const mockUseSession = vi.mocked(useSession);
const mockUseDrugSearch = vi.mocked(useDrugSearch);
const mockUseDrugTemplate = vi.mocked(useDrugTemplate);
const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockUserHasAccess = vi.mocked(UserHasAccess);
const usePatientOrdersMock = vi.fn();

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
      useOrderBasket('medications', ((x) => x) as unknown as PostDataPrepFunction),
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
    await user.click(saveFormButton);

    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalled());
    expect(hookResult.current.orders).toEqual([
      expect.objectContaining({
        startDate: expect.any(Date),
        indication: 'Hypertension',
      }),
    ]);
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
});

function renderAddDrugOrderWorkspace() {
  render(
    <AddDrugOrderWorkspace
      workspaceProps={{
        order: null,
        orderToEditOrdererUuid: null,
      }}
      groupProps={{
        patientUuid: mockFhirPatient.id,
        patient: mockFhirPatient,
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
    />,
  );
}

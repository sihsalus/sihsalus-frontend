import { ActionMenuButton, useLayoutType, usePatient, useWorkspaces } from '@openmrs/esm-framework';
import {
  type OrderBasketItem,
  useLaunchWorkspaceRequiringVisit,
  useOrderBasket,
} from '@openmrs/esm-patient-common-lib';
import { orderBasketStore } from '@openmrs/esm-patient-common-lib/src/orders/store';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';

import OrderBasketActionButton from './order-basket-action-button.extension';

const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUsePatient = vi.mocked(usePatient);
const mockUseWorkspaces = useWorkspaces as vi.Mock;
const MockActionMenuButton = vi.mocked(ActionMenuButton);
const mockUseLaunchWorkspaceRequiringVisit = useLaunchWorkspaceRequiringVisit as vi.Mock;
const mockFhirPatient = mockPatient as unknown as fhir.Patient;

MockActionMenuButton.mockImplementation(({ handler, label, tagContent }) => (
  <button type="button" onClick={handler}>
    {tagContent} {label}
  </button>
));

mockUseWorkspaces.mockReturnValue({
  workspaces: [{ type: 'order' }],
  workspaceWindowState: 'normal',
});

// This pattern of mocking seems to be required: defining the mocked function here and
// then assigning it with an arrow function wrapper in vi.mock. It is very particular.
// I think it is related to this: https://github.com/swc-project/jest/issues/14#issuecomment-1238621942

const mockLaunchPatientWorkspace = vi.fn();
const mockLaunchStartVisitPrompt = vi.fn();
const mockUseVisitOrOfflineVisit = vi.fn(() => ({
  activeVisit: {
    uuid: '8ef90c91-14be-42dd-a1c0-e67fbf904470',
  },
  currentVisit: {
    uuid: '8ef90c91-14be-42dd-a1c0-e67fbf904470',
  },
}));
const mockGetPatientUuidFromUrl = vi.fn(() => mockPatient.id);
const mockUseSystemVisitSetting = vi.fn();

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    getPatientUuidFromUrl: () => mockGetPatientUuidFromUrl(),
    getPatientUuidFromStore: () => mockGetPatientUuidFromUrl(),
    useLaunchWorkspaceRequiringVisit: vi.fn(),
    launchPatientWorkspace: (arg) => mockLaunchPatientWorkspace(arg),
  };
});

vi.mock('@openmrs/esm-patient-common-lib/src/useSystemVisitSetting', async () => {
  return {
    useSystemVisitSetting: () => mockUseSystemVisitSetting(),
  };
});

vi.mock('@openmrs/esm-patient-common-lib/src/launchStartVisitPrompt', async () => {
  return { launchStartVisitPrompt: () => mockLaunchStartVisitPrompt() };
});

vi.mock('@openmrs/esm-patient-common-lib/src/store/patient-chart-store', async () => {
  return {
    getPatientUuidFromStore: () => mockGetPatientUuidFromUrl(),
    usePatientChartStore: () => ({ patientUuid: mockPatient.id }),
  };
});

vi.mock('@openmrs/esm-patient-common-lib/src/offline/visit', async () => {
  return { useVisitOrOfflineVisit: () => mockUseVisitOrOfflineVisit() };
});

mockUsePatient.mockReturnValue({
  patient: mockFhirPatient,
  patientUuid: mockPatient.id,
  isLoading: false,
  error: null,
});
mockUseSystemVisitSetting.mockReturnValue({ systemVisitEnabled: false });

describe('<OrderBasketActionButton/>', () => {
  beforeAll(() => {
    orderBasketStore.setState({
      items: {
        [mockPatient.id]: {
          medications: [{ name: 'order-01', uuid: 'some-uuid' } as unknown as OrderBasketItem],
        },
      },
    });
  });

  beforeEach(() => {
    mockUseLaunchWorkspaceRequiringVisit.mockReturnValue(vi.fn());
  });

  it('should display tablet view action button', async () => {
    const user = userEvent.setup();
    const mockLaunchOrderBasket = vi.fn();
    mockUseLayoutType.mockReturnValue('tablet');
    mockUseLaunchWorkspaceRequiringVisit.mockReturnValue(mockLaunchOrderBasket);
    render(<OrderBasketActionButton />);

    const orderBasketButton = screen.getByRole('button', { name: /Order Basket/i });
    expect(orderBasketButton).toBeInTheDocument();
    await user.click(orderBasketButton);
    expect(mockUseLaunchWorkspaceRequiringVisit).toHaveBeenCalledWith('order-basket');
    expect(mockLaunchOrderBasket).toHaveBeenCalled();
  });

  it('should display desktop view action button', async () => {
    const user = userEvent.setup();
    const mockLaunchOrderBasket = vi.fn();
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockUseLaunchWorkspaceRequiringVisit.mockReturnValue(mockLaunchOrderBasket);
    render(<OrderBasketActionButton />);

    const orderBasketButton = screen.getByRole('button', { name: /order basket/i });
    expect(orderBasketButton).toBeInTheDocument();
    await user.click(orderBasketButton);
    expect(mockUseLaunchWorkspaceRequiringVisit).toHaveBeenCalledWith('order-basket');
    expect(mockLaunchOrderBasket).toHaveBeenCalled();
  });

  it('should render the action button even if no currentVisit is found', async () => {
    const user = userEvent.setup();
    const mockLaunchOrderBasket = vi.fn();
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockUseSystemVisitSetting.mockReturnValue({ systemVisitEnabled: true });
    mockUseVisitOrOfflineVisit.mockImplementation(() => ({
      activeVisit: null,
      currentVisit: null,
    }));
    mockUseLaunchWorkspaceRequiringVisit.mockReturnValue(mockLaunchOrderBasket);

    render(<OrderBasketActionButton />);

    const orderBasketButton = screen.getByRole('button', { name: /order basket/i });
    expect(orderBasketButton).toBeInTheDocument();
    await user.click(orderBasketButton);
    expect(mockUseLaunchWorkspaceRequiringVisit).toHaveBeenCalledWith('order-basket');
    expect(mockLaunchOrderBasket).toHaveBeenCalled();
  });

  it('should display a count tag when orders are present on the desktop view', () => {
    mockUseLayoutType.mockReturnValue('small-desktop');
    const { result } = renderHook(useOrderBasket);
    expect(result.current.orders).toHaveLength(1); // sanity check
    render(<OrderBasketActionButton />);

    expect(screen.getByText(/order basket/i)).toBeInTheDocument();
    expect(screen.getByText(/1/i)).toBeInTheDocument();
  });

  it('should display the count tag when orders are present on the tablet view', () => {
    mockUseLayoutType.mockReturnValue('tablet');
    render(<OrderBasketActionButton />);

    expect(screen.getByRole('button', { name: /1 order basket/i })).toBeInTheDocument();
  });
});

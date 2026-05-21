import {
  closeWorkspace,
  getDefaultsFromConfigSchema,
  useConfig,
  useLayoutType,
  usePatient,
  useSession,
} from '@openmrs/esm-framework';
import { type PostDataPrepFunction, useOrderBasket, useOrderType } from '@openmrs/esm-patient-common-lib';
import { _resetOrderBasketStore } from '@openmrs/esm-patient-common-lib/src/orders/store';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';
import { mockFhirPatient, mockSessionDataResponse } from 'test-utils';

import { type ConfigObject, configSchema } from '../../config-schema';
import { type PostDataPrepLabOrderFunction } from '../api';

import AddLabOrderWorkspace from './add-test-order.workspace';
import { createEmptyLabOrder } from './test-order';

const mockCloseWorkspace = closeWorkspace as vi.Mock;
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUsePatient = vi.mocked(usePatient);
const mockUseSession = vi.mocked(useSession);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseOrderType = vi.mocked(useOrderType);

mockCloseWorkspace.mockImplementation(({ onWorkspaceClose }) => {
  onWorkspaceClose?.();
});

const ptUuid = 'test-patient-uuid';

const mockTestTypes = [
  // {
  //   conceptUuid: 'test-lab-uuid-1',
  //   label: 'HIV VIRAL LOAD',
  //   synonyms: ['HIV VIRAL LOAD', 'HIV VL'],
  // },
  {
    conceptUuid: 'test-lab-uuid-2',
    label: 'CD4 COUNT',
    synonyms: ['CD4 COUNT', 'CD4'],
  },
  // {
  //   conceptUuid: 'test-lab-uuid-3',
  //   label: 'HEMOGLOBIN',
  //   synonyms: ['HEMOGLOBIN', 'HGB'],
  // },
];
const mockUseTestTypes = vi.fn().mockReturnValue({
  testTypes: mockTestTypes,
  isLoading: false,
  error: null,
});

vi.mock('./useTestTypes', async () => ({
  useTestTypes: () => mockUseTestTypes(),
}));

const mockLaunchPatientWorkspace = vi.fn();

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: (...args) => mockLaunchPatientWorkspace(...args),
  useOrderType: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib/src/store/patient-chart-store', async () => ({
  getPatientUuidFromStore: vi.fn(() => ptUuid),
  usePatientChartStore: vi.fn(() => ({
    patientUuid: ptUuid,
  })),
}));

function renderAddLabOrderWorkspace(props: Partial<ComponentProps<typeof AddLabOrderWorkspace>> = {}) {
  const mockCloseWorkspace = vi.fn().mockImplementation(({ onWorkspaceClose }) => {
    onWorkspaceClose();
  });
  const mockCloseWorkspaceWithSavedChanges = vi.fn().mockImplementation(({ onWorkspaceClose }) => {
    onWorkspaceClose();
  });
  const mockPromptBeforeClosing = vi.fn();
  const view = render(
    <AddLabOrderWorkspace
      closeWorkspace={mockCloseWorkspace}
      closeWorkspaceWithSavedChanges={mockCloseWorkspaceWithSavedChanges}
      promptBeforeClosing={mockPromptBeforeClosing}
      patientUuid={ptUuid}
      setTitle={vi.fn()}
      orderTypeUuid="test-lab-order-type-uuid"
      {...props}
    />,
  );
  return { mockCloseWorkspace, mockPromptBeforeClosing, mockCloseWorkspaceWithSavedChanges, ...view };
}

mockUseConfig.mockReturnValue({
  ...getDefaultsFromConfigSchema(configSchema),
  orders: {
    labOrderTypeUuid: 'test-lab-order-type-uuid',
    labOrderableConcepts: [],
  },
  additionalTestOrderTypes: [],
});

mockUseSession.mockReturnValue(mockSessionDataResponse.data);

mockUsePatient.mockReturnValue({
  patient: mockFhirPatient,
  patientUuid: mockFhirPatient.id,
  isLoading: false,
  error: null,
});

mockUseOrderType.mockReturnValue({
  orderType: {
    uuid: 'test-order-type-uuid',
    display: 'Test order',
    javaClassName: 'org.openmrs.TestOrder',
    name: 'Test order',
    retired: false,
    description: '',
    conceptClasses: [],
  },
  isLoadingOrderType: false,
  isValidatingOrderType: false,
  errorFetchingOrderType: undefined,
});

describe('AddLabOrder', () => {
  beforeEach(() => {
    _resetOrderBasketStore();
  });

  test('happy path fill and submit form', async () => {
    const user = userEvent.setup();
    const { result: hookResult } = renderHook(() =>
      useOrderBasket('test-lab-order-type-uuid', ((x) => x) as unknown as PostDataPrepLabOrderFunction),
    );
    const { mockCloseWorkspaceWithSavedChanges } = renderAddLabOrderWorkspace();
    await user.type(screen.getByRole('searchbox'), 'cd4');
    await screen.findByText('CD4 COUNT');

    const cd4OrderButton = screen.getByRole('button', { name: /order form/i });
    await user.click(cd4OrderButton);

    const testTypeLabel = screen.getByText('Test type');
    const testTypeValue = screen.getByText('CD4 COUNT');
    expect(testTypeLabel).toBeInTheDocument();
    expect(testTypeValue).toBeInTheDocument();

    const priority = screen.getByRole('combobox', { name: 'Priority' });
    expect(priority).toBeInTheDocument();
    await user.click(priority);
    await user.selectOptions(priority, 'STAT');

    const additionalInstructions = screen.getByRole('textbox', { name: 'Additional instructions' });
    expect(additionalInstructions).toBeInTheDocument();
    await user.type(additionalInstructions, 'plz do it thx');
    const submit = screen.getByRole('button', { name: 'Save order' });

    expect(submit).toBeInTheDocument();
    await user.click(submit);

    await waitFor(() => {
      expect(hookResult.current.orders).toEqual([
        expect.objectContaining({
          action: 'NEW',
          display: 'CD4 COUNT',
          urgency: 'STAT',
          instructions: 'plz do it thx',
          testType: { label: 'CD4 COUNT', conceptUuid: 'test-lab-uuid-2' },
          orderer: mockSessionDataResponse.data.currentProvider.uuid,
        }),
      ]);
    });

    expect(mockCloseWorkspaceWithSavedChanges).toHaveBeenCalled();
    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('order-basket');
  });

  test('from lab search, click add directly to order basket', async () => {
    const user = userEvent.setup();
    const { result: hookResult } = renderHook(() =>
      useOrderBasket('test-lab-order-type-uuid', ((x) => x) as unknown as PostDataPrepFunction),
    );
    const { mockCloseWorkspace } = renderAddLabOrderWorkspace();
    await user.type(screen.getByRole('searchbox'), 'cd4');
    await screen.findByText('CD4 COUNT');

    const cd4AddToBasketButton = screen.getByRole('button', { name: /add to basket/i });
    await user.click(cd4AddToBasketButton);

    await waitFor(() => {
      expect(hookResult.current.orders).toEqual([
        {
          ...createEmptyLabOrder(mockTestTypes[0], mockSessionDataResponse.data.currentProvider.uuid),
          isOrderIncomplete: true,
        },
      ]);
    });

    expect(mockCloseWorkspace).toHaveBeenCalled();
    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('order-basket');
  });

  test('back to order basket', async () => {
    const user = userEvent.setup();
    const { mockCloseWorkspace } = renderAddLabOrderWorkspace();
    const back = screen.getByText('Back to order basket');
    expect(back).toBeInTheDocument();
    await user.click(back);
    expect(mockCloseWorkspace).toHaveBeenCalled();
    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('order-basket');
  });

  test('uses custom order basket workspace name when returning from legacy workspace', async () => {
    const user = userEvent.setup();
    const { mockCloseWorkspace } = renderAddLabOrderWorkspace({
      orderBasketWorkspaceName: 'add-test-order-basket-workspace',
    });
    const back = screen.getByText('Back to order basket');

    await user.click(back);

    expect(mockCloseWorkspace).toHaveBeenCalled();
    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('add-test-order-basket-workspace');
  });

  test('should display a patient header on tablet', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-03-26T12:00:00Z'));

    try {
      mockUseLayoutType.mockReturnValue('tablet');
      renderAddLabOrderWorkspace();
      expect(screen.getByText(/joshua johnson/i)).toBeInTheDocument();
      expect(screen.getByText(/male/i)).toBeInTheDocument();
      expect(screen.getByText(/6 yrs, 6 mths/i)).toBeInTheDocument();
      expect(screen.getByText('25 — Sept — 2019')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  test('should display an error message if test types fail to load', () => {
    mockUseTestTypes.mockReturnValue({
      testTypes: [],
      isLoading: false,
      error: {
        message: 'test error',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
        },
      },
    });
    renderAddLabOrderWorkspace();
    expect(screen.getByText(/Error/i)).toBeInTheDocument();
  });
});

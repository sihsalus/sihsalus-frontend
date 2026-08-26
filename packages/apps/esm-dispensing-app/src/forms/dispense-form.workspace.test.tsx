import { showModal, showSnackbar, useConfig, usePatient } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveMedicationDispense } from '../medication-dispense/medication-dispense.resource';
import { updateMedicationRequestFulfillerStatus } from '../medication-request/medication-request.resource';
import {
  type MedicationDispense,
  MedicationDispenseStatus,
  type MedicationRequestBundle,
  MedicationRequestFulfillerStatus,
} from '../types';
import { isMedicationRequestFullyDispensed, revalidate } from '../utils';
import DispenseForm from './dispense-form.workspace';

const mockUseConfig = vi.mocked(useConfig);
const mockUsePatient = vi.mocked(usePatient);
const mockShowModal = vi.mocked(showModal);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockCloseWorkspace = vi.fn();
const mockLaunchChildWorkspace = vi.fn();
const mockSaveMedicationDispense = vi.mocked(saveMedicationDispense);
const mockUpdateMedicationRequestFulfillerStatus = vi.mocked(updateMedicationRequestFulfillerStatus);
const mockRevalidate = vi.mocked(revalidate);

vi.mock('../medication-dispense/medication-dispense.resource', () => ({
  __esModule: true,
  saveMedicationDispense: vi.fn(),
}));

vi.mock('../medication-request/medication-request.resource', () => ({
  __esModule: true,
  updateMedicationRequestFulfillerStatus: vi.fn(),
}));

vi.mock('../utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils')>()),
  revalidate: vi.fn(),
}));

// Mock workspace props required by Workspace2DefinitionProps
const mockWorkspaceProps = {
  launchChildWorkspace: mockLaunchChildWorkspace,
  windowProps: {},
  groupProps: {},
  workspaceName: 'dispense-form',
  windowName: 'dispense-form-window',
  isRootWorkspace: true,
  promptBeforeClosing: vi.fn(),
  setTitle: vi.fn(),
  showActionMenu: true,
};

// Mock the child components
vi.mock('./medication-dispense-review.component', () => ({
  __esModule: true,
  default: () => <div>Medication Dispense Review</div>,
}));

vi.mock('./stock-dispense/stock-dispense.component', () => ({
  __esModule: true,
  default: () => <div>Stock Dispense</div>,
}));

const mockPatient = {
  uuid: 'patient-uuid',
  display: 'Test Patient',
  identifiers: [],
  person: {
    age: 30,
    attributes: [],
    birthDate: '1990-01-01',
    gender: 'M',
    display: 'Test Patient',
    preferredAddress: {},
    uuid: 'patient-uuid',
  },
};

const createMockMedicationDispense = (): MedicationDispense => ({
  resourceType: 'MedicationDispense',
  status: MedicationDispenseStatus.completed,
  authorizingPrescription: [
    {
      reference: 'MedicationRequest/request-uuid',
      type: 'MedicationRequest',
    },
  ],
  medicationCodeableConcept: {
    text: 'Test Medication',
    coding: [
      {
        code: 'medication-code',
      },
    ],
  },
  medicationReference: {
    reference: 'Medication/med-uuid',
    display: 'Test Medication',
  },
  subject: {
    reference: 'Patient/patient-uuid',
    display: 'Test Patient',
  },
  performer: [
    {
      actor: {
        reference: 'Practitioner/prac-uuid',
        display: 'Test Practitioner',
      },
    },
  ],
  location: {
    reference: 'Location/loc-uuid',
    display: 'Test Location',
  },
  quantity: {
    value: 30,
    unit: 'tablet',
    code: '385055001',
  },
  dosageInstruction: [
    {
      timing: {
        code: {
          coding: [
            {
              code: 'timing-code',
              display: 'Once daily',
            },
          ],
        },
      },
      asNeededBoolean: false,
      route: {
        coding: [
          {
            code: 'route-code',
            display: 'Oral',
          },
        ],
      },
      doseAndRate: [
        {
          doseQuantity: {
            value: 1,
            code: '385055001',
          },
        },
      ],
    },
  ],
  substitution: {
    wasSubstituted: false,
  },
});

const createMockMedicationRequestBundle = (numberOfRepeatsAllowed: number | null): MedicationRequestBundle => ({
  request: {
    resourceType: 'MedicationRequest',
    id: 'request-uuid',
    meta: {
      lastUpdated: '2023-01-01T00:00:00.000Z',
    },
    status: 'active' as any,
    intent: 'order',
    priority: 'routine',
    medicationReference: {
      reference: 'Medication/med-uuid',
      display: 'Test Medication',
    },
    subject: {
      reference: 'Patient/patient-uuid',
      display: 'Test Patient',
    },
    encounter: {
      reference: 'Encounter/enc-uuid',
      type: 'Encounter',
    },
    requester: {
      reference: 'Practitioner/prac-uuid',
      type: 'Practitioner',
      identifier: {
        value: 'PRAC123',
      },
      display: 'Test Practitioner',
    },
    dosageInstruction: [
      {
        timing: {
          code: {
            coding: [
              {
                code: 'timing-code',
                display: 'Once daily',
              },
            ],
          },
        },
        asNeededBoolean: false,
        route: {
          coding: [
            {
              code: 'route-code',
              display: 'Oral',
            },
          ],
        },
        doseAndRate: [
          {
            doseQuantity: {
              value: 1,
              code: '385055001',
            },
          },
        ],
      },
    ],
    dispenseRequest: {
      numberOfRepeatsAllowed: numberOfRepeatsAllowed,
      quantity: {
        value: 30,
        unit: 'tablet',
        code: '385055001',
      },
      validityPeriod: {
        start: '2023-01-01',
      },
    },
  },
  dispenses: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  mockShowModal.mockReturnValue(vi.fn());
  mockSaveMedicationDispense.mockResolvedValue({ ok: true, status: 201, data: { status: 'completed' } } as any);
  mockUpdateMedicationRequestFulfillerStatus.mockResolvedValue({} as any);
  mockRevalidate.mockResolvedValue(undefined);
  mockUseConfig.mockReturnValue({
    dispenseBehavior: {
      allowModifyingPrescription: false,
      restrictTotalQuantityDispensed: false,
    },
    completeOrderWithThisDispense: true,
    enableStockDispense: false,
  });
  mockUsePatient.mockReturnValue({
    patient: mockPatient,
    isLoading: false,
    error: null,
    patientUuid: 'patient-uuid',
  } as any);
});

describe('DispenseForm - order completion persistence', () => {
  const renderForm = (medicationDispense: MedicationDispense, medicationRequestBundle: MedicationRequestBundle) =>
    render(
      <DispenseForm
        {...mockWorkspaceProps}
        workspaceProps={{
          medicationDispense,
          medicationRequestBundle,
          mode: 'enter',
          patientUuid: 'patient-uuid',
          encounterUuid: 'encounter-uuid',
          quantityRemaining: null,
          quantityDispensed: 0,
        }}
        closeWorkspace={mockCloseWorkspace}
      />,
    );

  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      dispenseBehavior: {
        allowModifyingPrescription: true,
        restrictTotalQuantityDispensed: false,
      },
      completeOrderWithThisDispense: false,
      enableStockDispense: false,
    });
  });

  test('marks a fully dispensed order as completed and refreshes before closing', async () => {
    let finishRefresh!: () => void;
    mockRevalidate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    const medicationDispense = createMockMedicationDispense();
    const medicationRequestBundle = createMockMedicationRequestBundle(0);
    expect(
      isMedicationRequestFullyDispensed({
        request: medicationRequestBundle.request,
        dispenses: [medicationDispense],
      }),
    ).toBe(true);
    renderForm(medicationDispense, medicationRequestBundle);

    await userEvent.click(screen.getByRole('button', { name: /dispense prescription/i }));

    await waitFor(() =>
      expect(mockUpdateMedicationRequestFulfillerStatus).toHaveBeenCalledWith(
        'request-uuid',
        MedicationRequestFulfillerStatus.completed,
      ),
    );
    expect(mockCloseWorkspace).not.toHaveBeenCalled();

    finishRefresh();
    await waitFor(() => expect(mockCloseWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', title: 'Prescription completed' }),
    );
  });

  test('marks a partially dispensed order as in-progress instead of completed', async () => {
    const partialDispense = createMockMedicationDispense();
    partialDispense.quantity.value = 10;
    renderForm(partialDispense, createMockMedicationRequestBundle(0));

    await userEvent.click(screen.getByRole('button', { name: /dispense prescription/i }));

    await waitFor(() => expect(mockSaveMedicationDispense).toHaveBeenCalledTimes(1));
    expect(mockUpdateMedicationRequestFulfillerStatus).toHaveBeenCalledWith(
      'request-uuid',
      MedicationRequestFulfillerStatus.in_progress,
    );
    expect(mockRevalidate).toHaveBeenCalled();
    expect(mockCloseWorkspace).toHaveBeenCalled();
  });

  test('keeps an order active while repeat quantities remain', async () => {
    renderForm(createMockMedicationDispense(), createMockMedicationRequestBundle(1));

    await userEvent.click(screen.getByRole('button', { name: /dispense prescription/i }));

    await waitFor(() => expect(mockSaveMedicationDispense).toHaveBeenCalledTimes(1));
    expect(mockUpdateMedicationRequestFulfillerStatus).toHaveBeenCalledWith(
      'request-uuid',
      MedicationRequestFulfillerStatus.in_progress,
    );
  });

  test('completes an order on the final repeat dispense', async () => {
    const medicationRequestBundle = createMockMedicationRequestBundle(1);
    const previousDispense = createMockMedicationDispense();
    previousDispense.id = 'previous-dispense';
    medicationRequestBundle.dispenses = [previousDispense];
    renderForm(createMockMedicationDispense(), medicationRequestBundle);

    await userEvent.click(screen.getByRole('button', { name: /dispense prescription/i }));

    await waitFor(() =>
      expect(mockUpdateMedicationRequestFulfillerStatus).toHaveBeenCalledWith(
        'request-uuid',
        MedicationRequestFulfillerStatus.completed,
      ),
    );
  });

  test('does not create a second dispense on two clicks in the same render', async () => {
    renderForm(createMockMedicationDispense(), createMockMedicationRequestBundle(0));
    const submit = screen.getByRole('button', { name: /dispense prescription/i });

    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(mockSaveMedicationDispense).toHaveBeenCalledTimes(1));
  });

  test('does not allow another dispense when the calculated remaining quantity is zero', () => {
    render(
      <DispenseForm
        {...mockWorkspaceProps}
        workspaceProps={{
          medicationDispense: createMockMedicationDispense(),
          medicationRequestBundle: createMockMedicationRequestBundle(0),
          mode: 'enter',
          patientUuid: 'patient-uuid',
          encounterUuid: 'encounter-uuid',
          quantityRemaining: 0,
          quantityDispensed: 30,
        }}
        closeWorkspace={mockCloseWorkspace}
      />,
    );

    expect(screen.getByRole('button', { name: /dispense prescription/i })).toBeDisabled();
  });

  test('warns against another dispense when the dispense is saved but the status update fails', async () => {
    mockUpdateMedicationRequestFulfillerStatus.mockRejectedValue(new Error('synthetic status failure'));
    renderForm(createMockMedicationDispense(), createMockMedicationRequestBundle(0));

    await userEvent.click(screen.getByRole('button', { name: /dispense prescription/i }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'warning',
          title: 'Dispense saved; order status pending',
          subtitle: expect.stringContaining('Do not dispense it again'),
        }),
      ),
    );
    expect(mockRevalidate).toHaveBeenCalled();
    expect(mockCloseWorkspace).toHaveBeenCalled();
  });
});

describe('DispenseForm - Complete Order Checkbox Auto-Default', () => {
  test('should default checkbox to true when numberOfRepeatsAllowed is 0', () => {
    const medicationDispense = createMockMedicationDispense();
    const medicationRequestBundle = createMockMedicationRequestBundle(0);

    render(
      <DispenseForm
        {...mockWorkspaceProps}
        workspaceProps={{
          medicationDispense,
          medicationRequestBundle,
          mode: 'enter',
          patientUuid: 'patient-uuid',
          encounterUuid: 'encounter-uuid',
          quantityRemaining: 30,
          quantityDispensed: 0,
        }}
        closeWorkspace={mockCloseWorkspace}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: /complete order with this dispense/i });
    expect(checkbox).toBeChecked();
  });

  test('should treat missing refill information as zero and default checkbox to true', () => {
    const medicationDispense = createMockMedicationDispense();
    const medicationRequestBundle = createMockMedicationRequestBundle(null);

    render(
      <DispenseForm
        {...mockWorkspaceProps}
        workspaceProps={{
          medicationDispense,
          medicationRequestBundle,
          mode: 'enter',
          patientUuid: 'patient-uuid',
          encounterUuid: 'encounter-uuid',
          quantityRemaining: 30,
          quantityDispensed: 0,
        }}
        closeWorkspace={mockCloseWorkspace}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: /complete order with this dispense/i });
    expect(checkbox).toBeChecked();
  });

  test('should default checkbox to false when numberOfRepeatsAllowed is greater than 0', () => {
    const medicationDispense = createMockMedicationDispense();
    const medicationRequestBundle = createMockMedicationRequestBundle(2);

    render(
      <DispenseForm
        {...mockWorkspaceProps}
        workspaceProps={{
          medicationDispense,
          medicationRequestBundle,
          mode: 'enter',
          patientUuid: 'patient-uuid',
          encounterUuid: 'encounter-uuid',
          quantityRemaining: 30,
          quantityDispensed: 0,
        }}
        closeWorkspace={mockCloseWorkspace}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: /complete order with this dispense/i });
    expect(checkbox).not.toBeChecked();
  });

  test('should allow user to manually uncheck the checkbox even when auto-defaulted to true', async () => {
    const user = userEvent.setup();
    const medicationDispense = createMockMedicationDispense();
    const medicationRequestBundle = createMockMedicationRequestBundle(0);

    render(
      <DispenseForm
        {...mockWorkspaceProps}
        workspaceProps={{
          medicationDispense,
          medicationRequestBundle,
          mode: 'enter',
          patientUuid: 'patient-uuid',
          encounterUuid: 'encounter-uuid',
          quantityRemaining: 30,
          quantityDispensed: 0,
        }}
        closeWorkspace={mockCloseWorkspace}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: /complete order with this dispense/i });
    expect(checkbox).toBeChecked();

    // User manually unchecks the checkbox
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: /dispense prescription/i }));

    await waitFor(() =>
      expect(mockUpdateMedicationRequestFulfillerStatus).toHaveBeenCalledWith(
        'request-uuid',
        MedicationRequestFulfillerStatus.in_progress,
      ),
    );
    expect(mockUpdateMedicationRequestFulfillerStatus).not.toHaveBeenCalledWith(
      'request-uuid',
      MedicationRequestFulfillerStatus.completed,
    );
  });

  test('should not auto-default checkbox in edit mode', () => {
    const medicationDispense = createMockMedicationDispense();
    medicationDispense.id = 'existing-dispense-id'; // Existing dispense
    const medicationRequestBundle = createMockMedicationRequestBundle(0);

    render(
      <DispenseForm
        {...mockWorkspaceProps}
        workspaceProps={{
          medicationDispense,
          medicationRequestBundle,
          mode: 'edit',
          patientUuid: 'patient-uuid',
          encounterUuid: 'encounter-uuid',
          quantityRemaining: 30,
          quantityDispensed: 30,
        }}
        closeWorkspace={mockCloseWorkspace}
      />,
    );

    // In edit mode, the checkbox should not be rendered at all
    const checkbox = screen.queryByRole('checkbox', { name: /complete order with this dispense/i });
    expect(checkbox).not.toBeInTheDocument();
  });

  test('keeps an edited fully dispensed order completed when the checkbox feature is enabled', async () => {
    const originalDispense = createMockMedicationDispense();
    originalDispense.id = 'existing-dispense-id';
    const editedDispense = {
      ...originalDispense,
      quantity: { ...originalDispense.quantity },
    };
    const medicationRequestBundle = createMockMedicationRequestBundle(0);
    medicationRequestBundle.dispenses = [originalDispense];

    render(
      <DispenseForm
        {...mockWorkspaceProps}
        workspaceProps={{
          medicationDispense: editedDispense,
          medicationRequestBundle,
          mode: 'edit',
          patientUuid: 'patient-uuid',
          encounterUuid: 'encounter-uuid',
          quantityRemaining: null,
          quantityDispensed: 30,
        }}
        closeWorkspace={mockCloseWorkspace}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(mockUpdateMedicationRequestFulfillerStatus).toHaveBeenCalledWith(
        'request-uuid',
        MedicationRequestFulfillerStatus.completed,
      ),
    );
  });

  test('reopens an edited order when its fully dispensed quantity is reduced', async () => {
    const originalDispense = createMockMedicationDispense();
    originalDispense.id = 'existing-dispense-id';
    const editedDispense = {
      ...originalDispense,
      quantity: { ...originalDispense.quantity, value: 20 },
    };
    const medicationRequestBundle = createMockMedicationRequestBundle(0);
    medicationRequestBundle.dispenses = [originalDispense];

    render(
      <DispenseForm
        {...mockWorkspaceProps}
        workspaceProps={{
          medicationDispense: editedDispense,
          medicationRequestBundle,
          mode: 'edit',
          patientUuid: 'patient-uuid',
          encounterUuid: 'encounter-uuid',
          quantityRemaining: null,
          quantityDispensed: 30,
        }}
        closeWorkspace={mockCloseWorkspace}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(mockUpdateMedicationRequestFulfillerStatus).toHaveBeenCalledWith(
        'request-uuid',
        MedicationRequestFulfillerStatus.in_progress,
      ),
    );
  });

  test('should not show duplicate warning for retrospective dispense when only later dispenses are in the lookback window', async () => {
    const user = userEvent.setup();

    const medicationDispense = {
      ...createMockMedicationDispense(),
      whenHandedOver: '2026-03-12T10:00:00.000Z',
    };
    const recentDispense = {
      ...createMockMedicationDispense(),
      id: 'existing-dispense-id',
      whenHandedOver: '2026-03-26T10:00:00.000Z',
    };

    const medicationRequestBundle = {
      ...createMockMedicationRequestBundle(0),
      dispenses: [recentDispense],
    };

    mockUseConfig.mockReturnValue({
      dispenseBehavior: {
        allowModifyingPrescription: false,
        restrictTotalQuantityDispensed: false,
      },
      completeOrderWithThisDispense: true,
      enableStockDispense: false,
      enableDuplicateDispenseCheck: true,
      duplicateCheckWindowDays: 7,
    } as any);

    render(
      <DispenseForm
        {...mockWorkspaceProps}
        workspaceProps={{
          medicationDispense,
          medicationRequestBundle,
          mode: 'enter',
          patientUuid: 'patient-uuid',
          encounterUuid: 'encounter-uuid',
          quantityRemaining: 30,
          quantityDispensed: 0,
        }}
        closeWorkspace={mockCloseWorkspace}
      />,
    );

    await user.click(screen.getByRole('button', { name: /dispense prescription/i }));

    expect(mockShowModal).not.toHaveBeenCalled();
    expect(mockSaveMedicationDispense).toHaveBeenCalled();
  });
});

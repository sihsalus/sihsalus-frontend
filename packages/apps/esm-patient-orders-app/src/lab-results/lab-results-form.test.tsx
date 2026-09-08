import { type Order } from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Encounter } from '../types/encounter';
import {
  completeOrderResult,
  type Datatype,
  type LabOrderConcept,
  LabResultCompletionError,
  updateObservation,
  updateOrderResult,
  useCompletedLabResults,
  useLabEncounter,
  useObservation,
  useOrderConceptByUuid,
} from './lab-results.resource';
import LabResultsForm from './lab-results-form.component';

const mockUseOrderConceptByUuid = vi.mocked(useOrderConceptByUuid);
const mockUseLabEncounter = vi.mocked(useLabEncounter);
const mockUseObservation = vi.mocked(useObservation);
const mockUseCompletedLabResults = vi.mocked(useCompletedLabResults);
const mockCompleteOrderResult = vi.mocked(completeOrderResult);
const mockUpdateObservation = vi.mocked(updateObservation);

vi.mock('./lab-results.resource', async () => ({
  ...(await vi.importActual('./lab-results.resource')),
  useOrderConceptByUuid: vi.fn(),
  useLabEncounter: vi.fn(),
  useObservation: vi.fn(),
  completeOrderResult: vi.fn().mockResolvedValue({}),
  updateObservation: vi.fn().mockResolvedValue({}),
  updateOrderResult: vi.fn().mockResolvedValue({}),
  useCompletedLabResults: vi.fn(),
  isCoded: (concept) => concept?.datatype?.display === 'Coded',
  isText: (concept) => concept?.datatype?.display === 'Text',
  isNumeric: (concept) => concept?.datatype?.display === 'Numeric',
  isPanel: (concept) => concept?.setMembers?.length > 0,
}));

const mockOrder = {
  uuid: 'order-uuid',
  concept: { uuid: 'concept-uuid' },
  encounter: { uuid: 'encounter-uuid' },
  patient: { uuid: 'patient-uuid' },
  orderNumber: 'ORD-1',
  careSetting: { uuid: 'care-setting-uuid' },
  orderer: { uuid: 'orderer-uuid' },
};

const testProps = {
  closeWorkspace: vi.fn(),
  closeWorkspaceWithSavedChanges: vi.fn(),
  order: mockOrder as Order,
  promptBeforeClosing: vi.fn(),
  setTitle: vi.fn(),
  patientUuid: 'patient-uuid',
};

describe('LabResultsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Test Concept',
        setMembers: [],
        datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
        hiAbsolute: 100,
        hiCritical: 80,
        hiNormal: 70,
        lowAbsolute: 0,
        lowCritical: 40,
        lowNormal: 50,
        units: 'mg/dL',
        allowDecimal: false,
      } as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockUseLabEncounter.mockReturnValue({
      encounter: { obs: [] } as Encounter,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockUseObservation.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockUseCompletedLabResults.mockReturnValue({
      completeLabResult: null,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    });
  });

  test('validates numeric input correctly', async () => {
    const user = userEvent.setup();
    render(<LabResultsForm {...testProps} />);

    const input = await screen.findByLabelText(`Test Concept (0 - 100 mg/dL)`);
    await user.type(input, '150');

    const saveButton = screen.getByRole('button', { name: /Save and close/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Test Concept debe estar entre 0 y 100')).toBeInTheDocument();
    });
  });

  test('validate when we have a concept with allowDecimal set to true', async () => {
    const user = userEvent.setup();
    // if allowDecimal is true, we should allow decimal values
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Test Concept',
        setMembers: [],
        datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
        hiAbsolute: 100,
        lowAbsolute: null,
        lowCritical: null,
        lowNormal: null,
        hiCritical: null,
        hiNormal: null,
        units: 'mg/dL',
        allowDecimal: true,
      } as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    render(<LabResultsForm {...testProps} />);

    const input = screen.getByRole('spinbutton', {
      name: /Test Concept/i,
    });
    await user.type(input, '50.5');

    const saveButton = screen.getByRole('button', { name: /Save and close/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByText('Test Concept debe ser un número entero')).not.toBeInTheDocument();
    });
  });

  test('prevents decimal values when the concept does not allow decimals', async () => {
    render(<LabResultsForm {...testProps} />);

    const input = await screen.findByLabelText(`Test Concept (0 - 100 mg/dL)`);
    expect(fireEvent.keyDown(input, { key: '.' })).toBe(false);
    expect(
      fireEvent.paste(input, {
        clipboardData: { getData: () => '50.5' },
      }),
    ).toBe(false);
  });

  test('prevents negative values when the concept lower bound is non-negative', async () => {
    render(<LabResultsForm {...testProps} />);

    const input = await screen.findByLabelText(`Test Concept (0 - 100 mg/dL)`);
    expect(fireEvent.keyDown(input, { key: '-' })).toBe(false);
    expect(
      fireEvent.paste(input, {
        clipboardData: { getData: () => '-50' },
      }),
    ).toBe(false);
  });

  test('prevents scientific notation and symbols in numeric lab results', async () => {
    render(<LabResultsForm {...testProps} />);

    const input = await screen.findByLabelText(`Test Concept (0 - 100 mg/dL)`);
    for (const key of ['e', 'E', '+', '.', ',']) {
      expect(fireEvent.keyDown(input, { key })).toBe(false);
    }
    expect(
      fireEvent.paste(input, {
        clipboardData: { getData: () => '1e2' },
      }),
    ).toBe(false);
  });

  test('allows negative decimal values when the concept range permits them', async () => {
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Test Concept',
        setMembers: [],
        datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
        hiAbsolute: 100,
        lowAbsolute: -100,
        lowCritical: null,
        lowNormal: null,
        hiCritical: null,
        hiNormal: null,
        units: 'mg/dL',
        allowDecimal: true,
      } as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<LabResultsForm {...testProps} />);

    const input = await screen.findByLabelText(`Test Concept (-100 - 100 mg/dL)`);
    expect(fireEvent.keyDown(input, { key: '-' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: '.' })).toBe(true);
    expect(
      fireEvent.paste(input, {
        clipboardData: { getData: () => '-50.5' },
      }),
    ).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'e' })).toBe(false);
  });

  test('validate numeric input with zero value', async () => {
    const user = userEvent.setup();
    render(<LabResultsForm {...testProps} />);

    const input = await screen.findByLabelText('Test Concept (0 - 100 mg/dL)');
    await user.type(input, '0');

    await waitFor(() => {
      expect(screen.queryByText('Test Concept debe estar entre 0 y 100')).not.toBeInTheDocument();
    });
  });

  test('validate numeric input with concept having only hiAbsolute', async () => {
    const user = userEvent.setup();
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Test Concept',
        setMembers: [],
        datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
        hiAbsolute: 100,
        lowAbsolute: null,
        lowCritical: null,
        lowNormal: null,
        hiCritical: null,
        hiNormal: null,
        units: 'mg/dL',
      } as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    render(<LabResultsForm {...testProps} />);

    const input = screen.getByRole('spinbutton', {
      name: /Test Concept/i,
    });
    await user.type(input, '150');

    const saveButton = screen.getByRole('button', { name: /Save and close/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Test Concept debe ser menor o igual a 100')).toBeInTheDocument();
    });
  });

  test('prevents negative input when concept has only a non-negative lowAbsolute', () => {
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Test Concept',
        setMembers: [],
        datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
        lowAbsolute: 0,
        lowCritical: null,
        lowNormal: null,
        hiCritical: null,
        hiNormal: null,
        hiAbsolute: null,
        units: 'mg/dL',
      } as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    render(<LabResultsForm {...testProps} />);

    const input = screen.getByRole('spinbutton', {
      name: /Test Concept/i,
    });
    expect(fireEvent.keyDown(input, { key: '-' })).toBe(false);
    expect(
      fireEvent.paste(input, {
        clipboardData: { getData: () => '-50' },
      }),
    ).toBe(false);
  });

  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    const mockCloseWorkspace = vi.fn();
    const mockCloseWorkspaceWithSavedChanges = vi.fn();

    render(
      <LabResultsForm
        {...testProps}
        closeWorkspace={mockCloseWorkspace}
        closeWorkspaceWithSavedChanges={mockCloseWorkspaceWithSavedChanges}
      />,
    );

    const input = await screen.findByLabelText(`Test Concept (0 - 100 mg/dL)`);
    await user.type(input, '50');

    const saveButton = screen.getByRole('button', { name: /Save and close/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockCloseWorkspaceWithSavedChanges).toHaveBeenCalled();
    });
  });

  test('validate numeric input where concept is a set', async () => {
    const user = userEvent.setup();
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Test Concept',
        datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
        lowAbsolute: 0,
        lowCritical: null,
        lowNormal: null,
        hiCritical: null,
        hiNormal: null,
        hiAbsolute: null,
        units: 'mg/dL',
        setMembers: [
          {
            uuid: 'set-member-uuid',
            display: 'Set Member',
            setMembers: [],
            datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
            lowAbsolute: 50,
            lowCritical: 70,
            lowNormal: 80,
            hiCritical: 140,
            hiNormal: 120,
            hiAbsolute: 150,
            units: 'mg/dL',
          },
          {
            uuid: 'set-member-uuid-2',
            display: 'Set Member 2',
            setMembers: [],
            datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
            lowAbsolute: 5,
            lowCritical: 10,
            lowNormal: 15,
            hiCritical: 20,
            hiNormal: 25,
            hiAbsolute: 30,
            units: 'mg/dL',
          },
        ],
      } as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    render(<LabResultsForm {...testProps} />);

    // Normal input range
    const setMember1Input = screen.getByLabelText('Set Member (50 - 150 mg/dL)');
    await user.clear(setMember1Input);
    await user.type(setMember1Input, '50');
    expect(screen.queryByText('Set Member debe estar entre 50 y 150')).not.toBeInTheDocument();

    const setMember2Input = screen.getByLabelText('Set Member 2 (5 - 30 mg/dL)');
    await user.clear(setMember2Input);
    await user.type(setMember2Input, '10');
    expect(screen.queryByText('Set Member debe estar entre 5 y 30')).not.toBeInTheDocument();

    // Out of range input, upper limit
    await user.clear(setMember1Input);
    await user.type(setMember1Input, '151');
    expect(await screen.findByText('Set Member debe estar entre 50 y 150')).toBeInTheDocument();

    await user.clear(setMember2Input);
    await user.type(setMember2Input, '31');
    expect(await screen.findByText('Set Member 2 debe estar entre 5 y 30')).toBeInTheDocument();

    // Out of range input, lower limit
    await user.clear(setMember1Input);
    await user.type(setMember1Input, '49');
    expect(await screen.findByText('Set Member debe estar entre 50 y 150')).toBeInTheDocument();

    await user.clear(setMember2Input);
    await user.type(setMember2Input, '4');
    expect(await screen.findByText('Set Member 2 debe estar entre 5 y 30')).toBeInTheDocument();
  });

  test('lab results form submits the correct lab result payload when the concept is not a set', async () => {
    const user = userEvent.setup();
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Test Concept',
        setMembers: [],
        datatype: { display: 'Text', hl7Abbreviation: 'ST' } as Datatype,
        hiAbsolute: 100,
        lowAbsolute: 0,
        lowCritical: null,
        lowNormal: null,
        hiCritical: null,
        hiNormal: null,
        units: 'mg/dL',
      } as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<LabResultsForm {...testProps} />);
    const input = await screen.findByRole('textbox', { name: /Test Concept/i });
    await user.clear(input);
    await user.type(input, '100');
    const submitButton = screen.getByRole('button', { name: 'Save and close' });
    await user.click(submitButton);

    expect(updateOrderResult).toHaveBeenCalledWith(
      'order-uuid',
      'encounter-uuid',
      {
        obs: [
          {
            concept: { uuid: 'concept-uuid' },
            order: { uuid: 'order-uuid' },
            status: 'FINAL',
            value: '100',
            obsDatetime: expect.any(String),
          },
        ],
      },
      { fulfillerComment: 'Test Results Entered', fulfillerStatus: 'COMPLETED' },
      {
        action: 'DISCONTINUE',
        careSetting: 'care-setting-uuid',
        concept: 'concept-uuid',
        encounter: 'encounter-uuid',
        orderer: mockOrder.orderer,
        patient: 'patient-uuid',
        previousOrder: 'order-uuid',
        type: 'testorder',
      },
      expect.anything(),
    );
  });

  test('lab results forms submits correct payload when the concept is a set and one set member is keyed', async () => {
    const user = userEvent.setup();
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Test Concept',
        set: true,
        setMembers: [
          {
            uuid: 'set-member-uuid-1',
            display: 'Set Member 1',
            concept: { uuid: 'concept-uuid-1', display: 'Concept 1' },
            datatype: { display: 'Numeric', hl7Abbreviation: 'NM' } as Datatype,
            hiAbsolute: 100,
            lowAbsolute: 0,
            lowCritical: null,
            lowNormal: null,
            hiCritical: null,
            hiNormal: null,
            units: 'mg/dL',
          },
          {
            uuid: 'set-member-uuid-2',
            display: 'Set Member 2',
            concept: { uuid: 'concept-uuid-2', display: 'Concept 2' },
            datatype: { display: 'Numeric', hl7Abbreviation: 'NM' } as Datatype,
            hiAbsolute: 80,
            lowAbsolute: 0,
            lowCritical: null,
            lowNormal: null,
            hiCritical: null,
            hiNormal: null,
            units: 'mmol/L',
          },
        ],
        datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
        hiAbsolute: 100,
        lowAbsolute: 0,
        lowCritical: null,
        lowNormal: null,
        hiCritical: null,
        hiNormal: null,
        units: 'mg/dL',
      } as unknown as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<LabResultsForm {...testProps} />);
    const concept1Input = await screen.findByLabelText('Set Member 1 (0 - 100 mg/dL)');
    await user.type(concept1Input, '100');

    const submitButton = screen.getByRole('button', { name: 'Save and close' });
    await user.click(submitButton);

    // Expect the observation payload to include only the set member that was keyed
    expect(updateOrderResult).toHaveBeenCalledWith(
      'order-uuid',
      'encounter-uuid',
      {
        obs: [
          {
            concept: {
              uuid: 'concept-uuid',
            },
            status: 'FINAL',
            order: {
              uuid: 'order-uuid',
            },
            obsDatetime: expect.any(String),
            groupMembers: [
              {
                concept: {
                  uuid: 'set-member-uuid-1',
                },
                value: 100,
                status: 'FINAL',
                order: {
                  uuid: 'order-uuid',
                },
                obsDatetime: expect.any(String),
              },
            ],
          },
        ],
      },
      {
        fulfillerStatus: 'COMPLETED',
        fulfillerComment: 'Test Results Entered',
      },
      {
        previousOrder: 'order-uuid',
        type: 'testorder',
        action: 'DISCONTINUE',
        careSetting: 'care-setting-uuid',
        encounter: 'encounter-uuid',
        patient: 'patient-uuid',
        concept: 'concept-uuid',
        orderer: { uuid: 'orderer-uuid' },
      },
      expect.anything(),
    );
  });

  test('lab results form submits correct payload when the concept is a set and both set members are keyed', async () => {
    const user = userEvent.setup();
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Test Concept',
        set: true,
        setMembers: [
          {
            uuid: 'set-member-uuid-1',
            display: 'Set Member 1',
            concept: { uuid: 'concept-uuid-1', display: 'Concept 1' },
            datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
            hiAbsolute: 100,
            lowAbsolute: 0,
            lowCritical: null,
            lowNormal: null,
            hiCritical: null,
            hiNormal: null,
            units: 'mg/dL',
          },
          {
            uuid: 'set-member-uuid-2',
            display: 'Set Member 2',
            concept: { uuid: 'concept-uuid-2', display: 'Concept 2' },
            datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
            hiAbsolute: 80,
            lowAbsolute: 0,
            lowCritical: null,
            lowNormal: null,
            hiCritical: null,
            hiNormal: null,
            units: 'mmol/L',
          },
        ],
        datatype: { display: 'Numeric' },
        hiAbsolute: 100,
        lowAbsolute: 0,
        lowCritical: null,
        lowNormal: null,
        hiCritical: null,
        hiNormal: null,
        units: 'mg/dL',
      } as unknown as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<LabResultsForm {...testProps} />);
    const concept1Input = await screen.findByLabelText('Set Member 1 (0 - 100 mg/dL)');
    await user.type(concept1Input, '100');

    const concept2Input = await screen.findByLabelText('Set Member 2 (0 - 80 mmol/L)');
    await user.type(concept2Input, '60');

    const submitButton = screen.getByRole('button', { name: 'Save and close' });
    await user.click(submitButton);

    // Expect the observation payload to include both set members with their respective values
    expect(updateOrderResult).toHaveBeenCalledWith(
      'order-uuid',
      'encounter-uuid',
      {
        obs: [
          {
            concept: {
              uuid: 'concept-uuid',
            },
            status: 'FINAL',
            order: {
              uuid: 'order-uuid',
            },
            obsDatetime: expect.any(String),
            groupMembers: [
              {
                concept: {
                  uuid: 'set-member-uuid-1',
                },
                value: 100,
                status: 'FINAL',
                order: {
                  uuid: 'order-uuid',
                },
                obsDatetime: expect.any(String),
              },
              {
                concept: {
                  uuid: 'set-member-uuid-2',
                },
                value: 60,
                status: 'FINAL',
                order: {
                  uuid: 'order-uuid',
                },
                obsDatetime: expect.any(String),
              },
            ],
          },
        ],
      },
      {
        fulfillerStatus: 'COMPLETED',
        fulfillerComment: 'Test Results Entered',
      },
      {
        previousOrder: 'order-uuid',
        type: 'testorder',
        action: 'DISCONTINUE',
        careSetting: 'care-setting-uuid',
        encounter: 'encounter-uuid',
        patient: 'patient-uuid',
        concept: 'concept-uuid',
        orderer: { uuid: 'orderer-uuid' },
      },
      expect.anything(),
    );
  });

  test('should handle empty form submission', async () => {
    const user = userEvent.setup();
    render(<LabResultsForm {...testProps} />);

    const saveButton = screen.getByRole('button', { name: /Save and close/i });
    await user.click(saveButton);

    expect(screen.getByText('Please fill at least one field.')).toBeInTheDocument();
    expect(updateOrderResult).not.toHaveBeenCalled();
  });

  test('should disable save button when form has validation errors', async () => {
    const user = userEvent.setup();
    render(<LabResultsForm {...testProps} />);

    const input = await screen.findByLabelText(`Test Concept (0 - 100 mg/dL)`);
    await user.type(input, '150');

    const saveButton = screen.getByRole('button', { name: /Save and close/i });
    expect(saveButton).toBeDisabled();
  });

  test('fails closed before writing when a completed panel member cannot be resolved', async () => {
    const user = userEvent.setup();
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Panel Sintético',
        set: true,
        setMembers: [
          {
            uuid: 'missing-member-uuid',
            display: 'Miembro faltante',
            datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
            setMembers: [],
            allowDecimal: false,
          },
        ],
        datatype: { display: 'N/A', hl7Abbreviation: 'N/A' },
      } as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockUseCompletedLabResults.mockReturnValue({
      completeLabResult: {
        uuid: 'panel-observation-uuid',
        concept: { uuid: 'concept-uuid', display: 'Panel Sintético' },
        groupMembers: [],
      } as never,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LabResultsForm {...testProps} order={{ ...mockOrder, fulfillerStatus: 'COMPLETED' } as Order} />);
    await user.type(screen.getByLabelText(/Miembro faltante/i), '10');
    await user.click(screen.getByRole('button', { name: /Save and close/i }));

    await waitFor(() => expect(mockUpdateObservation).not.toHaveBeenCalled());
    expect(testProps.closeWorkspaceWithSavedChanges).not.toHaveBeenCalled();
  });

  test('updates one completed panel member with one observation request', async () => {
    const user = userEvent.setup();
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Panel Sintético',
        set: true,
        setMembers: [
          {
            uuid: 'member-uuid',
            display: 'Hemoglobina sintética',
            datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
            setMembers: [],
            allowDecimal: false,
          },
        ],
        datatype: { display: 'N/A', hl7Abbreviation: 'N/A' },
      } as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockUseCompletedLabResults.mockReturnValue({
      completeLabResult: {
        uuid: 'panel-observation-uuid',
        concept: { uuid: 'concept-uuid', display: 'Panel Sintético' },
        groupMembers: [
          {
            uuid: 'member-observation-uuid',
            concept: { uuid: 'member-uuid', display: 'Hemoglobina sintética' },
            value: 11,
          },
        ],
      } as never,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LabResultsForm {...testProps} order={{ ...mockOrder, fulfillerStatus: 'COMPLETED' } as Order} />);
    const input = screen.getByLabelText(/Hemoglobina sintética/i);
    await waitFor(() => expect(input).toHaveValue(11));
    await user.clear(input);
    await user.type(input, '12');
    await user.click(screen.getByRole('button', { name: /Save and close/i }));

    await waitFor(() =>
      expect(mockUpdateObservation).toHaveBeenCalledWith(
        'member-observation-uuid',
        expect.objectContaining({ value: 12, obsDatetime: expect.any(String) }),
      ),
    );
    expect(mockUpdateObservation).toHaveBeenCalledOnce();
  });

  test('fails closed before writing when more than one completed panel member changed', async () => {
    const user = userEvent.setup();
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Panel Sintético',
        set: true,
        setMembers: [
          {
            uuid: 'first-member-uuid',
            display: 'Primer miembro',
            datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
            setMembers: [],
            allowDecimal: false,
          },
          {
            uuid: 'second-member-uuid',
            display: 'Segundo miembro',
            datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
            setMembers: [],
            allowDecimal: false,
          },
        ],
        datatype: { display: 'N/A', hl7Abbreviation: 'N/A' },
      } as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockUseCompletedLabResults.mockReturnValue({
      completeLabResult: {
        uuid: 'panel-observation-uuid',
        concept: { uuid: 'concept-uuid', display: 'Panel Sintético' },
        groupMembers: [
          {
            uuid: 'first-observation-uuid',
            concept: { uuid: 'first-member-uuid', display: 'Primer miembro' },
            value: 1,
          },
          {
            uuid: 'second-observation-uuid',
            concept: { uuid: 'second-member-uuid', display: 'Segundo miembro' },
            value: 2,
          },
        ],
      } as never,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LabResultsForm {...testProps} order={{ ...mockOrder, fulfillerStatus: 'COMPLETED' } as Order} />);
    const firstInput = screen.getByLabelText(/Primer miembro/i);
    const secondInput = screen.getByLabelText(/Segundo miembro/i);
    await waitFor(() => {
      expect(firstInput).toHaveValue(1);
      expect(secondInput).toHaveValue(2);
    });
    await user.clear(firstInput);
    await user.type(firstInput, '10');
    await user.clear(secondInput);
    await user.type(secondInput, '20');
    await user.click(screen.getByRole('button', { name: /Save and close/i }));

    await waitFor(() => expect(mockUpdateObservation).not.toHaveBeenCalled());
    expect(testProps.closeWorkspaceWithSavedChanges).not.toHaveBeenCalled();
  });

  test.each([
    { kind: 'numeric', savedValue: 2, restoredValue: '2', datatype: 'Numeric', hl7: 'NM' },
    { kind: 'numeric string', savedValue: '2.00', restoredValue: '2', datatype: 'Numeric', hl7: 'NM' },
    { kind: 'zero', savedValue: 0, restoredValue: '0', datatype: 'Numeric', hl7: 'NM' },
    { kind: 'text', savedValue: 'Original', restoredValue: 'Original', datatype: 'Text', hl7: 'ST' },
    {
      kind: 'coded',
      savedValue: { uuid: 'synthetic-answer-a', display: 'Respuesta A' },
      restoredValue: 'synthetic-answer-a',
      datatype: 'Coded',
      hl7: 'CWE',
    },
  ])('saves one net panel correction after undoing a $kind edit', async ({
    savedValue,
    restoredValue,
    datatype,
    hl7,
  }) => {
    const user = userEvent.setup();
    mockUseOrderConceptByUuid.mockReturnValue({
      concept: {
        uuid: 'concept-uuid',
        display: 'Panel Sintético',
        set: true,
        setMembers: [
          {
            uuid: 'first-member-uuid',
            display: 'Primer miembro',
            datatype: { display: 'Numeric', hl7Abbreviation: 'NM' },
            setMembers: [],
            allowDecimal: false,
          },
          {
            uuid: 'second-member-uuid',
            display: 'Segundo miembro',
            datatype: { display: datatype, hl7Abbreviation: hl7 },
            setMembers: [],
            allowDecimal: false,
            answers: [
              { uuid: 'synthetic-answer-a', display: 'Respuesta A' },
              { uuid: 'synthetic-answer-b', display: 'Respuesta B' },
            ],
          },
        ],
        datatype: { display: 'N/A', hl7Abbreviation: 'N/A' },
      } as LabOrderConcept,
      isLoading: false,
      error: null,
      isValidating: false,
      mutate: vi.fn(),
    });
    mockUseCompletedLabResults.mockReturnValue({
      completeLabResult: {
        uuid: 'panel-observation-uuid',
        concept: { uuid: 'concept-uuid', display: 'Panel Sintético' },
        groupMembers: [
          {
            uuid: 'first-observation-uuid',
            concept: { uuid: 'first-member-uuid', display: 'Primer miembro' },
            value: 1,
          },
          {
            uuid: 'second-observation-uuid',
            concept: { uuid: 'second-member-uuid', display: 'Segundo miembro' },
            value: savedValue,
          },
        ],
      } as never,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LabResultsForm {...testProps} order={{ ...mockOrder, fulfillerStatus: 'COMPLETED' } as Order} />);
    const firstInput = screen.getByLabelText(/Primer miembro/i);
    const secondInput = screen.getByLabelText(/Segundo miembro/i);
    await waitFor(() => {
      expect(firstInput).toHaveValue(1);
      expect(secondInput).toHaveValue(datatype === 'Numeric' ? Number(restoredValue) : restoredValue);
    });
    await user.clear(firstInput);
    await user.type(firstInput, '10');
    if (datatype === 'Coded') {
      await user.selectOptions(secondInput, 'synthetic-answer-b');
      await user.selectOptions(secondInput, restoredValue);
    } else {
      await user.clear(secondInput);
      await user.type(secondInput, '20');
      await user.clear(secondInput);
      await user.type(secondInput, restoredValue);
    }
    await user.click(screen.getByRole('button', { name: /Save and close/i }));

    await waitFor(() =>
      expect(mockUpdateObservation).toHaveBeenCalledExactlyOnceWith(
        'first-observation-uuid',
        expect.objectContaining({ value: 10 }),
      ),
    );
    expect(testProps.closeWorkspaceWithSavedChanges).toHaveBeenCalledOnce();
  });

  test.each([
    { field: 'value', savedComment: undefined },
    { field: 'comment', savedComment: undefined },
    { field: 'comment', savedComment: 'Comentario original' },
  ])('does not revise an observation after undoing its $field edit ($savedComment)', async ({
    field,
    savedComment,
  }) => {
    const user = userEvent.setup();
    mockUseCompletedLabResults.mockReturnValue({
      completeLabResult: {
        uuid: 'saved-observation-uuid',
        concept: { uuid: 'concept-uuid', display: 'Test Concept' },
        value: 50,
        comment: savedComment,
      } as never,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    });
    render(<LabResultsForm {...testProps} order={{ ...mockOrder, fulfillerStatus: 'COMPLETED' } as Order} />);
    const input =
      field === 'value'
        ? screen.getByLabelText('Test Concept (0 - 100 mg/dL)')
        : screen.getByLabelText('Observaciones');
    const restoredValue = field === 'value' ? '50' : (savedComment ?? '');
    await user.clear(input);
    await user.type(input, '60');
    await user.clear(input);
    if (restoredValue) await user.type(input, restoredValue);
    await user.click(screen.getByRole('button', { name: /Save and close/i }));

    await waitFor(() => expect(testProps.closeWorkspace).toHaveBeenCalledOnce());
    expect(mockUpdateObservation).not.toHaveBeenCalled();
    expect(updateOrderResult).not.toHaveBeenCalled();
  });

  test('keeps an intentional deletion of a saved comment', async () => {
    const user = userEvent.setup();
    mockUseCompletedLabResults.mockReturnValue({
      completeLabResult: {
        uuid: 'saved-observation-uuid',
        concept: { uuid: 'concept-uuid', display: 'Test Concept' },
        value: 50,
        comment: 'Comentario original',
      } as never,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    });
    render(<LabResultsForm {...testProps} order={{ ...mockOrder, fulfillerStatus: 'COMPLETED' } as Order} />);
    await user.clear(screen.getByLabelText('Observaciones'));
    await user.click(screen.getByRole('button', { name: /Save and close/i }));

    await waitFor(() =>
      expect(mockUpdateObservation).toHaveBeenCalledExactlyOnceWith('saved-observation-uuid', {
        comment: '',
        obsDatetime: expect.any(String),
      }),
    );
    expect(testProps.closeWorkspaceWithSavedChanges).toHaveBeenCalledOnce();
  });

  test('retries only order completion when a saved result has a pending order', async () => {
    const user = userEvent.setup();
    mockUseCompletedLabResults.mockReturnValue({
      completeLabResult: {
        uuid: 'saved-observation-uuid',
        concept: { uuid: 'concept-uuid', display: 'Test Concept' },
        value: 50,
      } as never,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<LabResultsForm {...testProps} />);
    const input = await screen.findByLabelText('Test Concept (0 - 100 mg/dL)');
    await waitFor(() => expect(input).toHaveValue(50));
    await user.click(screen.getByRole('button', { name: /Complete order/i }));

    await waitFor(() =>
      expect(mockCompleteOrderResult).toHaveBeenCalledWith(
        'order-uuid',
        { fulfillerStatus: 'COMPLETED', fulfillerComment: 'Test Results Entered' },
        expect.anything(),
      ),
    );
    expect(updateOrderResult).not.toHaveBeenCalled();
    expect(mockUpdateObservation).not.toHaveBeenCalled();
  });

  test.each([0, 50])('keeps persisted value %s and its comment read-only until order completion', async (value) => {
    const user = userEvent.setup();
    mockUseCompletedLabResults.mockReturnValue({
      completeLabResult: {
        uuid: 'saved-observation-uuid',
        concept: { uuid: 'concept-uuid', display: 'Test Concept' },
        value,
        comment: 'Persisted synthetic comment',
      } as never,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    });
    render(<LabResultsForm {...testProps} />);
    const input = await screen.findByLabelText('Test Concept (0 - 100 mg/dL)');
    const comment = screen.getByLabelText('Observaciones');
    await waitFor(() => expect(input).toHaveValue(value));
    expect(input).toBeDisabled();
    expect(comment).toBeDisabled();
    await user.type(input, '60');
    await user.type(comment, 'Discarded edit');
    expect(input).toHaveValue(value);
    expect(comment).toHaveValue('Persisted synthetic comment');
    expect(screen.getByText(/Results are read-only/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Complete order/i }));
    await waitFor(() => expect(mockCompleteOrderResult).toHaveBeenCalledTimes(1));
    expect(updateOrderResult).not.toHaveBeenCalled();
    expect(mockUpdateObservation).not.toHaveBeenCalled();
  });

  test('locks value and comment during saving and keeps them locked after a partial save', async () => {
    const user = userEvent.setup();
    let rejectSave: (reason: unknown) => void;
    vi.mocked(updateOrderResult).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    render(<LabResultsForm {...testProps} />);
    const input = await screen.findByLabelText('Test Concept (0 - 100 mg/dL)');
    const comment = screen.getByLabelText('Observaciones');
    await user.type(input, '50');
    await user.type(comment, 'Persisted synthetic comment');
    await user.click(screen.getByRole('button', { name: /Save and close/i }));
    await waitFor(() => expect(updateOrderResult).toHaveBeenCalledTimes(1));
    expect(input).toBeDisabled();
    expect(comment).toBeDisabled();
    rejectSave(new LabResultCompletionError('saved-observation-uuid', new Error('Synthetic failure')));
    const retry = await screen.findByRole('button', { name: /Complete order/i });
    expect(input).toBeDisabled();
    expect(comment).toBeDisabled();
    expect(input).toHaveValue(50);
    expect(testProps.closeWorkspaceWithSavedChanges).not.toHaveBeenCalled();
    mockCompleteOrderResult.mockRejectedValueOnce(new Error('Synthetic completion failure'));
    await user.click(retry);
    await waitFor(() => expect(mockCompleteOrderResult).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(retry).toBeEnabled());
    expect(input).toBeDisabled();
    expect(testProps.closeWorkspaceWithSavedChanges).not.toHaveBeenCalled();
    await user.click(retry);
    await waitFor(() => expect(testProps.closeWorkspaceWithSavedChanges).toHaveBeenCalledTimes(1));
    expect(updateOrderResult).toHaveBeenCalledTimes(1);
    expect(mockUpdateObservation).not.toHaveBeenCalled();
  });
});

import type { FormSchema } from '@sihsalus/esm-form-engine-lib';
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import * as formEngineRuntime from '../form-engine-lib-runtime';
import FormRenderer from './form-renderer.component';

void React;

// Mock dependencies
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showModal: vi.fn(() => vi.fn()),
  useConfig: vi.fn(() => ({
    dataSources: { monthlySchedule: false },
    customDataSources: [],
    appointmentsResourceUrl: '/etl-latest/etl/get-monthly-schedule',
    customEncounterDatetime: false,
  })),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
  getGlobalStore: vi.fn(() => ({
    getState: () => ({}),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  })),
  createGlobalStore: vi.fn(() => ({
    getState: () => ({}),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  })),
  showSnackbar: vi.fn(),
}));

vi.mock('../form-engine-lib-runtime', () => ({
  FormEngine: vi.fn(() => <div data-testid="form-engine">FormEngine Mock</div>),
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  clinicalFormsWorkspace: 'clinical-forms-workspace',
  launchPatientWorkspace: vi.fn(),
}));

vi.mock('../hooks/useFormSchema', () => ({
  __esModule: true,
  default: vi.fn(),
}));

vi.mock('../hooks/useCustomDataSources', () => ({
  useCustomDataSources: vi.fn(),
}));

const mockShowLabOrdersNotification = vi.fn();

vi.mock('../hooks/useLabOrderNotification', () => ({
  useLabOrderNotification: vi.fn(() => ({
    showLabOrdersNotification: mockShowLabOrdersNotification,
  })),
}));

vi.mock('../hooks/useCustomEncounterDatetime', () => ({
  useCustomEncounterDatetime: vi.fn((_, __, preFilled) => preFilled),
}));

import useFormSchema from '../hooks/useFormSchema';

const mockUseFormSchema = vi.mocked(useFormSchema);

const mockSchema: FormSchema = {
  uuid: 'test',
  name: 'Test Form',
  encounterType: 'enc-type-uuid',
  pages: [],
};
const mockFormEngine = vi.mocked(formEngineRuntime.FormEngine);

const defaultProps = {
  formUuid: 'test-form-uuid',
  patientUuid: 'test-patient-uuid',
  patient: {} as fhir.Patient,
  view: 'form',
  visitUuid: 'test-visit-uuid',
  visitStartDatetime: '2024-01-01T08:00:00.000+0000',
  visitStopDatetime: '2024-01-01T18:00:00.000+0000',
  isOffline: false,
  closeWorkspace: vi.fn(),
  closeWorkspaceWithSavedChanges: vi.fn(),
  promptBeforeClosing: vi.fn(),
  setTitle: vi.fn(),
};

const canonicalProps = {
  formUuid: 'test-form-uuid',
  patientUuid: 'test-patient-uuid',
  patient: {} as fhir.Patient,
  visit: {
    uuid: 'test-visit-uuid',
    startDatetime: '2024-01-01T08:00:00.000+0000',
    stopDatetime: '2024-01-01T18:00:00.000+0000',
    encounters: [],
    visitType: { uuid: 'visit-type-123', display: 'Visit type' },
  },
  closeWorkspace: vi.fn(),
  closeWorkspaceWithSavedChanges: vi.fn(),
  setHasUnsavedChanges: vi.fn(),
};

describe('FormRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowLabOrdersNotification.mockReset();
  });

  it('renders loading state', () => {
    mockUseFormSchema.mockReturnValue({
      schema: undefined,
      error: undefined,
      isLoading: true,
    });
    render(<FormRenderer {...defaultProps} />);
    expect(screen.getByText('Loading ...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseFormSchema.mockReturnValue({
      schema: undefined,
      error: new Error('fail'),
      isLoading: false,
    });
    render(<FormRenderer {...defaultProps} />);
    expect(screen.getByText(/there was an error with this form/i)).toBeInTheDocument();
  });

  it('renders FormEngine when schema is loaded', () => {
    mockUseFormSchema.mockReturnValue({
      schema: mockSchema,
      error: undefined,
      isLoading: false,
    });
    render(<FormRenderer {...defaultProps} />);
    expect(screen.getByTestId('form-engine')).toBeInTheDocument();
  });

  it('passes encounterUUID for edit mode', () => {
    mockUseFormSchema.mockReturnValue({
      schema: mockSchema,
      error: undefined,
      isLoading: false,
    });

    render(<FormRenderer {...defaultProps} encounterUuid="enc-123" />);
    expect(mockFormEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterUUID: 'enc-123',
        mode: 'edit',
      }),
      expect.anything(),
    );
  });

  it('defaults to enter mode when no encounterUuid', () => {
    mockUseFormSchema.mockReturnValue({
      schema: mockSchema,
      error: undefined,
      isLoading: false,
    });

    render(<FormRenderer {...defaultProps} />);
    expect(mockFormEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'enter',
      }),
      expect.anything(),
    );
  });

  it('constructs visit object from string props', () => {
    mockUseFormSchema.mockReturnValue({
      schema: mockSchema,
      error: undefined,
      isLoading: false,
    });

    render(<FormRenderer {...defaultProps} visitTypeUuid="visit-type-123" />);
    expect(mockFormEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        visit: expect.objectContaining({
          uuid: 'test-visit-uuid',
          startDatetime: '2024-01-01T08:00:00.000+0000',
          stopDatetime: '2024-01-01T18:00:00.000+0000',
          visitType: { uuid: 'visit-type-123', display: '' },
        }),
      }),
      expect.anything(),
    );
  });

  it('uses the canonical visit object when provided by a v12-style caller', () => {
    mockUseFormSchema.mockReturnValue({
      schema: mockSchema,
      error: undefined,
      isLoading: false,
    });

    render(<FormRenderer {...canonicalProps} />);

    expect(mockFormEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        visit: canonicalProps.visit,
      }),
      expect.anything(),
    );
  });

  it('allows canonical callers to omit visit context', () => {
    mockUseFormSchema.mockReturnValue({
      schema: mockSchema,
      error: undefined,
      isLoading: false,
    });

    render(<FormRenderer {...canonicalProps} visit={undefined} />);

    expect(mockFormEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        visit: undefined,
      }),
      expect.anything(),
    );
  });

  it('bridges dirty state through promptBeforeClosing for legacy callers', () => {
    mockUseFormSchema.mockReturnValue({
      schema: mockSchema,
      error: undefined,
      isLoading: false,
    });

    render(<FormRenderer {...defaultProps} />);
    const formEngineProps = mockFormEngine.mock.calls[0][0];

    formEngineProps.markFormAsDirty(true);

    expect(defaultProps.promptBeforeClosing).toHaveBeenCalledWith(expect.any(Function));
    expect(defaultProps.promptBeforeClosing.mock.calls[0][0]()).toBe(true);
  });

  it('uses setHasUnsavedChanges directly for canonical callers', () => {
    mockUseFormSchema.mockReturnValue({
      schema: mockSchema,
      error: undefined,
      isLoading: false,
    });

    render(<FormRenderer {...canonicalProps} />);
    const formEngineProps = mockFormEngine.mock.calls[0][0];

    formEngineProps.markFormAsDirty(true);

    expect(canonicalProps.setHasUnsavedChanges).toHaveBeenCalledWith(true);
  });

  it('shows lab order notifications and closes the workspace after a successful submit', async () => {
    const handlePostResponse = vi.fn();
    mockUseFormSchema.mockReturnValue({
      schema: mockSchema,
      error: undefined,
      isLoading: false,
    });

    render(<FormRenderer {...defaultProps} handlePostResponse={handlePostResponse} />);
    const formEngineProps = mockFormEngine.mock.calls[0][0];
    const submittedEncounter = {
      uuid: 'encounter-123',
      display: 'Encounter 123',
    };

    await act(async () => {
      await formEngineProps.onSubmit([submittedEncounter]);
    });

    expect(mockShowLabOrdersNotification).toHaveBeenCalledWith('encounter-123');
    expect(handlePostResponse).toHaveBeenCalledWith(submittedEncounter);
    expect(defaultProps.closeWorkspaceWithSavedChanges).toHaveBeenCalled();
  });
});

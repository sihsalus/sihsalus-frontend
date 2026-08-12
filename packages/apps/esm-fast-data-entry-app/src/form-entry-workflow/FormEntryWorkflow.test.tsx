import { useSession } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  DECEASED_PATIENT_OPERATION_BLOCKED,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
} from '@openmrs/esm-patient-common-lib';
import { render } from '@testing-library/react';
import FormWorkflowContext from '../context/FormWorkflowContext';
import FormBootstrap from '../FormBootstrap';
import useStartVisit from '../hooks/useStartVisit';
import { FormWorkspace } from './FormEntryWorkflow';

vi.mock('@openmrs/esm-framework', () => ({
  ExtensionSlot: vi.fn(() => null),
  useSession: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  assertFreshPatientIsAlive: vi.fn(),
  DECEASED_PATIENT_OPERATION_BLOCKED: 'DECEASED_PATIENT_OPERATION_BLOCKED',
  PATIENT_VITAL_STATUS_UNAVAILABLE: 'PATIENT_VITAL_STATUS_UNAVAILABLE',
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'generated-visit-uuid'),
}));

vi.mock('../FormBootstrap', () => ({
  __esModule: true,
  default: vi.fn(() => <div data-testid="form-bootstrap" />),
}));

vi.mock('../hooks/useStartVisit', () => ({
  __esModule: true,
  default: vi.fn(),
}));

vi.mock('../patient-card/PatientCard', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('../CancelModal', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('../CompleteModal', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('./patient-banner', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('./patient-search-header', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('./workflow-review', () => ({
  __esModule: true,
  default: () => null,
}));

const mockUseSession = vi.mocked(useSession);
const mockAssertFreshPatientIsAlive = vi.mocked(assertFreshPatientIsAlive);
const mockUseStartVisit = vi.mocked(useStartVisit);
const mockFormBootstrap = FormBootstrap as vi.Mock;

const renderWorkspace = (contextOverrides = {}) => {
  const defaultContext = {
    workflowState: 'EDIT_FORM',
    patientUuids: ['patient-a'],
    activePatientUuid: 'patient-a',
    activeEncounterUuid: null,
    activeFormUuid: 'individual-form',
    encounters: {},
    singleSessionVisitTypeUuid: 'visit-type-1',
    saveEncounter: vi.fn(),
    editEncounter: vi.fn(),
    destroySession: vi.fn(),
  };

  return render(
    <FormWorkflowContext.Provider value={{ ...defaultContext, ...contextOverrides } as never}>
      <FormWorkspace />
    </FormWorkflowContext.Provider>,
  );
};

describe('FormWorkspace encounter vital-status guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      sessionLocation: { uuid: 'session-location', display: 'General Hospital' },
    } as never);
    mockUseStartVisit.mockReturnValue({ updateEncounter: vi.fn(), success: null } as never);
    mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, isDeceased: false });
  });

  it('checks a living patient before building the visit and again before its final save', async () => {
    renderWorkspace();
    const [formBootstrapProps] = mockFormBootstrap.mock.calls[0];
    const payload = { encounterDatetime: '2026-04-15T10:00:00.000Z' };
    const originalPayload = structuredClone(payload);

    mockAssertFreshPatientIsAlive.mockImplementationOnce(async () => {
      expect(payload).toEqual(originalPayload);
      return { dead: false, isDeceased: false };
    });

    await expect(formBootstrapProps.handleEncounterCreate(payload)).resolves.toBe(payload);

    expect(payload).toEqual(
      expect.objectContaining({
        encounterDatetime: '2026-04-15T10:00:00.000Z',
        location: 'session-location',
        visit: expect.objectContaining({
          uuid: 'generated-visit-uuid',
          patient: { uuid: 'patient-a' },
          location: { uuid: 'session-location' },
          visitType: { uuid: 'visit-type-1' },
        }),
      }),
    );

    await expect(formBootstrapProps.onBeforeEncounterSave(payload)).resolves.toBeUndefined();
    expect(mockAssertFreshPatientIsAlive).toHaveBeenNthCalledWith(1, 'patient-a');
    expect(mockAssertFreshPatientIsAlive).toHaveBeenNthCalledWith(2, 'patient-a');
  });

  it.each([
    ['deceased', DECEASED_PATIENT_OPERATION_BLOCKED],
    ['unavailable', PATIENT_VITAL_STATUS_UNAVAILABLE],
  ])('does not mutate the encounter payload when the initial patient check is %s', async (_state, code) => {
    const guardError = Object.assign(new Error(`Patient status ${_state}`), { code });
    mockAssertFreshPatientIsAlive.mockRejectedValueOnce(guardError);
    renderWorkspace();

    const [formBootstrapProps] = mockFormBootstrap.mock.calls[0];
    const payload = {
      encounterDatetime: '2026-04-15T10:00:00.000Z',
      location: 'original-location',
      visit: 'original-visit',
    };
    const originalPayload = structuredClone(payload);

    await expect(formBootstrapProps.handleEncounterCreate(payload)).rejects.toBe(guardError);

    expect(payload).toEqual(originalPayload);
  });

  it('blocks the final save when the patient dies after the initial check', async () => {
    const deceasedError = Object.assign(new Error('Patient is deceased'), {
      code: DECEASED_PATIENT_OPERATION_BLOCKED,
    });
    mockAssertFreshPatientIsAlive
      .mockResolvedValueOnce({ dead: false, isDeceased: false })
      .mockRejectedValueOnce(deceasedError);
    renderWorkspace();

    const [formBootstrapProps] = mockFormBootstrap.mock.calls[0];
    const payload = { encounterDatetime: '2026-04-15T10:00:00.000Z' };

    await formBootstrapProps.handleEncounterCreate(payload);

    expect(payload).toHaveProperty('visit');
    await expect(formBootstrapProps.onBeforeEncounterSave(payload)).rejects.toBe(deceasedError);
    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledTimes(2);
  });
});

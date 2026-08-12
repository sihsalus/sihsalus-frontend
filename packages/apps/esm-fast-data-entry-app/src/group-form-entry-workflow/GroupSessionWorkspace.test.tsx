import { getGlobalStore, useConfig, useSession, useStore } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  DECEASED_PATIENT_OPERATION_BLOCKED,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
} from '@openmrs/esm-patient-common-lib';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback, useReducer } from 'react';
import GroupFormWorkflowContext from '../context/GroupFormWorkflowContext';
import groupFormWorkflowReducer from '../context/GroupFormWorkflowReducer';
import FormBootstrap from '../FormBootstrap';
import GroupSessionWorkspace from './GroupSessionWorkspace';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getGlobalStore: vi.fn(),
  useConfig: vi.fn(),
  useSession: vi.fn(),
  useStore: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  assertFreshPatientIsAlive: vi.fn(),
  DECEASED_PATIENT_OPERATION_BLOCKED: 'DECEASED_PATIENT_OPERATION_BLOCKED',
  PATIENT_VITAL_STATUS_UNAVAILABLE: 'PATIENT_VITAL_STATUS_UNAVAILABLE',
}));

const mockUuid = vi.hoisted(() => vi.fn());

vi.mock('uuid', () => ({ v4: mockUuid }));

vi.mock('../FormBootstrap', () => ({
  __esModule: true,
  default: vi.fn(() => <div data-testid="form-bootstrap" />),
}));

vi.mock('../patient-card/PatientCard', () => ({
  __esModule: true,
  default: ({ patientUuid, editEncounter }) => (
    <button type="button" data-testid={`patient-card-${patientUuid}`} onClick={() => editEncounter(patientUuid)}>
      {patientUuid}
    </button>
  ),
}));

vi.mock('../CancelModal', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('../CompleteModal', () => ({
  __esModule: true,
  default: () => null,
}));

const mockGetGlobalStore = vi.mocked(getGlobalStore);
const mockUseConfig = vi.mocked(useConfig);
const mockUseSession = vi.mocked(useSession);
const mockUseStore = vi.mocked(useStore);
const mockAssertFreshPatientIsAlive = vi.mocked(assertFreshPatientIsAlive);
const mockFormBootstrap = FormBootstrap as vi.Mock;

const renderWorkspace = (contextOverrides = {}) => {
  const defaultContext = {
    workflowState: 'EDIT_FORM',
    patientUuids: ['patient-a', 'patient-b'],
    activePatientUuid: 'patient-a',
    activeEncounterUuid: null,
    activeVisitUuid: null,
    activeFormUuid: 'group-form',
    activeGroupUuid: 'group-1',
    activeGroupName: 'Nutrition Cohort',
    activeSessionUuid: 'session-1',
    activeSessionMeta: {
      sessionName: 'April Session',
      practitionerName: 'Alice',
      sessionDate: '2026-04-15',
      sessionNotes: 'Bring notebooks',
    },
    groupVisitTypeUuid: 'visit-type-1',
    encounters: {},
    saveEncounter: vi.fn(),
    updateVisitUuid: vi.fn(),
    submitForNext: vi.fn(),
    resetSubmission: vi.fn(),
  };

  return render(
    <GroupFormWorkflowContext.Provider value={{ ...defaultContext, ...contextOverrides } as never}>
      <GroupSessionWorkspace />
    </GroupFormWorkflowContext.Provider>,
  );
};

const StatefulGroupWorkflow = () => {
  const [state, dispatch] = useReducer(groupFormWorkflowReducer, {
    activeFormUuid: 'group-form',
    userUuid: 'user-1',
    nextPatientUuid: null,
    forms: {
      'group-form': {
        workflowState: 'EDIT_FORM',
        patientUuids: ['patient-a', 'patient-b'],
        activePatientUuid: 'patient-a',
        activeEncounterUuid: null,
        activeVisitUuid: null,
        activeFormUuid: 'group-form',
        activeGroupUuid: 'group-1',
        activeGroupName: 'Nutrition Cohort',
        activeSessionUuid: 'session-1',
        activeSessionMeta: {
          sessionName: 'April Session',
          practitionerName: 'Alice',
          sessionDate: '2026-04-15',
          sessionNotes: 'Bring notebooks',
        },
        groupVisitTypeUuid: 'visit-type-1',
        encounters: {},
        visits: {},
      },
    },
  });
  const formState = state.forms['group-form'];
  const saveEncounter = useCallback((encounterUuid) => dispatch({ type: 'SAVE_ENCOUNTER', encounterUuid }), []);
  const updateVisitUuid = useCallback((visitUuid) => dispatch({ type: 'UPDATE_VISIT_UUID', visitUuid }), []);
  const submitForNext = useCallback(
    (nextPatientUuid) => dispatch({ type: 'SUBMIT_FOR_NEXT', nextPatientUuid }),
    [],
  );
  const resetSubmission = useCallback(() => dispatch({ type: 'SUBMISSION_FAILED' }), []);

  return (
    <GroupFormWorkflowContext.Provider
      value={
        {
          ...formState,
          activeFormUuid: 'group-form',
          activeGroupUuid: formState.activeGroupUuid,
          activeGroupName: formState.activeGroupName,
          activeSessionMeta: formState.activeSessionMeta,
          groupVisitTypeUuid: formState.groupVisitTypeUuid,
          saveEncounter,
          updateVisitUuid,
          submitForNext,
          resetSubmission,
        } as never
      }
    >
      <GroupSessionWorkspace />
    </GroupFormWorkflowContext.Provider>
  );
};

describe('GroupSessionWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGlobalStore.mockReturnValue('ampath-form-state' as never);
    mockUseStore.mockReturnValue({
      'group-form': 'ready',
    } as never);
    mockUseSession.mockReturnValue({
      sessionLocation: {
        uuid: 'session-location',
        display: 'General Hospital',
      },
    } as never);
    mockUseConfig.mockReturnValue({
      groupSessionConcepts: {
        sessionName: 'concept-session-name',
        practitionerName: 'concept-practitioner',
        sessionNotes: 'concept-notes',
        sessionDate: 'concept-date',
        cohortId: 'concept-cohort-id',
        cohortName: 'concept-cohort-name',
        sessionUuid: 'concept-session-uuid',
      },
    } as never);
    mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, isDeceased: false });
    mockUuid.mockReturnValue('generated-visit-uuid');
  });

  it('checks a living patient before building the encounter and again before its final save', async () => {
    const updateVisitUuid = vi.fn();
    renderWorkspace({ updateVisitUuid });

    const [formBootstrapProps] = mockFormBootstrap.mock.calls[0];
    const payload: Record<string, unknown> = {
      obs: [
        {
          concept: 'weight-concept',
          value: '70',
          groupMembers: [{ concept: 'height-concept', value: '175' }],
        },
      ],
    };

    await act(async () => {
      await formBootstrapProps.handleEncounterCreate(payload);
    });

    const expectedObsDatetime = new Date('2026-04-15').toISOString();

    expect(payload.location).toBe('session-location');
    expect(payload.encounterDatetime).toBe(expectedObsDatetime);
    expect(payload.obs[0]).toEqual(
      expect.objectContaining({
        obsDatetime: expectedObsDatetime,
        groupMembers: [
          expect.objectContaining({
            concept: 'height-concept',
            value: '175',
            obsDatetime: expectedObsDatetime,
          }),
        ],
      }),
    );
    expect(payload.obs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ concept: 'concept-session-name', value: 'April Session' }),
        expect.objectContaining({ concept: 'concept-practitioner', value: 'Alice' }),
        expect.objectContaining({ concept: 'concept-notes', value: 'Bring notebooks' }),
        expect.objectContaining({ concept: 'concept-date', value: '2026-04-15' }),
        expect.objectContaining({ concept: 'concept-cohort-id', value: 'group-1' }),
        expect.objectContaining({ concept: 'concept-cohort-name', value: 'Nutrition Cohort' }),
        expect.objectContaining({ concept: 'concept-session-uuid', value: 'session-1' }),
      ]),
    );
    expect(payload.visit).toEqual({
      startDatetime: '2026-04-15',
      stopDatetime: '2026-04-15',
      uuid: 'generated-visit-uuid',
      patient: {
        uuid: 'patient-a',
      },
      location: {
        uuid: 'session-location',
      },
      visitType: {
        uuid: 'visit-type-1',
      },
    });
    expect(updateVisitUuid).not.toHaveBeenCalled();

    await expect(formBootstrapProps.onBeforeEncounterSave(payload)).resolves.toBeUndefined();
    formBootstrapProps.handlePostResponse({ uuid: 'saved-encounter-uuid' });
    expect(updateVisitUuid).toHaveBeenCalledWith('generated-visit-uuid');
    expect(mockAssertFreshPatientIsAlive).toHaveBeenNthCalledWith(1, 'patient-a');
    expect(mockAssertFreshPatientIsAlive).toHaveBeenNthCalledWith(2, 'patient-a');
    expect(mockAssertFreshPatientIsAlive.mock.invocationCallOrder[0]).toBeLessThan(
      updateVisitUuid.mock.invocationCallOrder[0],
    );
  });

  it.each([
    ['deceased', DECEASED_PATIENT_OPERATION_BLOCKED],
    ['unavailable', PATIENT_VITAL_STATUS_UNAVAILABLE],
  ])('does not mutate the encounter payload when the initial patient check is %s', async (_state, code) => {
    const updateVisitUuid = vi.fn();
    const resetSubmission = vi.fn();
    const guardError = Object.assign(new Error(`Patient status ${_state}`), { code });
    mockAssertFreshPatientIsAlive.mockRejectedValueOnce(guardError);
    renderWorkspace({ updateVisitUuid, resetSubmission });

    const [formBootstrapProps] = mockFormBootstrap.mock.calls[0];
    const payload = {
      location: 'original-location',
      encounterDatetime: '2026-04-01T10:00:00.000Z',
      obs: [{ concept: 'weight-concept', value: '70' }],
    };
    const originalPayload = structuredClone(payload);

    await expect(formBootstrapProps.handleEncounterCreate(payload)).rejects.toBe(guardError);

    expect(payload).toEqual(originalPayload);
    expect(updateVisitUuid).not.toHaveBeenCalled();
    expect(resetSubmission).toHaveBeenCalledOnce();
  });

  it('blocks the final save when the patient dies after the initial check', async () => {
    const updateVisitUuid = vi.fn();
    const resetSubmission = vi.fn();
    const deceasedError = Object.assign(new Error('Patient is deceased'), {
      code: DECEASED_PATIENT_OPERATION_BLOCKED,
    });
    mockAssertFreshPatientIsAlive
      .mockResolvedValueOnce({ dead: false, isDeceased: false })
      .mockRejectedValueOnce(deceasedError);
    renderWorkspace({ updateVisitUuid, resetSubmission });

    const [formBootstrapProps] = mockFormBootstrap.mock.calls[0];
    const payload = { obs: [] };

    await formBootstrapProps.handleEncounterCreate(payload);

    expect(payload).toHaveProperty('visit');
    await expect(formBootstrapProps.onBeforeEncounterSave(payload)).rejects.toBe(deceasedError);
    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledTimes(2);
    expect(updateVisitUuid).not.toHaveBeenCalled();
    expect(resetSubmission).toHaveBeenCalledOnce();

    mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, isDeceased: false });
    const retryPayload: Record<string, unknown> = { obs: [] };
    await formBootstrapProps.handleEncounterCreate(retryPayload);
    await formBootstrapProps.onBeforeEncounterSave(retryPayload);

    expect(retryPayload.visit).toEqual(expect.objectContaining({ uuid: 'generated-visit-uuid' }));
    formBootstrapProps.handlePostResponse({ uuid: 'retry-encounter-uuid' });
    expect(updateVisitUuid).toHaveBeenCalledWith('generated-visit-uuid');
  });

  it('restores the button after a rejected final guard and retries with the same pending visit UUID', async () => {
    const user = userEvent.setup();
    const deceasedError = Object.assign(new Error('Patient died during submission'), {
      code: DECEASED_PATIENT_OPERATION_BLOCKED,
    });
    mockAssertFreshPatientIsAlive
      .mockResolvedValueOnce({ dead: false, isDeceased: false })
      .mockRejectedValueOnce(deceasedError)
      .mockResolvedValue({ dead: false, isDeceased: false });
    mockUuid.mockReset().mockReturnValueOnce('pending-visit-uuid').mockReturnValue('unexpected-new-visit-uuid');
    render(<StatefulGroupWorkflow />);

    const attemptedVisitUuids: string[] = [];
    const savedEncounterUuids: string[] = [];
    const attemptCompletions: Array<Promise<void>> = [];
    const onSubmit = () => {
      const [formBootstrapProps] = mockFormBootstrap.mock.calls.at(-1);
      const payload: Record<string, unknown> = { obs: [] };
      const attempt = (async () => {
        try {
          await formBootstrapProps.handleEncounterCreate(payload);
          attemptedVisitUuids.push((payload.visit as { uuid: string }).uuid);
          await formBootstrapProps.onBeforeEncounterSave(payload);
          const encounterUuid = `encounter-${attemptedVisitUuids.length}`;
          savedEncounterUuids.push(encounterUuid);
          formBootstrapProps.handlePostResponse({ uuid: encounterUuid });
        } catch {
          // The real form engine reports the rejection while the workflow guard
          // restores EDIT_FORM. The retry is initiated by the user below.
        }
      })();
      attemptCompletions.push(attempt);
    };
    window.addEventListener('ampath-form-action', onSubmit);

    try {
      await user.click(screen.getByRole('button', { name: 'Next patient' }));
      await waitFor(() => expect(attemptCompletions).toHaveLength(1));
      await attemptCompletions[0];

      await waitFor(() => expect(screen.getByRole('button', { name: 'Next patient' })).toBeEnabled());
      expect(attemptedVisitUuids).toEqual(['pending-visit-uuid']);
      expect(savedEncounterUuids).toEqual([]);

      await user.click(screen.getByRole('button', { name: 'Next patient' }));
      await waitFor(() => expect(attemptCompletions).toHaveLength(2));
      await attemptCompletions[1];

      expect(attemptedVisitUuids).toEqual(['pending-visit-uuid', 'pending-visit-uuid']);
      expect(savedEncounterUuids).toEqual(['encounter-2']);
      expect(mockUuid).toHaveBeenCalledOnce();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Save Form' })).toBeEnabled());
    } finally {
      window.removeEventListener('ampath-form-action', onSubmit);
    }
  });

  it('wires patient switching and save actions through the workflow callbacks', async () => {
    const user = userEvent.setup();
    const saveEncounter = vi.fn();
    const submitForNext = vi.fn();
    renderWorkspace({ saveEncounter, submitForNext });

    const [formBootstrapProps] = mockFormBootstrap.mock.calls[0];

    act(() => {
      formBootstrapProps.handlePostResponse({ uuid: 'encounter-1' });
    });

    expect(saveEncounter).toHaveBeenCalledWith('encounter-1');

    await user.click(screen.getByTestId('patient-card-patient-b'));
    expect(submitForNext).toHaveBeenCalledWith('patient-b');

    await user.click(screen.getByRole('button', { name: 'Next patient' }));
    expect(submitForNext).toHaveBeenCalledWith();
  });
});

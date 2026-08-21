import { getFullSynchronizationItems, queueSynchronizationItem } from '@openmrs/esm-framework';

import { queuePatientFormSyncItem } from './sync';
import type { PatientFormSyncItemContent } from './types';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getFullSynchronizationItems: vi.fn(),
  queueSynchronizationItem: vi.fn(),
}));

const mockGetFullSynchronizationItems = vi.mocked(getFullSynchronizationItems);
const mockQueueSynchronizationItem = vi.mocked(queueSynchronizationItem);
const queuedContentUuid = '11111111-1111-4111-8111-111111111111';

function createQueuedForm(encounterUuid?: string): PatientFormSyncItemContent {
  return {
    _id: queuedContentUuid,
    form: { uuid: 'synthetic-form-uuid' },
    encounter: {},
    _payloads: {
      encounterCreate: {
        uuid: encounterUuid,
        encounterDatetime: '2026-08-20T12:00:00.000Z',
        patient: 'synthetic-patient-uuid',
        encounterType: 'synthetic-encounter-type-uuid',
        location: 'synthetic-location-uuid',
        visit: 'synthetic-visit-uuid',
      },
      personUpdate: {
        uuid: 'synthetic-person-uuid',
        attributes: [],
      },
    },
  };
}

describe('queuePatientFormSyncItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullSynchronizationItems.mockResolvedValue([]);
    mockQueueSynchronizationItem.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists the stable queue content UUID in the encounter payload', async () => {
    const content = createQueuedForm();

    await queuePatientFormSyncItem(content);

    expect(content._payloads.encounterCreate?.uuid).toBeUndefined();
    expect(mockQueueSynchronizationItem).toHaveBeenCalledWith(
      'patient-form',
      expect.objectContaining({
        _payloads: expect.objectContaining({
          encounterCreate: expect.objectContaining({ uuid: queuedContentUuid }),
        }),
      }),
      {
        id: content._id,
        displayName: 'Patient form',
        patientUuid: 'synthetic-patient-uuid',
        dependencies: [{ type: 'visit', id: 'synthetic-visit-uuid' }],
      },
      expect.objectContaining({ reconcileContent: expect.any(Function) }),
    );
  });

  it('uses the same encounter UUID when concurrent submissions replace the same queue item', async () => {
    await Promise.all([queuePatientFormSyncItem(createQueuedForm()), queuePatientFormSyncItem(createQueuedForm())]);

    expect(mockQueueSynchronizationItem).toHaveBeenCalledTimes(2);
    for (const [, queuedContent] of mockQueueSynchronizationItem.mock.calls) {
      expect((queuedContent as PatientFormSyncItemContent)._payloads.encounterCreate?.uuid).toBe(queuedContentUuid);
    }
  });

  it('preserves the stable queue UUID when it is already present in the encounter payload', async () => {
    const content = createQueuedForm(queuedContentUuid);

    await queuePatientFormSyncItem(content);

    expect(mockQueueSynchronizationItem.mock.calls[0][1]).toBe(content);
  });

  it('fails closed before queue mutation when two supplied recovery keys conflict', async () => {
    const content = createQueuedForm('33333333-3333-4333-8333-333333333333');

    await expect(queuePatientFormSyncItem(content)).rejects.toEqual(
      new Error('The offline patient form could not be queued.'),
    );
    expect(mockQueueSynchronizationItem).not.toHaveBeenCalled();
  });

  it('fails closed before queue mutation when the encounter key is not a canonical UUID', async () => {
    const content = { ...createQueuedForm(), _id: 'not-a-canonical-uuid' };

    await expect(queuePatientFormSyncItem(content)).rejects.toEqual(
      new Error('The offline patient form could not be queued.'),
    );
    expect(mockQueueSynchronizationItem).not.toHaveBeenCalled();
  });

  it('strips caller-supplied checkpoints when creating a new queue row', async () => {
    await queuePatientFormSyncItem(createQueuedForm());
    const queuedContent = structuredClone(mockQueueSynchronizationItem.mock.calls[0][1] as PatientFormSyncItemContent);
    queuedContent._syncState = {
      encounter: {
        status: 'attempted',
        payload: getEncounterCreate(queuedContent),
        attemptId: 'forged-attempt-id',
      },
    };
    const reconcileContent = getReconcileContent();

    const reconciled = reconcileContent(undefined, queuedContent);

    expect(reconciled).toEqual({ ...queuedContent, _syncState: undefined });
    expect(reconciled).not.toHaveProperty('_syncState');
  });

  it('preserves an attempted checkpoint only when its clinical payload is unchanged', async () => {
    await queuePatientFormSyncItem(createQueuedForm());
    const proposedContent = structuredClone(
      mockQueueSynchronizationItem.mock.calls[0][1] as PatientFormSyncItemContent,
    );
    const existingContent = structuredClone(proposedContent);
    existingContent._syncState = {
      encounter: {
        status: 'attempted',
        payload: structuredClone(getEncounterCreate(existingContent)),
        attemptId: 'existing-attempt-id',
      },
    };
    const reconcileContent = getReconcileContent();

    expect(reconcileContent(existingContent, proposedContent)).toEqual(existingContent);

    const editedContent = structuredClone(proposedContent);
    getEncounterCreate(editedContent).location = 'edited-location-uuid';
    expect(() => reconcileContent(existingContent, editedContent)).toThrow(
      'The offline patient form could not be queued.',
    );
  });

  it('does not replace a legacy ambiguous row or an uncheckpointed row with changed content', async () => {
    await queuePatientFormSyncItem(createQueuedForm());
    const proposedContent = structuredClone(
      mockQueueSynchronizationItem.mock.calls[0][1] as PatientFormSyncItemContent,
    );
    const reconcileContent = getReconcileContent();
    const legacyContent = structuredClone(proposedContent);
    delete legacyContent._payloads.encounterCreate?.uuid;

    expect(() => reconcileContent(legacyContent, proposedContent)).toThrow(
      'The offline patient form could not be queued.',
    );

    const editedContent = structuredClone(proposedContent);
    getEncounterCreate(editedContent).location = 'edited-location-uuid';
    expect(() => reconcileContent(proposedContent, editedContent)).toThrow(
      'The offline patient form could not be queued.',
    );
    expect(reconcileContent(proposedContent, structuredClone(proposedContent))).toEqual(proposedContent);
  });
});

function getReconcileContent() {
  const options = mockQueueSynchronizationItem.mock.calls[0][3] as {
    reconcileContent: (
      existingContent: PatientFormSyncItemContent | undefined,
      proposedContent: PatientFormSyncItemContent,
    ) => PatientFormSyncItemContent;
  };
  return options.reconcileContent;
}

function getEncounterCreate(content: PatientFormSyncItemContent) {
  const encounterCreate = content._payloads.encounterCreate;
  if (!encounterCreate) {
    throw new Error('The synthetic test fixture requires an encounter payload.');
  }
  return encounterCreate;
}

import { getFullSynchronizationItems, queueSynchronizationItem, type SyncItem } from '@openmrs/esm-framework';
import isEqual from 'lodash-es/isEqual';

import type { PatientFormSyncItemContent } from './types';

// The synchronization handler which actually synchronizes the queued items lives in `esm-patient-forms-app`.
// See that module's offline code for the synchronization logic.

export const patientFormSyncItem = 'patient-form';
const patientFormQueueError = 'The offline patient form could not be queued.';
const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function queuePatientFormSyncItem(content: PatientFormSyncItemContent) {
  const encounterCreate = content._payloads.encounterCreate;
  if (
    encounterCreate &&
    (!canonicalUuidPattern.test(content._id) || (encounterCreate.uuid && encounterCreate.uuid !== content._id))
  ) {
    throw createPatientFormQueueError();
  }

  const queuedContent =
    encounterCreate && !encounterCreate.uuid
      ? {
          ...content,
          _payloads: {
            ...content._payloads,
            encounterCreate: {
              ...encounterCreate,
              uuid: content._id,
            },
          },
        }
      : content;

  await queueSynchronizationItem(
    patientFormSyncItem,
    queuedContent,
    {
      id: queuedContent._id,
      displayName: 'Patient form',
      patientUuid: queuedContent._payloads.encounterCreate?.patient,
      dependencies: [
        {
          type: 'visit',
          id: queuedContent._payloads.encounterCreate?.visit,
        },
      ],
    },
    {
      reconcileContent(existingContent, proposedContent) {
        const { _syncState: _proposedSyncState, ...proposedWithoutSyncState } = proposedContent;
        if (!existingContent) {
          return proposedWithoutSyncState as PatientFormSyncItemContent;
        }

        assertExistingEncounterRecoveryKey(existingContent, proposedContent._id);
        const { _syncState: existingSyncState, ...existingWithoutSyncState } = existingContent;
        const hasCheckpoint = Boolean(existingSyncState?.encounter || existingSyncState?.person);
        if (!hasCheckpoint) {
          // A historical row has no durable evidence that it was never submitted. Its clinical payload
          // must remain immutable so an edit cannot turn an ambiguous legacy attempt into a new write.
          if (!isEqual(existingWithoutSyncState, proposedWithoutSyncState)) {
            throw createPatientFormQueueError();
          }
          return existingContent;
        }

        assertCheckpointPayloadIsUnchanged(
          existingSyncState?.encounter,
          existingContent._payloads.encounterCreate,
          proposedContent._payloads.encounterCreate,
        );
        assertCheckpointPayloadIsUnchanged(
          existingSyncState?.person,
          existingContent._payloads.personUpdate,
          proposedContent._payloads.personUpdate,
        );

        return {
          ...proposedWithoutSyncState,
          _syncState: existingSyncState,
        } as PatientFormSyncItemContent;
      },
    },
  );
}

function assertExistingEncounterRecoveryKey(content: PatientFormSyncItemContent, replacementId: string) {
  const encounterCreate = content._payloads.encounterCreate;
  if (
    content._id !== replacementId ||
    (encounterCreate && (!encounterCreate.uuid || encounterCreate.uuid !== content._id))
  ) {
    throw createPatientFormQueueError();
  }
}

function assertCheckpointPayloadIsUnchanged<T>(
  checkpoint: { payload: T } | undefined,
  existingPayload: T | undefined,
  proposedPayload: T | undefined,
) {
  if (checkpoint && (!isEqual(checkpoint.payload, existingPayload) || !isEqual(checkpoint.payload, proposedPayload))) {
    throw createPatientFormQueueError();
  }
}

function createPatientFormQueueError() {
  return new Error(patientFormQueueError);
}

export async function findQueuedPatientFormSyncItemByContentId(
  id: string,
): Promise<SyncItem<PatientFormSyncItemContent> | undefined> {
  const syncItems = await getFullSynchronizationItems<PatientFormSyncItemContent>(patientFormSyncItem);
  return syncItems.find((item) => item.content._id === id);
}

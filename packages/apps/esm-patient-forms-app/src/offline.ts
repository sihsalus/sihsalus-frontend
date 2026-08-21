import {
  launchWorkspace2,
  makeUrl,
  messageOmrsServiceWorker,
  omrsOfflineCachingStrategyHttpHeaderName,
  openmrsFetch,
  refreshOfflineCacheEntry,
  restBaseUrl,
  type SyncItem,
  type SyncProcessOptions,
  setupDynamicOfflineDataHandler,
  setupOfflineSync,
  type Visit,
} from '@openmrs/esm-framework';
import escapeRegExp from 'lodash-es/escapeRegExp';
import isEqual from 'lodash-es/isEqual';

/** Types inlined from the former esm-form-entry-app (Angular) to remove the cross-package dependency. */
interface EncounterCreate {
  uuid?: string;
  encounterDatetime: string;
  patient: string;
  encounterType: string;
  location: string;
  encounterProviders?: Array<{
    uuid?: string;
    person: string;
    provider: string;
  }>;
  obs?: Array<Record<string, unknown>>;
  orders?: Array<Record<string, unknown>>;
  diagnoses?: Array<Record<string, unknown>>;
  form?: string;
  visit?: string;
}

interface PersonUpdate {
  uuid?: string;
  attributes: Array<{ attributeType: string; value: string }>;
}

interface PatientFormSyncItemContent {
  /** Stable client-generated OpenMRS UUID and queue replacement key for this new encounter. */
  _id: string;
  form?: Pick<Form, 'uuid'> & Partial<Form>;
  formSchemaUuid?: string;
  encounter: Partial<{ uuid: string; encounterDatetime: string }>;
  /** Durable per-write checkpoints. This field is absent on legacy queue rows. */
  _syncState?: {
    encounter?: PatientFormWriteCheckpoint<EncounterCreate>;
    person?: PatientFormWriteCheckpoint<PersonUpdate>;
  };
  _payloads: {
    encounterCreate?: EncounterCreate;
    personUpdate?: PersonUpdate;
  };
}

type PatientFormWriteCheckpoint<T> =
  | {
      status: 'attempted';
      payload: T;
      attemptId: string;
    }
  | {
      status: 'completed';
      payload: T;
      attemptId?: string;
    };

import { formEncounterUrl, formEncounterUrlPoc } from './constants';
import { type Form } from './types';

const patientFormSyncItem = 'patient-form';
const patientFormSynchronizationError = 'The offline patient form could not be synchronized.';
const encounterRecoveryRepresentation =
  'custom:(uuid,encounterDatetime,patient:(uuid),encounterType:(uuid),location:(uuid),visit:(uuid),form:(uuid),voided)';
type UpdatePatientFormContent = NonNullable<SyncProcessOptions<PatientFormSyncItemContent>['updateContent']>;
let clinicalRecoveryRequestSequence = 0;

export async function setupPatientFormSync() {
  setupOfflineSync<PatientFormSyncItemContent>(patientFormSyncItem, ['visit'], syncPatientForm, {
    onBeginEditSyncItem(syncItem) {
      launchEditPatientFormSyncItem(syncItem);
    },
  });
}

function launchEditPatientFormSyncItem(syncItem: SyncItem<PatientFormSyncItemContent>) {
  const groupProps = {
    patient: null,
    patientUuid: syncItem.descriptor.patientUuid,
    visitContext: null,
    mutateVisitContext: null,
  };
  const form =
    syncItem.content.form ??
    (syncItem.content.formSchemaUuid ? ({ uuid: syncItem.content.formSchemaUuid } satisfies Pick<Form, 'uuid'>) : null);

  if (form?.uuid) {
    void launchWorkspace2(
      'patient-form-entry-workspace-v2',
      {
        form: normalizeSyncItemForm(form),
        encounterUuid: syncItem.content._id,
      },
      null,
      groupProps,
    );
    return;
  }
}

function normalizeSyncItemForm(form: Pick<Form, 'uuid'> & Partial<Form>): Form {
  return {
    uuid: form.uuid,
    name: form.name ?? form.display ?? 'Clinical form',
    display: form.display ?? form.name ?? 'Clinical form',
    version: form.version ?? '1',
    published: form.published ?? true,
    retired: form.retired ?? false,
    resources: form.resources ?? [],
    encounterType: form.encounterType,
    formCategory: form.formCategory,
  };
}

async function syncPatientForm(
  item: PatientFormSyncItemContent,
  options: SyncProcessOptions<PatientFormSyncItemContent>,
) {
  const associatedOfflineVisit: Visit | undefined = options.dependencies[0];
  const hasPendingEncounter = Boolean(
    item._payloads.encounterCreate && item._syncState?.encounter?.status !== 'completed',
  );
  const hasPendingPerson = Boolean(item._payloads.personUpdate && item._syncState?.person?.status !== 'completed');

  if ((hasPendingEncounter || hasPendingPerson) && !options.updateContent) {
    throw createPatientFormSynchronizationError();
  }

  if (
    hasPendingEncounter &&
    (!item._payloads.encounterCreate?.uuid || item._payloads.encounterCreate.uuid !== item._id)
  ) {
    // Historical rows may already have committed a server-generated UUID before a response was lost.
    // Assigning a new UUID here could create a duplicate encounter, so these rows require manual reconciliation.
    throw createPatientFormSynchronizationError();
  }

  if (hasPendingPerson && !item._payloads.personUpdate?.uuid) {
    throw createPatientFormSynchronizationError();
  }

  const writeResults = await Promise.allSettled([
    Promise.resolve().then(() =>
      syncEncounterRetrySafe(item, associatedOfflineVisit, options.abort.signal, options.updateContent),
    ),
    Promise.resolve().then(() => syncPersonUpdateRetrySafe(item, options.abort.signal, options.updateContent)),
  ]);

  if (writeResults.some((result) => result.status === 'rejected')) {
    throw createPatientFormSynchronizationError();
  }
}

async function syncEncounterRetrySafe(
  item: PatientFormSyncItemContent,
  associatedOfflineVisit: Visit | undefined,
  signal: AbortSignal,
  updateContent?: UpdatePatientFormContent,
) {
  if (!item._payloads.encounterCreate || item._syncState?.encounter?.status === 'completed') {
    return;
  }

  if (!updateContent) {
    throw createPatientFormSynchronizationError();
  }

  const queuedEncounter = item._payloads.encounterCreate;
  if (!queuedEncounter.uuid) {
    throw createPatientFormSynchronizationError();
  }

  const encounter = await materializeEncounterPayload(item, associatedOfflineVisit, updateContent);
  const existingCheckpoint = item._syncState?.encounter;
  if (existingCheckpoint && !isEqual(existingCheckpoint.payload, encounter)) {
    throw createPatientFormSynchronizationError();
  }

  if (await encounterExistsOnServer(encounter, signal)) {
    if (hasComplexEncounterPayload(encounter)) {
      throw createPatientFormSynchronizationError();
    }
    await completeRecoveredEncounterWrite(updateContent, encounter);
    return;
  }

  if (existingCheckpoint?.status === 'attempted') {
    throw createPatientFormSynchronizationError();
  }

  const attemptId = createWriteAttemptId();
  await claimEncounterWrite(updateContent, encounter, attemptId);

  const response = await openmrsFetch<{ uuid?: string }>(`${restBaseUrl}/encounter`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: encounter,
    signal,
    rejectOnAuthFailure: true,
  });

  if (response.data?.uuid !== encounter.uuid) {
    throw createPatientFormSynchronizationError();
  }

  await completeClaimedEncounterWrite(updateContent, encounter, attemptId);
}

async function syncPersonUpdateRetrySafe(
  item: PatientFormSyncItemContent,
  signal: AbortSignal,
  updateContent?: UpdatePatientFormContent,
) {
  const personUpdate = item._payloads.personUpdate;
  const personUuid = personUpdate?.uuid;
  if (!personUpdate || item._syncState?.person?.status === 'completed') {
    return;
  }

  if (!personUuid || !updateContent) {
    throw createPatientFormSynchronizationError();
  }
  const body: PersonUpdate & { uuid: string } = { ...personUpdate, uuid: personUuid };

  const existingCheckpoint = item._syncState?.person;
  if (existingCheckpoint && !isEqual(existingCheckpoint.payload, body)) {
    throw createPatientFormSynchronizationError();
  }

  validateDesiredPersonAttributes(body);

  if (body.attributes.length === 0 || (await personUpdateExistsOnServer(body, signal))) {
    await completeRecoveredPersonWrite(updateContent, body);
    return;
  }

  if (existingCheckpoint?.status === 'attempted') {
    throw createPatientFormSynchronizationError();
  }

  const attemptId = createWriteAttemptId();
  await claimPersonWrite(updateContent, body, attemptId);

  await openmrsFetch(`${restBaseUrl}/person/${personUuid}`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body,
    signal,
    rejectOnAuthFailure: true,
  });

  if (!(await personUpdateExistsOnServer(body, signal))) {
    throw createPatientFormSynchronizationError();
  }

  await completeClaimedPersonWrite(updateContent, body, attemptId);
}

async function materializeEncounterPayload(
  item: PatientFormSyncItemContent,
  associatedOfflineVisit: Visit | undefined,
  updateContent: UpdatePatientFormContent,
): Promise<EncounterCreate & { uuid: string }> {
  const queuedEncounter = item._payloads.encounterCreate;
  if (!queuedEncounter?.uuid || queuedEncounter.uuid !== item._id) {
    throw createPatientFormSynchronizationError();
  }

  const materializedEncounter = {
    ...queuedEncounter,
    uuid: queuedEncounter.uuid,
    encounterDatetime: queuedEncounter.encounterDatetime ?? associatedOfflineVisit?.stopDatetime,
  };
  if (!materializedEncounter.encounterDatetime) {
    throw createPatientFormSynchronizationError();
  }

  if (isEqual(materializedEncounter, queuedEncounter)) {
    return materializedEncounter;
  }

  const updatedContent = await updateContent((currentContent) => {
    const currentEncounter = currentContent._payloads.encounterCreate;
    if (
      !currentEncounter ||
      currentEncounter.uuid !== item._id ||
      (currentContent._syncState?.encounter && !isEqual(currentContent._syncState.encounter.payload, currentEncounter))
    ) {
      throw createPatientFormSynchronizationError();
    }

    if (isEqual(currentEncounter, materializedEncounter)) {
      return currentContent;
    }

    if (!isEqual(currentEncounter, queuedEncounter) || currentContent._syncState?.encounter) {
      throw createPatientFormSynchronizationError();
    }

    return {
      ...currentContent,
      _payloads: {
        ...currentContent._payloads,
        encounterCreate: materializedEncounter,
      },
    };
  });
  const persistedEncounter = updatedContent._payloads.encounterCreate;
  if (!persistedEncounter?.uuid || !persistedEncounter.encounterDatetime) {
    throw createPatientFormSynchronizationError();
  }

  return persistedEncounter as EncounterCreate & { uuid: string };
}

async function encounterExistsOnServer(encounter: EncounterCreate & { uuid: string }, signal: AbortSignal) {
  const searchParams = new URLSearchParams({
    v: encounterRecoveryRepresentation,
    _: getClinicalRecoveryRequestNonce(),
  });

  try {
    const response = await openmrsFetch<{
      uuid?: string;
      encounterDatetime?: string;
      patient?: string | { uuid?: string };
      encounterType?: string | { uuid?: string };
      location?: string | { uuid?: string };
      visit?: string | { uuid?: string } | null;
      form?: string | { uuid?: string } | null;
      voided?: boolean;
    }>(`${restBaseUrl}/encounter/${encodeURIComponent(encounter.uuid)}?${searchParams.toString()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
      },
      signal,
      rejectOnAuthFailure: true,
    });

    const recoveredEncounter = response.data;
    if (
      recoveredEncounter?.uuid !== encounter.uuid ||
      getReferenceUuid(recoveredEncounter.patient) !== encounter.patient ||
      getReferenceUuid(recoveredEncounter.encounterType) !== encounter.encounterType ||
      getReferenceUuid(recoveredEncounter.location) !== encounter.location ||
      getReferenceUuid(recoveredEncounter.visit) !== encounter.visit ||
      getReferenceUuid(recoveredEncounter.form) !== encounter.form ||
      recoveredEncounter.voided !== false ||
      !areEncounterDatetimesEqual(recoveredEncounter.encounterDatetime, encounter.encounterDatetime)
    ) {
      throw createPatientFormSynchronizationError();
    }

    return true;
  } catch (error) {
    if (getHttpStatus(error) === 404) {
      return false;
    }

    throw error;
  }
}

async function personUpdateExistsOnServer(personUpdate: PersonUpdate & { uuid: string }, signal: AbortSignal) {
  const searchParams = new URLSearchParams({
    v: 'custom:(uuid,attributes:(uuid,attributeType:(uuid),value,voided))',
    _: getClinicalRecoveryRequestNonce(),
  });
  const response = await openmrsFetch<{
    uuid?: string;
    attributes?: Array<{
      uuid?: string;
      attributeType?: string | { uuid?: string };
      value?: unknown;
      voided?: boolean;
    }>;
  }>(`${restBaseUrl}/person/${encodeURIComponent(personUpdate.uuid)}?${searchParams.toString()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-store',
      [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
    },
    signal,
    rejectOnAuthFailure: true,
  });

  if (response.data?.uuid !== personUpdate.uuid || !Array.isArray(response.data.attributes)) {
    throw createPatientFormSynchronizationError();
  }

  let allAttributesMatch = true;
  for (const desiredAttribute of personUpdate.attributes) {
    const activeAttributes = response.data.attributes.filter(
      (attribute) =>
        attribute.voided !== true && getReferenceUuid(attribute.attributeType) === desiredAttribute.attributeType,
    );
    if (activeAttributes.length > 1) {
      throw createPatientFormSynchronizationError();
    }
    if (
      activeAttributes.length === 0 ||
      normalizePersonAttributeValue(activeAttributes[0].value) !== desiredAttribute.value
    ) {
      allAttributesMatch = false;
    }
  }

  return allAttributesMatch;
}

function validateDesiredPersonAttributes(personUpdate: PersonUpdate) {
  const desiredTypes = new Set<string>();
  for (const desiredAttribute of personUpdate.attributes) {
    if (desiredTypes.has(desiredAttribute.attributeType)) {
      throw createPatientFormSynchronizationError();
    }
    desiredTypes.add(desiredAttribute.attributeType);
  }
}

async function claimEncounterWrite(
  updateContent: UpdatePatientFormContent,
  payload: EncounterCreate,
  attemptId: string,
) {
  await updateContent((currentContent) => {
    assertPayloadIsCurrent(currentContent._payloads.encounterCreate, payload);
    if (currentContent._syncState?.encounter) {
      throw createPatientFormSynchronizationError();
    }
    return {
      ...currentContent,
      _syncState: {
        ...currentContent._syncState,
        encounter: { status: 'attempted', payload, attemptId },
      },
    };
  });
}

async function completeClaimedEncounterWrite(
  updateContent: UpdatePatientFormContent,
  payload: EncounterCreate,
  attemptId: string,
) {
  await updateContent((currentContent) => {
    assertPayloadIsCurrent(currentContent._payloads.encounterCreate, payload);
    const checkpoint = currentContent._syncState?.encounter;
    if (checkpoint?.status === 'completed' && isEqual(checkpoint.payload, payload)) {
      return currentContent;
    }
    if (
      checkpoint?.status !== 'attempted' ||
      checkpoint.attemptId !== attemptId ||
      !isEqual(checkpoint.payload, payload)
    ) {
      throw createPatientFormSynchronizationError();
    }
    return {
      ...currentContent,
      _syncState: {
        ...currentContent._syncState,
        encounter: { status: 'completed', payload, attemptId },
      },
    };
  });
}

async function completeRecoveredEncounterWrite(updateContent: UpdatePatientFormContent, payload: EncounterCreate) {
  await updateContent((currentContent) =>
    withRecoveredCheckpoint(currentContent, 'encounter', currentContent._payloads.encounterCreate, payload),
  );
}

async function claimPersonWrite(updateContent: UpdatePatientFormContent, payload: PersonUpdate, attemptId: string) {
  await updateContent((currentContent) => {
    assertPayloadIsCurrent(currentContent._payloads.personUpdate, payload);
    if (currentContent._syncState?.person) {
      throw createPatientFormSynchronizationError();
    }
    return {
      ...currentContent,
      _syncState: {
        ...currentContent._syncState,
        person: { status: 'attempted', payload, attemptId },
      },
    };
  });
}

async function completeClaimedPersonWrite(
  updateContent: UpdatePatientFormContent,
  payload: PersonUpdate,
  attemptId: string,
) {
  await updateContent((currentContent) => {
    assertPayloadIsCurrent(currentContent._payloads.personUpdate, payload);
    const checkpoint = currentContent._syncState?.person;
    if (checkpoint?.status === 'completed' && isEqual(checkpoint.payload, payload)) {
      return currentContent;
    }
    if (
      checkpoint?.status !== 'attempted' ||
      checkpoint.attemptId !== attemptId ||
      !isEqual(checkpoint.payload, payload)
    ) {
      throw createPatientFormSynchronizationError();
    }
    return {
      ...currentContent,
      _syncState: {
        ...currentContent._syncState,
        person: { status: 'completed', payload, attemptId },
      },
    };
  });
}

async function completeRecoveredPersonWrite(updateContent: UpdatePatientFormContent, payload: PersonUpdate) {
  await updateContent((currentContent) =>
    withRecoveredCheckpoint(currentContent, 'person', currentContent._payloads.personUpdate, payload),
  );
}

function withRecoveredCheckpoint<T, K extends 'encounter' | 'person'>(
  currentContent: PatientFormSyncItemContent,
  key: K,
  currentPayload: T | undefined,
  payload: T,
): PatientFormSyncItemContent {
  assertPayloadIsCurrent(currentPayload, payload);
  const checkpoint = currentContent._syncState?.[key] as PatientFormWriteCheckpoint<T> | undefined;
  if (checkpoint && !isEqual(checkpoint.payload, payload)) {
    throw createPatientFormSynchronizationError();
  }
  if (checkpoint?.status === 'completed') {
    return currentContent;
  }

  return {
    ...currentContent,
    _syncState: {
      ...currentContent._syncState,
      [key]: {
        status: 'completed',
        payload,
        ...(checkpoint?.status === 'attempted' ? { attemptId: checkpoint.attemptId } : {}),
      },
    },
  };
}

function assertPayloadIsCurrent<T>(currentPayload: T | undefined, payload: T) {
  if (!isEqual(currentPayload, payload)) {
    throw createPatientFormSynchronizationError();
  }
}

function createWriteAttemptId() {
  const attemptId = globalThis.crypto?.randomUUID?.();
  if (!attemptId) {
    throw createPatientFormSynchronizationError();
  }
  return attemptId;
}

function hasComplexEncounterPayload(encounter: EncounterCreate) {
  return Boolean(
    encounter.encounterProviders?.length ||
      encounter.obs?.length ||
      encounter.orders?.length ||
      encounter.diagnoses?.length,
  );
}

function normalizePersonAttributeValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return getReferenceUuid(value as { uuid?: string } | null);
}

function getClinicalRecoveryRequestNonce() {
  clinicalRecoveryRequestSequence += 1;
  return `${Date.now()}-${clinicalRecoveryRequestSequence}`;
}

function getReferenceUuid(reference?: string | { uuid?: string } | null) {
  return typeof reference === 'string' ? reference : reference?.uuid;
}

function areEncounterDatetimesEqual(actual?: string, expected?: string) {
  if (!actual || !expected) {
    return actual === expected;
  }

  const actualTime = Date.parse(actual);
  const expectedTime = Date.parse(expected);
  return Number.isFinite(actualTime) && Number.isFinite(expectedTime) && actualTime === expectedTime;
}

function getHttpStatus(error: unknown) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const status = (error as { response?: { status?: unknown } }).response?.status;
  return typeof status === 'number' ? status : undefined;
}

function createPatientFormSynchronizationError() {
  return new Error(patientFormSynchronizationError);
}

export async function setupDynamicFormDataHandler() {
  setupDynamicOfflineDataHandler({
    id: 'esm-patient-forms-app:form',
    type: 'form',
    displayName: 'Patient forms',
    async isSynced() {
      const expectedUrls = getCacheableFormUrls();
      const absoluteExpectedUrls = expectedUrls.map((url) => globalThis.location.origin + makeUrl(url));
      const cache = await caches.open('omrs-spa-cache-v1');
      const keys = (await cache.keys()).map((key) => key.url);
      return absoluteExpectedUrls.every((url) => keys.includes(url));
    },
    async sync(_identifier, abortSignal) {
      const urlsToCache = getCacheableFormUrls();
      const cacheResults = await Promise.allSettled(
        urlsToCache.map(async (urlToCache) => {
          const routeRegistration = await messageOmrsServiceWorker({
            type: 'registerDynamicRoute',
            pattern: escapeRegExp(urlToCache),
            strategy: 'network-first',
          });

          if (!routeRegistration.success) {
            throw new Error(routeRegistration.error ?? 'The offline form cache route could not be registered.');
          }

          await refreshOfflineCacheEntry(urlToCache, abortSignal);
        }),
      );

      if (cacheResults.some((x) => x.status === 'rejected')) {
        throw new Error('Some form data could not be properly downloaded.');
      }
    },
  });
}

function getCacheableFormUrls() {
  return [formEncounterUrl, formEncounterUrlPoc];
}

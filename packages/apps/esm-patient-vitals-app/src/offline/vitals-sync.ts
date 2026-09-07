import {
  deleteSynchronizationItem,
  getSynchronizationItem,
  omrsOfflineCachingStrategyHttpHeaderName,
  openmrsFetch,
  queueSynchronizationItem,
  restBaseUrl,
  setupOfflineSync,
  type QueueItemDescriptor,
  type SyncProcessOptions,
} from '@openmrs/esm-framework';
import { assertFreshPatientIsAlive } from '@openmrs/esm-patient-common-lib';
import isEqual from 'lodash-es/isEqual';

import type { ConfigObject } from '../config-schema';
import type { VitalsBiometricsFormData } from '../vitals-biometrics-form/vitals-biometrics-form.workspace';

export const vitalsSyncType = 'patient-vitals';

const vitalsQueueError = 'The offline vitals could not be queued.';
const vitalsSynchronizationError = 'The offline vitals could not be synchronized.';
const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const recoveredEncounterRepresentation =
  'custom:(uuid,encounterDatetime,patient:(uuid),encounterType:(uuid),location:(uuid),visit:(uuid),voided,encounterProviders:(provider:(uuid),encounterRole:(uuid),voided),obs:(concept:(uuid),value,voided))';
const authoritativeVisitTimingRepresentation = 'custom:(uuid,startDatetime,stopDatetime,voided,patient:(uuid))';
const httpDatePrecisionMilliseconds = 999;

let recoveryRequestSequence = 0;
let visitTimingRequestSequence = 0;

export interface VitalsObservationCreate {
  concept: string;
  value: number | string;
}

export interface VitalsEncounterCreate {
  uuid: string;
  patient: string;
  location: string;
  encounterType: string;
  visit: string;
  encounterDatetime: string;
  encounterProviders?: Array<{
    provider: string;
    encounterRole: string;
  }>;
  obs: Array<VitalsObservationCreate>;
}

type VitalsWriteCheckpoint =
  | {
      status: 'attempted';
      payload: VitalsEncounterCreate;
      attemptId: string;
    }
  | {
      status: 'completed';
      payload: VitalsEncounterCreate;
      attemptId?: string;
    };

export interface VitalsSyncItemContent {
  /** Stable client-generated OpenMRS UUID and queue replacement key. */
  _id: string;
  encounter: VitalsEncounterCreate;
  _syncState?: {
    encounter?: VitalsWriteCheckpoint;
  };
}

export type VitalsPersistenceResult =
  | { status: 'confirmed'; encounterUuid: string }
  | { status: 'queued'; encounterUuid: string };

interface PersistVitalsOptions {
  abortController: AbortController;
  displayName: string;
}

type QueueTransition = 'initial' | 'server-time' | 'claim' | 'complete';
type UpdateVitalsContent = NonNullable<SyncProcessOptions<VitalsSyncItemContent>['updateContent']>;

interface AuthoritativeVisitTiming {
  serverDatetime: Date;
  startDatetime: Date;
  stopDatetime: Date | null;
}

interface FreshVisitTimingResponse {
  uuid?: string;
  startDatetime?: string;
  stopDatetime?: string | null;
  voided?: boolean;
  patient?: string | { uuid?: string };
}

interface RecoveredEncounter {
  uuid?: string;
  encounterDatetime?: string;
  patient?: string | { uuid?: string };
  encounterType?: string | { uuid?: string };
  location?: string | { uuid?: string };
  visit?: string | { uuid?: string } | null;
  voided?: boolean;
  encounterProviders?: Array<{
    provider?: string | { uuid?: string };
    encounterRole?: string | { uuid?: string };
    voided?: boolean;
  }>;
  obs?: Array<{
    concept?: string | { uuid?: string };
    value?: unknown;
    voided?: boolean;
  }>;
}

export function setupVitalsSync() {
  setupOfflineSync<VitalsSyncItemContent>(vitalsSyncType, ['visit'], synchronizeVitalsEncounter);
}

export function buildVitalsEncounter({
  concepts,
  encounterDatetime,
  encounterRoleUuid,
  encounterTypeUuid,
  encounterUuid,
  locationUuid,
  patientUuid,
  providerUuid,
  visitUuid,
  vitals,
}: {
  concepts: ConfigObject['concepts'];
  encounterDatetime: Date;
  encounterRoleUuid?: string;
  encounterTypeUuid: string;
  encounterUuid?: string;
  locationUuid: string;
  patientUuid: string;
  providerUuid?: string;
  visitUuid: string;
  vitals: VitalsBiometricsFormData;
}): VitalsEncounterCreate {
  const uuid = encounterUuid ?? createClinicalUuid();
  if (!isCanonicalUuid(uuid)) {
    throw createVitalsQueueError();
  }

  const obs = Object.entries(vitals)
    .filter(([, value]) => value != null && value !== '')
    .map(([name, value]) => ({ concept: concepts[`${name}Uuid`], value }))
    .filter((observation): observation is VitalsObservationCreate =>
      Boolean(observation.concept && (typeof observation.value === 'number' || typeof observation.value === 'string')),
    );

  if (obs.length === 0) {
    throw createVitalsQueueError();
  }

  return {
    uuid,
    patient: patientUuid,
    location: locationUuid,
    encounterType: encounterTypeUuid,
    visit: visitUuid,
    encounterDatetime: encounterDatetime.toISOString(),
    ...(providerUuid && encounterRoleUuid
      ? { encounterProviders: [{ provider: providerUuid, encounterRole: encounterRoleUuid }] }
      : {}),
    obs,
  };
}

/**
 * Persists the clinical intent locally before any server write. While online,
 * only its provisional device datetime may be replaced by the authoritative
 * server/visit time before the first attempt. A confirmed response removes the
 * queue row; an unavailable or ambiguous response leaves the same UUID queued
 * for reconciliation.
 */
export async function persistVitalsEncounter(
  encounter: VitalsEncounterCreate,
  { abortController, displayName }: PersistVitalsOptions,
): Promise<VitalsPersistenceResult> {
  assertValidContent({ _id: encounter.uuid, encounter });
  const descriptor = createDescriptor(encounter, displayName);
  let queuedItemId = await queueVitalsContent({ _id: encounter.uuid, encounter }, descriptor, 'initial');

  let authoritativeVisitTiming: AuthoritativeVisitTiming;
  try {
    await assertFreshPatientIsAlive(encounter.patient, abortController.signal);
    authoritativeVisitTiming = await fetchAuthoritativeVisitTiming(encounter, abortController.signal);
  } catch (error) {
    if (isDeceasedPatientError(error)) {
      await deleteQueuedItemBestEffort(queuedItemId);
      throw error;
    }

    return { status: 'queued', encounterUuid: encounter.uuid };
  }

  if (abortController.signal.aborted) {
    return { status: 'queued', encounterUuid: encounter.uuid };
  }

  const authoritativeEncounter = getServerTimedEncounter(encounter, authoritativeVisitTiming);
  if (!authoritativeEncounter) {
    return { status: 'queued', encounterUuid: encounter.uuid };
  }

  let persistedEncounter = encounter;
  if (!isEqual(authoritativeEncounter, encounter)) {
    try {
      const authoritativeContent = { _id: encounter.uuid, encounter: authoritativeEncounter };
      queuedItemId = await queueVitalsContent(authoritativeContent, descriptor, 'server-time');
      const storedItem = await getSynchronizationItem<VitalsSyncItemContent>(queuedItemId);
      if (!storedItem || !isEqual(storedItem.content, authoritativeContent)) {
        return { status: 'queued', encounterUuid: encounter.uuid };
      }
      persistedEncounter = authoritativeEncounter;
    } catch {
      return { status: 'queued', encounterUuid: encounter.uuid };
    }
  }

  let attemptId: string;
  let attemptedContent: VitalsSyncItemContent;
  let claimedCheckpoint: VitalsWriteCheckpoint | undefined;
  try {
    attemptId = createClinicalUuid();
    attemptedContent = {
      _id: encounter.uuid,
      encounter: persistedEncounter,
      _syncState: {
        encounter: { status: 'attempted', payload: persistedEncounter, attemptId },
      },
    };
    queuedItemId = await queueVitalsContent(attemptedContent, descriptor, 'claim');
    const claimedItem = await getSynchronizationItem<VitalsSyncItemContent>(queuedItemId);
    claimedCheckpoint = claimedItem?.content._syncState?.encounter;
  } catch {
    // The initial row was already durable. A checkpoint/read failure
    // must not invite a second submission with a different encounter UUID.
    return { status: 'queued', encounterUuid: encounter.uuid };
  }

  if (claimedCheckpoint?.status === 'completed') {
    await deleteQueuedItemBestEffort(queuedItemId);
    return { status: 'confirmed', encounterUuid: encounter.uuid };
  }

  if (claimedCheckpoint?.status !== 'attempted' || claimedCheckpoint.attemptId !== attemptId) {
    return { status: 'queued', encounterUuid: encounter.uuid };
  }

  let response: Awaited<ReturnType<typeof postVitalsEncounter>>;
  try {
    response = await postVitalsEncounter(persistedEncounter, abortController.signal);
  } catch (error) {
    if (isDefiniteRejectedWrite(error)) {
      await deleteQueuedItemBestEffort(queuedItemId);
      throw createVitalsQueueError();
    }

    return { status: 'queued', encounterUuid: encounter.uuid };
  }

  if (response.data?.uuid !== encounter.uuid) {
    return { status: 'queued', encounterUuid: encounter.uuid };
  }

  const completedContent: VitalsSyncItemContent = {
    ...attemptedContent,
    _syncState: {
      encounter: { status: 'completed', payload: persistedEncounter, attemptId },
    },
  };
  try {
    queuedItemId = await queueVitalsContent(completedContent, descriptor, 'complete');
    await deleteQueuedItemBestEffort(queuedItemId);
  } catch {
    // The server response already confirmed this exact UUID. Leaving the
    // attempted row behind is safe: synchronization will reconcile it.
  }

  return { status: 'confirmed', encounterUuid: encounter.uuid };
}

export async function synchronizeVitalsEncounter(
  item: VitalsSyncItemContent,
  options: SyncProcessOptions<VitalsSyncItemContent>,
) {
  try {
    assertValidContent(item);
    const checkpoint = item._syncState?.encounter;
    if (checkpoint && !isEqual(checkpoint.payload, item.encounter)) {
      throw createVitalsSynchronizationError();
    }

    if (checkpoint?.status === 'completed') {
      return { uuid: item.encounter.uuid };
    }

    if (!options.updateContent) {
      throw createVitalsSynchronizationError();
    }

    await assertFreshPatientIsAlive(item.encounter.patient, options.abort.signal);
    const recoveredEncounter = await fetchEncounterForRecovery(item.encounter.uuid, options.abort.signal);
    if (recoveredEncounter) {
      if (!recoveredEncounterMatches(item.encounter, recoveredEncounter)) {
        throw createVitalsSynchronizationError();
      }
      await completeRecoveredWrite(options.updateContent, item.encounter);
      return recoveredEncounter;
    }

    if (checkpoint?.status === 'attempted') {
      // A prior request may still have committed outside the observable
      // response path. Do not replay a clinical write from an ambiguous state.
      throw createVitalsSynchronizationError();
    }

    const authoritativeVisitTiming = await fetchAuthoritativeVisitTiming(item.encounter, options.abort.signal);
    if (!isEncounterDatetimeWithinVisit(item.encounter.encounterDatetime, authoritativeVisitTiming)) {
      throw createVitalsSynchronizationError();
    }

    const attemptId = createClinicalUuid();
    await claimWrite(options.updateContent, item.encounter, attemptId);
    const response = await postVitalsEncounter(item.encounter, options.abort.signal);
    if (response.data?.uuid !== item.encounter.uuid) {
      throw createVitalsSynchronizationError();
    }
    await completeClaimedWrite(options.updateContent, item.encounter, attemptId);
    return response.data;
  } catch {
    throw createVitalsSynchronizationError();
  }
}

export function reconcileVitalsQueueContent(
  existingContent: VitalsSyncItemContent | undefined,
  proposedContent: VitalsSyncItemContent,
  transition: QueueTransition,
): VitalsSyncItemContent {
  assertValidContent(proposedContent);
  if (!existingContent) {
    if (transition !== 'initial') {
      throw createVitalsQueueError();
    }
    return proposedContent;
  }

  assertValidContent(existingContent);
  if (transition === 'server-time') {
    if (
      existingContent._syncState?.encounter ||
      proposedContent._syncState?.encounter ||
      existingContent._id !== proposedContent._id ||
      !encountersDifferOnlyByDatetime(existingContent.encounter, proposedContent.encounter)
    ) {
      throw createVitalsQueueError();
    }
    return proposedContent;
  }

  if (existingContent._id !== proposedContent._id || !isEqual(existingContent.encounter, proposedContent.encounter)) {
    throw createVitalsQueueError();
  }

  const existingCheckpoint = existingContent._syncState?.encounter;
  if (existingCheckpoint && !isEqual(existingCheckpoint.payload, existingContent.encounter)) {
    throw createVitalsQueueError();
  }

  if (transition === 'initial') {
    return existingContent;
  }

  const proposedCheckpoint = proposedContent._syncState?.encounter;
  if (!proposedCheckpoint || !isEqual(proposedCheckpoint.payload, proposedContent.encounter)) {
    throw createVitalsQueueError();
  }

  if (transition === 'claim') {
    if (proposedCheckpoint.status !== 'attempted') {
      throw createVitalsQueueError();
    }
    return existingCheckpoint ? existingContent : proposedContent;
  }

  if (
    proposedCheckpoint.status !== 'completed' ||
    existingCheckpoint?.status !== 'attempted' ||
    proposedCheckpoint.attemptId !== existingCheckpoint.attemptId
  ) {
    if (
      existingCheckpoint?.status === 'completed' &&
      proposedCheckpoint.status === 'completed' &&
      isEqual(existingCheckpoint.payload, proposedCheckpoint.payload)
    ) {
      return existingContent;
    }
    throw createVitalsQueueError();
  }

  return proposedContent;
}

async function queueVitalsContent(
  content: VitalsSyncItemContent,
  descriptor: QueueItemDescriptor,
  transition: QueueTransition,
) {
  try {
    return await queueSynchronizationItem(vitalsSyncType, content, descriptor, {
      reconcileContent: (existingContent, proposedContent) =>
        reconcileVitalsQueueContent(existingContent, proposedContent, transition),
    });
  } catch {
    throw createVitalsQueueError();
  }
}

function createDescriptor(encounter: VitalsEncounterCreate, displayName: string): QueueItemDescriptor {
  return {
    id: encounter.uuid,
    displayName,
    patientUuid: encounter.patient,
    dependencies: [{ type: 'visit', id: encounter.visit }],
  };
}

async function fetchEncounterForRecovery(encounterUuid: string, signal: AbortSignal) {
  const searchParams = new URLSearchParams({
    v: recoveredEncounterRepresentation,
    _: getRecoveryRequestNonce(),
  });
  try {
    const response = await openmrsFetch<RecoveredEncounter>(
      `${restBaseUrl}/encounter/${encodeURIComponent(encounterUuid)}?${searchParams.toString()}`,
      {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store',
          [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
        },
        signal,
        rejectOnAuthFailure: true,
      },
    );
    return response.data;
  } catch (error) {
    if (getHttpStatus(error) === 404) {
      return undefined;
    }
    throw error;
  }
}

async function fetchAuthoritativeVisitTiming(
  encounter: VitalsEncounterCreate,
  signal: AbortSignal,
): Promise<AuthoritativeVisitTiming> {
  const searchParams = new URLSearchParams({
    v: authoritativeVisitTimingRepresentation,
    _: getVisitTimingRequestNonce(),
  });
  const response = await openmrsFetch<FreshVisitTimingResponse>(
    `${restBaseUrl}/visit/${encodeURIComponent(encounter.visit)}?${searchParams.toString()}`,
    {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
      },
      signal,
      rejectOnAuthFailure: true,
    },
  );
  const serverDatetime = parseDate(response.headers?.get?.('Date'));
  const startDatetime = parseDate(response.data?.startDatetime);
  const stopDatetimeValue: unknown = response.data?.stopDatetime;
  const stopDatetime = stopDatetimeValue === null ? null : parseDate(stopDatetimeValue);
  const hasValidStopDatetime =
    Object.hasOwn(response.data ?? {}, 'stopDatetime') && (stopDatetimeValue === null || Boolean(stopDatetime));

  if (
    response.data?.uuid !== encounter.visit ||
    response.data?.voided !== false ||
    getReferenceUuid(response.data?.patient) !== encounter.patient ||
    !serverDatetime ||
    !startDatetime ||
    !hasValidStopDatetime ||
    (stopDatetime && stopDatetime < startDatetime)
  ) {
    throw createVitalsSynchronizationError();
  }

  return { serverDatetime, startDatetime, stopDatetime };
}

function getServerTimedEncounter(
  encounter: VitalsEncounterCreate,
  timing: AuthoritativeVisitTiming,
): VitalsEncounterCreate | null {
  if (timing.stopDatetime || timing.startDatetime.valueOf() > getServerUpperBound(timing)) {
    return null;
  }
  const encounterDatetime = new Date(Math.max(timing.serverDatetime.valueOf(), timing.startDatetime.valueOf()));
  return { ...encounter, encounterDatetime: encounterDatetime.toISOString() };
}

function isEncounterDatetimeWithinVisit(encounterDatetime: string, timing: AuthoritativeVisitTiming): boolean {
  const parsedEncounterDatetime = parseDate(encounterDatetime);
  if (!parsedEncounterDatetime) {
    return false;
  }
  return (
    parsedEncounterDatetime >= timing.startDatetime &&
    parsedEncounterDatetime.valueOf() <= getServerUpperBound(timing) &&
    (!timing.stopDatetime || parsedEncounterDatetime <= timing.stopDatetime)
  );
}

function getServerUpperBound(timing: AuthoritativeVisitTiming): number {
  return timing.serverDatetime.valueOf() + httpDatePrecisionMilliseconds;
}

function encountersDifferOnlyByDatetime(existing: VitalsEncounterCreate, proposed: VitalsEncounterCreate): boolean {
  const { encounterDatetime: _existingDatetime, ...existingClinicalData } = existing;
  const { encounterDatetime: _proposedDatetime, ...proposedClinicalData } = proposed;
  return isEqual(existingClinicalData, proposedClinicalData);
}

function parseDate(value?: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function postVitalsEncounter(encounter: VitalsEncounterCreate, signal: AbortSignal) {
  return openmrsFetch<{ uuid?: string }>(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: encounter,
    signal,
    rejectOnAuthFailure: true,
  });
}

async function claimWrite(updateContent: UpdateVitalsContent, encounter: VitalsEncounterCreate, attemptId: string) {
  await updateContent((currentContent) => {
    assertCurrentPayload(currentContent, encounter);
    if (currentContent._syncState?.encounter) {
      throw createVitalsSynchronizationError();
    }
    return {
      ...currentContent,
      _syncState: {
        encounter: { status: 'attempted', payload: encounter, attemptId },
      },
    };
  });
}

async function completeClaimedWrite(
  updateContent: UpdateVitalsContent,
  encounter: VitalsEncounterCreate,
  attemptId: string,
) {
  await updateContent((currentContent) => {
    assertCurrentPayload(currentContent, encounter);
    const checkpoint = currentContent._syncState?.encounter;
    if (
      checkpoint?.status !== 'attempted' ||
      checkpoint.attemptId !== attemptId ||
      !isEqual(checkpoint.payload, encounter)
    ) {
      throw createVitalsSynchronizationError();
    }
    return {
      ...currentContent,
      _syncState: {
        encounter: { status: 'completed', payload: encounter, attemptId },
      },
    };
  });
}

async function completeRecoveredWrite(updateContent: UpdateVitalsContent, encounter: VitalsEncounterCreate) {
  await updateContent((currentContent) => {
    assertCurrentPayload(currentContent, encounter);
    const checkpoint = currentContent._syncState?.encounter;
    if (checkpoint && !isEqual(checkpoint.payload, encounter)) {
      throw createVitalsSynchronizationError();
    }
    return {
      ...currentContent,
      _syncState: {
        encounter: {
          status: 'completed',
          payload: encounter,
          ...(checkpoint?.status === 'attempted' ? { attemptId: checkpoint.attemptId } : {}),
        },
      },
    };
  });
}

function assertCurrentPayload(content: VitalsSyncItemContent, encounter: VitalsEncounterCreate) {
  assertValidContent(content);
  if (!isEqual(content.encounter, encounter)) {
    throw createVitalsSynchronizationError();
  }
}

function assertValidContent(content: VitalsSyncItemContent) {
  if (
    !isCanonicalUuid(content._id) ||
    content.encounter.uuid !== content._id ||
    !content.encounter.patient ||
    !content.encounter.location ||
    !content.encounter.encounterType ||
    !content.encounter.visit ||
    !Number.isFinite(Date.parse(content.encounter.encounterDatetime)) ||
    !Array.isArray(content.encounter.obs) ||
    content.encounter.obs.length === 0 ||
    content.encounter.obs.some(
      (observation) =>
        !observation.concept ||
        (typeof observation.value !== 'number' && typeof observation.value !== 'string') ||
        observation.value === '',
    )
  ) {
    throw createVitalsQueueError();
  }
}

function recoveredEncounterMatches(expected: VitalsEncounterCreate, actual: RecoveredEncounter) {
  return (
    actual.uuid === expected.uuid &&
    actual.voided === false &&
    getReferenceUuid(actual.patient) === expected.patient &&
    getReferenceUuid(actual.encounterType) === expected.encounterType &&
    getReferenceUuid(actual.location) === expected.location &&
    getReferenceUuid(actual.visit) === expected.visit &&
    areEncounterDatetimesEqual(actual.encounterDatetime, expected.encounterDatetime) &&
    isEqual(normalizeExpectedObservations(expected.obs), normalizeRecoveredObservations(actual.obs)) &&
    isEqual(
      normalizeExpectedProviders(expected.encounterProviders),
      normalizeRecoveredProviders(actual.encounterProviders),
    )
  );
}

function normalizeExpectedObservations(observations: Array<VitalsObservationCreate>) {
  return observations.map(({ concept, value }) => `${concept}|${normalizeClinicalValue(value)}`).sort();
}

function normalizeRecoveredObservations(observations: RecoveredEncounter['obs']) {
  return (observations ?? [])
    .filter((observation) => observation.voided !== true)
    .map((observation) => `${getReferenceUuid(observation.concept) ?? ''}|${normalizeClinicalValue(observation.value)}`)
    .sort();
}

function normalizeExpectedProviders(providers: VitalsEncounterCreate['encounterProviders']) {
  return (providers ?? []).map(({ provider, encounterRole }) => `${provider}|${encounterRole}`).sort();
}

function normalizeRecoveredProviders(providers: RecoveredEncounter['encounterProviders']) {
  return (providers ?? [])
    .filter((provider) => provider.voided !== true)
    .map((provider) => `${getReferenceUuid(provider.provider) ?? ''}|${getReferenceUuid(provider.encounterRole) ?? ''}`)
    .sort();
}

function normalizeClinicalValue(value: unknown) {
  const referenceUuid = getReferenceUuid(value as string | { uuid?: string } | null);
  if (typeof value === 'object' && value !== null && referenceUuid) {
    return `uuid:${referenceUuid}`;
  }
  if (typeof value === 'number') {
    return `number:${value}`;
  }
  if (typeof value === 'string') {
    return canonicalUuidPattern.test(value) ? `uuid:${value}` : `string:${value}`;
  }
  return `unsupported:${typeof value}`;
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

function getRecoveryRequestNonce() {
  recoveryRequestSequence += 1;
  return `${Date.now()}-${recoveryRequestSequence}`;
}

function getVisitTimingRequestNonce() {
  visitTimingRequestSequence += 1;
  return `${Date.now()}-${visitTimingRequestSequence}`;
}

function createClinicalUuid() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid || !isCanonicalUuid(uuid)) {
    throw createVitalsQueueError();
  }
  return uuid;
}

function isCanonicalUuid(value: string) {
  return canonicalUuidPattern.test(value);
}

function isDeceasedPatientError(error: unknown) {
  return getErrorCode(error) === 'DECEASED_PATIENT_OPERATION_BLOCKED';
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}

function getHttpStatus(error: unknown) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const status = (error as { response?: { status?: unknown } }).response?.status;
  return typeof status === 'number' ? status : undefined;
}

function isDefiniteRejectedWrite(error: unknown) {
  const status = getHttpStatus(error);
  return Boolean(status && status >= 400 && status < 500 && ![408, 409, 425, 429].includes(status));
}

async function deleteQueuedItemBestEffort(itemId: number) {
  try {
    await deleteSynchronizationItem(itemId);
  } catch {
    // A retained row is safer than losing a clinical write. Ownership checks
    // and later synchronization will handle the remaining item.
  }
}

function createVitalsQueueError() {
  return new Error(vitalsQueueError);
}

function createVitalsSynchronizationError() {
  return new Error(vitalsSynchronizationError);
}

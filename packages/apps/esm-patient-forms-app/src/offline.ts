import {
  launchWorkspace2,
  makeUrl,
  messageOmrsServiceWorker,
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
  _id: string;
  form?: Pick<Form, 'uuid'> & Partial<Form>;
  formSchemaUuid?: string;
  encounter: Partial<{ uuid: string; encounterDatetime: string }>;
  _payloads: {
    encounterCreate?: EncounterCreate;
    personUpdate?: PersonUpdate;
  };
}

import { formEncounterUrl, formEncounterUrlPoc } from './constants';
import { type Form } from './types';

const patientFormSyncItem = 'patient-form';

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
  const {
    _payloads: { encounterCreate, personUpdate },
  } = item;

  await Promise.all([
    syncEncounter(associatedOfflineVisit, encounterCreate, options.abort.signal),
    syncPersonUpdate(personUpdate?.uuid, personUpdate, options.abort.signal),
  ]);
}

async function syncEncounter(associatedOfflineVisit: Visit, encounter?: EncounterCreate, signal?: AbortSignal) {
  if (!encounter) {
    return;
  }

  const body = {
    ...encounter,
    encounterDatetime: encounter.encounterDatetime ?? associatedOfflineVisit?.stopDatetime,
  };

  await openmrsFetch(`${restBaseUrl}/encounter`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body,
    signal,
  });
}

async function syncPersonUpdate(personUuid?: string, personUpdate?: PersonUpdate, signal?: AbortSignal) {
  if (!personUuid || !personUpdate) {
    return;
  }

  await openmrsFetch(`${restBaseUrl}/person/${personUuid}`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    body: personUpdate,
    signal,
  });
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

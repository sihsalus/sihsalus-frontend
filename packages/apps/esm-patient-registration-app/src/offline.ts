import {
  fhirBaseUrl,
  getConfig,
  makeUrl,
  messageOmrsServiceWorker,
  navigate,
  refreshOfflineCacheEntry,
  restBaseUrl,
  type SyncProcessOptions,
  setupDynamicOfflineDataHandler,
  setupOfflineSync,
} from '@openmrs/esm-framework';

import { type RegistrationConfig } from './config-schema';
import { moduleName, patientRegistration, personRelationshipRepresentation } from './constants';
import {
  fetchAddressTemplate,
  fetchAllFieldDefinitionTypes,
  fetchAllRelationshipTypes,
  fetchCurrentSession,
  fetchPatientIdentifierTypesWithSources,
} from './offline.resources';
import { FormManager } from './patient-registration/form-manager';
import { type PatientRegistration } from './patient-registration/patient-registration.types';

export function setupOffline() {
  setupOfflineSync(patientRegistration, [], syncPatientRegistration, {
    onBeginEditSyncItem(syncItem) {
      navigate({
        to: `${globalThis.spaBase}/patient/${syncItem.content.fhirPatient.id}/edit`,
      });
    },
  });

  // Precaching is best-effort: a failure here must not become an unhandled
  // rejection at startup. The interactive form surfaces fetch errors itself.
  precacheStaticAssets().catch((error) => {
    console.warn('Failed to precache patient registration assets for offline use.', error);
  });

  setupDynamicOfflineDataHandler({
    id: 'esm-patient-registration-app:patient',
    type: 'patient',
    displayName: 'Patient registration',
    async isSynced(patientUuid) {
      const expectedUrls = await getPatientUrlsToBeCached(patientUuid);
      const cache = await caches.open('omrs-spa-cache-v1');
      const keys = (await cache.keys()).map((key) => key.url);
      return expectedUrls.every((url) => keys.includes(url));
    },
    async sync(patientUuid, abortSignal) {
      const urlsToCache = await getPatientUrlsToBeCached(patientUuid);
      await cachePatientUrlsForOfflineUse(urlsToCache, abortSignal);
    },
  });
}

export async function cachePatientUrlsForOfflineUse(
  urlsToCache: Array<string>,
  abortSignal?: AbortSignal,
): Promise<void> {
  const results = await Promise.allSettled(
    urlsToCache.map(async (url) => {
      const routeRegistration = await messageOmrsServiceWorker({
        type: 'registerDynamicRoute',
        url,
        strategy: 'network-first',
      });

      if (!routeRegistration.success) {
        throw new Error(routeRegistration.error ?? 'The offline cache route could not be registered.');
      }

      await refreshOfflineCacheEntry(url, abortSignal);
    }),
  );
  const failures = results.filter((result) => result.status === 'rejected');

  if (failures.length > 0) {
    throw new AggregateError(
      failures.map(() => new Error('A patient offline resource could not be refreshed.')),
      `Failed to cache ${failures.length} of ${urlsToCache.length} patient resources for offline use.`,
    );
  }
}

export async function getPatientUrlsToBeCached(patientUuid: string) {
  const config = await getConfig<RegistrationConfig>(moduleName);
  const urls = [
    `${fhirBaseUrl}/Patient/${patientUuid}`,
    `${restBaseUrl}/relationship?v=${personRelationshipRepresentation}&person=${patientUuid}`,
    `${restBaseUrl}/person/${patientUuid}?v=custom:(uuid,display,causeOfDeath,dead,deathDate,causeOfDeathNonCoded)`,
    `${restBaseUrl}/person/${patientUuid}/attribute?v=custom:(uuid,display,attributeType:(uuid,display,format),value)`,
    `${restBaseUrl}/patient/${patientUuid}/identifier?v=custom:(uuid,identifier,identifierType:(uuid,required,name),preferred)`,
  ];

  if (config.registrationObs?.encounterTypeUuid) {
    urls.push(
      `${restBaseUrl}/encounter?patient=${patientUuid}&v=custom:(encounterDatetime,obs:(concept:ref,value:ref))&encounterType=${config.registrationObs.encounterTypeUuid}`,
    );
  }

  return urls.map((url) => globalThis.location.origin + makeUrl(url));
}

async function precacheStaticAssets() {
  await Promise.all([
    fetchCurrentSession(),
    fetchAddressTemplate(),
    fetchAllRelationshipTypes(),
    fetchAllFieldDefinitionTypes(),
    fetchPatientIdentifierTypesWithSources(),
  ]);
}

export async function syncPatientRegistration(
  queuedPatient: PatientRegistration,
  options: SyncProcessOptions<PatientRegistration>,
) {
  await FormManager.savePatientFormOnline(
    queuedPatient._patientRegistrationData.isNewPatient,
    queuedPatient._patientRegistrationData.formValues,
    queuedPatient._patientRegistrationData.patientUuidMap,
    queuedPatient._patientRegistrationData.initialAddressFieldValues,
    queuedPatient._patientRegistrationData.capturePhotoProps,
    queuedPatient._patientRegistrationData.currentLocation,
    queuedPatient._patientRegistrationData.identifierTypes ?? [],
    queuedPatient._patientRegistrationData.initialIdentifierValues,
    queuedPatient._patientRegistrationData.currentUser,
    queuedPatient._patientRegistrationData.config,
    queuedPatient._patientRegistrationData.savePatientTransactionManager,
    options.abort,
  );
}

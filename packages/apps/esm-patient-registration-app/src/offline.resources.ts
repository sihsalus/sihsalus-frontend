import {
  type FetchResponse,
  getConfig,
  makeUrl,
  messageOmrsServiceWorker,
  omrsOfflineCachingStrategyHttpHeaderName,
  openmrsFetch,
  restBaseUrl,
  type Session,
} from '@openmrs/esm-framework';
import camelCase from 'lodash-es/camelCase';
import escapeRegExp from 'lodash-es/escapeRegExp';
import find from 'lodash-es/find';
import React from 'react';
import { type RegistrationConfig } from './config-schema';
import { cacheForOfflineHeaders, moduleName } from './constants';
import type {
  AddressTemplate,
  FetchedPatientIdentifierType,
  PatientIdentifierType,
} from './patient-registration/patient-registration.types';
import { getEffectiveRegistrationConfig } from './patient-registration/peru-registration-config';

const metadataFetchTimeoutMs = 10_000;
const serviceWorkerMessageTimeoutMs = 1_000;
const maxFreshMetadataPages = 20;
let hasWarnedAboutOfflineRouteRegistration = false;

const patientIdentifierTypesUrl =
  `${restBaseUrl}/patientidentifiertype?` +
  'v=custom:(display,uuid,name,description,format,required,uniquenessBehavior,locationBehavior)';
const primaryIdentifierTypeUrl = `${restBaseUrl}/metadatamapping/termmapping?v=full&code=emr.primaryIdentifierType`;
const identifierSourcesUrl = `${restBaseUrl}/idgen/identifiersource?v=default`;
const autoGenerationOptionsUrl = `${restBaseUrl}/idgen/autogenerationoption?v=full`;

interface PatientIdentifierTypeResponse {
  description?: string;
  display: string;
  format: string;
  name: string;
  locationBehavior?: string | null;
  required: boolean;
  uniquenessBehavior: FetchedPatientIdentifierType['uniquenessBehavior'];
  uuid: string;
}

interface IdentifierSourceResponse {
  uuid: string;
  name: string;
  identifierType: {
    uuid: string;
  };
  autoGenerationOption?: AutoGenerationOptionResponse;
}

interface AutoGenerationOptionResponse {
  manualEntryEnabled: boolean;
  automaticGenerationEnabled: boolean;
  source: {
    uuid: string;
  };
}

interface MetadataPage<T> {
  results?: Array<T>;
  links?: Array<{ rel?: string; uri?: string }>;
}

export interface Resources {
  addressTemplate: AddressTemplate;
  addressTemplateError?: Error;
  isLoadingAddressTemplate?: boolean;
  currentSession: Session;
  relationshipTypes: RelationshipTypesResponse | Array<unknown> | undefined;
  relationshipTypesError?: Error;
  isLoadingRelationshipTypes?: boolean;
  identifierTypes: Array<PatientIdentifierType>;
  identifierTypesError?: Error;
  isLoadingIdentifierTypes?: boolean;
}

export interface RelationshipTypesResponse {
  results: Array<{
    displayAIsToB?: string;
    displayBIsToA?: string;
    uuid: string;
    weight?: number;
  }>;
}

export const ResourcesContext = React.createContext<Resources>(null);

export async function fetchCurrentSession(): Promise<Session> {
  const { data } = await cacheAndFetch<Session>(`${restBaseUrl}/session`);
  return data;
}

export async function fetchAddressTemplate() {
  const { data } = await cacheAndFetch<AddressTemplate>(`${restBaseUrl}/addresstemplate`);
  return data;
}

export async function fetchAllRelationshipTypes(): Promise<RelationshipTypesResponse> {
  // Let failures propagate so SWR populates `relationshipTypesError` and the
  // relationships section can render an error instead of silently omitting options.
  const { data } = await cacheAndFetch<RelationshipTypesResponse>(
    `${restBaseUrl}/relationshiptype?v=custom:(uuid,displayAIsToB,displayBIsToA,weight)`,
  );
  return data;
}

export async function fetchAllFieldDefinitionTypes() {
  const config = getEffectiveRegistrationConfig((await getConfig(moduleName)) as RegistrationConfig);

  if (!config.fieldDefinitions) {
    return;
  }

  const fieldDefinitionPromises = config.fieldDefinitions.map((def) => fetchFieldDefinitionType(def));

  const fieldDefinitionResults = await Promise.all(fieldDefinitionPromises);

  const mergedData = fieldDefinitionResults.reduce<Array<unknown>>((merged, result) => {
    if (result) {
      merged.push(result);
    }
    return merged;
  }, []);

  return mergedData;
}

async function fetchFieldDefinitionType(fieldDefinition) {
  if (fieldDefinition.type === 'person attribute') {
    const { data } = await cacheAndFetch(`${restBaseUrl}/personattributetype/${fieldDefinition.uuid}`);
    return data;
  }

  if (fieldDefinition.answerConceptSetUuid) {
    await cacheAndFetch(`${restBaseUrl}/concept/${fieldDefinition.answerConceptSetUuid}`);
  }

  return null;
}

export async function fetchPatientIdentifierTypesWithSources(): Promise<Array<PatientIdentifierType>> {
  const patientIdentifierTypes = await fetchPatientIdentifierTypes();
  const identifierTypes = patientIdentifierTypes.filter(Boolean);

  if (!identifierTypes.length) {
    return [];
  }

  const [autoGenOptions, identifierSourcesResponse] = await Promise.allSettled([
    fetchAutoGenerationOptions(),
    fetchIdentifierSources(),
  ]);

  if (autoGenOptions.status === 'rejected' || identifierSourcesResponse.status === 'rejected') {
    console.warn(
      'Failed to load ID generation metadata. Rendering identifier fields without auto-generation sources.',
      {
        autoGenOptions: autoGenOptions.status === 'rejected' ? autoGenOptions.reason : undefined,
        identifierSources:
          identifierSourcesResponse.status === 'rejected' ? identifierSourcesResponse.reason : undefined,
      },
    );
    return identifierTypes.map((identifierType) => ({
      ...identifierType,
      identifierSources: [],
    }));
  }

  return addIdentifierSources(
    identifierTypes,
    identifierSourcesResponse.value.data.results,
    autoGenOptions.value.data.results,
  );
}

/**
 * Fetches the identifier metadata used by the bulk-import safety preflight.
 * Every URL has a nonce and uses a network-only request so a cached success can
 * never be mistaken for the backend's current uniqueness or ID-generation rules.
 */
export async function fetchFreshPatientIdentifierTypesWithSources(
  signal?: AbortSignal,
): Promise<Array<PatientIdentifierType>> {
  const abortController = new AbortController();
  const abortForCaller = () => abortController.abort(signal?.reason);
  const timeout = globalThis.setTimeout(() => abortController.abort(), metadataFetchTimeoutMs);

  if (signal?.aborted) {
    abortForCaller();
  }
  signal?.addEventListener('abort', abortForCaller, { once: true });

  try {
    const [patientIdentifierTypes, primaryIdentifierTypes, identifierSources, autoGenOptions] = await Promise.all([
      fetchAllFreshMetadataResults<PatientIdentifierTypeResponse>(patientIdentifierTypesUrl, abortController.signal),
      fetchAllFreshMetadataResults<{ metadataUuid?: string }>(primaryIdentifierTypeUrl, abortController.signal),
      fetchAllFreshMetadataResults<IdentifierSourceResponse>(identifierSourcesUrl, abortController.signal),
      fetchAllFreshMetadataResults<AutoGenerationOptionResponse>(autoGenerationOptionsUrl, abortController.signal),
    ]);

    const identifierTypes = mapPatientIdentifierTypes(patientIdentifierTypes, primaryIdentifierTypes[0]?.metadataUuid);

    return addIdentifierSources(identifierTypes, identifierSources, autoGenOptions);
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortForCaller);
  }
}

async function fetchPatientIdentifierTypes(): Promise<Array<FetchedPatientIdentifierType>> {
  // A failure here must propagate so SWR populates `identifierTypesError`:
  // swallowing it would render the registration form without identifier fields
  // and allow registering patients without their primary identifier.
  const patientIdentifierTypesResponse = await cacheAndFetch<{
    results: Array<PatientIdentifierTypeResponse>;
  }>(patientIdentifierTypesUrl);
  const primaryIdentifierTypeResponse = await cacheAndFetch<{
    results: Array<{ metadataUuid?: string }>;
  }>(primaryIdentifierTypeUrl, {
    required: false,
  }).catch((error) => {
    console.warn('Failed to load primary identifier mapping. Falling back to required identifier types.', error);
    return null;
  });

  if (!patientIdentifierTypesResponse.ok) {
    throw new Error(`Failed to load patient identifier types (HTTP ${patientIdentifierTypesResponse.status}).`);
  }

  return mapPatientIdentifierTypes(
    patientIdentifierTypesResponse.data.results,
    primaryIdentifierTypeResponse?.ok ? primaryIdentifierTypeResponse.data.results[0]?.metadataUuid : undefined,
  );
}

async function fetchIdentifierSources() {
  return await cacheAndFetch<{ results: Array<IdentifierSourceResponse> }>(identifierSourcesUrl);
}

async function fetchAutoGenerationOptions() {
  return await cacheAndFetch<{ results: Array<AutoGenerationOptionResponse> }>(autoGenerationOptionsUrl);
}

async function fetchFreshMetadata<T>(url: string, signal: AbortSignal): Promise<FetchResponse<T>> {
  const requestUrl = new URL(makeUrl(url), globalThis.location.origin);
  requestUrl.searchParams.set('_bulkPatientImportMetadata', globalThis.crypto.randomUUID());

  const response = await openmrsFetch<T>(requestUrl.href, {
    cache: 'no-store',
    headers: {
      [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
    },
    rejectOnAuthFailure: true,
    signal,
  });

  if (!response.ok || response.status < 200 || response.status >= 300) {
    throw new Error(`Failed to load fresh patient identifier metadata (HTTP ${response.status}).`);
  }

  return response;
}

async function fetchAllFreshMetadataResults<T>(initialUrl: string, signal: AbortSignal): Promise<Array<T>> {
  const results: Array<T> = [];
  const visited = new Set<string>();
  const restPath = `${new URL(makeUrl(restBaseUrl), globalThis.location.origin).pathname.replace(/\/$/, '')}/`;
  let nextUrl: string | undefined = makeUrl(initialUrl);

  for (let page = 0; nextUrl && page < maxFreshMetadataPages; page++) {
    const linkedUrl = new URL(nextUrl, globalThis.location.origin);
    if (!linkedUrl.pathname.startsWith(restPath)) {
      throw new Error('Failed to load fresh patient identifier metadata.');
    }
    const canonicalUrl = new URL(`${linkedUrl.pathname}${linkedUrl.search}`, globalThis.location.origin);
    canonicalUrl.searchParams.delete('_bulkPatientImportMetadata');
    const pageKey = canonicalUrl.href;
    if (visited.has(pageKey)) {
      throw new Error('Failed to load fresh patient identifier metadata.');
    }
    visited.add(pageKey);

    const response = await fetchFreshMetadata<MetadataPage<T>>(pageKey, signal);
    results.push(...(response.data.results ?? []));
    nextUrl = response.data.links?.find((link) => link.rel === 'next')?.uri;
  }

  if (nextUrl) {
    throw new Error('Failed to load fresh patient identifier metadata.');
  }
  return results;
}

async function cacheAndFetch<T = unknown>(url?: string, options: { required?: boolean } = {}) {
  const abortController = new AbortController();
  const timeout = globalThis.setTimeout(() => abortController.abort(), metadataFetchTimeoutMs);

  await withTimeout(
    messageOmrsServiceWorker({
      type: 'registerDynamicRoute',
      pattern: escapeRegExp(url),
    }),
    serviceWorkerMessageTimeoutMs,
  ).catch((error) => {
    if (options.required !== false && !hasWarnedAboutOfflineRouteRegistration) {
      hasWarnedAboutOfflineRouteRegistration = true;
      console.warn('Offline cache route registration is unavailable. Continuing with network requests.', error);
    }
  });

  try {
    return await openmrsFetch<T>(url, {
      headers: cacheForOfflineHeaders,
      signal: abortController.signal,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);

    promise.then(
      (value) => {
        globalThis.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function mapPatientIdentifierType(patientIdentifierType: PatientIdentifierTypeResponse, isPrimary: boolean) {
  return {
    description: patientIdentifierType.description,
    display: patientIdentifierType.display,
    name: patientIdentifierType.display || patientIdentifierType.name,
    fieldName: camelCase(patientIdentifierType.name),
    required: patientIdentifierType.required,
    uuid: patientIdentifierType.uuid,
    format: patientIdentifierType.format,
    isPrimary,
    locationBehavior: patientIdentifierType.locationBehavior,
    uniquenessBehavior: patientIdentifierType.uniquenessBehavior,
  };
}

function mapPatientIdentifierTypes(
  patientIdentifierTypes: Array<PatientIdentifierTypeResponse>,
  primaryIdentifierTypeUuid?: string,
): Array<FetchedPatientIdentifierType> {
  const primaryIdentifierType = patientIdentifierTypes.find((type) => type.uuid === primaryIdentifierTypeUuid);
  const identifierTypes = primaryIdentifierType ? [mapPatientIdentifierType(primaryIdentifierType, true)] : [];

  patientIdentifierTypes.forEach((type) => {
    if (type.uuid !== primaryIdentifierTypeUuid) {
      identifierTypes.push(mapPatientIdentifierType(type, false));
    }
  });

  return identifierTypes;
}

function addIdentifierSources(
  identifierTypes: Array<FetchedPatientIdentifierType>,
  allIdentifierSources: Array<IdentifierSourceResponse>,
  autoGenerationOptions: Array<AutoGenerationOptionResponse>,
): Array<PatientIdentifierType> {
  return identifierTypes.map((identifierType) => ({
    ...identifierType,
    identifierSources: allIdentifierSources
      .filter((source) => source.identifierType.uuid === identifierType.uuid)
      .map((source) => ({
        ...source,
        autoGenerationOption: find(autoGenerationOptions, {
          source: { uuid: source.uuid },
        }),
      })),
  }));
}

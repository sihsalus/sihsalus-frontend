import { getConfig, messageOmrsServiceWorker, openmrsFetch, restBaseUrl, type Session } from '@openmrs/esm-framework';
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

interface PatientIdentifierTypeResponse {
  description?: string;
  display: string;
  format: string;
  locationBehavior: FetchedPatientIdentifierType['locationBehavior'];
  name: string;
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
  try {
    const { data } = await cacheAndFetch<RelationshipTypesResponse>(
      `${restBaseUrl}/relationshiptype?v=custom:(uuid,displayAIsToB,displayBIsToA,weight)`,
    );
    return data;
  } catch (error) {
    console.warn(
      'Failed to load patient relationship types. Rendering registration without relationship options.',
      error,
    );
    return { results: [] };
  }
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

  // @ts-expect-error Reason: The required props of the type are generated below.
  const identifierTypes: Array<PatientIdentifierType> = patientIdentifierTypes.filter(Boolean);

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
    return identifierTypes.map((identifierType) => ({ ...identifierType, identifierSources: [] }));
  }

  const allIdentifierSources = identifierSourcesResponse.value.data.results;

  for (let i = 0; i < identifierTypes?.length; i++) {
    identifierTypes[i].identifierSources = allIdentifierSources
      .filter((source) => source.identifierType.uuid === identifierTypes[i].uuid)
      .map((source) => {
        const option = find(autoGenOptions.value.data.results, { source: { uuid: source.uuid } });
        source.autoGenerationOption = option;
        return source;
      });
  }

  return identifierTypes;
}

async function fetchPatientIdentifierTypes(): Promise<Array<FetchedPatientIdentifierType>> {
  try {
    const patientIdentifierTypesResponse = await cacheAndFetch<{ results: Array<PatientIdentifierTypeResponse> }>(
      `${restBaseUrl}/patientidentifiertype?v=custom:(display,uuid,name,description,format,required,locationBehavior,uniquenessBehavior)`,
    );
    const primaryIdentifierTypeResponse = await cacheAndFetch<{
      results: Array<{ metadataUuid?: string }>;
    }>(`${restBaseUrl}/metadatamapping/termmapping?v=full&code=emr.primaryIdentifierType`, {
      required: false,
    }).catch((error) => {
      console.warn('Failed to load primary identifier mapping. Falling back to required identifier types.', error);
      return null;
    });

    if (patientIdentifierTypesResponse.ok) {
      // Primary identifier type is to be kept at the top of the list.
      const patientIdentifierTypes = patientIdentifierTypesResponse?.data?.results;

      const primaryIdentifierTypeUuid = primaryIdentifierTypeResponse?.data?.results?.[0]?.metadataUuid;
      const primaryIdentifierType = patientIdentifierTypes?.find((type) => type.uuid === primaryIdentifierTypeUuid);

      const identifierTypes =
        primaryIdentifierTypeResponse?.ok && primaryIdentifierType
          ? [mapPatientIdentifierType(primaryIdentifierType, true)]
          : [];

      patientIdentifierTypes.forEach((type) => {
        if (type.uuid !== primaryIdentifierTypeUuid) {
          identifierTypes.push(mapPatientIdentifierType(type, false));
        }
      });
      return identifierTypes;
    }
  } catch (error) {
    console.warn('Failed to load patient identifier types.', error);
  }

  return [];
}

async function fetchIdentifierSources() {
  return await cacheAndFetch<{ results: Array<IdentifierSourceResponse> }>(
    `${restBaseUrl}/idgen/identifiersource?v=default`,
  );
}

async function fetchAutoGenerationOptions() {
  return await cacheAndFetch<{ results: Array<AutoGenerationOptionResponse> }>(
    `${restBaseUrl}/idgen/autogenerationoption?v=full`,
  );
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
    if (options.required !== false) {
      console.warn(`Failed to register offline cache route for ${url}. Continuing with network request.`, error);
    }
  });

  try {
    return await openmrsFetch<T>(url, { headers: cacheForOfflineHeaders, signal: abortController.signal });
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

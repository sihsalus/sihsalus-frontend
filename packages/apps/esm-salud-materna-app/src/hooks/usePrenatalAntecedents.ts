import type { FetchResponse } from '@openmrs/esm-framework';
import { openmrsFetch, restBaseUrl, useConfig, useOpenmrsFetchAll } from '@openmrs/esm-framework';
import { useEffect, useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

import type { ConfigObject } from '../config-schema';
import type { PatientPrenatalAntecedents } from '../types';
import { toEncounterDateTime } from '../utils/date-utils';

import { encounterMatchesForm, getObservationValue, type MaternalEncounter } from '../utils/pregnancy-episode-utils';
import { obstetricHistoryFields } from '../maternal-and-child-health/obstetric-history-fields';

// Enhanced Types
interface ConceptMetadata {
  uuid: string;
  display: string;
  hiNormal: number | null;
  hiAbsolute: number | null;
  hiCritical: number | null;
  lowNormal: number | null;
  lowAbsolute: number | null;
  lowCritical: number | null;
  units: string | null;
}

interface ConceptMetadataResponse {
  setMembers: ConceptMetadata[];
}

interface ConceptRange {
  lowAbsolute: number | null;
  highAbsolute: number | null;
}

interface PrenatalHookOptions {
  pageSize?: number;
  enabled?: boolean;
  refreshInterval?: number;
}

const isValidUuid = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Enhanced Error Handling
class PrenatalHookError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'PrenatalHookError';
  }
}

// Cache Management
class PrenatalCacheManager {
  private static instance: PrenatalCacheManager;
  private mutators = new Map<string, () => Promise<unknown>>();

  static getInstance(): PrenatalCacheManager {
    if (!PrenatalCacheManager.instance) {
      PrenatalCacheManager.instance = new PrenatalCacheManager();
    }
    return PrenatalCacheManager.instance;
  }

  register(patientUuid: string, mutator: () => Promise<unknown>): void {
    if (!isValidUuid(patientUuid)) {
      throw new PrenatalHookError('Invalid patient UUID', 'INVALID_UUID');
    }
    this.mutators.set(patientUuid, mutator);
  }

  unregister(patientUuid: string): void {
    this.mutators.delete(patientUuid);
  }

  async invalidate(patientUuid: string): Promise<void> {
    const mutator = this.mutators.get(patientUuid);
    if (mutator) {
      try {
        await mutator();
      } catch (error) {
        throw new PrenatalHookError(
          `Failed to invalidate cache for patient ${patientUuid}`,
          'CACHE_INVALIDATION_ERROR',
          error,
        );
      }
    }
  }

  clear(): void {
    this.mutators.clear();
  }
}

// Enhanced Hooks

/**
 * Hook optimizado para obtener metadatos de conceptos prenatales
 * @returns Datos de metadatos con mejor tipado y manejo de errores
 */
export function usePrenatalConceptMetadata() {
  const { madreGestante } = useConfig<ConfigObject>();
  const prenatalConceptSetUuid = madreGestante?.gtpalConceptSetUuid;

  const shouldFetch = Boolean(prenatalConceptSetUuid && isValidUuid(prenatalConceptSetUuid));

  const customRepresentation = useMemo(
    () => 'custom:(setMembers:(uuid,display,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units))',
    [],
  );

  const apiUrl = useMemo(() => {
    if (!shouldFetch) return null;
    return `${restBaseUrl}/concept/${prenatalConceptSetUuid}?v=${customRepresentation}`;
  }, [prenatalConceptSetUuid, customRepresentation, shouldFetch]);

  const { data, error, isLoading } = useSWRImmutable<{ data: ConceptMetadataResponse }, Error>(
    apiUrl,
    shouldFetch ? openmrsFetch : null,
    {
      onError: (error) => {
        console.error('Error fetching prenatal concept metadata:', error);
      },
      revalidateOnMount: true,
    },
  );

  const processedData = useMemo(() => {
    const conceptMetadata = data?.data?.setMembers;

    if (!conceptMetadata?.length) {
      return {
        conceptUnits: new Map<string, string>(),
        conceptRanges: new Map<string, ConceptRange>(),
        conceptMetadata: undefined,
      };
    }

    const conceptUnits = new Map<string, string>(
      conceptMetadata.filter((concept) => concept.units).map((concept) => [concept.uuid, concept.units!]),
    );

    const conceptRanges = new Map<string, ConceptRange>(
      conceptMetadata.map((concept) => [
        concept.uuid,
        {
          lowAbsolute: concept.lowAbsolute ?? null,
          highAbsolute: concept.hiAbsolute ?? null,
        },
      ]),
    );

    return { conceptUnits, conceptRanges, conceptMetadata };
  }, [data?.data?.setMembers]);

  return {
    data: processedData.conceptUnits,
    conceptRanges: processedData.conceptRanges,
    conceptMetadata: processedData.conceptMetadata,
    error: error ? new PrenatalHookError('Failed to fetch concept metadata', 'METADATA_FETCH_ERROR', error) : null,
    isLoading,
    isReady: shouldFetch && !isLoading && !error,
  };
}

/**
 * Hook optimizado para obtener antecedentes prenatales del paciente
 * @param patientUuid UUID del paciente
 * @param options Opciones de configuración del hook
 * @returns Datos de antecedentes prenatales con paginación mejorada
 */
const representation =
  'custom:(uuid,encounterDatetime,form:(uuid,name,display),obs:(uuid,concept:(uuid),value,groupMembers:(uuid,concept:(uuid),value,groupMembers:(uuid,concept:(uuid),value))))';

export function usePrenatalAntecedents(patientUuid: string, options: PrenatalHookOptions = {}) {
  const { formsList, madreGestante } = useConfig<ConfigObject>();
  const enabled = options.enabled !== false;
  const identifier = formsList.maternalHistory?.trim();
  const url =
    patientUuid && enabled && identifier ? `${restBaseUrl}/encounter?patient=${patientUuid}&v=${representation}` : null;
  const { data, error, isLoading, isValidating, mutate } = useOpenmrsFetchAll<MaternalEncounter>(url, {
    fetcher: openmrsFetch,
    swrInfiniteConfig: { refreshInterval: options.refreshInterval, revalidateOnFocus: false },
  });

  useEffect(() => {
    if (url) {
      const manager = PrenatalCacheManager.getInstance();
      manager.register(patientUuid, mutate);
      return () => manager.unregister(patientUuid);
    }
  }, [patientUuid, mutate, url]);

  const result = useMemo(() => {
    if (!data) return { records: [], processingError: null };
    try {
      const fields = obstetricHistoryFields;
      const records = data
        .filter((encounter) => encounterMatchesForm(encounter, identifier))
        .map((encounter): PatientPrenatalAntecedents => {
          if (!encounter.uuid || !Number.isFinite(Date.parse(encounter.encounterDatetime))) {
            throw new Error('Invalid obstetric encounter metadata');
          }
          const record: PatientPrenatalAntecedents = { id: encounter.uuid, date: encounter.encounterDatetime };
          for (const { key, conceptKey } of fields) {
            const value = getObservationValue(encounter.obs, madreGestante[conceptKey]);
            if (value === undefined || value === null || value === '') continue;
            // OpenMRS numeric values are authoritative. Do not manufacture zeros,
            // infer totals or combine fields from different encounters.
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
              throw new Error('Invalid numeric obstetric observation');
            }
            record[key] = value;
          }
          return record;
        })
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      return { records, processingError: null };
    } catch (caught) {
      return {
        records: [],
        processingError: caught instanceof Error ? caught : new Error('Invalid obstetric history'),
      };
    }
  }, [data, identifier, madreGestante]);

  return {
    data: result.records,
    isLoading,
    isValidating,
    error:
      error ??
      result.processingError ??
      (enabled && !identifier ? new Error('Maternal history form is not configured') : null),
    mutate,
  };
}

// Funciones de persistencia mejoradas

/**
 * Guardar antecedentes prenatales con validaciones mejoradas
 */
export async function savePrenatalAntecedents(
  encounterTypeUuid: string,
  formUuid: string,
  concepts: ConfigObject['madreGestante'],
  patientUuid: string,
  antecedents: Record<string, string | number>,
  abortController: AbortController,
  location: string,
): Promise<FetchResponse<Record<string, unknown>>> {
  // Validaciones
  if (!isValidUuid(patientUuid)) {
    throw new PrenatalHookError('Invalid patient UUID', 'INVALID_UUID');
  }

  if (!isValidUuid(encounterTypeUuid)) {
    throw new PrenatalHookError('Invalid encounter type UUID', 'INVALID_ENCOUNTER_TYPE');
  }

  if (!concepts) {
    throw new PrenatalHookError('Missing concepts configuration', 'MISSING_CONCEPTS');
  }

  try {
    const obsData = createObsObject(antecedents, concepts);

    if (obsData.length === 0) {
      throw new PrenatalHookError('No valid observations to save', 'NO_OBSERVATIONS');
    }

    return await openmrsFetch<Record<string, unknown>>(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
      body: {
        patient: patientUuid,
        location,
        encounterType: encounterTypeUuid,
        form: formUuid,
        obs: obsData,
      },
    });
  } catch (error) {
    throw new PrenatalHookError('Failed to save prenatal antecedents', 'SAVE_ERROR', error);
  }
}

/**
 * Actualizar antecedentes prenatales con validaciones mejoradas
 */
export async function updatePrenatalAntecedents(
  concepts: ConfigObject['madreGestante'],
  patientUuid: string,
  antecedents: Record<string, string | number>,
  encounterDatetime: Date,
  abortController: AbortController,
  encounterUuid: string,
  location: string,
): Promise<FetchResponse<Record<string, unknown>>> {
  // Validaciones similares a savePrenatalAntecedents
  if (!isValidUuid(patientUuid)) {
    throw new PrenatalHookError('Invalid patient UUID', 'INVALID_UUID');
  }

  if (!isValidUuid(encounterUuid)) {
    throw new PrenatalHookError('Invalid encounter UUID', 'INVALID_ENCOUNTER');
  }

  try {
    const obsData = createObsObject(antecedents, concepts);

    return await openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
      body: JSON.stringify({
        encounterDatetime: toEncounterDateTime(encounterDatetime),
        location,
        patient: patientUuid,
        obs: obsData,
        orders: [],
      }),
    });
  } catch (error) {
    throw new PrenatalHookError('Failed to update prenatal antecedents', 'UPDATE_ERROR', error);
  }
}

/**
 * Crear objeto de observaciones con validaciones mejoradas
 */
function createObsObject(
  antecedents: Record<string, string | number>,
  madreGestante: ConfigObject['madreGestante'],
): Array<{ concept: string; value: string }> {
  if (!madreGestante) {
    throw new PrenatalHookError('Missing madre gestante configuration', 'MISSING_CONFIG');
  }

  return Object.entries(antecedents)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .map(([name, value]) => {
      const conceptKey = `${name}Uuid` as keyof typeof madreGestante;
      const conceptUuid = madreGestante[conceptKey];

      if (!conceptUuid || !isValidUuid(conceptUuid)) {
        console.warn(`Invalid concept UUID for ${name}: ${conceptUuid}`);
        return null;
      }

      return {
        concept: conceptUuid,
        value: String(value),
      };
    })
    .filter(Boolean) as Array<{ concept: string; value: string }>;
}

/**
 * Invalidar cache de antecedentes prenatales
 */
export async function invalidateCachedPrenatalAntecedents(patientUuid: string): Promise<void> {
  const cacheManager = PrenatalCacheManager.getInstance();
  await cacheManager.invalidate(patientUuid);
}

/**
 * Limpiar todo el cache de antecedentes prenatales
 */
export function clearPrenatalCache(): void {
  const cacheManager = PrenatalCacheManager.getInstance();
  cacheManager.clear();
}

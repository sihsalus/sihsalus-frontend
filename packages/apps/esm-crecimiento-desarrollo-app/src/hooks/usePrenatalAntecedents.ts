import type { FetchResponse, FHIRResource } from '@openmrs/esm-framework';
import { fhirBaseUrl, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import useSWRImmutable from 'swr/immutable';
import useSWRInfinite from 'swr/infinite';

import type { ConfigObject } from '../config-schema';
import type {
  FHIRSearchBundleResponse,
  MappedInterpretation,
  PatientPrenatalAntecedents,
  PrenatalResponse,
} from '../types';
import { assessValue, getReferenceRangesForConcept } from '../utils';
import { toEncounterDateTime } from '../utils/date-utils';

// Constants
const DEFAULT_PAGE_SIZE = 100;
const SWR_KEY_NEEDLE = Symbol('prenatalAntecedents');

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

interface PrenatalSwrKey {
  swrKeyNeedle: typeof SWR_KEY_NEEDLE;
  patientUuid: string;
  conceptUuids: string;
  page: number;
  pageSize: number;
  prevPageData: FHIRSearchBundleResponse | null;
}

type PrenatalFetchResponse = FetchResponse<PrenatalResponse>;

// Utility Functions
const createInterpretationKey = (header: string): string => `${header}RenderInterpretation`;

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
export function usePrenatalAntecedents(patientUuid: string, options: PrenatalHookOptions = {}) {
  const { pageSize = DEFAULT_PAGE_SIZE, enabled = true, refreshInterval } = options;
  const { madreGestante } = useConfig<ConfigObject>();
  const { conceptMetadata, isReady: metadataReady } = usePrenatalConceptMetadata();
  const cacheManager = useRef(PrenatalCacheManager.getInstance());

  // Validación de entrada
  const isValidInput = useMemo(() => {
    return Boolean(patientUuid && isValidUuid(patientUuid) && madreGestante && enabled && metadataReady);
  }, [patientUuid, madreGestante, enabled, metadataReady]);

  // Conceptos prenatales con validación
  const prenatalConcepts = useMemo(() => {
    if (!madreGestante) return [];

    const concepts = [
      madreGestante.gravidezUuid,
      madreGestante.partoAlTerminoUuid,
      madreGestante.partoPrematuroUuid,
      madreGestante.partoAbortoUuid,
      madreGestante.partoNacidoVivoUuid,
      madreGestante.partoNacidoMuertoUuid,
    ].filter((uuid) => uuid && isValidUuid(uuid));

    return concepts;
  }, [madreGestante]);

  const conceptUuids = useMemo(() => prenatalConcepts.join(','), [prenatalConcepts]);

  // Función para obtener páginas con mejor manejo de errores
  const getPage = useCallback(
    (page: number, prevPageData: FHIRSearchBundleResponse | null): PrenatalSwrKey | null => {
      if (!isValidInput) return null;

      return {
        swrKeyNeedle: SWR_KEY_NEEDLE,
        patientUuid,
        conceptUuids,
        page,
        pageSize,
        prevPageData,
      };
    },
    [conceptUuids, patientUuid, isValidInput, pageSize],
  );

  // Hook SWR con configuración mejorada
  const { data, isLoading, isValidating, setSize, error, size, mutate } = useSWRInfinite<PrenatalFetchResponse, Error>(
    getPage,
    handleFetch,
    {
      refreshInterval,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      onError: (error) => {
        console.error('Error fetching prenatal antecedents:', error);
      },
    },
  );

  // Registro del mutador en el cache manager
  useEffect(() => {
    if (isValidInput) {
      const manager = cacheManager.current;
      manager.register(patientUuid, mutate);
      return () => {
        manager.unregister(patientUuid);
      };
    }
  }, [mutate, patientUuid, isValidInput]);

  // Mapeador de claves de conceptos prenatales optimizado
  const getPrenatalMapKey = useCallback(
    (conceptUuid: string): string => {
      if (!madreGestante) return '';

      const keyMap: Record<string, string> = {
        [madreGestante.gravidezUuid]: 'gravidez',
        [madreGestante.partoAlTerminoUuid]: 'partoAlTermino',
        [madreGestante.partoPrematuroUuid]: 'partoPrematuro',
        [madreGestante.partoAbortoUuid]: 'partoAborto',
        [madreGestante.partoNacidoVivoUuid]: 'partoNacidoVivo',
        [madreGestante.partoNacidoMuertoUuid]: 'partoNacidoMuerto',
      };

      return keyMap[conceptUuid] || '';
    },
    [madreGestante],
  );

  // Procesamiento optimizado de observaciones
  const formattedObs: PatientPrenatalAntecedents[] = useMemo(() => {
    if (!data?.[0]?.data?.entry || !conceptMetadata) {
      return [];
    }

    try {
      const prenatalHashTable = data[0].data.entry
        .map((entry) => entry.resource)
        .filter(Boolean)
        .map(mapPrenatalProperties(conceptMetadata))
        .filter((obs) => obs.value !== undefined && obs.value !== null)
        .reduce((hashTable, vitalSign) => {
          const recordedDate = new Date(vitalSign.recordedDate).toISOString();
          const mapKey = getPrenatalMapKey(vitalSign.code);

          if (!mapKey) return hashTable;

          const existingRecord = hashTable.get(recordedDate) || {};

          hashTable.set(recordedDate, {
            ...existingRecord,
            [mapKey]: vitalSign.value,
            [createInterpretationKey(mapKey)]: vitalSign.interpretation,
          });

          return hashTable;
        }, new Map<string, Partial<PatientPrenatalAntecedents>>());

      return Array.from(prenatalHashTable.entries())
        .map(([date, vitalSigns], index) => ({
          id: `${patientUuid}-${index}`,
          date,
          madreGestante,
          conceptMetadata,
          ...vitalSigns,
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (processingError) {
      console.error('Error processing prenatal observations:', processingError);
      return [];
    }
  }, [data, conceptMetadata, getPrenatalMapKey, madreGestante, patientUuid]);

  const hasMore = useMemo(() => {
    return data?.length
      ? !!data[data.length - 1].data?.link?.some((link: { relation?: string }) => link.relation === 'next')
      : false;
  }, [data]);

  return {
    data: isValidInput ? formattedObs : [],
    isLoading: isLoading && isValidInput,
    error: error
      ? new PrenatalHookError('Failed to fetch prenatal antecedents', 'ANTECEDENTS_FETCH_ERROR', error)
      : null,
    hasMore,
    isValidating,
    loadingNewData: isValidating,
    setPage: setSize,
    currentPage: size,
    totalResults: data?.[0]?.data?.total ?? 0,
    mutate,
    isEmpty: formattedObs.length === 0 && !isLoading,
    isReady: isValidInput && !isLoading,
  };
}

// Funciones de utilidad mejoradas

/**
 * Fetcher optimizado con mejor manejo de errores y validaciones
 */
async function handleFetch({
  patientUuid,
  conceptUuids,
  page,
  pageSize,
  prevPageData,
}: PrenatalSwrKey): Promise<PrenatalFetchResponse | null> {
  try {
    // Verificar si hay más páginas disponibles
    if (prevPageData && !prevPageData?.data?.link?.some((link) => link.relation === 'next')) {
      return null;
    }

    // Validar parámetros
    if (!patientUuid || !isValidUuid(patientUuid)) {
      throw new PrenatalHookError('Invalid patient UUID', 'INVALID_UUID');
    }

    if (!conceptUuids) {
      throw new PrenatalHookError('No concept UUIDs provided', 'MISSING_CONCEPTS');
    }

    const url = `${fhirBaseUrl}/Observation`;
    const urlSearchParams = new URLSearchParams({
      'subject:Patient': patientUuid,
      code: conceptUuids,
      _summary: 'data',
      _sort: '-date',
      _count: pageSize.toString(),
    });

    if (page > 0) {
      urlSearchParams.append('_getpagesoffset', (page * pageSize).toString());
    }

    return await openmrsFetch<PrenatalResponse>(`${url}?${urlSearchParams.toString()}`);
  } catch (error) {
    throw new PrenatalHookError('Failed to fetch prenatal data', 'FETCH_ERROR', error);
  }
}

/**
 * Mapeador mejorado con mejor manejo de tipos
 */
function mapPrenatalProperties(conceptMetadata: ConceptMetadata[]) {
  return (resource: FHIRResource['resource']): MappedInterpretation => {
    try {
      const code = resource?.code?.coding?.[0]?.code;
      const value = resource?.valueQuantity?.value;
      const effectiveDateTime = resource?.effectiveDateTime;

      // Convertir string de fecha a Date si es necesario
      const recordedDate = effectiveDateTime
        ? typeof effectiveDateTime === 'string'
          ? new Date(effectiveDateTime)
          : effectiveDateTime
        : new Date();

      return {
        code,
        interpretation: assessValue(value, getReferenceRangesForConcept(code, conceptMetadata)),
        recordedDate,
        value,
      };
    } catch (error) {
      console.warn('Error mapping prenatal properties:', error);
      return {
        code: resource?.code?.coding?.[0]?.code || '',
        interpretation: null,
        recordedDate: new Date(),
        value: null,
      };
    }
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
        encounterDatetime: toEncounterDateTime(new Date()),
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

import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  type DosingUnit,
  type DurationUnit,
  type MedicationFrequency,
  type MedicationRoute,
  type QuantityUnit,
} from '@openmrs/esm-patient-common-lib';
import { useCallback, useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

export interface ConceptName {
  uuid: string;
  display: string;
}
export interface CommonConfigProps {
  uuid: string;
  display: string;
  frequencyPerDay?: number;
  concept?: {
    names: ConceptName[];
  };
}

export interface OrderConfig {
  drugRoutes: Array<CommonConfigProps>;
  drugDosingUnits: Array<CommonConfigProps>;
  drugDispensingUnits: Array<CommonConfigProps>;
  durationUnits: Array<CommonConfigProps>;
  orderFrequencies: Array<CommonConfigProps>;
}

export function useOrderConfig(): {
  isLoading: boolean;
  isValidating: boolean;
  reloadOrderConfig: () => Promise<void>;
  error: Error;
  orderConfigObject: {
    drugRoutes: Array<MedicationRoute>;
    drugDosingUnits: Array<DosingUnit> | undefined;
    drugDispensingUnits: Array<QuantityUnit>;
    durationUnits: Array<DurationUnit>;
    orderFrequencies: Array<MedicationFrequency>;
  };
} {
  const { data, error, isLoading, isValidating, mutate } = useSWRImmutable<{ data: OrderConfig }, Error>(
    `${restBaseUrl}/orderentryconfig`,
    openmrsFetch,
  );
  const {
    data: frequencyData,
    error: frequencyError,
    isLoading: frequencyLoading,
    isValidating: frequencyValidating,
    mutate: mutateFrequencies,
  } = useSWRImmutable<{ data: OrderConfig }, Error>(
    `${restBaseUrl}/orderentryconfig?v=custom:(uuid,display,frequencyPerDay,concept:(names:(display,uuid)))`,
    openmrsFetch,
  );

  const reloadOrderConfig = useCallback(async () => {
    // SWR retains each request's failure in its error state, including failed retries.
    await Promise.allSettled([mutate(), mutateFrequencies()]);
  }, [mutate, mutateFrequencies]);

  const results = useMemo(
    () => ({
      orderConfigObject: {
        drugRoutes: data?.data?.drugRoutes?.map(({ uuid, display }) => ({
          valueCoded: uuid,
          value: display,
        })),
        // The existing REST resource can omit a catalog even on HTTP 200.
        drugDosingUnits: parseDosingUnits(data?.data?.drugDosingUnits),
        drugDispensingUnits: data?.data?.drugDispensingUnits?.map(({ uuid, display }) => ({
          valueCoded: uuid,
          value: display,
        })),
        durationUnits: data?.data?.durationUnits?.map(({ uuid, display }) => ({
          valueCoded: uuid,
          value: display,
        })),
        orderFrequencies: frequencyData?.data?.orderFrequencies?.map(({ uuid, display, frequencyPerDay, concept }) => ({
          valueCoded: uuid,
          value: display,
          frequencyPerDay: frequencyPerDay ?? null,
          names: [display, ...(concept?.names?.map((name) => name.display) ?? [])].filter(Boolean),
        })),
      },
      isLoading: isLoading || frequencyLoading,
      isValidating: isValidating || frequencyValidating,
      reloadOrderConfig,
      error: error || frequencyError,
    }),
    [
      data,
      error,
      isLoading,
      isValidating,
      frequencyData,
      frequencyError,
      frequencyLoading,
      frequencyValidating,
      reloadOrderConfig,
    ],
  );
  return results;
}

function parseDosingUnits(value: unknown): Array<DosingUnit> | undefined {
  if (
    !Array.isArray(value) ||
    !value.every(
      (unit) =>
        unit &&
        typeof unit.uuid === 'string' &&
        unit.uuid.trim() &&
        typeof unit.display === 'string' &&
        unit.display.trim(),
    )
  ) {
    return undefined;
  }
  return value.map(({ uuid, display }) => ({ valueCoded: uuid, value: display }));
}

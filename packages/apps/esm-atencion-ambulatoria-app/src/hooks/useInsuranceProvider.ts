import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID } from '@openmrs/esm-patient-common-lib';
import useSWR from 'swr';

export interface InsuranceEntry {
  uuid: string;
  display: string;
  /** UUID del concepto de financiador cuando se conoce (visit attribute). */
  conceptUuid: string | null;
  obsDatetime: string;
  encounterType: string | null;
  source: 'visit-attribute' | 'obs';
}

interface ObsResult {
  uuid: string;
  display: string;
  obsDatetime: string;
  value: { display: string } | string;
  encounter: {
    encounterType: { display: string };
  };
}

interface VisitAttributeResult {
  uuid: string;
  value?: string | { uuid?: string; display?: string } | null;
  attributeType?: { uuid?: string };
}

interface ActiveVisitResult {
  uuid: string;
  startDatetime?: string;
  attributes?: Array<VisitAttributeResult>;
}

function toFinanciadorEntry(visit: ActiveVisitResult | undefined): InsuranceEntry | null {
  const attribute = visit?.attributes?.find(
    (candidate) => candidate.attributeType?.uuid === FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  );

  if (!attribute?.value) {
    return null;
  }

  const conceptUuid = typeof attribute.value === 'string' ? attribute.value : (attribute.value.uuid ?? null);
  const display = typeof attribute.value === 'string' ? attribute.value : (attribute.value.display ?? '');

  return {
    uuid: attribute.uuid,
    display,
    conceptUuid,
    obsDatetime: visit?.startDatetime ?? '',
    encounterType: null,
    source: 'visit-attribute',
  };
}

/**
 * Financiador del paciente (plan de seguros SIS, F2): lee el visit attribute
 * «Financiador» de la visita activa; cuando la visita no tiene el atributo
 * (visitas antiguas), cae al historial legacy de obs (concepto CIEL 161631)
 * para que los datos anteriores sigan visibles.
 */
export function useInsuranceProvider(patientUuid: string, conceptUuid: string) {
  const visitUrl = patientUuid
    ? `${restBaseUrl}/visit?patient=${patientUuid}&includeInactive=false&v=custom:(uuid,startDatetime,attributes:(uuid,value,attributeType:(uuid)))&limit=1`
    : null;
  const {
    data: visitData,
    error: visitError,
    isLoading: isLoadingVisit,
    mutate: mutateVisit,
  } = useSWR<{ data: { results: ActiveVisitResult[] } }>(visitUrl, openmrsFetch);

  const obsUrl =
    patientUuid && conceptUuid
      ? `${restBaseUrl}/obs?patient=${patientUuid}&concept=${conceptUuid}&v=custom:(uuid,display,obsDatetime,value,encounter:(encounterType:(display)))&limit=20`
      : null;
  const { data, error, isLoading, mutate } = useSWR<{ data: { results: ObsResult[] } }>(obsUrl, openmrsFetch);

  const activeVisitFinanciador = toFinanciadorEntry(visitData?.data?.results?.[0]);

  const legacyObsEntries: InsuranceEntry[] = (data?.data?.results ?? []).map((obs) => ({
    uuid: obs.uuid,
    display: typeof obs.value === 'string' ? obs.value : (obs.value?.display ?? ''),
    conceptUuid: null,
    obsDatetime: obs.obsDatetime,
    encounterType: obs.encounter?.encounterType?.display ?? null,
    source: 'obs' as const,
  }));

  // Fuente de verdad: el visit attribute de la visita activa. Fallback legacy:
  // las obs 161631 registradas por el formulario de consulta externa.
  const insuranceEntries: InsuranceEntry[] = activeVisitFinanciador ? [activeVisitFinanciador] : legacyObsEntries;

  return {
    activeVisitFinanciador,
    insuranceEntries,
    isLoading: isLoading || isLoadingVisit,
    error: error ?? visitError,
    mutate: () => Promise.all([mutate(), mutateVisit()]),
  };
}

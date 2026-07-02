import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { type ConfigObject } from '../config-schema';
import type {
  Concept,
  DiagnosisPayload,
  EncountersFetchResponse,
  PatientNote,
  RESTPatientNote,
  VisitNotePayload,
} from '../types';
import { defaultVisitNoteClinicalConceptUuids } from './visit-note-config-schema';

interface UseVisitNotes {
  visitNotes: Array<PatientNote> | null;
  error: Error;
  isLoading: boolean;
  isValidating?: boolean;
  mutateVisitNotes: () => void;
}

export interface VisitNoteClinicalContext {
  codigoPrestacional?: string;
  chiefComplaint?: string;
  illnessDuration?: string;
  biologicalFunctions?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  auxiliaryExams?: string;
  procedures?: string;
  prescriptions?: string;
  referral?: string;
  nextAppointment?: string;
}

export interface ProviderSignatureDetails {
  uuid?: string;
  name?: string;
  identifier?: string;
  professionalRegistration?: string;
}

interface RestObsValue {
  uuid?: string;
  display?: string;
}

interface RestClinicalContextObs {
  uuid?: string;
  obsDatetime?: string;
  display?: string;
  concept?: {
    uuid?: string;
    display?: string;
  };
  value?: string | number | boolean | RestObsValue;
  formFieldNamespace?: string;
  formFieldPath?: string;
}

interface RestClinicalContextEncounter {
  uuid?: string;
  display?: string;
  encounterDatetime?: string;
  obs?: Array<RestClinicalContextObs>;
}

interface RestProviderAttribute {
  uuid?: string;
  display?: string;
  value?: string | number | boolean;
  attributeType?: {
    uuid?: string;
    display?: string;
  };
}

interface RestProvider {
  uuid?: string;
  display?: string;
  identifier?: string;
  person?: {
    uuid?: string;
    display?: string;
    attributes?: Array<RestProviderAttribute>;
  };
}

const legacyProceduresConceptUuids = {
  procedure: '1651AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  textWithProceduresPath: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
} as const;

export function useVisitNotes(patientUuid: string): UseVisitNotes {
  const {
    visitNoteConfig: { encounterNoteTextConceptUuid, visitDiagnosesConceptUuid },
  } = useConfig<ConfigObject>();

  const customRepresentation =
    'custom:(uuid,display,encounterDatetime,patient,obs,' +
    'encounterProviders:(uuid,display,' +
    'encounterRole:(uuid,display),' +
    'provider:(uuid,person:(uuid,display))),' +
    'diagnoses';
  const encountersApiUrl = `${restBaseUrl}/encounter?patient=${patientUuid}&obs=${visitDiagnosesConceptUuid}&v=${customRepresentation}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: EncountersFetchResponse }, Error>(
    encountersApiUrl,
    openmrsFetch,
  );

  const mapNoteProperties = (note: RESTPatientNote, index: number): PatientNote => {
    const encounterNoteObs = note.obs.find(
      (observation) => observation.concept.uuid === encounterNoteTextConceptUuid && !observation.formFieldPath,
    );

    return {
      id: `${index}`,
      diagnoses: note.diagnoses
        .filter((diagnosis) => !diagnosis.voided)
        .map((diagnosisData) => getDisplayText(diagnosisData.display))
        .filter((val) => val)
        .join(', '),
      encounterDate: note.encounterDatetime,
      encounterNote: encounterNoteObs ? getObsTextValue(encounterNoteObs) : '',
      encounterNoteRecordedAt: encounterNoteObs?.obsDatetime,
      encounterProvider: getDisplayText(note?.encounterProviders[0]?.provider?.person?.display),
      encounterProviderRole: getDisplayText(note?.encounterProviders[0]?.encounterRole?.display),
    };
  };

  const formattedVisitNotes = data?.data?.results
    ?.map(mapNoteProperties)
    ?.sort((noteA, noteB) => new Date(noteB.encounterDate).getTime() - new Date(noteA.encounterDate).getTime());

  return {
    visitNotes: data ? formattedVisitNotes : null,
    error,
    isLoading,
    isValidating,
    mutateVisitNotes: mutate,
  };
}

export function fetchDiagnosisConceptsByName(searchTerm: string, diagnosisConceptClass: string) {
  const customRepresentation = 'custom:(uuid,display)';
  const url = `${restBaseUrl}/concept?name=${searchTerm}&searchType=fuzzy&class=${diagnosisConceptClass}&v=${customRepresentation}`;

  return openmrsFetch<Array<Concept>>(url).then(({ data }) => data['results']);
}

export function fetchPrestacionalConceptsByName(searchTerm: string, conceptSourceName = 'Codigos Prestacionales') {
  const configuredConceptSetNames = getConfiguredConceptSourceNames(conceptSourceName);
  const conceptSetQuery = encodeURIComponent(configuredConceptSetNames[0] ?? conceptSourceName);
  const customRepresentation = 'custom:(uuid,display,setMembers:(uuid,display))';
  const url = `${restBaseUrl}/concept?q=${conceptSetQuery}&searchType=fuzzy&v=${customRepresentation}&limit=20`;

  return openmrsFetch<Array<Concept>>(url).then(({ data }) => {
    const matchingConceptSet = (data['results'] ?? []).find((concept) =>
      configuredConceptSetNames.some((conceptSetName) => matchesConceptSetDisplay(concept.display, conceptSetName)),
    );
    const normalizedSearchTerm = normalizeSearchText(searchTerm);

    return (matchingConceptSet?.setMembers ?? [])
      .filter((concept) => normalizeSearchText(concept.display).includes(normalizedSearchTerm))
      .sort((left, right) => left.display.localeCompare(right.display));
  });
}

function normalizeConceptSourceName(sourceName?: string | null) {
  return (
    sourceName
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') ?? ''
  );
}

function normalizeSearchText(value?: string | null) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '') ?? ''
  );
}

function getConfiguredConceptSourceNames(conceptSourceName: string) {
  return conceptSourceName
    .split(',')
    .map((sourceName) => sourceName.trim())
    .filter(Boolean);
}

function matchesConceptSetDisplay(actualDisplay: string, expectedDisplay: string) {
  const actual = normalizeConceptSourceName(actualDisplay);
  const expected = normalizeConceptSourceName(expectedDisplay);

  return Boolean(actual && expected && actual === expected);
}

export function saveVisitNote(abortController: AbortController, payload: VisitNotePayload) {
  return openmrsFetch(`${restBaseUrl}/encounter`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: payload,
    signal: abortController.signal,
  });
}

function getDisplayText(value: unknown) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(getDisplayText).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    const displayValue = 'display' in value ? (value as { display?: unknown }).display : undefined;
    if (displayValue) {
      return getDisplayText(displayValue);
    }

    const nameValue = 'name' in value ? (value as { name?: unknown }).name : undefined;
    if (nameValue) {
      return getDisplayText(nameValue);
    }

    const uuidValue = 'uuid' in value ? (value as { uuid?: unknown }).uuid : undefined;
    if (uuidValue) {
      return getDisplayText(uuidValue);
    }
  }

  return '';
}

function getObsTextValue(obs: { value?: unknown; display?: string }) {
  if (obs.value == null) {
    return '';
  }

  return getDisplayText(obs.value) || obs.display || '';
}

function getLatestObsValue(
  encounters: Array<RestClinicalContextEncounter>,
  conceptUuid: string,
  formFieldPath?: string,
): string | undefined {
  if (!conceptUuid) {
    return undefined;
  }

  for (const encounter of encounters) {
    const obs = encounter?.obs?.find(
      (observation) =>
        observation?.concept?.uuid === conceptUuid && (!formFieldPath || observation?.formFieldPath === formFieldPath),
    );
    const value = obs ? getObsTextValue(obs).trim() : '';
    if (value) {
      return value;
    }
  }

  return undefined;
}

function buildBiologicalFunctionsSummary(
  encounters: Array<RestClinicalContextEncounter>,
  visitNoteConfig: ConfigObject['visitNoteConfig'],
) {
  const values = [
    ['Apetito', getLatestObsValue(encounters, visitNoteConfig.appetiteConceptUuid)],
    ['Sed', getLatestObsValue(encounters, visitNoteConfig.thirstConceptUuid)],
    ['Sueno', getLatestObsValue(encounters, visitNoteConfig.sleepConceptUuid)],
    ['Animo', getLatestObsValue(encounters, visitNoteConfig.moodConceptUuid)],
    ['Orina', getLatestObsValue(encounters, visitNoteConfig.urineConceptUuid)],
    ['Deposiciones', getLatestObsValue(encounters, visitNoteConfig.bowelMovementsConceptUuid)],
  ].filter(([, value]) => value);

  return values.length ? values.map(([label, value]) => `${label}: ${value}`).join('\n') : undefined;
}

export function useVisitNoteClinicalContext(patientUuid: string, visitUuid?: string) {
  const config = useConfig<ConfigObject>();
  const visitNoteConfig = {
    ...defaultVisitNoteClinicalConceptUuids,
    ...config.visitNoteConfig,
  };
  const customRepresentation =
    'custom:(uuid,display,encounterDatetime,obs:(uuid,obsDatetime,display,concept:(uuid,display),value:(uuid,display),' +
    'formFieldNamespace,formFieldPath))';
  const visitQuery = visitUuid ? `&visit=${visitUuid}` : '';
  const encountersApiUrl = patientUuid
    ? `${restBaseUrl}/encounter?patient=${patientUuid}${visitQuery}&v=${customRepresentation}&limit=25`
    : null;

  const { data, error, isLoading, isValidating } = useSWR<
    { data: { results: Array<RestClinicalContextEncounter> } },
    Error
  >(encountersApiUrl, openmrsFetch);

  const encounters = [...(data?.data?.results ?? [])].sort(
    (encounterA, encounterB) =>
      new Date(encounterB.encounterDatetime ?? 0).getTime() - new Date(encounterA.encounterDatetime ?? 0).getTime(),
  );
  const getLatest = (conceptUuid: string, formFieldPath?: string) =>
    getLatestObsValue(encounters, conceptUuid, formFieldPath);
  const getLatestStructuredText = (conceptUuid: string, formFieldPath: string) =>
    getLatest(conceptUuid, formFieldPath) ??
    (conceptUuid !== visitNoteConfig.encounterNoteTextConceptUuid ? getLatest(conceptUuid) : undefined);
  const getLatestProceduresText = () =>
    getLatest(visitNoteConfig.proceduresConceptUuid, 'procedures') ??
    getLatest(legacyProceduresConceptUuids.textWithProceduresPath, 'procedures') ??
    getLatest(legacyProceduresConceptUuids.procedure, 'procedures') ??
    getLatest(visitNoteConfig.proceduresConceptUuid) ??
    getLatest(legacyProceduresConceptUuids.procedure);

  const clinicalContext: VisitNoteClinicalContext = {
    codigoPrestacional: getLatest(visitNoteConfig.codigoPrestacionalConceptUuid, 'codigo-prestacional'),
    chiefComplaint: getLatest(visitNoteConfig.chiefComplaintConceptUuid),
    illnessDuration: getLatest(visitNoteConfig.illnessDurationConceptUuid),
    biologicalFunctions:
      getLatest(visitNoteConfig.biologicalFunctionsConceptUuid, 'biological-functions') ??
      buildBiologicalFunctionsSummary(encounters, visitNoteConfig),
    subjective: getLatest(visitNoteConfig.soapSubjectiveConceptUuid) ?? getLatest(visitNoteConfig.anamnesisConceptUuid),
    objective: getLatest(visitNoteConfig.soapObjectiveConceptUuid),
    assessment: getLatest(visitNoteConfig.soapAssessmentConceptUuid),
    plan: getLatestStructuredText(visitNoteConfig.soapPlanConceptUuid, 'soap-plan'),
    auxiliaryExams: getLatest(visitNoteConfig.labOrdersConceptUuid),
    procedures: getLatestProceduresText(),
    prescriptions: getLatest(visitNoteConfig.prescriptionsConceptUuid),
    referral: getLatest(visitNoteConfig.referralConceptUuid),
    nextAppointment: getLatest(visitNoteConfig.nextAppointmentConceptUuid),
  };

  return {
    clinicalContext,
    error,
    isLoading,
    isValidating,
  };
}

function getProviderAttributeValue(provider: RestProvider | undefined, patterns: Array<RegExp>) {
  const attributes = provider?.person?.attributes ?? [];
  const matchingAttribute = attributes.find((attribute) => {
    const label = `${attribute?.attributeType?.display ?? ''} ${attribute?.display ?? ''}`;
    return patterns.some((pattern) => pattern.test(label));
  });

  return matchingAttribute?.value ? String(matchingAttribute.value) : undefined;
}

export function useProviderSignatureDetails(providerUuid?: string): {
  providerSignatureDetails: ProviderSignatureDetails;
  error: Error;
  isLoading: boolean;
} {
  const customRepresentation =
    'custom:(uuid,display,identifier,person:(uuid,display,attributes:(uuid,display,value,attributeType:(uuid,display))))';
  const providerUrl = providerUuid ? `${restBaseUrl}/provider/${providerUuid}?v=${customRepresentation}` : null;
  const { data, error, isLoading } = useSWR<{ data: RestProvider }, Error>(providerUrl, openmrsFetch);
  const provider = data?.data;
  const professionalRegistration =
    provider?.identifier ??
    getProviderAttributeValue(provider, [
      /colegiatura/i,
      /\bcmp\b/i,
      /\brne\b/i,
      /registro/i,
      /colegio/i,
      /licen[cs]/i,
    ]);

  return {
    providerSignatureDetails: {
      uuid: provider?.uuid ?? providerUuid,
      name: provider?.person?.display ?? provider?.display,
      identifier: provider?.identifier,
      professionalRegistration,
    },
    error,
    isLoading,
  };
}

export function updateVisitNote(abortController: AbortController, encounterUuid: string, payload: VisitNotePayload) {
  return openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: payload,
    signal: abortController.signal,
  });
}

export function savePatientDiagnosis(abortController: AbortController, payload: DiagnosisPayload) {
  return openmrsFetch(`${restBaseUrl}/patientdiagnoses`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: payload,
    signal: abortController.signal,
  });
}

export function deletePatientDiagnosis(abortController: AbortController, diagnosisUuid: string) {
  return openmrsFetch(`${restBaseUrl}/patientdiagnoses/${diagnosisUuid}`, {
    method: 'DELETE',
    signal: abortController.signal,
  });
}

/**
 * Tipo de diagnóstico MINSA (NTS-139): P (Presuntivo), D (Definitivo), R (Repetitivo).
 *
 * OpenMRS solo guarda `certainty` (CONFIRMED/PROVISIONAL) en `patientdiagnoses`,
 * que no distingue P de R. Para no perder el tipo exacto, el visit note guarda
 * además un obs por diagnóstico cuyo `formFieldPath` es `tipo-dx-{conceptUuid}`,
 * ligando el tipo a su diagnóstico CIE-10. Estos helpers centralizan ese mapeo.
 */
export const TIPO_DX_FORM_FIELD_NAMESPACE = 'visit-notes';
export const TIPO_DX_FIELD_PREFIX = 'tipo-dx-';

/** NTS-139: Definitivo → CONFIRMED; Presuntivo/Repetitivo → PROVISIONAL. */
export function getCertaintyForTipo(tipoUuid: string, definitivoUuid: string): 'CONFIRMED' | 'PROVISIONAL' {
  return tipoUuid === definitivoUuid ? 'CONFIRMED' : 'PROVISIONAL';
}

export interface TipoDxObs {
  concept: { uuid: string; display: string };
  value: string;
  formFieldNamespace: string;
  formFieldPath: string;
}

/** Construye el obs que persiste el tipo MINSA (P/D/R) ligado a su diagnóstico CIE-10. */
export function buildTipoDxObs(
  diagnosisTypeConceptUuid: string,
  codedDiagnosisUuid: string,
  tipoUuid: string,
): TipoDxObs {
  return {
    concept: { uuid: diagnosisTypeConceptUuid, display: '' },
    value: tipoUuid,
    formFieldNamespace: TIPO_DX_FORM_FIELD_NAMESPACE,
    formFieldPath: `${TIPO_DX_FIELD_PREFIX}${codedDiagnosisUuid}`,
  };
}

type TipoDxObsValue = string | number | boolean | { uuid?: string; display?: string } | null | undefined;

interface TipoDxSourceObs {
  formFieldNamespace?: string;
  formFieldPath?: string;
  value?: TipoDxObsValue;
}

/**
 * Reconstruye el mapa `{ conceptUuid CIE-10 → tipo UUID (P/D/R) }` a partir de los
 * obs del encounter. Inverso de {@link buildTipoDxObs}.
 */
export function parseTipoDxObs(obs: Array<TipoDxSourceObs>): Record<string, string> {
  const tipos: Record<string, string> = {};
  for (const o of obs) {
    if (
      o.formFieldNamespace !== TIPO_DX_FORM_FIELD_NAMESPACE ||
      typeof o.formFieldPath !== 'string' ||
      !o.formFieldPath.startsWith(TIPO_DX_FIELD_PREFIX)
    ) {
      continue;
    }
    const codedUuid = o.formFieldPath.slice(TIPO_DX_FIELD_PREFIX.length);
    const valueUuid =
      typeof o.value === 'object' && o.value !== null ? o.value.uuid : o.value != null ? String(o.value) : undefined;
    if (codedUuid && valueUuid) {
      tipos[codedUuid] = valueUuid;
    }
  }
  return tipos;
}

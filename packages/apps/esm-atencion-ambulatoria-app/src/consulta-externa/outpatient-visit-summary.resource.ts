import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { ConfigObject } from '../config-schema';

const TIPO_DX_FORM_FIELD_NAMESPACE = 'visit-notes';
const TIPO_DX_FIELD_PREFIX = 'tipo-dx-';

const VISIT_SUMMARY_REPRESENTATION =
  'custom:(uuid,patient:(uuid),visitType:(uuid,display),startDatetime,stopDatetime,location:(uuid,display),' +
  'encounters:(uuid,voided,encounterDatetime,location:(uuid,display),' +
  'encounterProviders:(uuid,provider:(uuid,display,person:(uuid,display)),encounterRole:(uuid,display)),' +
  'diagnoses:(uuid,display,voided,certainty,rank,diagnosis:(coded:(uuid,display,mappings:(display)),nonCoded)),' +
  'obs:(uuid,voided,concept:(uuid,display),value,display,formFieldNamespace,formFieldPath),' +
  'orders:(uuid,voided,action,previousOrder:(uuid),orderType:(uuid,display),concept:(uuid,display),' +
  'drug:(uuid,display,strength),dose,doseUnits:(uuid,display),route:(uuid,display),frequency:(uuid,display),' +
  'duration,durationUnits:(uuid,display),quantity,quantityUnits:(uuid,display),dosingInstructions,instructions,' +
  'orderer:(uuid,display,person:(uuid,display)))))';

interface OpenmrsRef {
  uuid: string;
  display?: string;
}

interface VisitSummaryObservation {
  uuid: string;
  voided?: boolean;
  concept?: OpenmrsRef;
  value?: unknown;
  display?: string;
  formFieldNamespace?: string;
  formFieldPath?: string;
}

interface VisitSummaryDiagnosis {
  uuid: string;
  display?: string;
  voided?: boolean;
  certainty?: string;
  rank?: number;
  diagnosis?: {
    coded?: OpenmrsRef & { mappings?: Array<{ display?: string }> };
    nonCoded?: string;
  };
}

interface VisitSummaryOrder {
  uuid: string;
  voided?: boolean;
  action?: string;
  previousOrder?: OpenmrsRef;
  orderType?: OpenmrsRef;
  concept?: OpenmrsRef;
  drug?: OpenmrsRef & { strength?: string };
  dose?: number;
  doseUnits?: OpenmrsRef;
  route?: OpenmrsRef;
  frequency?: OpenmrsRef;
  duration?: number;
  durationUnits?: OpenmrsRef;
  quantity?: number;
  quantityUnits?: OpenmrsRef;
  dosingInstructions?: string;
  instructions?: string;
  orderer?: OpenmrsRef & { person?: OpenmrsRef };
}

interface VisitSummaryEncounter {
  uuid: string;
  voided?: boolean;
  encounterDatetime: string;
  location?: OpenmrsRef;
  encounterProviders?: Array<{
    uuid: string;
    provider?: OpenmrsRef & { person?: OpenmrsRef };
    encounterRole?: OpenmrsRef;
  }>;
  diagnoses?: VisitSummaryDiagnosis[];
  obs?: VisitSummaryObservation[];
  orders?: VisitSummaryOrder[];
}

export interface VisitSummarySource {
  uuid: string;
  patient?: OpenmrsRef;
  visitType?: OpenmrsRef;
  startDatetime?: string;
  stopDatetime?: string | null;
  location?: OpenmrsRef;
  encounters?: VisitSummaryEncounter[];
}

export interface OutpatientSummaryPatient {
  uuid: string;
  name: string;
  identifiers: Array<{ label: string; value: string }>;
  birthDate: string | null;
  gender: string | null;
}

export interface OutpatientSummaryDiagnosis {
  uuid: string;
  display: string;
  cie10Code: string | null;
  rank: number | null;
  type: 'P' | 'D' | 'R';
}

export interface OutpatientSummaryOrder {
  uuid: string;
  category: 'medication' | 'laboratory' | 'other';
  name: string;
  details: string | null;
  orderer: string | null;
}

export interface OutpatientVisitSummary {
  visitUuid: string;
  patient: OutpatientSummaryPatient;
  facilityName: string;
  visitType: string;
  visitStart: string;
  visitEnd: string | null;
  location: string | null;
  providers: string[];
  vitals: {
    bloodPressure: string | null;
    temperature: string | null;
    oxygenSaturation: string | null;
    weight: string | null;
    height: string | null;
    pulse: string | null;
    respiratoryRate: string | null;
    bmi: string | null;
  };
  anamnesis: {
    chiefComplaint: string | null;
    illnessDuration: string | null;
    onsetType: string | null;
    course: string | null;
    narrative: string | null;
    biologicalFunctions: {
      summary: string | null;
      appetite: string | null;
      thirst: string | null;
      sleep: string | null;
      mood: string | null;
      urine: string | null;
      bowelMovements: string | null;
    };
  };
  soap: {
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
  };
  diagnoses: OutpatientSummaryDiagnosis[];
  treatment: {
    therapeuticIndications: string | null;
    procedures: string | null;
    referral: string | null;
    nextAppointment: string | null;
    legacyLabOrders: string | null;
    legacyPrescriptions: string | null;
  };
  orders: OutpatientSummaryOrder[];
  hasClinicalContent: boolean;
}

export interface BuildOutpatientVisitSummaryOptions {
  source: VisitSummarySource;
  expectedVisitUuid: string;
  expectedPatientUuid: string;
  expectedVisitTypeUuid: string;
  patient: OutpatientSummaryPatient;
  facilityName: string;
  concepts: ConfigObject['concepts'];
}

export class OutpatientVisitSummaryContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutpatientVisitSummaryContractError';
  }
}

export async function fetchOutpatientVisitSummarySource(visitUuid: string): Promise<VisitSummarySource> {
  const response = await openmrsFetch<VisitSummarySource>(
    `${restBaseUrl}/visit/${visitUuid}?v=${VISIT_SUMMARY_REPRESENTATION}`,
  );
  return response.data;
}

function asText(value: unknown, fallback?: string): string | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const normalized = String(value).trim();
    return normalized || null;
  }
  if (value && typeof value === 'object') {
    const display = 'display' in value ? value.display : undefined;
    if (typeof display === 'string' && display.trim()) return display.trim();
  }
  return fallback?.trim() || null;
}

function valueUuid(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('uuid' in value)) return null;
  return typeof value.uuid === 'string' ? value.uuid : null;
}

function getLatestObservation(
  encounters: VisitSummaryEncounter[],
  conceptUuid: string | undefined,
  fieldPath?: string,
): VisitSummaryObservation | null {
  if (!conceptUuid) return null;
  for (const encounter of [...encounters].sort(
    (a, b) => new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime(),
  )) {
    const match = encounter.obs?.find(
      (obs) =>
        !obs.voided &&
        obs.concept?.uuid === conceptUuid &&
        (fieldPath === undefined || obs.formFieldPath === fieldPath),
    );
    if (match) return match;
  }
  return null;
}

function getObservationText(
  encounters: VisitSummaryEncounter[],
  conceptUuid: string | undefined,
  fieldPath?: string,
): string | null {
  const observation = getLatestObservation(encounters, conceptUuid, fieldPath);
  return observation ? asText(observation.value, observation.display) : null;
}

function getNumericObservation(encounters: VisitSummaryEncounter[], conceptUuid: string | undefined): number | null {
  const value = getObservationText(encounters, conceptUuid);
  if (value === null) return null;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function getLatestNumericObservationWithEncounter(
  encounters: VisitSummaryEncounter[],
  conceptUuid: string | undefined,
): { encounterUuid: string; value: number } | null {
  for (const encounter of [...encounters].sort(
    (a, b) => new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime(),
  )) {
    const value = getNumericObservation([encounter], conceptUuid);
    if (value !== null) return { encounterUuid: encounter.uuid, value };
  }
  return null;
}

function getLatestNumericObservationPair(
  encounters: VisitSummaryEncounter[],
  firstConceptUuid: string | undefined,
  secondConceptUuid: string | undefined,
): [number | null, number | null] {
  for (const encounter of [...encounters].sort(
    (a, b) => new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime(),
  )) {
    const first = getNumericObservation([encounter], firstConceptUuid);
    const second = getNumericObservation([encounter], secondConceptUuid);
    if (first !== null && second !== null) return [first, second];
  }
  return [null, null];
}

function formatNumber(value: number | null, unit: string): string | null {
  return value === null ? null : `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
}

function getDiagnosisType(
  encounter: VisitSummaryEncounter,
  diagnosis: VisitSummaryDiagnosis,
  concepts: ConfigObject['concepts'],
): 'P' | 'D' | 'R' {
  const codedUuid = diagnosis.diagnosis?.coded?.uuid;
  const linkedType = codedUuid
    ? encounter.obs?.find(
        (obs) =>
          !obs.voided &&
          obs.concept?.uuid === concepts.diagnosisTypeConceptUuid &&
          obs.formFieldNamespace === TIPO_DX_FORM_FIELD_NAMESPACE &&
          obs.formFieldPath === `${TIPO_DX_FIELD_PREFIX}${codedUuid}`,
      )
    : null;
  const linkedUuid = valueUuid(linkedType?.value);
  const linkedDisplay = asText(linkedType?.value)?.toLocaleLowerCase();
  if (linkedUuid === concepts.definitiveDiagnosisTypeUuid || linkedDisplay?.includes('definit')) return 'D';
  if (linkedUuid === concepts.repeatDiagnosisTypeUuid || linkedDisplay?.includes('repetit')) return 'R';
  if (diagnosis.certainty === 'CONFIRMED') return 'D';
  return 'P';
}

function mapDiagnoses(
  encounters: VisitSummaryEncounter[],
  concepts: ConfigObject['concepts'],
): OutpatientSummaryDiagnosis[] {
  const seen = new Set<string>();
  return encounters.flatMap((encounter) =>
    (encounter.diagnoses ?? []).flatMap((diagnosis) => {
      if (diagnosis.voided || seen.has(diagnosis.uuid)) return [];
      seen.add(diagnosis.uuid);
      const coded = diagnosis.diagnosis?.coded;
      const display = coded?.display ?? diagnosis.diagnosis?.nonCoded ?? diagnosis.display;
      if (!display) return [];
      const cie10Mapping = coded?.mappings?.find((mapping) => mapping.display?.toUpperCase().startsWith('ICD-10'));
      return [
        {
          uuid: diagnosis.uuid,
          display,
          cie10Code: cie10Mapping?.display?.split(':').slice(1).join(':').trim() || null,
          rank: diagnosis.rank ?? null,
          type: getDiagnosisType(encounter, diagnosis, concepts),
        },
      ];
    }),
  );
}

function orderDetails(order: VisitSummaryOrder): string | null {
  const parts = [
    order.dose != null ? `${order.dose}${order.doseUnits?.display ? ` ${order.doseUnits.display}` : ''}` : null,
    order.route?.display,
    order.frequency?.display,
    order.duration != null
      ? `${order.duration}${order.durationUnits?.display ? ` ${order.durationUnits.display}` : ''}`
      : null,
    order.quantity != null
      ? `${order.quantity}${order.quantityUnits?.display ? ` ${order.quantityUnits.display}` : ''}`
      : null,
    order.dosingInstructions,
    order.instructions,
  ].filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(' · ') : null;
}

function mapOrders(encounters: VisitSummaryEncounter[]): OutpatientSummaryOrder[] {
  const seen = new Set<string>();
  const sourceOrders = encounters.flatMap((encounter) => encounter.orders ?? []).filter((order) => !order.voided);
  const supersededOrderUuids = new Set(
    sourceOrders.map((order) => order.previousOrder?.uuid).filter((uuid): uuid is string => Boolean(uuid)),
  );
  return sourceOrders.flatMap((order) => {
    if (seen.has(order.uuid) || order.action === 'DISCONTINUE' || supersededOrderUuids.has(order.uuid)) return [];
    seen.add(order.uuid);
    const type = order.orderType?.display?.toLocaleLowerCase() ?? '';
    const category = order.drug ? 'medication' : /lab|laborator|test|prueba|examen/.test(type) ? 'laboratory' : 'other';
    const drugName = [order.drug?.display, order.drug?.strength].filter(Boolean).join(' ');
    const name = drugName || order.concept?.display || order.orderType?.display;
    if (!name) return [];
    return [
      {
        uuid: order.uuid,
        category,
        name,
        details: orderDetails(order),
        orderer: order.orderer?.person?.display ?? order.orderer?.display ?? null,
      },
    ];
  });
}

function getProviderNames(encounters: VisitSummaryEncounter[]): string[] {
  return [
    ...new Set(
      encounters.flatMap((encounter) =>
        (encounter.encounterProviders ?? [])
          .map((entry) => entry.provider?.person?.display ?? entry.provider?.display)
          .filter((name): name is string => Boolean(name)),
      ),
    ),
  ];
}

export function buildOutpatientVisitSummary({
  source,
  expectedVisitUuid,
  expectedPatientUuid,
  expectedVisitTypeUuid,
  patient,
  facilityName,
  concepts,
}: BuildOutpatientVisitSummaryOptions): OutpatientVisitSummary {
  if (source.uuid?.toLowerCase() !== expectedVisitUuid.toLowerCase()) {
    throw new OutpatientVisitSummaryContractError('The visit response does not match the requested visit.');
  }
  if (
    source.patient?.uuid?.toLowerCase() !== expectedPatientUuid.toLowerCase() ||
    patient.uuid.toLowerCase() !== expectedPatientUuid.toLowerCase()
  ) {
    throw new OutpatientVisitSummaryContractError('The visit and patient identities do not match.');
  }
  if (source.visitType?.uuid?.toLowerCase() !== expectedVisitTypeUuid.toLowerCase()) {
    throw new OutpatientVisitSummaryContractError('The selected visit is not an outpatient visit.');
  }
  if (!source.startDatetime) {
    throw new OutpatientVisitSummaryContractError('The visit start date is missing.');
  }

  const encounters = (source.encounters ?? []).filter(
    (encounter) =>
      !encounter.voided &&
      encounter.encounterDatetime &&
      !Number.isNaN(new Date(encounter.encounterDatetime).getTime()),
  );
  const weightObservation = getLatestNumericObservationWithEncounter(encounters, concepts.weightUuid);
  const heightObservation = getLatestNumericObservationWithEncounter(encounters, concepts.heightUuid);
  const weight = weightObservation?.value ?? null;
  const height = heightObservation?.value ?? null;
  const heightMetres = height && height > 0 ? height / 100 : null;
  const bmi =
    weight && heightMetres && weightObservation?.encounterUuid === heightObservation?.encounterUuid
      ? weight / (heightMetres * heightMetres)
      : null;
  const [systolic, diastolic] = getLatestNumericObservationPair(
    encounters,
    concepts.systolicBloodPressureUuid,
    concepts.diastolicBloodPressureUuid,
  );
  const biologicalFunctions = {
    summary: getObservationText(encounters, concepts.biologicalFunctionsSummaryUuid),
    appetite: getObservationText(encounters, concepts.appetiteUuid),
    thirst: getObservationText(encounters, concepts.thirstUuid),
    sleep: getObservationText(encounters, concepts.sleepUuid),
    mood: getObservationText(encounters, concepts.moodUuid),
    urine: getObservationText(encounters, concepts.urineUuid),
    bowelMovements: getObservationText(encounters, concepts.bowelMovementsUuid),
  };
  const diagnoses = mapDiagnoses(encounters, concepts);
  const orders = mapOrders(encounters);
  const anamnesis = {
    chiefComplaint: getObservationText(encounters, concepts.chiefComplaintUuid),
    illnessDuration: getObservationText(encounters, concepts.illnessDurationUuid),
    onsetType: getObservationText(encounters, concepts.onsetTypeUuid),
    course: getObservationText(encounters, concepts.courseUuid),
    narrative: getObservationText(encounters, concepts.anamnesisUuid),
    biologicalFunctions,
  };
  const soap = {
    subjective: getObservationText(encounters, concepts.soapSubjectiveUuid),
    objective: getObservationText(encounters, concepts.soapObjectiveUuid),
    assessment: getObservationText(encounters, concepts.soapAssessmentUuid),
    plan: getObservationText(encounters, concepts.soapPlanUuid),
  };
  const treatment = {
    therapeuticIndications: getObservationText(encounters, concepts.therapeuticIndicationsUuid),
    procedures: getObservationText(encounters, concepts.proceduresUuid),
    referral: getObservationText(encounters, concepts.referralUuid),
    nextAppointment: getObservationText(encounters, concepts.nextAppointmentUuid),
    legacyLabOrders: getObservationText(encounters, concepts.labOrdersUuid),
    legacyPrescriptions: getObservationText(encounters, concepts.prescriptionsUuid),
  };
  const vitals = {
    bloodPressure: systolic !== null && diastolic !== null ? `${systolic}/${diastolic} mmHg` : null,
    temperature: formatNumber(getNumericObservation(encounters, concepts.temperatureUuid), '°C'),
    oxygenSaturation: formatNumber(getNumericObservation(encounters, concepts.oxygenSaturationUuid), '%'),
    weight: formatNumber(weight, 'kg'),
    height: formatNumber(height, 'cm'),
    pulse: formatNumber(getNumericObservation(encounters, concepts.pulseUuid), 'lpm'),
    respiratoryRate: formatNumber(getNumericObservation(encounters, concepts.respiratoryRateUuid), 'rpm'),
    bmi: bmi ? bmi.toFixed(1) : null,
  };
  const hasClinicalContent = Boolean(
    encounters.length &&
      (Object.values(vitals).some(Boolean) ||
        Object.values({ ...anamnesis, biologicalFunctions: null }).some(Boolean) ||
        Object.values(biologicalFunctions).some(Boolean) ||
        Object.values(soap).some(Boolean) ||
        diagnoses.length ||
        Object.values(treatment).some(Boolean) ||
        orders.length),
  );

  return {
    visitUuid: source.uuid,
    patient,
    facilityName,
    visitType: source.visitType.display ?? '',
    visitStart: source.startDatetime,
    visitEnd: source.stopDatetime ?? null,
    location:
      source.location?.display ??
      encounters.find((encounter) => encounter.location?.display)?.location?.display ??
      null,
    providers: getProviderNames(encounters),
    vitals,
    anamnesis,
    soap,
    diagnoses,
    treatment,
    orders,
    hasClinicalContent,
  };
}

export function getVisitSummaryRepresentationForTesting(): string {
  return VISIT_SUMMARY_REPRESENTATION;
}

import { Type } from '@openmrs/esm-framework';

export const defaultVisitNoteClinicalConceptUuids = {
  codigoPrestacionalConceptUuid: 'e82d45de-8696-42f8-99bc-337a750a7102',
  chiefComplaintConceptUuid: '71b58cff-879b-4358-98d5-2165434d4324',
  illnessDurationConceptUuid: '577876b1-0b6e-4c57-b4c3-7af969a1d501',
  anamnesisConceptUuid: '6d99603e-ae9d-4838-8a09-ba75e27ff1e9',
  biologicalFunctionsConceptUuid: '9011adf4-2b9f-4ecb-a44c-cb5642e4e015',
  appetiteConceptUuid: 'f0000182-0000-4000-8000-000000000182',
  thirstConceptUuid: 'f0000183-0000-4000-8000-000000000183',
  sleepConceptUuid: 'f0000184-0000-4000-8000-000000000184',
  moodConceptUuid: 'f0000185-0000-4000-8000-000000000185',
  urineConceptUuid: 'f0000186-0000-4000-8000-000000000186',
  bowelMovementsConceptUuid: 'f0000187-0000-4000-8000-000000000187',
  soapSubjectiveConceptUuid: 'f0000202-0000-4000-8000-000000000202',
  soapObjectiveConceptUuid: '160532AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  soapAssessmentConceptUuid: '160533AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  soapPlanConceptUuid: 'f0000201-0000-4000-8000-000000000201',
  labOrdersConceptUuid: '01fe9e3c-7150-42ca-87db-8813fa630129',
  proceduresConceptUuid: 'f0000206-0000-4000-8000-000000000206',
  prescriptionsConceptUuid: '1e9c5e02-b09f-41c6-83aa-dfed81bd0df5',
  referralConceptUuid: '3f573194-bade-46bc-b5fd-59c36f5f697a',
  nextAppointmentConceptUuid: '47ce3ee6-ee9f-4037-901b-2a6381c4b340',
} as const;

export default {
  clinicianEncounterRole: {
    _type: Type.UUID,
    _default: '240b26f9-dd88-4172-823d-4a8bfeb7841f',
    _description: 'Doctor or Nurse who is the primary provider for an encounter, and will sign the note',
  },
  visitDiagnosesConceptUuid: {
    _type: Type.ConceptUuid,
    _default: '159947AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    _description: 'The set of diagnoses that were either addressed or diagnosed during the current visit',
  },
  encounterNoteTextConceptUuid: {
    _type: Type.ConceptUuid,
    _default: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    _description: 'Free text note field intended to capture unstructured description of the patient encounter',
  },
  codigoPrestacionalConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.codigoPrestacionalConceptUuid,
    _description: 'Codigo Prestacional saved by visit notes with formFieldPath codigo-prestacional',
  },
  chiefComplaintConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.chiefComplaintConceptUuid,
    _description: 'Chief complaint / motive for consultation, reused from anamnesis when available',
  },
  illnessDurationConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.illnessDurationConceptUuid,
    _description: 'Duration of current illness, reused from anamnesis when available',
  },
  anamnesisConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.anamnesisConceptUuid,
    _description: 'Chronological illness story / anamnesis concept used as fallback source for subjective notes',
  },
  biologicalFunctionsConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.biologicalFunctionsConceptUuid,
    _description: 'Summary of biological functions saved by visit notes with formFieldPath biological-functions',
  },
  appetiteConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.appetiteConceptUuid,
    _description: 'Appetite biological function concept used to prefill visit notes',
  },
  thirstConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.thirstConceptUuid,
    _description: 'Thirst biological function concept used to prefill visit notes',
  },
  sleepConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.sleepConceptUuid,
    _description: 'Sleep biological function concept used to prefill visit notes',
  },
  moodConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.moodConceptUuid,
    _description: 'Mood biological function concept used to prefill visit notes',
  },
  urineConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.urineConceptUuid,
    _description: 'Urine biological function concept used to prefill visit notes',
  },
  bowelMovementsConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.bowelMovementsConceptUuid,
    _description: 'Bowel movements biological function concept used to prefill visit notes',
  },
  soapSubjectiveConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.soapSubjectiveConceptUuid,
    _description: 'SOAP subjective concept used by outpatient forms',
  },
  soapObjectiveConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.soapObjectiveConceptUuid,
    _description: 'SOAP objective / physical exam concept used by outpatient forms',
  },
  soapAssessmentConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.soapAssessmentConceptUuid,
    _description: 'SOAP assessment concept used by outpatient forms',
  },
  soapPlanConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.soapPlanConceptUuid,
    _description: 'SOAP plan / treatment concept used by outpatient forms',
  },
  labOrdersConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.labOrdersConceptUuid,
    _description: 'Auxiliary exams / lab orders concept used by outpatient forms',
  },
  proceduresConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.proceduresConceptUuid,
    _description: 'Procedures CPMS text concept used by outpatient forms',
  },
  prescriptionsConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.prescriptionsConceptUuid,
    _description: 'Prescriptions concept used by outpatient forms',
  },
  referralConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.referralConceptUuid,
    _description: 'Referral / interconsultation concept used by outpatient forms',
  },
  nextAppointmentConceptUuid: {
    _type: Type.ConceptUuid,
    _default: defaultVisitNoteClinicalConceptUuids.nextAppointmentConceptUuid,
    _description: 'Next appointment concept used by outpatient forms',
  },
  encounterTypeUuid: {
    _type: Type.UUID,
    _default: 'd7151f82-c1f3-4152-a605-2f9ea7414a79',
    _description:
      'Encounter where a full or abbreviated examination is done, usually leading to a presumptive or confirmed diagnosis, recorded by the examining clinician.',
  },
  formConceptUuid: {
    _type: Type.UUID,
    _default: 'c75f120a-04ec-11e3-8780-2b40bef9a44b',
    _description: 'The UUID of the Visit Note form to be associated with visit note encounters',
  },
  // NTS-139: Tipo de diagnóstico — concepto con respuestas Presuntivo, Definitivo, Repetitivo
  diagnosisTypeConceptUuid: {
    _type: Type.UUID,
    _default: '2d53d39f-c93f-4128-8f7c-1bb45b498497',
    _description: 'UUID del concepto Tipo de diagnóstico (NTS-139). Respuestas: Presuntivo, Definitivo, Repetitivo',
  },
  diagnosisTypePresuntivoUuid: {
    _type: Type.UUID,
    _default: '4f59cf03-f888-4d34-a5dc-f24269b1945d',
    _description: 'UUID de la respuesta Presuntivo (P) del concepto Tipo de diagnóstico',
  },
  diagnosisTypeDefinitivoUuid: {
    _type: Type.UUID,
    _default: '2c60a8f6-1787-41be-8434-30ebeb5656ff',
    _description: 'UUID de la respuesta Definitivo (D) del concepto Tipo de diagnóstico',
  },
  diagnosisTypeRepetitivoUuid: {
    _type: Type.UUID,
    _default: '6f653861-8469-4dfa-a0b5-2804f1cfc527',
    _description: 'UUID de la respuesta Repetitivo (R) del concepto Tipo de diagnóstico',
  },
};

export interface VisitNoteConfigObject {
  clinicianEncounterRole: string;
  encounterNoteTextConceptUuid: string;
  encounterTypeUuid: string;
  formConceptUuid: string;
  visitDiagnosesConceptUuid: string;
  codigoPrestacionalConceptUuid: string;
  chiefComplaintConceptUuid: string;
  illnessDurationConceptUuid: string;
  anamnesisConceptUuid: string;
  biologicalFunctionsConceptUuid: string;
  appetiteConceptUuid: string;
  thirstConceptUuid: string;
  sleepConceptUuid: string;
  moodConceptUuid: string;
  urineConceptUuid: string;
  bowelMovementsConceptUuid: string;
  soapSubjectiveConceptUuid: string;
  soapObjectiveConceptUuid: string;
  soapAssessmentConceptUuid: string;
  soapPlanConceptUuid: string;
  labOrdersConceptUuid: string;
  proceduresConceptUuid: string;
  prescriptionsConceptUuid: string;
  referralConceptUuid: string;
  nextAppointmentConceptUuid: string;
  diagnosisTypeConceptUuid: string;
  diagnosisTypePresuntivoUuid: string;
  diagnosisTypeDefinitivoUuid: string;
  diagnosisTypeRepetitivoUuid: string;
}

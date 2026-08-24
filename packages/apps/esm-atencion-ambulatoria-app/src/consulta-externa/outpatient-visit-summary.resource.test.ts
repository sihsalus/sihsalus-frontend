import type { ConfigObject } from '../config-schema';
import {
  buildOutpatientVisitSummary,
  getVisitSummaryRepresentationForTesting,
  type OutpatientSummaryPatient,
  OutpatientVisitSummaryContractError,
  type VisitSummarySource,
} from './outpatient-visit-summary.resource';

const patient: OutpatientSummaryPatient = {
  uuid: 'patient-uuid',
  name: 'Paciente Sintético',
  identifiers: [{ label: 'DNI', value: '00000000' }],
  birthDate: '1990-01-01',
  gender: 'female',
};

const concepts = {
  weightUuid: 'weight',
  heightUuid: 'height',
  systolicBloodPressureUuid: 'systolic',
  diastolicBloodPressureUuid: 'diastolic',
  pulseUuid: 'pulse',
  respiratoryRateUuid: 'respiratory-rate',
  temperatureUuid: 'temperature',
  oxygenSaturationUuid: 'oxygen-saturation',
  chiefComplaintUuid: 'chief-complaint',
  illnessDurationUuid: 'illness-duration',
  onsetTypeUuid: 'onset',
  courseUuid: 'course',
  anamnesisUuid: 'anamnesis',
  biologicalFunctionsSummaryUuid: 'biological-functions',
  appetiteUuid: 'appetite',
  thirstUuid: 'thirst',
  sleepUuid: 'sleep',
  moodUuid: 'mood',
  urineUuid: 'urine',
  bowelMovementsUuid: 'bowel',
  soapSubjectiveUuid: 'soap-subjective',
  soapObjectiveUuid: 'soap-objective',
  soapAssessmentUuid: 'soap-assessment',
  soapPlanUuid: 'soap-plan',
  diagnosisTypeConceptUuid: 'diagnosis-type',
  definitiveDiagnosisTypeUuid: 'definitive',
  repeatDiagnosisTypeUuid: 'repeat',
  therapeuticIndicationsUuid: 'therapeutic-indications',
  proceduresUuid: 'procedures',
  referralUuid: 'referral',
  nextAppointmentUuid: 'next-appointment',
  labOrdersUuid: 'legacy-labs',
  prescriptionsUuid: 'legacy-prescriptions',
} as ConfigObject['concepts'];

const source: VisitSummarySource = {
  uuid: 'visit-uuid',
  patient: { uuid: 'patient-uuid' },
  visitType: { uuid: 'ambulatory-type', display: 'Atención Ambulatoria' },
  startDatetime: '2026-08-23T14:00:00.000-05:00',
  location: { uuid: 'location-uuid', display: 'Consulta Externa' },
  encounters: [
    {
      uuid: 'encounter-uuid',
      encounterDatetime: '2026-08-23T14:10:00.000-05:00',
      encounterProviders: [
        {
          uuid: 'encounter-provider-uuid',
          provider: { uuid: 'provider-uuid', person: { uuid: 'person-uuid', display: 'Dra. Demo' } },
        },
      ],
      obs: [
        { uuid: 'weight-obs', concept: { uuid: 'weight' }, value: 60 },
        { uuid: 'height-obs', concept: { uuid: 'height' }, value: 160 },
        { uuid: 'systolic-obs', concept: { uuid: 'systolic' }, value: 110 },
        { uuid: 'diastolic-obs', concept: { uuid: 'diastolic' }, value: 70 },
        { uuid: 'chief-obs', concept: { uuid: 'chief-complaint' }, value: 'Dolor de cabeza' },
        { uuid: 'subjective-obs', concept: { uuid: 'soap-subjective' }, value: 'Cefalea de dos días' },
        { uuid: 'plan-obs', concept: { uuid: 'therapeutic-indications' }, value: 'Hidratación y reposo' },
        {
          uuid: 'diagnosis-type-obs',
          concept: { uuid: 'diagnosis-type' },
          value: { uuid: 'definitive', display: 'Definitivo' },
          formFieldNamespace: 'visit-notes',
          formFieldPath: 'tipo-dx-coded-diagnosis',
        },
      ],
      diagnoses: [
        {
          uuid: 'diagnosis-uuid',
          rank: 1,
          certainty: 'CONFIRMED',
          diagnosis: {
            coded: {
              uuid: 'coded-diagnosis',
              display: 'Cefalea',
              mappings: [{ display: 'ICD-10: R51' }],
            },
          },
        },
      ],
      orders: [
        {
          uuid: 'old-medication-order',
          drug: { uuid: 'old-drug-uuid', display: 'Paracetamol 250 mg' },
          orderType: { uuid: 'drug-order-type', display: 'Drug Order' },
        },
        {
          uuid: 'medication-order',
          previousOrder: { uuid: 'old-medication-order' },
          drug: { uuid: 'drug-uuid', display: 'Paracetamol 500 mg' },
          orderType: { uuid: 'drug-order-type', display: 'Drug Order' },
          dose: 1,
          doseUnits: { uuid: 'tablet', display: 'tableta' },
          frequency: { uuid: 'every-eight-hours', display: 'cada 8 horas' },
          orderer: { uuid: 'provider-uuid', person: { uuid: 'person-uuid', display: 'Dra. Demo' } },
        },
        {
          uuid: 'lab-order',
          concept: { uuid: 'pregnancy-test', display: 'Prueba de embarazo' },
          orderType: { uuid: 'test-order-type', display: 'Laboratory Test Order' },
        },
      ],
    },
  ],
};

function build(overrides: Partial<Parameters<typeof buildOutpatientVisitSummary>[0]> = {}) {
  return buildOutpatientVisitSummary({
    source,
    expectedVisitUuid: 'visit-uuid',
    expectedPatientUuid: 'patient-uuid',
    expectedVisitTypeUuid: 'ambulatory-type',
    patient,
    facilityName: 'IPRESS Sintética',
    concepts,
    ...overrides,
  });
}

describe('outpatient visit summary contract', () => {
  it('uses a balanced exact-visit representation with diagnoses and encounter orders', () => {
    const representation = getVisitSummaryRepresentationForTesting();
    expect(representation.split('(')).toHaveLength(representation.split(')').length);
    expect(representation).toContain('patient:(uuid)');
    expect(representation).toContain('diagnoses:(');
    expect(representation).toContain('orders:(');
    expect(representation).toContain('previousOrder:(uuid)');
  });

  it('maps only the verified visit into the patient report', () => {
    const summary = build();

    expect(summary.patient.name).toBe('Paciente Sintético');
    expect(summary.providers).toEqual(['Dra. Demo']);
    expect(summary.vitals).toMatchObject({ bloodPressure: '110/70 mmHg', weight: '60 kg', height: '160 cm' });
    expect(summary.anamnesis.chiefComplaint).toBe('Dolor de cabeza');
    expect(summary.anamnesis.biologicalFunctions.summary).toBeNull();
    expect(summary.soap.subjective).toBe('Cefalea de dos días');
    expect(summary.diagnoses).toEqual([expect.objectContaining({ display: 'Cefalea', cie10Code: 'R51', type: 'D' })]);
    expect(summary.orders).toEqual([
      expect.objectContaining({ uuid: 'medication-order', category: 'medication' }),
      expect.objectContaining({ uuid: 'lab-order', category: 'laboratory', name: 'Prueba de embarazo' }),
    ]);
    expect(summary.hasClinicalContent).toBe(true);
  });

  it.each([
    ['visit', { expectedVisitUuid: 'other-visit' }],
    ['patient', { expectedPatientUuid: 'other-patient' }],
    ['visit type', { expectedVisitTypeUuid: 'hospitalization-type' }],
  ])('fails closed when the %s identity does not match', (_label, overrides) => {
    expect(() => build(overrides)).toThrow(OutpatientVisitSummaryContractError);
  });

  it('does not claim a clinical report when the verified visit has no clinical data', () => {
    const emptySummary = build({ source: { ...source, encounters: [] } });
    expect(emptySummary.hasClinicalContent).toBe(false);
  });

  it('does not combine blood pressure or BMI values recorded in different encounters', () => {
    const originalEncounter = source.encounters?.[0];
    if (!originalEncounter) throw new Error('The synthetic fixture requires an encounter.');
    const summary = build({
      source: {
        ...source,
        encounters: [
          originalEncounter,
          {
            uuid: 'newer-partial-vitals',
            encounterDatetime: '2026-08-23T15:00:00.000-05:00',
            obs: [
              {
                uuid: 'newer-systolic',
                concept: { uuid: 'systolic' },
                value: 140,
              },
              { uuid: 'newer-weight', concept: { uuid: 'weight' }, value: 80 },
            ],
          },
        ],
      },
    });

    expect(summary.vitals.bloodPressure).toBe('110/70 mmHg');
    expect(summary.vitals.weight).toBe('80 kg');
    expect(summary.vitals.height).toBe('160 cm');
    expect(summary.vitals.bmi).toBeNull();
  });
});

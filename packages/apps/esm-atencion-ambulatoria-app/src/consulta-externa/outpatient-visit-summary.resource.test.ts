import { openmrsFetch } from '@openmrs/esm-framework';
import type { ConfigObject } from '../config-schema';
import {
  buildOutpatientVisitSummary,
  fetchOutpatientVisitSummarySource,
  getLinkedAppointmentUuids,
  getVisitSummaryRepresentationForTesting,
  type OutpatientSummaryPatient,
  OutpatientVisitSummaryContractError,
  type VisitSummarySource,
} from './outpatient-visit-summary.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

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
      encounterType: { uuid: 'visit-note-type' },
      form: { uuid: 'visit-note-form' },
      encounterProviders: [
        {
          uuid: 'encounter-provider-uuid',
          encounterRole: { uuid: 'clinician-role', display: 'Clinician' },
          provider: {
            uuid: 'provider-uuid',
            attributes: [
              {
                uuid: 'registration-attribute',
                value: 'CMP-12345',
                attributeType: { uuid: 'professional-registration-type' },
              },
            ],
            person: { uuid: 'person-uuid', display: 'Dra. Demo' },
          },
        },
      ],
      obs: [
        { uuid: 'weight-obs', concept: { uuid: 'weight' }, value: 60 },
        { uuid: 'height-obs', concept: { uuid: 'height' }, value: 160 },
        { uuid: 'systolic-obs', concept: { uuid: 'systolic' }, value: 110 },
        { uuid: 'diastolic-obs', concept: { uuid: 'diastolic' }, value: 70 },
        {
          uuid: 'chief-obs',
          concept: { uuid: 'chief-complaint' },
          value: 'Dolor de cabeza',
        },
        {
          uuid: 'subjective-obs',
          concept: { uuid: 'soap-subjective' },
          value: 'Cefalea de dos días',
        },
        {
          uuid: 'general-state-obs',
          concept: { uuid: 'soap-objective' },
          value: 'Paciente en buen estado general',
          formFieldPath: 'rfe-forms-estadoGeneral',
        },
        {
          uuid: 'head-and-neck-obs',
          concept: { uuid: 'head-and-neck-concept' },
          value: 'Sin hallazgos de alarma',
          formFieldPath: 'rfe-forms-cabezaCuello',
        },
        {
          uuid: 'plan-obs',
          concept: { uuid: 'therapeutic-indications' },
          value: 'Hidratación y reposo',
        },
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
              mappings: [
                {
                  display: 'ICD-10: R51',
                  conceptReferenceTerm: {
                    code: 'R51',
                    conceptSource: { name: 'ICD-10' },
                  },
                },
              ],
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
          orderer: {
            uuid: 'provider-uuid',
            person: { uuid: 'person-uuid', display: 'Dra. Demo' },
          },
        },
        {
          uuid: 'lab-order',
          concept: { uuid: 'pregnancy-test', display: 'Prueba de embarazo' },
          orderType: {
            uuid: 'test-order-type',
            display: 'Laboratory Test Order',
          },
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
    professionalRegistrationProviderAttributeTypeUuid: 'professional-registration-type',
    clinicianEncounterRoleUuid: 'clinician-role',
    responsibleEncounterTypeUuid: 'visit-note-type',
    responsibleFormUuid: 'visit-note-form',
    concepts,
    ...overrides,
  });
}

describe('outpatient visit summary contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('propagates the server Date header from the verified visit read', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { uuid: 'visit-uuid' },
      headers: { get: (name: string) => (name.toLowerCase() === 'date' ? 'Tue, 26 Aug 2026 14:00:00 GMT' : null) },
    } as unknown as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(fetchOutpatientVisitSummarySource('visit-uuid')).resolves.toMatchObject({
      uuid: 'visit-uuid',
      responseServerDatetime: '2026-08-26T14:00:00.000Z',
    });
  });

  it('enriches only DrugOrder entries when a visit also contains TestOrder entries', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          uuid: 'visit-uuid',
          encounters: [
            {
              uuid: 'encounter-uuid',
              encounterDatetime: '2026-08-26T12:00:00.000Z',
              orders: [
                {
                  uuid: 'drug-order-uuid',
                  drug: { uuid: 'drug-uuid', display: 'Medicamento sintético' },
                  orderType: { uuid: 'drug-order-type', display: 'Drug Order' },
                  dose: 1,
                },
                {
                  uuid: 'test-order-uuid',
                  orderType: { uuid: 'test-order-type', display: 'Test Order' },
                },
              ],
            },
          ],
        },
        headers: { get: () => 'Tue, 26 Aug 2026 14:00:00 GMT' },
      } as unknown as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({
        data: {
          uuid: 'drug-uuid',
          display: 'Medicamento sintético',
          strength: '100 mg',
        },
      } as unknown as Awaited<ReturnType<typeof openmrsFetch>>);

    const result = await fetchOutpatientVisitSummarySource('visit-uuid');

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls[0]?.[0]).not.toContain('drug:(');
    expect(mockOpenmrsFetch.mock.calls[1]?.[0]).toContain('/drug/drug-uuid?');
    const orders = result.encounters?.[0]?.orders;
    expect(orders?.[0]).toEqual(
      expect.objectContaining({
        uuid: 'drug-order-uuid',
        drug: expect.objectContaining({ display: 'Medicamento sintético', strength: '100 mg' }),
        dose: 1,
      }),
    );
    expect(orders?.[1]).toEqual(expect.objectContaining({ uuid: 'test-order-uuid' }));
    expect(orders?.[1]).not.toHaveProperty('drug');
  });

  it('preserves verified facility contact details for printable documents', () => {
    const summary = build({
      facilityAddress: 'Distrito de prueba, provincia de prueba, Loreto',
      facilityPhone: '900 000 000',
      facilityIpressCode: '00000000',
    });

    expect(summary).toMatchObject({
      facilityAddress: 'Distrito de prueba, provincia de prueba, Loreto',
      facilityPhone: '900 000 000',
      facilityIpressCode: '00000000',
    });
  });

  it('uses a balanced exact-visit representation with diagnoses and encounter orders', () => {
    const representation = getVisitSummaryRepresentationForTesting();
    expect(representation.split('(')).toHaveLength(representation.split(')').length);
    expect(representation).toContain('patient:(uuid)');
    expect(representation).toContain('attributes:(uuid,voided,value,attributeType:(uuid))');
    expect(representation).toContain('encounterType:(uuid),form:(uuid)');
    expect(representation).toContain('provider:(uuid,display,attributes:(');
    expect(representation).toContain('encounterRole:(uuid,display)');
    expect(representation).toContain('conceptReferenceTerm:(code,conceptSource:(name,display))');
    expect(representation).toContain('diagnoses:(');
    expect(representation).toContain('orders:FULL');
    expect(representation).not.toContain('orders:(');
    expect(representation).not.toContain('drug:(');
    expect(representation).not.toContain('asNeeded');
    expect(representation).not.toContain('numRefills');
  });

  it('extracts only active appointment links of the configured visit attribute type', () => {
    expect(
      getLinkedAppointmentUuids(
        {
          ...source,
          attributes: [
            {
              uuid: 'active-link',
              value: ' appointment-uuid ',
              attributeType: { uuid: 'appointment-link-type' },
            },
            {
              uuid: 'duplicate-link',
              value: 'APPOINTMENT-UUID',
              attributeType: { uuid: 'APPOINTMENT-LINK-TYPE' },
            },
            {
              uuid: 'voided-link',
              voided: true,
              value: 'voided-appointment',
              attributeType: { uuid: 'appointment-link-type' },
            },
            {
              uuid: 'other-attribute',
              value: 'other-appointment',
              attributeType: { uuid: 'other-type' },
            },
            {
              uuid: 'empty-link',
              value: '   ',
              attributeType: { uuid: 'appointment-link-type' },
            },
          ],
        },
        'appointment-link-type',
      ),
    ).toEqual(['APPOINTMENT-UUID']);
  });

  it('maps only the verified visit into the patient report', () => {
    const summary = build();

    expect(summary.patient.name).toBe('Paciente Sintético');
    expect(summary.providers).toEqual(['Dra. Demo']);
    expect(summary).toMatchObject({
      clinicalEncounterDatetime: '2026-08-23T14:10:00.000-05:00',
      clinicalRecordCompleteness: 'canonical-complete',
      clinicalRecordIssues: [],
      responsibleProviderUuid: 'provider-uuid',
      responsibleProvider: 'Dra. Demo',
      responsibleProfessionalRegistration: 'CMP-12345',
    });
    expect(summary.vitals).toMatchObject({
      bloodPressure: '110/70 mmHg',
      weight: '60 kg',
      height: '160 cm',
    });
    expect(summary.anamnesis.chiefComplaint).toBe('Dolor de cabeza');
    expect(summary.anamnesis.biologicalFunctions.summary).toBeNull();
    expect(summary.soap.subjective).toBe('Cefalea de dos días');
    expect(summary.soap.objective).toBeNull();
    expect(summary.physicalExam).toMatchObject({
      generalState: 'Paciente en buen estado general',
      headAndNeck: 'Sin hallazgos de alarma',
    });
    expect(summary.diagnoses).toEqual([
      expect.objectContaining({
        display: 'Cefalea',
        cie10Code: 'R51',
        type: 'D',
      }),
    ]);
    expect(summary.orders).toEqual([
      expect.objectContaining({
        uuid: 'medication-order',
        category: 'medication',
      }),
      expect.objectContaining({
        uuid: 'lab-order',
        category: 'laboratory',
        name: 'Prueba de embarazo',
      }),
    ]);
    expect(summary.hasClinicalContent).toBe(true);
  });

  it('classifies a concept-only Drug Order as a canonical medication order', () => {
    const originalEncounter = source.encounters?.[0];
    if (!originalEncounter) throw new Error('The synthetic fixture requires an encounter.');
    const summary = build({
      source: {
        ...source,
        encounters: [
          {
            ...originalEncounter,
            orders: [
              {
                uuid: 'concept-only-medication',
                concept: { uuid: 'iron-concept', display: 'Hierro' },
                orderType: { uuid: 'drug-order-type', display: 'Drug Order' },
              },
            ],
          },
        ],
      },
    });

    expect(summary.hasRecordedMedicationOrders).toBe(true);
    expect(summary.orders).toEqual([
      expect.objectContaining({
        uuid: 'concept-only-medication',
        category: 'medication',
        name: 'Hierro',
      }),
    ]);
  });

  it('maps a PRN medication and its reason as distinct printable fields', () => {
    const originalEncounter = source.encounters?.[0];
    if (!originalEncounter) throw new Error('The synthetic fixture requires an encounter.');
    const summary = build({
      source: {
        ...source,
        encounters: [
          {
            ...originalEncounter,
            orders: [
              {
                uuid: 'prn-medication',
                drug: { uuid: 'drug-uuid', display: 'Paracetamol 500 mg' },
                orderType: { uuid: 'drug-order-type', display: 'Drug Order' },
                dose: 1,
                doseUnits: { uuid: 'tablet', display: 'tableta' },
                asNeeded: true,
                asNeededCondition: 'Dolor o fiebre',
              },
            ],
          },
        ],
      },
    });

    expect(summary.orders).toEqual([
      expect.objectContaining({
        uuid: 'prn-medication',
        asNeeded: true,
        asNeededCondition: 'Dolor o fiebre',
        details: '1 tableta',
      }),
    ]);
  });

  it('maps the medication indication and zero refills without conflating them', () => {
    const originalEncounter = source.encounters?.[0];
    if (!originalEncounter) throw new Error('The synthetic fixture requires an encounter.');
    const summary = build({
      source: {
        ...source,
        encounters: [
          {
            ...originalEncounter,
            orders: [
              {
                uuid: 'medication-with-instructions',
                drug: { uuid: 'drug-uuid', display: 'Paracetamol 500 mg' },
                orderType: { uuid: 'drug-order-type', display: 'Drug Order' },
                orderReasonNonCoded: ' Cefalea ',
                numRefills: 0,
              },
            ],
          },
        ],
      },
    });

    expect(summary.orders).toEqual([
      expect.objectContaining({
        uuid: 'medication-with-instructions',
        orderReasonNonCoded: 'Cefalea',
        numRefills: 0,
      }),
    ]);
  });

  it('does not carry a stale PRN reason when the medication is not marked as needed', () => {
    const originalEncounter = source.encounters?.[0];
    if (!originalEncounter) throw new Error('The synthetic fixture requires an encounter.');
    const summary = build({
      source: {
        ...source,
        encounters: [
          {
            ...originalEncounter,
            orders: [
              {
                uuid: 'scheduled-medication',
                drug: { uuid: 'drug-uuid', display: 'Amoxicilina 500 mg' },
                orderType: { uuid: 'drug-order-type', display: 'Drug Order' },
                asNeeded: false,
                asNeededCondition: 'Texto obsoleto que no debe imprimirse',
              },
            ],
          },
        ],
      },
    });

    expect(summary.orders).toEqual([
      expect.objectContaining({
        uuid: 'scheduled-medication',
        asNeeded: false,
        asNeededCondition: null,
      }),
    ]);
  });

  it.each([
    ['voided', { voided: true }],
    ['voided in FULL representation', { auditInfo: { dateVoided: '2026-08-26T12:30:00.000Z' } }],
    ['discontinued', { action: 'DISCONTINUE' }],
  ] as const)('remembers a %s canonical medication order without printing it as active', (_label, state) => {
    const originalEncounter = source.encounters?.[0];
    if (!originalEncounter) throw new Error('The synthetic fixture requires an encounter.');
    const summary = build({
      source: {
        ...source,
        encounters: [
          {
            ...originalEncounter,
            orders: [
              {
                uuid: `${_label}-medication`,
                drug: { uuid: 'drug-uuid', display: 'Medicamento sintético' },
                orderType: { uuid: 'drug-order-type', display: 'Drug Order' },
                ...state,
              },
            ],
          },
        ],
      },
    });

    expect(summary.hasRecordedMedicationOrders).toBe(true);
    expect(summary.orders).toEqual([]);
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

  it('marks an ambiguous canonical encounter incomplete and keeps missing colegiatura manual', () => {
    const canonicalEncounter = source.encounters?.[0];
    if (!canonicalEncounter) throw new Error('The synthetic fixture requires an encounter.');
    const ambiguous = build({
      source: {
        ...source,
        encounters: [canonicalEncounter, { ...canonicalEncounter, uuid: 'duplicate-canonical-encounter' }],
      },
    });
    const withoutRegistration = build({
      source: {
        ...source,
        encounters: [
          {
            ...canonicalEncounter,
            encounterProviders: canonicalEncounter.encounterProviders?.map((entry) => ({
              ...entry,
              provider: entry.provider ? { ...entry.provider, attributes: [] } : undefined,
            })),
          },
        ],
      },
    });

    expect(ambiguous).toMatchObject({
      clinicalEncounterDatetime: null,
      clinicalRecordCompleteness: 'canonical-incomplete',
      clinicalRecordIssues: ['canonical-encounter-ambiguous'],
      responsibleProviderUuid: null,
      responsibleProvider: null,
      responsibleProfessionalRegistration: null,
    });
    expect(withoutRegistration).toMatchObject({
      clinicalRecordCompleteness: 'canonical-complete',
      responsibleProviderUuid: 'provider-uuid',
      responsibleProvider: 'Dra. Demo',
      responsibleProfessionalRegistration: null,
    });
  });

  it('marks a visit without the canonical encounter as legacy without inventing date or professional', () => {
    const legacy = build({
      source: {
        ...source,
        encounters: source.encounters?.map((encounter) => ({ ...encounter, form: { uuid: 'legacy-form' } })),
      },
    });

    expect(legacy).toMatchObject({
      clinicalEncounterDatetime: null,
      clinicalRecordCompleteness: 'legacy',
      clinicalRecordIssues: ['canonical-encounter-missing'],
      responsibleProviderUuid: null,
      responsibleProvider: null,
    });
  });

  it('uses exactly one provider in the configured clinician role and ignores other roles', () => {
    const canonicalEncounter = source.encounters?.[0];
    const clinician = canonicalEncounter?.encounterProviders?.[0];
    if (!canonicalEncounter || !clinician) throw new Error('The synthetic fixture requires a clinician.');
    const summary = build({
      source: {
        ...source,
        encounters: [
          {
            ...canonicalEncounter,
            encounterProviders: [
              clinician,
              {
                uuid: 'nurse-entry',
                encounterRole: { uuid: 'nurse-role', display: 'Nurse' },
                provider: {
                  uuid: 'nurse-provider',
                  person: { uuid: 'nurse-person', display: 'Enf. Apoyo' },
                },
              },
            ],
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      clinicalRecordCompleteness: 'canonical-complete',
      responsibleProviderUuid: 'provider-uuid',
      responsibleProvider: 'Dra. Demo',
    });
  });

  it('does not let a provider from another encounter role sign as the responsible clinician', () => {
    const canonicalEncounter = source.encounters?.[0];
    const clinician = canonicalEncounter?.encounterProviders?.[0];
    if (!canonicalEncounter || !clinician) throw new Error('The synthetic fixture requires a clinician.');
    const summary = build({
      source: {
        ...source,
        encounters: [
          {
            ...canonicalEncounter,
            encounterProviders: [{ ...clinician, encounterRole: { uuid: 'nurse-role', display: 'Nurse' } }],
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      clinicalRecordCompleteness: 'canonical-incomplete',
      clinicalRecordIssues: ['responsible-provider-missing-or-ambiguous'],
      responsibleProviderUuid: null,
      responsibleProvider: null,
    });
  });

  it.each([
    ['zero', []],
    [
      'more than one',
      [
        {
          uuid: 'second-clinician-entry',
          encounterRole: { uuid: 'clinician-role', display: 'Clinician' },
          provider: {
            uuid: 'second-clinician-provider',
            person: { uuid: 'second-clinician-person', display: 'Dr. Segundo' },
          },
        },
      ],
    ],
  ] as const)('does not assign responsibility with %s active clinicians', (_label, additionalClinicians) => {
    const canonicalEncounter = source.encounters?.[0];
    const originalClinician = canonicalEncounter?.encounterProviders?.[0];
    if (!canonicalEncounter || !originalClinician) throw new Error('The synthetic fixture requires a clinician.');
    const encounterProviders = additionalClinicians.length === 0 ? [] : [originalClinician, ...additionalClinicians];
    const summary = build({ source: { ...source, encounters: [{ ...canonicalEncounter, encounterProviders }] } });

    expect(summary).toMatchObject({
      clinicalRecordCompleteness: 'canonical-incomplete',
      clinicalRecordIssues: ['responsible-provider-missing-or-ambiguous'],
      responsibleProviderUuid: null,
      responsibleProvider: null,
    });
  });

  it('marks a canonical primary diagnosis without a structured CIE-10 mapping incomplete', () => {
    const canonicalEncounter = source.encounters?.[0];
    const primaryDiagnosis = canonicalEncounter?.diagnoses?.[0];
    if (!canonicalEncounter || !primaryDiagnosis?.diagnosis?.coded) {
      throw new Error('The synthetic fixture requires a coded primary diagnosis.');
    }
    const summary = build({
      source: {
        ...source,
        encounters: [
          {
            ...canonicalEncounter,
            diagnoses: [
              {
                ...primaryDiagnosis,
                diagnosis: { coded: { ...primaryDiagnosis.diagnosis.coded, mappings: [] } },
              },
            ],
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      clinicalEncounterDatetime: canonicalEncounter.encounterDatetime,
      clinicalRecordCompleteness: 'canonical-incomplete',
      clinicalRecordIssues: ['primary-diagnosis-cie10-mapping-missing'],
      responsibleProvider: 'Dra. Demo',
    });
  });

  it('accepts the structured CIE-10 source display when its source name is empty', () => {
    const canonicalEncounter = source.encounters?.[0];
    const primaryDiagnosis = canonicalEncounter?.diagnoses?.[0];
    if (!canonicalEncounter || !primaryDiagnosis?.diagnosis?.coded) {
      throw new Error('The synthetic fixture requires a coded primary diagnosis.');
    }
    const summary = build({
      source: {
        ...source,
        encounters: [
          {
            ...canonicalEncounter,
            diagnoses: [
              {
                ...primaryDiagnosis,
                diagnosis: {
                  coded: {
                    ...primaryDiagnosis.diagnosis.coded,
                    mappings: [
                      {
                        conceptReferenceTerm: {
                          code: 'R51-MINSA',
                          conceptSource: { name: '   ', display: 'CIE-10' },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    });

    expect(summary).toMatchObject({ clinicalRecordCompleteness: 'canonical-complete' });
    expect(summary.diagnoses[0].cie10Code).toBe('R51-MINSA');
  });

  it('marks more than one primary diagnosis in the canonical encounter incomplete', () => {
    const canonicalEncounter = source.encounters?.[0];
    const primaryDiagnosis = canonicalEncounter?.diagnoses?.[0];
    if (!canonicalEncounter || !primaryDiagnosis) throw new Error('The synthetic fixture requires a diagnosis.');
    const summary = build({
      source: {
        ...source,
        encounters: [
          {
            ...canonicalEncounter,
            diagnoses: [primaryDiagnosis, { ...primaryDiagnosis, uuid: 'second-primary-diagnosis' }],
          },
        ],
      },
    });

    expect(summary).toMatchObject({
      clinicalRecordCompleteness: 'canonical-incomplete',
      clinicalRecordIssues: ['primary-diagnosis-missing-or-ambiguous'],
    });
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

import type { OutpatientVisitSummary } from './outpatient-visit-summary.resource';
import {
  createInstitutionalReferralFileName,
  createInstitutionalReferralPdf,
  type InstitutionalReferralPdfData,
} from './institutional-referral-pdf';

const summary: OutpatientVisitSummary = {
  visitUuid: 'visit-uuid',
  patient: {
    uuid: 'synthetic-patient',
    name: 'Paciente Sintético',
    identifiers: [{ label: 'DNI', value: '00000000' }],
    birthDate: '1990-01-01',
    gender: 'Femenino',
    address: 'Distrito sintético, Loreto',
  },
  facilityName: 'Hospital Santa Clotilde',
  visitType: 'Atención Ambulatoria',
  visitStart: '2026-08-25T09:00:00.000-05:00',
  visitEnd: null,
  location: 'Consulta Externa',
  providers: ['Dra. Sintética'],
  vitals: {
    bloodPressure: '110/70 mmHg',
    temperature: '36.5 °C',
    oxygenSaturation: '99 %',
    weight: null,
    height: null,
    pulse: '70 lpm',
    respiratoryRate: '18 rpm',
    bmi: null,
  },
  anamnesis: {
    chiefComplaint: 'Dolor sintético',
    illnessDuration: '2 días',
    onsetType: null,
    course: null,
    narrative: 'Historia clínica sintética',
    biologicalFunctions: {
      summary: null,
      appetite: null,
      thirst: null,
      sleep: null,
      mood: null,
      urine: null,
      bowelMovements: null,
    },
  },
  soap: { subjective: null, objective: 'Hallazgo sintético', assessment: null, plan: null },
  physicalExam: {
    generalState: 'Estable',
    consciousness: null,
    skinAndAppendages: null,
    headAndNeck: null,
    respiratory: null,
    cardiovascular: null,
    abdomenAndDigestive: null,
    genitourinary: null,
    musculoskeletal: null,
    neurological: null,
    otherFindings: null,
  },
  diagnoses: [{ uuid: 'diagnosis', display: 'Diagnóstico sintético', cie10Code: 'Z00.0', rank: 1, type: 'D' }],
  treatment: {
    therapeuticIndications: 'Tratamiento sintético',
    procedures: null,
    referral: null,
    nextAppointment: null,
    legacyLabOrders: null,
    legacyPrescriptions: null,
  },
  orders: [],
  hasRecordedMedicationOrders: false,
  hasClinicalContent: true,
};

const data: InstitutionalReferralPdfData = {
  summary,
  referral: {
    uuid: 'referral-uuid-12345678',
    encounterDatetime: '2026-08-25T10:00:00.000-05:00',
    destinationName: 'Hospital Regional de Loreto',
    destinationRenaesCode: '00000003',
    specialty: 'Cirugía',
    priority: 'Urgencia',
    patientCondition: 'Estable',
    transportMode: 'Fluvial',
    reason: 'Manejo especializado',
  },
  originRenaesCode: '00000066',
  insurance: { payer: 'SIS', number: 'SIS-SINTETICO' },
};

describe('institutional referral PDF', () => {
  it('creates a printable PDF from referral data and the canonical visit summary', async () => {
    const bytes = await createInstitutionalReferralPdf(data, 'es-PE');
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toMatch(/^%PDF-/);
    const { PDFDocument } = await import('pdf-lib');
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(bytes.byteLength).toBeGreaterThan(2_000);
  });

  it('keeps patient identifiers out of the file name', () => {
    const fileName = createInstitutionalReferralFileName(data.referral.encounterDatetime, data.referral.uuid);
    expect(fileName).toBe('hoja-referencia-institucional-2026-08-25-12345678.pdf');
    expect(fileName).not.toContain('00000000');
  });
});

import type { OutpatientVisitSummary } from './outpatient-visit-summary.resource';
import {
  createOutpatientVisitSummaryFileName,
  createOutpatientVisitSummaryPdf,
  downloadOutpatientVisitSummaryPdf,
  type OutpatientVisitSummaryPdfLabels,
} from './outpatient-visit-summary-pdf';

const labels = new Proxy(
  {},
  {
    get: (_target, property) => String(property),
  },
) as OutpatientVisitSummaryPdfLabels;

const summary: OutpatientVisitSummary = {
  visitUuid: 'visit-uuid-12345678',
  patient: {
    uuid: 'patient-uuid',
    name: 'Paciente Sintético Ñá',
    identifiers: [{ label: 'DNI', value: '00000000' }],
    birthDate: '1990-01-01',
    gender: 'female',
  },
  facilityName: 'IPRESS Sintética',
  visitType: 'Atención Ambulatoria',
  visitStart: '2026-08-23T14:00:00.000-05:00',
  visitEnd: null,
  location: 'Consulta Externa',
  providers: ['Dra. Demo'],
  vitals: {
    bloodPressure: '110/70 mmHg',
    temperature: '36.5 °C',
    oxygenSaturation: '99 %',
    weight: '60 kg',
    height: '160 cm',
    pulse: '70 lpm',
    respiratoryRate: '18 rpm',
    bmi: '23.4',
  },
  anamnesis: {
    chiefComplaint: 'Dolor de cabeza',
    illnessDuration: '2 días',
    onsetType: 'Insidioso',
    course: 'Estacionario',
    narrative: 'Narrativa sintética '.repeat(100),
    biologicalFunctions: {
      summary: 'Conservadas',
      appetite: 'Conservado',
      thirst: null,
      sleep: null,
      mood: null,
      urine: null,
      bowelMovements: null,
    },
  },
  soap: { subjective: 'Subjetivo', objective: 'Objetivo', assessment: 'Apreciación', plan: 'Plan' },
  diagnoses: [{ uuid: 'diagnosis', display: 'Cefalea', cie10Code: 'R51', rank: 1, type: 'D' }],
  treatment: {
    therapeuticIndications: 'Hidratación',
    procedures: null,
    referral: null,
    nextAppointment: '2026-08-30',
    legacyLabOrders: null,
    legacyPrescriptions: null,
  },
  orders: [{ uuid: 'order', category: 'medication', name: 'Paracetamol', details: '500 mg', orderer: 'Dra. Demo' }],
  hasClinicalContent: true,
};

describe('outpatient visit summary PDF', () => {
  it('creates a valid multi-section PDF in the browser-compatible library', async () => {
    const bytes = await createOutpatientVisitSummaryPdf(summary, labels, 'es-PE');
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toMatch(/^%PDF-/);
    expect(bytes.byteLength).toBeGreaterThan(1_000);
  });

  it('paginates a single long clinical field instead of drawing it below the page', async () => {
    const longSummary: OutpatientVisitSummary = {
      ...summary,
      anamnesis: {
        ...summary.anamnesis,
        narrative: Array.from({ length: 180 }, (_, index) => `Línea clínica sintética ${index + 1}`).join('\n'),
      },
    };

    const bytes = await createOutpatientVisitSummaryPdf(longSummary, labels, 'es-PE');
    const { PDFDocument } = await import('pdf-lib');
    const document = await PDFDocument.load(bytes);

    expect(document.getPageCount()).toBeGreaterThanOrEqual(5);
  });

  it('uses only visit metadata in the filename, never patient identifiers', () => {
    const fileName = createOutpatientVisitSummaryFileName(summary.visitUuid, summary.visitStart);
    expect(fileName).toBe('informe-consulta-externa-2026-08-23-12345678.pdf');
    expect(fileName).not.toContain('00000000');
    expect(fileName).not.toContain('Paciente');
  });

  it('keeps the visit local date in the filename instead of shifting it to UTC', () => {
    expect(createOutpatientVisitSummaryFileName('visit-uuid-12345678', '2026-08-23T23:30:00.000-05:00')).toBe(
      'informe-consulta-externa-2026-08-23-12345678.pdf',
    );
  });

  it('downloads and always revokes the local object URL', () => {
    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    const appendChild = vi.spyOn(document.body, 'appendChild');
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    downloadOutpatientVisitSummaryPdf(new Uint8Array([1, 2, 3]), 'report.pdf');

    expect(appendChild).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic');
  });
});

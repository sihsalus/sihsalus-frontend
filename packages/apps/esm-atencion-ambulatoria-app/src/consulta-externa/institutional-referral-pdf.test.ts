import { expect } from 'vitest';
import {
  createInstitutionalReferralFileName,
  createInstitutionalReferralPdf,
  type InstitutionalReferralPdfData,
} from './institutional-referral-pdf';
import type { OutpatientVisitSummary } from './outpatient-visit-summary.resource';

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
  sourceServerDatetime: '2026-08-25T15:00:00.000Z',
  location: 'Consulta Externa',
  clinicalEncounterDatetime: '2026-08-25T09:10:00.000-05:00',
  clinicalRecordCompleteness: 'canonical-complete',
  clinicalRecordIssues: [],
  responsibleProviderUuid: 'provider-uuid',
  responsibleProvider: 'Dra. Sintética',
  responsibleProfessionalRegistration: 'CMP-12345',
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
  legacyNotes: { narrative: null, physicalExam: 'Hallazgo sintético' },
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
    originService: 'UPSS Emergencia',
    destinationService: 'Apoyo al Diagnóstico',
    specialty: 'Cirugía',
    priority: 'Urgencia',
    patientCondition: 'Estable',
    transportMode: 'Fluvial',
    reason: 'Manejo especializado',
  },
  originRenaesCode: '00000066',
  insurance: { payer: 'SIS', number: 'SIS-SINTETICO' },
};

async function renderRecordedPdf(input: InstitutionalReferralPdfData) {
  const { PDFDocument, PDFPage } = await import('pdf-lib');
  const draw = vi.spyOn(PDFPage.prototype, 'drawText');
  try {
    const bytes = await createInstitutionalReferralPdf(input, 'es-PE');
    const document = await PDFDocument.load(bytes);
    return {
      pageCount: document.getPageCount(),
      text: draw.mock.calls.map(([text]) => text),
      drawing: draw.mock.calls.map(([text, options], index) => {
        const { x, y, size, font } = options ?? {};
        if (typeof x !== 'number' || typeof y !== 'number' || typeof size !== 'number' || !font) {
          throw new Error('The PDF drawing must provide its position, font and size.');
        }
        return { text, options: { x, y, size, font }, page: draw.mock.contexts[index] };
      }),
    };
  } finally {
    draw.mockRestore();
  }
}

function expectTextInsidePage(drawing: Awaited<ReturnType<typeof renderRecordedPdf>>['drawing']) {
  for (const { text, options } of drawing) {
    const { x, y, size, font } = options;
    expect(x, text).toBeGreaterThanOrEqual(30);
    expect(x + font.widthOfTextAtSize(text, size), text).toBeLessThanOrEqual(565.29);
    expect(y, text).toBeGreaterThanOrEqual(text.startsWith('SIH Salus · Página ') ? 16 : 48);
    expect(y + size, text).toBeLessThanOrEqual(841.89);
  }
}

describe('institutional referral PDF', () => {
  it.each(['Presión ≤ 90; SpO₂ ≥ 95', 'Paciente 中', 'Texto con emoji 🩺', 'Acento combinado e\u0301'])(
    'rejects unsupported text instead of replacing it: %s',
    async (reason) => {
      await expect(
        createInstitutionalReferralPdf({ ...data, referral: { ...data.referral, reason } }).then(() => 'PDF generated'),
      ).rejects.toMatchObject({ name: 'OutpatientPdfUnsupportedCharacterError' });
    },
  );

  it('keeps supported accented characters, operators and punctuation unchanged', async () => {
    const reason = 'Evaluación: presión < 90 / > 60; temperatura 37,5 °C; variación ± 2; niño — revisión.';
    const { text } = await renderRecordedPdf({ ...data, referral: { ...data.referral, reason } });
    expect(text.join(' ')).toContain(reason);
  });

  it('preserves every line in both columns without overlapping adjacent fields', async () => {
    const priority = Array.from({ length: 90 }, (_, index) => `Prioridad sintética ${index}`).join('\n');
    const specialty = Array.from({ length: 120 }, (_, index) => `Especialidad sintética ${index}`).join('\n');
    const { text, drawing, pageCount } = await renderRecordedPdf({
      ...data,
      referral: { ...data.referral, priority, specialty },
    });
    for (const line of [...priority.split('\n'), ...specialty.split('\n')]) {
      expect(
        text.filter((rendered) => rendered === line),
        line,
      ).toHaveLength(1);
    }
    expect(pageCount).toBeGreaterThan(2);
    expectTextInsidePage(drawing);
    for (let index = 0; index < drawing.length; index++) {
      const first = drawing[index];
      const firstOptions = first.options;
      const right = firstOptions.x + firstOptions.font.widthOfTextAtSize(first.text, firstOptions.size);
      for (const second of drawing.slice(index + 1)) {
        if (first.page !== second.page || !first.text || !second.text) continue;
        const secondOptions = second.options;
        const secondRight = secondOptions.x + secondOptions.font.widthOfTextAtSize(second.text, secondOptions.size);
        const horizontalOverlap = firstOptions.x < secondRight && secondOptions.x < right;
        const verticalOverlap =
          firstOptions.y < secondOptions.y + secondOptions.size && secondOptions.y < firstOptions.y + firstOptions.size;
        expect(horizontalOverlap && verticalOverlap, `${first.text} / ${second.text}`).toBe(false);
      }
    }
  });

  it('paginates a clinical field longer than a page and retains the last line above the footer', async () => {
    const lines = Array.from({ length: 160 }, (_, index) => `Línea clínica sintética ${index}`);
    const { text, drawing, pageCount } = await renderRecordedPdf({
      ...data,
      referral: { ...data.referral, reason: lines.join('\n') },
    });
    for (const line of lines)
      expect(
        text.filter((rendered) => rendered === line),
        line,
      ).toHaveLength(1);
    expect(pageCount).toBeGreaterThan(3);
    expect(text.filter((value) => value === 'Motivo y detalle:').length).toBeGreaterThan(1);
    expectTextInsidePage(drawing);
    expect(text.filter((value) => value.startsWith('SIH Salus · Página '))).toHaveLength(pageCount);
  });

  it('wraps unbroken text in full-width and two-column fields without losing characters', async () => {
    const reason = 'A'.repeat(2000);
    const specialty = 'Z'.repeat(800);
    const { text, drawing } = await renderRecordedPdf({
      ...data,
      referral: { ...data.referral, reason, specialty },
    });
    expect(text.filter((value) => /^A+$/.test(value)).join('')).toBe(reason);
    expect(text.filter((value) => /^Z+$/.test(value)).join('')).toBe(specialty);
    expectTextInsidePage(drawing);
  });

  it('prints the recorded origin and destination services independently of priority and specialty', async () => {
    const { PDFPage } = await import('pdf-lib');
    const draw = vi.spyOn(PDFPage.prototype, 'drawText');
    try {
      await createInstitutionalReferralPdf(data, 'es-PE');
      const text = draw.mock.calls.map(([value]) => value);
      expect(text).toContain('UPSS Emergencia');
      expect(text).toContain('Apoyo al Diagnóstico');
      expect(text).not.toContain('Consulta Externa');
      expect(text).toContain('Cirugía');
    } finally {
      draw.mockRestore();
    }
  });

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

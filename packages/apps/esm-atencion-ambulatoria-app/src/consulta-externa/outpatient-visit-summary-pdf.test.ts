import type { OutpatientScheduledAppointment } from './outpatient-next-appointment.resource';
import type { OutpatientVisitSummary } from './outpatient-visit-summary.resource';
import {
  createOutpatientPatientInstructionsFileName,
  createOutpatientPatientInstructionsPdf,
  createOutpatientVisitSummaryFileName,
  createOutpatientVisitSummaryPdf,
  downloadOutpatientVisitSummaryPdf,
  hasOutpatientPatientInstructions,
  type OutpatientPatientInstructionsPdfLabels,
  type OutpatientVisitSummaryPdfLabels,
} from './outpatient-visit-summary-pdf';

const labels = new Proxy(
  {},
  {
    get: (_target, property) => String(property),
  },
) as OutpatientVisitSummaryPdfLabels;

const patientInstructionsLabels: OutpatientPatientInstructionsPdfLabels = {
  title: 'Indicaciones para el paciente',
  patient: 'Paciente',
  identifiers: 'Identificadores',
  careDetails: 'Datos de la atención',
  visitDate: 'Fecha y hora de atención',
  location: 'Lugar de atención',
  professional: 'Personal de salud responsable',
  scheduledAppointment: 'Próxima cita programada',
  scheduledAppointmentDate: 'Fecha y hora',
  scheduledAppointmentService: 'Servicio',
  scheduledAppointmentLocation: 'Lugar',
  scheduledAppointmentProfessional: 'Profesional',
  instructions: 'Indicaciones',
  indicatedFollowUpDate: 'Fecha de control indicada',
  therapeuticIndications: 'Indicaciones terapéuticas',
  medications: 'Medicamentos indicados',
  legacyPrescriptions: 'Medicamentos indicados',
  signatureAndStamp: 'Firma y sello del profesional responsable',
  generatedAt: 'Generado',
  page: 'Página',
  followUpDateDisclaimer:
    'La fecha de control indicada no confirma una cita programada. Esta hoja no sustituye una receta válida para dispensación.',
};

const scheduledAppointment: OutpatientScheduledAppointment = {
  uuid: 'appointment-uuid',
  startDateTime: '2999-08-30T15:00:00.000Z',
  service: 'Consulta de medicina',
  location: 'Consultorio 1',
  provider: 'Dra. Próxima',
};

const summary: OutpatientVisitSummary = {
  visitUuid: 'visit-uuid-12345678',
  patient: {
    uuid: 'patient-uuid',
    name: 'Paciente Sintético Ñá',
    identifiers: [
      { label: 'DNI', value: '00000000' },
      { label: 'Identificador alterno', value: 'ALT-0001' },
    ],
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
  soap: {
    subjective: 'Subjetivo',
    objective: 'Objetivo',
    assessment: 'Apreciación',
    plan: 'Plan',
  },
  physicalExam: {
    generalState: 'Paciente en buen estado general',
    consciousness: 'Alerta y orientado',
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
  diagnoses: [
    {
      uuid: 'diagnosis',
      display: 'Cefalea',
      cie10Code: 'R51',
      rank: 1,
      type: 'D',
    },
  ],
  treatment: {
    therapeuticIndications: 'Hidratación',
    procedures: null,
    referral: null,
    nextAppointment: '2026-08-30',
    legacyLabOrders: null,
    legacyPrescriptions: null,
  },
  orders: [
    {
      uuid: 'order',
      category: 'medication',
      name: 'Paracetamol',
      details: '500 mg',
      orderer: 'Dra. Demo',
    },
  ],
  hasRecordedMedicationOrders: true,
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

  it('creates a real brief patient-instructions PDF with the scheduled appointment', async () => {
    const bytes = await createOutpatientPatientInstructionsPdf(
      summary,
      patientInstructionsLabels,
      'es-PE',
      scheduledAppointment,
    );
    const { PDFDocument } = await import('pdf-lib');
    const document = await PDFDocument.load(bytes);

    expect(new TextDecoder().decode(bytes.slice(0, 8))).toMatch(/^%PDF-/);
    expect(bytes.byteLength).toBeGreaterThan(1_000);
    expect(document.getPageCount()).toBe(1);
  });

  it('prints the configured facility location, telephone, and IPRESS code in the header', async () => {
    const { PDFPage } = await import('pdf-lib');
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');

    try {
      await createOutpatientPatientInstructionsPdf(
        {
          ...summary,
          facilityAddress: 'Distrito de prueba, provincia de prueba, Loreto',
          facilityPhone: '900 000 000',
          facilityIpressCode: '00000000',
        },
        patientInstructionsLabels,
        'es-PE',
      );
      const renderedText = drawText.mock.calls.map(([text]) => text).join('\n');

      expect(renderedText).toContain('Distrito de prueba, provincia de prueba, Loreto');
      expect(renderedText).toContain('Tel. 900 000 000 · IPRESS 00000000');
    } finally {
      drawText.mockRestore();
    }
  });

  it('omits an appointment that is no longer upcoming when the PDF is rendered', async () => {
    const { PDFPage } = await import('pdf-lib');
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');

    try {
      await createOutpatientPatientInstructionsPdf(summary, patientInstructionsLabels, 'es-PE', {
        ...scheduledAppointment,
        startDateTime: '2000-01-01T00:00:00.000Z',
      });
      const renderedText = drawText.mock.calls.map(([text]) => text).join('\n');

      expect(renderedText).not.toContain('Próxima cita programada');
      expect(renderedText).not.toContain('Consulta de medicina');
    } finally {
      drawText.mockRestore();
    }
  });

  it('fails closed instead of replacing an unsupported clinical character', async () => {
    await expect(
      createOutpatientPatientInstructionsPdf(
        {
          ...summary,
          treatment: {
            ...summary.treatment,
            therapeuticIndications: 'Administrar ≤5 mL por dosis',
          },
        },
        patientInstructionsLabels,
        'es-PE',
      ),
    ).rejects.toMatchObject({ name: 'OutpatientPdfUnsupportedCharacterError' });
  });

  it('prints the real appointment separately and prefers canonical medication orders over legacy prescriptions', async () => {
    const summaryWithLegacy = {
      ...summary,
      treatment: {
        ...summary.treatment,
        legacyPrescriptions: 'LEGACY QUE NO DEBE IMPRIMIRSE',
      },
    };
    const { PDFPage } = await import('pdf-lib');
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');

    try {
      await createOutpatientPatientInstructionsPdf(
        summaryWithLegacy,
        patientInstructionsLabels,
        'es-PE',
        scheduledAppointment,
      );
      const renderedText = drawText.mock.calls.map(([text]) => text).join('\n');

      expect(renderedText).toContain('Próxima cita programada');
      expect(renderedText).toContain('Consulta de medicina');
      expect(renderedText).toContain('Consultorio 1');
      expect(renderedText).toContain('Dra. Próxima');
      expect(renderedText).toContain('Fecha de control indicada');
      expect(renderedText).toContain('Medicamentos indicados');
      expect(renderedText).toContain('Firma y sello del profesional responsable');
      expect(renderedText).toContain('Paracetamol');
      expect(renderedText).toContain('500 mg');
      expect(renderedText).toContain('DNI: 00000000');
      expect(renderedText).not.toContain('ALT-0001');
      expect(renderedText).not.toContain('LEGACY QUE NO DEBE IMPRIMIRSE');
      expect(renderedText).toContain('no confirma una cita programada');
      expect(renderedText).toContain('no sustituye una receta válida');
    } finally {
      drawText.mockRestore();
    }
  });

  it('uses the legacy prescription only when canonical medication orders are absent', async () => {
    const legacyOnlySummary: OutpatientVisitSummary = {
      ...summary,
      orders: summary.orders.filter((order) => order.category !== 'medication'),
      hasRecordedMedicationOrders: false,
      treatment: {
        ...summary.treatment,
        legacyPrescriptions: 'Receta histórica sintética',
      },
    };
    const { PDFPage } = await import('pdf-lib');
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');

    try {
      await createOutpatientPatientInstructionsPdf(legacyOnlySummary, patientInstructionsLabels, 'es-PE');
      const renderedText = drawText.mock.calls.map(([text]) => text).join('\n');

      expect(renderedText).toContain('Receta histórica sintética');
      expect(renderedText).not.toContain('Paracetamol');
    } finally {
      drawText.mockRestore();
    }
  });

  it('does not revive legacy prescription text after a canonical medication order was removed', async () => {
    const canonicalRemovedSummary: OutpatientVisitSummary = {
      ...summary,
      orders: summary.orders.filter((order) => order.category !== 'medication'),
      hasRecordedMedicationOrders: true,
      treatment: {
        ...summary.treatment,
        legacyPrescriptions: 'RECETA LEGACY ANULADA',
      },
    };
    const { PDFPage } = await import('pdf-lib');
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');

    try {
      await createOutpatientPatientInstructionsPdf(canonicalRemovedSummary, patientInstructionsLabels, 'es-PE');
      const renderedText = drawText.mock.calls.map(([text]) => text).join('\n');

      expect(renderedText).not.toContain('RECETA LEGACY ANULADA');
    } finally {
      drawText.mockRestore();
    }
  });

  it('omits stopped or expired medication orders without falling back to legacy text', async () => {
    const summaryWithEndedMedication: OutpatientVisitSummary = {
      ...summary,
      orders: [
        {
          uuid: 'stopped-medication',
          category: 'medication',
          name: 'Medicamento suspendido',
          details: null,
          orderer: null,
          dateStopped: '2000-01-01T00:00:00.000Z',
        },
        {
          uuid: 'active-medication',
          category: 'medication',
          name: 'Medicamento activo',
          details: 'Una tableta',
          orderer: null,
          autoExpireDate: '2999-01-01T00:00:00.000Z',
        },
      ],
      treatment: {
        ...summary.treatment,
        legacyPrescriptions: 'RECETA HISTÓRICA QUE NO DEBE IMPRIMIRSE',
      },
    };
    const { PDFPage } = await import('pdf-lib');
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');

    try {
      await createOutpatientPatientInstructionsPdf(summaryWithEndedMedication, patientInstructionsLabels, 'es-PE');
      const renderedText = drawText.mock.calls.map(([text]) => text).join('\n');

      expect(renderedText).toContain('Medicamento activo');
      expect(renderedText).not.toContain('Medicamento suspendido');
      expect(renderedText).not.toContain('RECETA HISTÓRICA QUE NO DEBE IMPRIMIRSE');
    } finally {
      drawText.mockRestore();
    }
  });

  it('recognizes only printable patient instructions, including a real scheduled appointment', () => {
    const emptySummary: OutpatientVisitSummary = {
      ...summary,
      treatment: {
        therapeuticIndications: null,
        procedures: 'Procedimiento que no corresponde',
        referral: 'Referencia que no corresponde',
        nextAppointment: null,
        legacyLabOrders: 'Laboratorio que no corresponde',
        legacyPrescriptions: null,
      },
      orders: [
        {
          uuid: 'lab-order',
          category: 'laboratory',
          name: 'Hemograma',
          details: null,
          orderer: null,
        },
      ],
      hasRecordedMedicationOrders: false,
      hasClinicalContent: true,
    };

    expect(hasOutpatientPatientInstructions(emptySummary)).toBe(false);
    expect(
      hasOutpatientPatientInstructions({
        ...emptySummary,
        treatment: {
          ...emptySummary.treatment,
          nextAppointment: 'En dos semanas',
        },
      }),
    ).toBe(true);
    expect(
      hasOutpatientPatientInstructions({
        ...emptySummary,
        hasRecordedMedicationOrders: true,
        orders: [
          {
            uuid: 'expired-medication-order',
            category: 'medication',
            name: 'Medicamento vencido',
            details: null,
            orderer: null,
            autoExpireDate: '2000-01-01T00:00:00.000Z',
          },
        ],
        treatment: {
          ...emptySummary.treatment,
          legacyPrescriptions: 'Receta histórica que no debe reemplazar la orden canónica',
        },
      }),
    ).toBe(false);
    expect(
      hasOutpatientPatientInstructions({
        ...emptySummary,
        treatment: {
          ...emptySummary.treatment,
          therapeuticIndications: 'Mantener hidratación',
        },
      }),
    ).toBe(true);
    expect(
      hasOutpatientPatientInstructions({
        ...emptySummary,
        orders: [
          {
            uuid: 'medication-order',
            category: 'medication',
            name: 'Paracetamol',
            details: null,
            orderer: null,
          },
        ],
      }),
    ).toBe(true);
    expect(
      hasOutpatientPatientInstructions({
        ...emptySummary,
        treatment: {
          ...emptySummary.treatment,
          legacyPrescriptions: 'Receta histórica',
        },
      }),
    ).toBe(true);
    expect(hasOutpatientPatientInstructions(emptySummary, scheduledAppointment)).toBe(true);
  });

  it('uses only visit metadata in the filename, never patient identifiers', () => {
    const fileName = createOutpatientVisitSummaryFileName(summary.visitUuid, summary.visitStart);
    expect(fileName).toBe('resumen-atencion-ambulatoria-2026-08-23-12345678.pdf');
    expect(fileName).not.toContain('00000000');
    expect(fileName).not.toContain('Paciente');
  });

  it('keeps the visit local date in the filename instead of shifting it to UTC', () => {
    expect(createOutpatientVisitSummaryFileName('visit-uuid-12345678', '2026-08-23T23:30:00.000-05:00')).toBe(
      'resumen-atencion-ambulatoria-2026-08-23-12345678.pdf',
    );
  });

  it('creates a patient-instructions filename without patient or visit identifiers', () => {
    const fileName = createOutpatientPatientInstructionsFileName(summary.visitUuid, summary.visitStart);

    expect(fileName).toBe('indicaciones-para-el-paciente-2026-08-23.pdf');
    expect(fileName).not.toContain(summary.visitUuid);
    expect(fileName).not.toContain('12345678');
    expect(fileName).not.toContain('00000000');
    expect(fileName).not.toContain('Paciente');
    expect(fileName).not.toContain('Paracetamol');
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

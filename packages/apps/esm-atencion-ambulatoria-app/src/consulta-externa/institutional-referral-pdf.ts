import type { PDFFont, PDFPage, RGB } from 'pdf-lib';
import type { OutpatientVisitSummary } from './outpatient-visit-summary.resource';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 30;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 7.5;
const LINE_HEIGHT = 10.5;

export interface InstitutionalReferralPdfData {
  summary: OutpatientVisitSummary;
  referral: {
    uuid: string;
    encounterDatetime: string;
    destinationName: string;
    destinationRenaesCode: string | null;
    specialty: string | null;
    priority: string | null;
    patientCondition: string | null;
    transportMode: string | null;
    reason: string | null;
  };
  originRenaesCode: string;
  insurance: {
    payer: string | null;
    number: string | null;
  };
}

interface PdfState {
  document: import('pdf-lib').PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  text: RGB;
  line: RGB;
  y: number;
}

function safeText(value: string, font: PDFFont): string {
  return [...value]
    .map((character) => {
      try {
        font.encodeText(character);
        return character;
      } catch {
        return '?';
      }
    })
    .join('');
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  return value.split(/\r?\n/).flatMap((paragraph) => {
    const words = safeText(paragraph, font).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  });
}

function addPage(state: PdfState): void {
  state.page = state.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  state.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(state: PdfState, height: number): void {
  if (state.y - height < MARGIN + 18) addPage(state);
}

function drawSectionHeader(state: PdfState, title: string): void {
  ensureSpace(state, 20);
  state.page.drawRectangle({
    x: MARGIN,
    y: state.y - 14,
    width: CONTENT_WIDTH,
    height: 16,
    borderColor: state.line,
    borderWidth: 0.8,
    color: undefined,
  });
  state.page.drawText(safeText(title.toUpperCase(), state.bold), {
    x: MARGIN + 5,
    y: state.y - 9.5,
    size: 8.5,
    font: state.bold,
    color: state.text,
  });
  state.y -= 18;
}

function drawField(state: PdfState, label: string, value: string | null | undefined, minHeight = 15): void {
  const displayValue = value?.trim() || '—';
  const labelText = `${label}:`;
  const labelWidth = Math.min(state.bold.widthOfTextAtSize(labelText, BODY_SIZE) + 8, CONTENT_WIDTH * 0.36);
  const lines = wrapText(displayValue, state.regular, BODY_SIZE, CONTENT_WIDTH - labelWidth - 10);
  const height = Math.max(minHeight, lines.length * LINE_HEIGHT + 5);
  ensureSpace(state, height);
  state.page.drawRectangle({
    x: MARGIN,
    y: state.y - height,
    width: CONTENT_WIDTH,
    height,
    borderColor: state.line,
    borderWidth: 0.5,
  });
  state.page.drawLine({
    start: { x: MARGIN + labelWidth, y: state.y },
    end: { x: MARGIN + labelWidth, y: state.y - height },
    thickness: 0.5,
    color: state.line,
  });
  state.page.drawText(safeText(labelText, state.bold), {
    x: MARGIN + 4,
    y: state.y - 10,
    size: BODY_SIZE,
    font: state.bold,
    color: state.text,
  });
  lines.forEach((line, index) => {
    state.page.drawText(line, {
      x: MARGIN + labelWidth + 5,
      y: state.y - 10 - index * LINE_HEIGHT,
      size: BODY_SIZE,
      font: state.regular,
      color: state.text,
    });
  });
  state.y -= height;
}

function drawTwoFields(
  state: PdfState,
  left: [string, string | null | undefined],
  right: [string, string | null | undefined],
): void {
  const height = 17;
  ensureSpace(state, height);
  const columnWidth = CONTENT_WIDTH / 2;
  state.page.drawRectangle({
    x: MARGIN,
    y: state.y - height,
    width: CONTENT_WIDTH,
    height,
    borderColor: state.line,
    borderWidth: 0.5,
  });
  state.page.drawLine({
    start: { x: MARGIN + columnWidth, y: state.y },
    end: { x: MARGIN + columnWidth, y: state.y - height },
    thickness: 0.5,
    color: state.line,
  });
  [left, right].forEach(([label, value], index) => {
    const x = MARGIN + index * columnWidth + 4;
    const prefix = `${label}: `;
    state.page.drawText(safeText(prefix, state.bold), {
      x,
      y: state.y - 11,
      size: BODY_SIZE,
      font: state.bold,
      color: state.text,
    });
    const available = columnWidth - state.bold.widthOfTextAtSize(prefix, BODY_SIZE) - 10;
    const shown = wrapText(value?.trim() || '—', state.regular, BODY_SIZE, available)[0] ?? '—';
    state.page.drawText(shown, {
      x: x + state.bold.widthOfTextAtSize(prefix, BODY_SIZE),
      y: state.y - 11,
      size: BODY_SIZE,
      font: state.regular,
      color: state.text,
    });
  });
  state.y -= height;
}

function drawManualBlocks(state: PdfState): void {
  const labels = [
    'Responsable de la referencia',
    'Responsable del E.S.',
    'Personal que acompaña',
    'Personal que recibe',
  ];
  const height = 76;
  ensureSpace(state, height + 20);
  drawSectionHeader(state, 'Responsables y recepción — completar manualmente');
  const columnWidth = CONTENT_WIDTH / labels.length;
  state.page.drawRectangle({
    x: MARGIN,
    y: state.y - height,
    width: CONTENT_WIDTH,
    height,
    borderColor: state.line,
    borderWidth: 0.6,
  });
  labels.forEach((label, index) => {
    const x = MARGIN + index * columnWidth;
    if (index) {
      state.page.drawLine({
        start: { x, y: state.y },
        end: { x, y: state.y - height },
        thickness: 0.5,
        color: state.line,
      });
    }
    const heading = wrapText(label, state.bold, 7, columnWidth - 8);
    heading.forEach((line, lineIndex) => {
      state.page.drawText(line, {
        x: x + 4,
        y: state.y - 10 - lineIndex * 9,
        size: 7,
        font: state.bold,
        color: state.text,
      });
    });
    ['DNI', 'Nombre', 'N° colegiatura', 'Profesión', 'Firma y sello'].forEach((field, fieldIndex) => {
      const y = state.y - 29 - fieldIndex * 10;
      state.page.drawText(`${safeText(field, state.regular)}:`, {
        x: x + 4,
        y,
        size: 6.5,
        font: state.regular,
        color: state.text,
      });
      state.page.drawLine({
        start: { x: x + 43, y: y - 1 },
        end: { x: x + columnWidth - 4, y: y - 1 },
        thickness: 0.35,
        color: state.line,
      });
    });
  });
  state.y -= height;
}

function formatDateTime(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function calculateAge(birthDate: string | null, at: string): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const date = new Date(at);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(date.getTime())) return null;
  let years = date.getFullYear() - birth.getFullYear();
  if (date.getMonth() < birth.getMonth() || (date.getMonth() === birth.getMonth() && date.getDate() < birth.getDate()))
    years--;
  return years >= 0 ? `${years} años` : null;
}

function compact(values: Array<string | null | undefined>, separator = ' · '): string | null {
  const present = values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return present.length ? present.join(separator) : null;
}

function getAnamnesis(summary: OutpatientVisitSummary): string | null {
  return compact(
    [
      summary.anamnesis.chiefComplaint && `Motivo: ${summary.anamnesis.chiefComplaint}`,
      summary.anamnesis.illnessDuration && `Tiempo: ${summary.anamnesis.illnessDuration}`,
      summary.anamnesis.narrative,
      summary.soap.subjective,
    ],
    '\n',
  );
}

function getPhysicalExam(summary: OutpatientVisitSummary): string | null {
  const vitals = compact([
    summary.vitals.temperature && `T ${summary.vitals.temperature}`,
    summary.vitals.bloodPressure && `PA ${summary.vitals.bloodPressure}`,
    summary.vitals.respiratoryRate && `FR ${summary.vitals.respiratoryRate}`,
    summary.vitals.pulse && `FC ${summary.vitals.pulse}`,
    summary.vitals.oxygenSaturation && `SatO2 ${summary.vitals.oxygenSaturation}`,
  ]);
  return compact([vitals, ...Object.values(summary.physicalExam), summary.soap.objective], '\n');
}

function getAuxiliaryExams(summary: OutpatientVisitSummary): string | null {
  return compact(
    [
      summary.treatment.legacyLabOrders,
      ...summary.orders
        .filter((order) => order.category === 'laboratory')
        .map((order) => compact([order.name, order.details], ' — ')),
    ],
    '\n',
  );
}

function getDiagnoses(summary: OutpatientVisitSummary): string | null {
  return compact(
    summary.diagnoses.map((diagnosis) =>
      compact([diagnosis.cie10Code, diagnosis.display, diagnosis.type ? `(${diagnosis.type})` : null], ' — '),
    ),
    '\n',
  );
}

function getTreatment(summary: OutpatientVisitSummary): string | null {
  return compact(
    [
      summary.treatment.therapeuticIndications,
      summary.treatment.procedures,
      summary.treatment.legacyPrescriptions,
      ...summary.orders
        .filter((order) => order.category === 'medication')
        .map((order) => compact([order.name, order.details], ' — ')),
    ],
    '\n',
  );
}

export async function createInstitutionalReferralPdf(
  data: InstitutionalReferralPdfData,
  locale = 'es-PE',
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  const state: PdfState = {
    document,
    page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    text: rgb(0.05, 0.05, 0.05),
    line: rgb(0.25, 0.25, 0.25),
    y: PAGE_HEIGHT - MARGIN,
  };

  document.setTitle('Hoja de Referencia Institucional');
  document.setSubject('Referencia institucional');
  document.setAuthor(data.summary.facilityName);
  document.setCreator('SIH Salus');
  document.setProducer('SIH Salus');

  state.page.drawText('MINISTERIO DE SALUD · DIRESA LORETO', {
    x: MARGIN,
    y: state.y,
    size: 8,
    font: state.bold,
    color: state.text,
  });
  const title = 'HOJA DE REFERENCIA INSTITUCIONAL';
  const titleWidth = state.bold.widthOfTextAtSize(title, 13);
  state.page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: state.y - 20,
    size: 13,
    font: state.bold,
    color: state.text,
  });
  state.y -= 35;

  drawSectionHeader(state, '1. Datos generales');
  drawTwoFields(
    state,
    ['Fecha y hora', formatDateTime(data.referral.encounterDatetime, locale)],
    ['N° de referencia', data.referral.uuid.slice(-12)],
  );
  drawTwoFields(state, ['Seguro', data.insurance.payer], ['Código del asegurado', data.insurance.number]);
  drawTwoFields(
    state,
    ['Código RENIPRESS origen', data.originRenaesCode],
    ['Historia clínica', data.summary.patient.identifiers[0]?.value],
  );
  drawField(state, 'Establecimiento de origen', data.summary.facilityName);
  drawTwoFields(
    state,
    ['Código RENIPRESS destino', data.referral.destinationRenaesCode],
    ['Servicio origen', 'Consulta Externa'],
  );
  drawField(state, 'Establecimiento de destino', data.referral.destinationName);
  drawField(state, 'Servicio destino (UPS)', null);

  drawSectionHeader(state, '2. Identificación del paciente');
  drawField(state, 'Nombres y apellidos', data.summary.patient.name);
  drawField(
    state,
    'Documento(s)',
    compact(data.summary.patient.identifiers.map(({ label, value }) => `${label}: ${value}`)),
  );
  drawTwoFields(
    state,
    ['Fecha de nacimiento', data.summary.patient.birthDate],
    ['Edad', calculateAge(data.summary.patient.birthDate, data.referral.encounterDatetime)],
  );
  drawField(state, 'Sexo', data.summary.patient.gender);
  drawField(state, 'Dirección', data.summary.patient.address);

  drawSectionHeader(state, '3. Resumen de historia clínica');
  drawField(state, 'Anamnesis', getAnamnesis(data.summary), 34);
  drawField(state, 'Examen físico', getPhysicalExam(data.summary), 34);
  drawField(state, 'Exámenes auxiliares', getAuxiliaryExams(data.summary), 24);
  drawField(state, 'Diagnóstico / CIE-10 / tipo', getDiagnoses(data.summary), 28);
  drawField(state, 'Tratamiento', getTreatment(data.summary), 28);

  drawSectionHeader(state, '4. Datos de la referencia');
  drawTwoFields(state, ['Prioridad', data.referral.priority], ['Especialidad destino', data.referral.specialty]);
  drawField(state, 'Motivo y detalle', data.referral.reason, 32);
  drawTwoFields(
    state,
    ['Condición del paciente', data.referral.patientCondition],
    ['Transporte', data.referral.transportMode],
  );
  drawField(state, 'Coordinación de la referencia', null, 28);

  drawManualBlocks(state);
  drawField(state, 'Condición a la llegada al establecimiento destino (estable / mal estado / fallecido)', null, 23);

  const pages = document.getPages();
  pages.forEach((page, index) => {
    const footer = `SIH Salus · Página ${index + 1} de ${pages.length} · Generado ${formatDateTime(new Date().toISOString(), locale)}`;
    page.drawText(safeText(footer, state.regular), {
      x: MARGIN,
      y: 16,
      size: 6.5,
      font: state.regular,
      color: state.text,
    });
  });

  return document.save();
}

export function downloadInstitutionalReferralPdf(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

export function createInstitutionalReferralFileName(encounterDatetime: string, referralUuid: string): string {
  const date = /^\d{4}-\d{2}-\d{2}/.exec(encounterDatetime)?.[0] ?? 'sin-fecha';
  const suffix = referralUuid.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'referencia';
  return `hoja-referencia-institucional-${date}-${suffix}.pdf`;
}

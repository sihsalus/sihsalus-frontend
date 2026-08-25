import type { PDFFont, PDFPage } from 'pdf-lib';
import type { OutpatientSummaryOrder, OutpatientVisitSummary } from './outpatient-visit-summary.resource';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const BODY_SIZE = 9;
const LINE_HEIGHT = 13;

export interface OutpatientVisitSummaryPdfLabels {
  title: string;
  patient: string;
  identifiers: string;
  birthDate: string;
  gender: string;
  visit: string;
  visitDate: string;
  visitType: string;
  location: string;
  professional: string;
  vitalSigns: string;
  bloodPressure: string;
  temperature: string;
  oxygenSaturation: string;
  weight: string;
  height: string;
  pulse: string;
  respiratoryRate: string;
  bmi: string;
  anamnesis: string;
  chiefComplaint: string;
  illnessDuration: string;
  onsetType: string;
  course: string;
  currentIllness: string;
  biologicalFunctions: string;
  appetite: string;
  thirst: string;
  sleep: string;
  mood: string;
  urine: string;
  bowelMovements: string;
  soap: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  physicalExam: string;
  generalCondition: string;
  hydrationStatus: string;
  nutritionStatus: string;
  consciousnessStatus: string;
  skinAndAppendages: string;
  regionalExamSummary: string;
  headAndNeck: string;
  respiratorySystem: string;
  cardiovascularSystem: string;
  abdomenAndDigestiveSystem: string;
  genitourinarySystem: string;
  musculoskeletalAndExtremities: string;
  neurologicalExam: string;
  otherObjectiveFindings: string;
  diagnoses: string;
  diagnosisType: string;
  presumptive: string;
  definitive: string;
  repeat: string;
  treatmentPlan: string;
  therapeuticIndications: string;
  procedures: string;
  referral: string;
  nextAppointment: string;
  legacyLabOrders: string;
  legacyPrescriptions: string;
  medications: string;
  laboratoryOrders: string;
  otherOrders: string;
  generatedAt: string;
  page: string;
  disclaimer: string;
}

interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface PdfState {
  document: import('pdf-lib').PDFDocument;
  page: PDFPage;
  y: number;
  fonts: PdfFonts;
  colors: {
    primary: import('pdf-lib').RGB;
    text: import('pdf-lib').RGB;
    muted: import('pdf-lib').RGB;
    line: import('pdf-lib').RGB;
  };
}

function safePdfText(value: string, font: PDFFont): string {
  return [...value]
    .map((character) => {
      if (character === '\n' || character === '\r' || character === '\t') return character;
      try {
        font.encodeText(character);
        return character;
      } catch {
        return '?';
      }
    })
    .join('');
}

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const segments: string[] = [];
  let segment = '';
  for (const character of word) {
    const candidate = `${segment}${character}`;
    if (segment && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      segments.push(segment);
      segment = character;
    } else {
      segment = candidate;
    }
  }
  if (segment) segments.push(segment);
  return segments;
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safeValue = safePdfText(value, font).replace(/\r\n?/g, '\n');
  return safeValue.split('\n').flatMap((paragraph) => {
    if (!paragraph.trim()) return [''];
    const words = paragraph
      .trim()
      .split(/\s+/)
      .flatMap((word) =>
        font.widthOfTextAtSize(word, size) > maxWidth ? splitLongWord(word, font, size, maxWidth) : [word],
      );
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
  state.y = PAGE_HEIGHT - PAGE_MARGIN;
}

function ensureSpace(state: PdfState, height: number): void {
  if (state.y - height < PAGE_MARGIN + 20) addPage(state);
}

function drawLines(
  state: PdfState,
  lines: string[],
  options: { font?: PDFFont; size?: number; color?: import('pdf-lib').RGB; indent?: number } = {},
): void {
  const font = options.font ?? state.fonts.regular;
  const size = options.size ?? BODY_SIZE;
  const indent = options.indent ?? 0;
  for (const line of lines) {
    ensureSpace(state, LINE_HEIGHT);
    state.page.drawText(line, {
      x: PAGE_MARGIN + indent,
      y: state.y,
      size,
      font,
      color: options.color ?? state.colors.text,
    });
    state.y -= LINE_HEIGHT;
  }
}

function drawSectionTitle(state: PdfState, title: string): void {
  ensureSpace(state, 28);
  state.y -= 5;
  state.page.drawText(safePdfText(title, state.fonts.bold), {
    x: PAGE_MARGIN,
    y: state.y,
    size: 11,
    font: state.fonts.bold,
    color: state.colors.primary,
  });
  state.y -= 7;
  state.page.drawLine({
    start: { x: PAGE_MARGIN, y: state.y },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y: state.y },
    thickness: 0.7,
    color: state.colors.line,
  });
  state.y -= 13;
}

function drawField(state: PdfState, label: string, value: string | null | undefined): void {
  if (!value) return;
  const prefix = `${safePdfText(label, state.fonts.bold)}: `;
  const prefixWidth = state.fonts.bold.widthOfTextAtSize(prefix, BODY_SIZE);
  const availableWidth = CONTENT_WIDTH - prefixWidth;
  const valueLines = wrapText(value, state.fonts.regular, BODY_SIZE, Math.max(availableWidth, CONTENT_WIDTH * 0.55));
  valueLines.forEach((line, index) => {
    ensureSpace(state, LINE_HEIGHT);
    if (index === 0) {
      state.page.drawText(prefix, {
        x: PAGE_MARGIN,
        y: state.y,
        size: BODY_SIZE,
        font: state.fonts.bold,
        color: state.colors.text,
      });
    }
    state.page.drawText(line, {
      x: index === 0 ? PAGE_MARGIN + prefixWidth : PAGE_MARGIN,
      y: state.y,
      size: BODY_SIZE,
      font: state.fonts.regular,
      color: state.colors.text,
    });
    state.y -= LINE_HEIGHT;
  });
}

function drawOrderList(state: PdfState, title: string, orders: OutpatientSummaryOrder[]): void {
  if (!orders.length) return;
  drawSectionTitle(state, title);
  orders.forEach((order) => {
    const details = [order.name, order.details, order.orderer].filter(Boolean).join(' — ');
    drawLines(state, wrapText(`• ${details}`, state.fonts.regular, BODY_SIZE, CONTENT_WIDTH), { indent: 4 });
  });
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

export async function createOutpatientVisitSummaryPdf(
  summary: OutpatientVisitSummary,
  labels: OutpatientVisitSummaryPdfLabels,
  locale: string,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
  const state: PdfState = {
    document,
    page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - PAGE_MARGIN,
    fonts,
    colors: {
      primary: rgb(0.09, 0.25, 0.47),
      text: rgb(0.08, 0.08, 0.08),
      muted: rgb(0.35, 0.35, 0.35),
      line: rgb(0.72, 0.75, 0.79),
    },
  };

  document.setTitle(labels.title);
  document.setSubject(labels.title);
  document.setAuthor(summary.facilityName);
  document.setCreator('SIH Salus');
  document.setProducer('SIH Salus');

  state.page.drawText(safePdfText(summary.facilityName, fonts.bold), {
    x: PAGE_MARGIN,
    y: state.y,
    size: 10,
    font: fonts.bold,
    color: state.colors.primary,
  });
  state.y -= 22;
  drawLines(state, wrapText(labels.title, fonts.bold, 16, CONTENT_WIDTH), { font: fonts.bold, size: 16 });
  state.y -= 4;

  drawSectionTitle(state, labels.patient);
  drawField(state, labels.patient, summary.patient.name);
  drawField(
    state,
    labels.identifiers,
    summary.patient.identifiers.map(({ label, value }) => `${label}: ${value}`).join(' · ') || null,
  );
  drawField(state, labels.birthDate, summary.patient.birthDate);
  drawField(state, labels.gender, summary.patient.gender);

  drawSectionTitle(state, labels.visit);
  drawField(state, labels.visitDate, formatDate(summary.visitStart, locale));
  drawField(state, labels.visitType, summary.visitType);
  drawField(state, labels.location, summary.location);
  drawField(state, labels.professional, summary.providers.join(' · ') || null);

  if (Object.values(summary.vitals).some(Boolean)) {
    drawSectionTitle(state, labels.vitalSigns);
    drawField(state, labels.bloodPressure, summary.vitals.bloodPressure);
    drawField(state, labels.temperature, summary.vitals.temperature);
    drawField(state, labels.oxygenSaturation, summary.vitals.oxygenSaturation);
    drawField(state, labels.weight, summary.vitals.weight);
    drawField(state, labels.height, summary.vitals.height);
    drawField(state, labels.pulse, summary.vitals.pulse);
    drawField(state, labels.respiratoryRate, summary.vitals.respiratoryRate);
    drawField(state, labels.bmi, summary.vitals.bmi);
  }

  if (
    Object.values({ ...summary.anamnesis, biologicalFunctions: null }).some(Boolean) ||
    Object.values(summary.anamnesis.biologicalFunctions).some(Boolean)
  ) {
    drawSectionTitle(state, labels.anamnesis);
    drawField(state, labels.chiefComplaint, summary.anamnesis.chiefComplaint);
    drawField(state, labels.illnessDuration, summary.anamnesis.illnessDuration);
    drawField(state, labels.onsetType, summary.anamnesis.onsetType);
    drawField(state, labels.course, summary.anamnesis.course);
    drawField(state, labels.currentIllness, summary.anamnesis.narrative);
    drawField(state, labels.biologicalFunctions, summary.anamnesis.biologicalFunctions.summary);
    drawField(state, labels.appetite, summary.anamnesis.biologicalFunctions.appetite);
    drawField(state, labels.thirst, summary.anamnesis.biologicalFunctions.thirst);
    drawField(state, labels.sleep, summary.anamnesis.biologicalFunctions.sleep);
    drawField(state, labels.mood, summary.anamnesis.biologicalFunctions.mood);
    drawField(state, labels.urine, summary.anamnesis.biologicalFunctions.urine);
    drawField(state, labels.bowelMovements, summary.anamnesis.biologicalFunctions.bowelMovements);
  }

  if (Object.values(summary.soap).some(Boolean)) {
    drawSectionTitle(state, labels.soap);
    drawField(state, labels.subjective, summary.soap.subjective);
    drawField(state, labels.objective, summary.soap.objective);
    drawField(state, labels.assessment, summary.soap.assessment);
    drawField(state, labels.plan, summary.soap.plan);
  }

  if (Object.values(summary.physicalExam).some(Boolean)) {
    drawSectionTitle(state, labels.physicalExam);
    drawField(state, labels.generalCondition, summary.physicalExam.generalState);
    drawField(state, labels.hydrationStatus, summary.physicalExam.hydration);
    drawField(state, labels.nutritionStatus, summary.physicalExam.nutrition);
    drawField(state, labels.consciousnessStatus, summary.physicalExam.consciousness);
    drawField(state, labels.skinAndAppendages, summary.physicalExam.skinAndAppendages);
    drawField(state, labels.regionalExamSummary, summary.physicalExam.regionalSummary);
    drawField(state, labels.headAndNeck, summary.physicalExam.headAndNeck);
    drawField(state, labels.respiratorySystem, summary.physicalExam.respiratory);
    drawField(state, labels.cardiovascularSystem, summary.physicalExam.cardiovascular);
    drawField(state, labels.abdomenAndDigestiveSystem, summary.physicalExam.abdomenAndDigestive);
    drawField(state, labels.genitourinarySystem, summary.physicalExam.genitourinary);
    drawField(state, labels.musculoskeletalAndExtremities, summary.physicalExam.musculoskeletal);
    drawField(state, labels.neurologicalExam, summary.physicalExam.neurological);
    drawField(state, labels.otherObjectiveFindings, summary.physicalExam.otherFindings);
  }

  if (summary.diagnoses.length) {
    drawSectionTitle(state, labels.diagnoses);
    summary.diagnoses.forEach((diagnosis) => {
      const code = diagnosis.cie10Code ? `${diagnosis.cie10Code} — ` : '';
      const diagnosisType = {
        P: labels.presumptive,
        D: labels.definitive,
        R: labels.repeat,
      }[diagnosis.type];
      drawLines(
        state,
        wrapText(
          `• ${code}${diagnosis.display} (${labels.diagnosisType}: ${diagnosisType})`,
          state.fonts.regular,
          BODY_SIZE,
          CONTENT_WIDTH,
        ),
        { indent: 4 },
      );
    });
  }

  if (Object.values(summary.treatment).some(Boolean)) {
    drawSectionTitle(state, labels.treatmentPlan);
    drawField(state, labels.therapeuticIndications, summary.treatment.therapeuticIndications);
    drawField(state, labels.procedures, summary.treatment.procedures);
    drawField(state, labels.referral, summary.treatment.referral);
    drawField(state, labels.nextAppointment, summary.treatment.nextAppointment);
    drawField(state, labels.legacyLabOrders, summary.treatment.legacyLabOrders);
    drawField(state, labels.legacyPrescriptions, summary.treatment.legacyPrescriptions);
  }

  drawOrderList(
    state,
    labels.medications,
    summary.orders.filter((order) => order.category === 'medication'),
  );
  drawOrderList(
    state,
    labels.laboratoryOrders,
    summary.orders.filter((order) => order.category === 'laboratory'),
  );
  drawOrderList(
    state,
    labels.otherOrders,
    summary.orders.filter((order) => order.category === 'other'),
  );

  ensureSpace(state, 42);
  state.y -= 10;
  drawLines(state, wrapText(labels.disclaimer, fonts.regular, 7.5, CONTENT_WIDTH), {
    size: 7.5,
    color: state.colors.muted,
  });
  drawLines(
    state,
    wrapText(
      `${labels.generatedAt}: ${formatDate(new Date().toISOString(), locale)}`,
      fonts.regular,
      7.5,
      CONTENT_WIDTH,
    ),
    { size: 7.5, color: state.colors.muted },
  );

  const pages = document.getPages();
  pages.forEach((page, index) => {
    const footer = `${labels.page} ${index + 1} / ${pages.length}`;
    page.drawText(safePdfText(footer, fonts.regular), {
      x: PAGE_WIDTH - PAGE_MARGIN - fonts.regular.widthOfTextAtSize(footer, 7.5),
      y: 20,
      size: 7.5,
      font: fonts.regular,
      color: state.colors.muted,
    });
  });

  return document.save();
}

export function downloadOutpatientVisitSummaryPdf(bytes: Uint8Array, fileName: string): void {
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

export function createOutpatientVisitSummaryFileName(visitUuid: string, visitStart: string): string {
  const date = new Date(visitStart);
  const sourceDate = /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(visitStart)?.[1];
  const safeDate = Number.isNaN(date.getTime()) ? 'sin-fecha' : (sourceDate ?? date.toISOString().slice(0, 10));
  const safeVisitSuffix = visitUuid.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'visita';
  return `resumen-atencion-ambulatoria-${safeDate}-${safeVisitSuffix}.pdf`;
}

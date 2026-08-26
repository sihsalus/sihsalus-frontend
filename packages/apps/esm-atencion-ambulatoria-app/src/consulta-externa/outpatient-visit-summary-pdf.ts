import type { PDFFont, PDFPage } from 'pdf-lib';
import {
  isUpcomingScheduledAppointment,
  type OutpatientScheduledAppointment,
} from './outpatient-next-appointment.resource';
import type { OutpatientSummaryOrder, OutpatientVisitSummary } from './outpatient-visit-summary.resource';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const BODY_SIZE = 9;
const LINE_HEIGHT = 13;

interface OutpatientMedicationOrderPdfLabels {
  medicationAsNeeded: string;
  medicationAsNeededReasonMissing: string;
  medicationIndication: string;
  medicationNumberOfRefills: string;
}

export interface OutpatientVisitSummaryPdfLabels extends OutpatientMedicationOrderPdfLabels {
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
  professionalRegistration: string;
  professionalRegistrationMissing: string;
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
  consciousnessStatus: string;
  skinAndAppendages: string;
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
  signatureAndStamp: string;
  generatedAt: string;
  page: string;
  disclaimer: string;
}

export interface OutpatientPatientInstructionsPdfLabels extends OutpatientMedicationOrderPdfLabels {
  title: string;
  patient: string;
  identifiers: string;
  careDetails: string;
  visitDate: string;
  location: string;
  professional: string;
  professionalRegistration: string;
  professionalRegistrationMissing: string;
  scheduledAppointment: string;
  scheduledAppointmentDate: string;
  scheduledAppointmentService: string;
  scheduledAppointmentLocation: string;
  scheduledAppointmentProfessional: string;
  instructions: string;
  indicatedFollowUpDate: string;
  therapeuticIndications: string;
  medications: string;
  legacyPrescriptions: string;
  signatureAndStamp: string;
  generatedAt: string;
  page: string;
  followUpDateDisclaimer: string;
}

export interface OutpatientRecetaUnicaPdfLabels extends OutpatientMedicationOrderPdfLabels {
  title: string;
  pharmacyCopy: string;
  patientCopy: string;
  prescriptionNumber: string;
  issuedAt: string;
  validUntil: string;
  patient: string;
  identifiers: string;
  birthDate: string;
  diagnoses: string;
  presumptive: string;
  definitive: string;
  repeat: string;
  medications: string;
  visitDate: string;
  location: string;
  professional: string;
  collegiateNumber: string;
  indicatedFollowUpDate: string;
  therapeuticIndications: string;
  signatureAndStamp: string;
  validOnlySignedLegend: string;
  generatedAt: string;
  page: string;
  disclaimer: string;
}

export interface RecetaUnicaEmissionPrintData {
  /** Correlativo emitido por la fuente idgen del servidor. */
  number: string;
  /** Emisión según el reloj del servidor. */
  issuedAt: string;
  /** Último día de vigencia. */
  validUntil: string;
  /** Colegiatura registrada del prescriptor; null deja la línea manuscrita. */
  collegiateNumber: string | null;
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

type FacilityContact = Pick<OutpatientVisitSummary, 'facilityAddress' | 'facilityPhone' | 'facilityIpressCode'>;

export class OutpatientPdfUnsupportedCharacterError extends Error {
  constructor() {
    super('The PDF contains text that cannot be represented by the embedded font.');
    this.name = 'OutpatientPdfUnsupportedCharacterError';
  }
}

export class OutpatientPdfClinicalResponsibilityError extends Error {
  constructor() {
    super('The clinical encounter must have one responsible professional.');
    this.name = 'OutpatientPdfClinicalResponsibilityError';
  }
}

function assertClinicalResponsibility(summary: OutpatientVisitSummary): void {
  if (!summary.clinicalEncounterDatetime || !summary.responsibleProvider?.trim()) {
    throw new OutpatientPdfClinicalResponsibilityError();
  }
}

function safePdfText(value: string, font: PDFFont): string {
  return [...value]
    .map((character) => {
      if (character === '\n' || character === '\r' || character === '\t') return character;
      try {
        font.encodeText(character);
        return character;
      } catch {
        throw new OutpatientPdfUnsupportedCharacterError();
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
  options: {
    font?: PDFFont;
    size?: number;
    color?: import('pdf-lib').RGB;
    indent?: number;
  } = {},
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

function drawOrderList(
  state: PdfState,
  title: string,
  orders: OutpatientSummaryOrder[],
  medicationLabels?: OutpatientMedicationOrderPdfLabels,
): void {
  if (!orders.length) return;
  drawSectionTitle(state, title);
  orders.forEach((order) => {
    const asNeededDetails =
      order.asNeeded && medicationLabels
        ? order.asNeededCondition
          ? `${medicationLabels.medicationAsNeeded}: ${order.asNeededCondition}`
          : medicationLabels.medicationAsNeededReasonMissing
        : null;
    const indicationDetails =
      medicationLabels && order.orderReasonNonCoded
        ? `${medicationLabels.medicationIndication}: ${order.orderReasonNonCoded}`
        : null;
    const refillDetails =
      medicationLabels && typeof order.numRefills === 'number'
        ? `${medicationLabels.medicationNumberOfRefills}: ${order.numRefills}`
        : null;
    const details = [order.name, order.details, indicationDetails, asNeededDetails, refillDetails, order.orderer]
      .filter(Boolean)
      .join(' — ');
    drawLines(state, wrapText(`• ${details}`, state.fonts.regular, BODY_SIZE, CONTENT_WIDTH), { indent: 4 });
  });
}

function drawSignatureAndStampBlock(state: PdfState, label: string): void {
  const lineWidth = 240;
  const lineStart = (PAGE_WIDTH - lineWidth) / 2;
  ensureSpace(state, 135);
  state.y -= 54;
  state.page.drawLine({
    start: { x: lineStart, y: state.y },
    end: { x: lineStart + lineWidth, y: state.y },
    thickness: 0.7,
    color: state.colors.line,
  });
  state.y -= LINE_HEIGHT;
  const safeLabel = safePdfText(label, state.fonts.bold);
  state.page.drawText(safeLabel, {
    x: (PAGE_WIDTH - state.fonts.bold.widthOfTextAtSize(safeLabel, BODY_SIZE)) / 2,
    y: state.y,
    size: BODY_SIZE,
    font: state.fonts.bold,
    color: state.colors.text,
  });
  state.y -= 18;
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

async function createPdfState(
  title: string,
  facilityName: string,
  facilityContact?: FacilityContact,
): Promise<PdfState> {
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

  document.setTitle(title);
  document.setSubject(title);
  document.setAuthor(facilityName);
  document.setCreator('SIH Salus');
  document.setProducer('SIH Salus');

  state.page.drawText(safePdfText(facilityName, fonts.bold), {
    x: PAGE_MARGIN,
    y: state.y,
    size: 10,
    font: fonts.bold,
    color: state.colors.primary,
  });
  state.y -= 14;
  const contactLine = [
    facilityContact?.facilityPhone ? `Tel. ${facilityContact.facilityPhone}` : null,
    facilityContact?.facilityIpressCode ? `IPRESS ${facilityContact.facilityIpressCode}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  [facilityContact?.facilityAddress, contactLine].filter(Boolean).forEach((detail) => {
    drawLines(state, wrapText(detail as string, fonts.regular, 8, CONTENT_WIDTH), {
      font: fonts.regular,
      size: 8,
      color: state.colors.muted,
    });
  });
  state.y -= 8;
  drawLines(state, wrapText(title, fonts.bold, 16, CONTENT_WIDTH), {
    font: fonts.bold,
    size: 16,
  });
  state.y -= 4;

  return state;
}

function drawPdfFooter(
  state: PdfState,
  labels: { disclaimer: string; generatedAt: string; page: string },
  locale: string,
): void {
  ensureSpace(state, 42);
  state.y -= 10;
  drawLines(state, wrapText(labels.disclaimer, state.fonts.regular, 7.5, CONTENT_WIDTH), {
    size: 7.5,
    color: state.colors.muted,
  });
  drawLines(
    state,
    wrapText(
      `${labels.generatedAt}: ${formatDate(new Date().toISOString(), locale)}`,
      state.fonts.regular,
      7.5,
      CONTENT_WIDTH,
    ),
    { size: 7.5, color: state.colors.muted },
  );

  const pages = state.document.getPages();
  pages.forEach((page, index) => {
    const footer = `${labels.page} ${index + 1} / ${pages.length}`;
    page.drawText(safePdfText(footer, state.fonts.regular), {
      x: PAGE_WIDTH - PAGE_MARGIN - state.fonts.regular.widthOfTextAtSize(footer, 7.5),
      y: 20,
      size: 7.5,
      font: state.fonts.regular,
      color: state.colors.muted,
    });
  });
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function getCanonicalMedicationOrders(summary: OutpatientVisitSummary): OutpatientSummaryOrder[] {
  const generatedAt = Date.now();
  return summary.orders.filter((order) => {
    if (order.category !== 'medication') return false;
    return ![order.dateStopped, order.autoExpireDate].some((value) => {
      if (!value) return false;
      const endedAt = new Date(value).getTime();
      return !Number.isNaN(endedAt) && endedAt <= generatedAt;
    });
  });
}

function hasRecordedCanonicalMedicationOrders(summary: OutpatientVisitSummary): boolean {
  return summary.hasRecordedMedicationOrders;
}

export function hasOutpatientPatientInstructions(
  summary: OutpatientVisitSummary,
  scheduledAppointment?: OutpatientScheduledAppointment | null,
): boolean {
  const medicationOrders = getCanonicalMedicationOrders(summary);
  return Boolean(
    isUpcomingScheduledAppointment(scheduledAppointment) ||
      hasText(summary.treatment.nextAppointment) ||
      hasText(summary.treatment.therapeuticIndications) ||
      medicationOrders.length ||
      (!hasRecordedCanonicalMedicationOrders(summary) && hasText(summary.treatment.legacyPrescriptions)),
  );
}

export async function createOutpatientVisitSummaryPdf(
  summary: OutpatientVisitSummary,
  labels: OutpatientVisitSummaryPdfLabels,
  locale: string,
): Promise<Uint8Array> {
  assertClinicalResponsibility(summary);
  const state = await createPdfState(labels.title, summary.facilityName, summary);
  const { document } = state;

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
  drawField(state, labels.visitDate, formatDate(summary.clinicalEncounterDatetime, locale));
  drawField(state, labels.visitType, summary.visitType);
  drawField(state, labels.location, summary.location);
  drawField(state, labels.professional, summary.responsibleProvider);
  drawField(
    state,
    labels.professionalRegistration,
    summary.responsibleProfessionalRegistration ?? labels.professionalRegistrationMissing,
  );

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
    drawField(state, labels.consciousnessStatus, summary.physicalExam.consciousness);
    drawField(state, labels.skinAndAppendages, summary.physicalExam.skinAndAppendages);
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
    labels,
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

  drawSignatureAndStampBlock(
    state,
    summary.responsibleProfessionalRegistration
      ? labels.signatureAndStamp
      : `${labels.signatureAndStamp} — ${labels.professionalRegistrationMissing}`,
  );

  drawPdfFooter(state, labels, locale);

  return document.save();
}

export async function createOutpatientPatientInstructionsPdf(
  summary: OutpatientVisitSummary,
  labels: OutpatientPatientInstructionsPdfLabels,
  locale: string,
  scheduledAppointment?: OutpatientScheduledAppointment | null,
): Promise<Uint8Array> {
  assertClinicalResponsibility(summary);
  const state = await createPdfState(labels.title, summary.facilityName, summary);
  const printableScheduledAppointment = isUpcomingScheduledAppointment(scheduledAppointment)
    ? scheduledAppointment
    : null;

  drawSectionTitle(state, labels.patient);
  drawField(state, labels.patient, summary.patient.name);
  drawField(
    state,
    labels.identifiers,
    summary.patient.identifiers.length
      ? `${summary.patient.identifiers[0].label}: ${summary.patient.identifiers[0].value}`
      : null,
  );

  drawSectionTitle(state, labels.careDetails);
  drawField(state, labels.visitDate, formatDate(summary.clinicalEncounterDatetime, locale));
  drawField(state, labels.location, summary.location);
  drawField(state, labels.professional, summary.responsibleProvider);
  drawField(
    state,
    labels.professionalRegistration,
    summary.responsibleProfessionalRegistration ?? labels.professionalRegistrationMissing,
  );

  if (printableScheduledAppointment) {
    drawSectionTitle(state, labels.scheduledAppointment);
    drawField(state, labels.scheduledAppointmentDate, formatDate(printableScheduledAppointment.startDateTime, locale));
    drawField(state, labels.scheduledAppointmentService, printableScheduledAppointment.service);
    drawField(state, labels.scheduledAppointmentLocation, printableScheduledAppointment.location);
    drawField(state, labels.scheduledAppointmentProfessional, printableScheduledAppointment.provider);
  }

  if (hasText(summary.treatment.nextAppointment) || hasText(summary.treatment.therapeuticIndications)) {
    drawSectionTitle(state, labels.instructions);
    drawField(state, labels.indicatedFollowUpDate, summary.treatment.nextAppointment);
    drawField(state, labels.therapeuticIndications, summary.treatment.therapeuticIndications);
  }

  const medicationOrders = getCanonicalMedicationOrders(summary);
  if (medicationOrders.length) {
    drawOrderList(state, labels.medications, medicationOrders, labels);
  } else if (!hasRecordedCanonicalMedicationOrders(summary) && hasText(summary.treatment.legacyPrescriptions)) {
    drawSectionTitle(state, labels.legacyPrescriptions);
    drawLines(
      state,
      wrapText(summary.treatment.legacyPrescriptions as string, state.fonts.regular, BODY_SIZE, CONTENT_WIDTH),
    );
  }

  drawSignatureAndStampBlock(
    state,
    summary.responsibleProfessionalRegistration
      ? labels.signatureAndStamp
      : `${labels.signatureAndStamp} — ${labels.professionalRegistrationMissing}`,
  );

  drawPdfFooter(
    state,
    {
      disclaimer: labels.followUpDateDisclaimer,
      generatedAt: labels.generatedAt,
      page: labels.page,
    },
    locale,
  );

  return state.document.save();
}

function drawRecetaUnicaHeaderFields(
  state: PdfState,
  labels: OutpatientRecetaUnicaPdfLabels,
  receta: RecetaUnicaEmissionPrintData,
  copyLabel: string,
  locale: string,
): void {
  drawSectionTitle(state, copyLabel);
  drawField(state, labels.prescriptionNumber, receta.number);
  drawField(state, labels.issuedAt, formatDate(receta.issuedAt, locale));
  drawField(state, labels.validUntil, formatDate(receta.validUntil, locale));
}

function drawRecetaUnicaDiagnoses(state: PdfState, labels: OutpatientRecetaUnicaPdfLabels, summary: OutpatientVisitSummary): void {
  if (!summary.diagnoses.length) return;
  drawSectionTitle(state, labels.diagnoses);
  summary.diagnoses.forEach((diagnosis) => {
    const code = diagnosis.cie10Code ? `${diagnosis.cie10Code} — ` : '';
    const diagnosisType = { P: labels.presumptive, D: labels.definitive, R: labels.repeat }[diagnosis.type];
    drawLines(
      state,
      wrapText(`• ${code}${diagnosis.display} (${diagnosisType})`, state.fonts.regular, BODY_SIZE, CONTENT_WIDTH),
      { indent: 4 },
    );
  });
}

function drawRecetaUnicaPrescriber(
  state: PdfState,
  labels: OutpatientRecetaUnicaPdfLabels,
  summary: OutpatientVisitSummary,
  receta: RecetaUnicaEmissionPrintData,
): void {
  drawSectionTitle(state, labels.professional);
  drawField(state, labels.professional, summary.providers.join(' · ') || null);
  // Sin colegiatura registrada, la línea queda para el manuscrito: la firma y
  // el sello siguen siendo lo que valida el documento.
  drawField(state, labels.collegiateNumber, receta.collegiateNumber ?? '________________');
  drawSignatureAndStampBlock(state, labels.signatureAndStamp);
  drawLines(state, wrapText(labels.validOnlySignedLegend, state.fonts.bold, 8, CONTENT_WIDTH), {
    font: state.fonts.bold,
    size: 8,
    color: state.colors.muted,
  });
}

/**
 * Receta Única Estandarizada en dos cuerpos (RM 116-2018): página 1 para
 * farmacia —con diagnósticos CIE-10 y el detalle completo de cada orden,
 * incluida la cantidad— y página 2 como ejemplar del paciente con las
 * indicaciones. Ambos cuerpos llevan el mismo correlativo del servidor y su
 * vigencia. Esta función NO acuña números: recibe la emisión ya auditada por
 * idgen y debe abortarse la impresión si aquella falló.
 */
export async function createOutpatientRecetaUnicaPdf(
  summary: OutpatientVisitSummary,
  labels: OutpatientRecetaUnicaPdfLabels,
  locale: string,
  receta: RecetaUnicaEmissionPrintData,
): Promise<Uint8Array> {
  const state = await createPdfState(labels.title, summary.facilityName, summary);
  const medicationOrders = getCanonicalMedicationOrders(summary);

  // ── Cuerpo 1: ejemplar de farmacia ─────────────────────────────────────────
  drawRecetaUnicaHeaderFields(state, labels, receta, labels.pharmacyCopy, locale);

  drawSectionTitle(state, labels.patient);
  drawField(state, labels.patient, summary.patient.name);
  drawField(
    state,
    labels.identifiers,
    summary.patient.identifiers.map(({ label, value }) => `${label}: ${value}`).join(' · ') || null,
  );
  drawField(state, labels.birthDate, summary.patient.birthDate);

  drawRecetaUnicaDiagnoses(state, labels, summary);
  drawOrderList(state, labels.medications, medicationOrders, labels);
  drawRecetaUnicaPrescriber(state, labels, summary, receta);

  // ── Cuerpo 2: ejemplar del paciente ────────────────────────────────────────
  addPage(state);
  drawRecetaUnicaHeaderFields(state, labels, receta, labels.patientCopy, locale);

  drawSectionTitle(state, labels.patient);
  drawField(state, labels.patient, summary.patient.name);
  drawField(state, labels.visitDate, formatDate(summary.visitStart, locale));
  drawField(state, labels.location, summary.location);

  drawOrderList(state, labels.medications, medicationOrders, labels);
  if (hasText(summary.treatment.nextAppointment) || hasText(summary.treatment.therapeuticIndications)) {
    drawSectionTitle(state, labels.therapeuticIndications);
    drawField(state, labels.indicatedFollowUpDate, summary.treatment.nextAppointment);
    drawField(state, labels.therapeuticIndications, summary.treatment.therapeuticIndications);
  }
  drawRecetaUnicaPrescriber(state, labels, summary, receta);

  drawPdfFooter(state, { disclaimer: labels.disclaimer, generatedAt: labels.generatedAt, page: labels.page }, locale);

  return state.document.save();
}

/** La receta exige al menos una orden canónica de medicación en la visita. */
export function hasOutpatientRecetaUnicaContent(summary: OutpatientVisitSummary): boolean {
  return getCanonicalMedicationOrders(summary).length > 0;
}

export function createOutpatientRecetaUnicaFileName(recetaNumber: string, visitStart: string): string {
  const safeNumber = recetaNumber.replace(/[^A-Za-z0-9-]+/g, '-');
  return `receta-unica-${safeNumber}-${getSafeVisitDate(visitStart)}.pdf`;
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

function getSafeVisitDate(visitStart: string): string {
  const date = new Date(visitStart);
  const sourceDate = /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(visitStart)?.[1];
  return Number.isNaN(date.getTime()) ? 'sin-fecha' : (sourceDate ?? date.toISOString().slice(0, 10));
}

function createVisitScopedPdfFileName(prefix: string, visitUuid: string, visitStart: string): string {
  const safeDate = getSafeVisitDate(visitStart);
  const safeVisitSuffix = visitUuid.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'visita';
  return `${prefix}-${safeDate}-${safeVisitSuffix}.pdf`;
}

export function createOutpatientVisitSummaryFileName(visitUuid: string, visitStart: string): string {
  return createVisitScopedPdfFileName('resumen-atencion-ambulatoria', visitUuid, visitStart);
}

export function createOutpatientPatientInstructionsFileName(_visitUuid: string, visitStart: string): string {
  return `indicaciones-para-el-paciente-${getSafeVisitDate(visitStart)}.pdf`;
}

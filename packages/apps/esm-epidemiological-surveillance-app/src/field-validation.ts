import type { SurveillanceCaseDraft } from "./types";

export const validationMessages = {
  required: true,
  selection: true,
  dateFormat: true,
  dateTimeFormat: true,
  future: true,
  beforeBirth: true,
  afterCare: true,
  beforeOnset: true,
  notificationBeforeInvestigation: true,
  endBeforeStart: true,
  referenceLength: true,
  duplicateDiagnosis: true,
  invalidLaboratory: true,
  laboratoryRequired: true,
  laboratoryConflict: true,
} as const;
export type ValidationReason = keyof typeof validationMessages;
export type FieldErrors = Record<string, ValidationReason>;
export const formFields = new Set([
  "patientUuid",
  "encounterUuid",
  "sourceEncounterUuid",
  "providerUuid",
  "locationUuid",
  "diagnosisUuid",
  "eventUuid",
  "diagnosisType",
  "status",
  "origin",
  "vaccinationStatus",
  "habitualResidence",
  "surveillanceType",
  "onsetDate",
  "investigationDate",
  "notificationDate",
  "deathAttribution",
  "infectionAddressUuid",
  "testOrderUuid",
  "laboratoryObservationUuid",
  "laboratoryResultUuid",
  "severity",
  "species",
  "conceptUuid",
  "periodicity",
  "referenceRegulation",
  "validFrom",
  "validTo",
]);
export function isCalendarDate(value?: string): value is string {
  return (
    !!value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function caseDateErrors(
  value: Pick<SurveillanceCaseDraft, "onsetDate" | "investigationDate" | "notificationDate">,
  today: string, birth?: string, care?: string,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of ["onsetDate", "investigationDate"] as const) {
    const date = value[key];
    if (date && !isCalendarDate(date)) errors[key] = "dateFormat";
    else if (date && date > today) errors[key] = "future";
  }
  if (!value.investigationDate) errors.investigationDate = "required";
  if (isCalendarDate(value.onsetDate)) {
    if (birth && value.onsetDate < birth) errors.onsetDate = "beforeBirth";
    else if (value.investigationDate && value.onsetDate > value.investigationDate) errors.onsetDate = "afterCare";
  }
  const notification = value.notificationDate;
  if (notification) {
    const time = Date.parse(notification);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?-05:00$/.test(notification) ||
        !isCalendarDate(notification.slice(0, 10)) || !Number.isFinite(time)) errors.notificationDate = "dateTimeFormat";
    else if (notification.slice(0, 10) > today || time > Date.now()) errors.notificationDate = "future";
    else if (value.onsetDate && notification.slice(0, 10) < value.onsetDate) errors.notificationDate = "beforeOnset";
    else if (care && time < Date.parse(care.length === 10 ? `${care}T00:00:00-05:00` : care)) errors.notificationDate = "notificationBeforeInvestigation";
    else if (value.investigationDate && notification.slice(0, 10) < value.investigationDate) errors.notificationDate = "notificationBeforeInvestigation";
  }
  return errors;
}

export function serverFieldErrors(
  error: { fields: string[]; code: string; fieldErrors: FieldErrors },
  registration = false,
): FieldErrors {
  const aliases: Record<string, string> = registration
    ? {
        encounterUuid: "sourceEncounterUuid",
        diagnosisUuid: "eventUuid",
        diagnosisType: "status",
        laboratoryObservationUuid: "laboratoryResultUuid",
        testOrderUuid: "laboratoryResultUuid",
      }
    : { testOrderUuid: "laboratoryObservationUuid" };
  const result: FieldErrors = {};
  for (const [key, reason] of Object.entries(error.fieldErrors ?? {}))
    result[aliases[key] ?? key] = reason;
  const reasons: Record<string, ValidationReason> = {
    REQUIRED_FIELDS: "required",
    INVALID_REFERENCE: "selection",
    INVALID_CLASSIFICATION: "selection",
    INVALID_INFECTION_ADDRESS: "selection",
    INVALID_DATE: "dateFormat",
    INVALID_LAB_RESULT: "invalidLaboratory",
    CASE_ALREADY_EXISTS_FOR_DIAGNOSIS: "duplicateDiagnosis",
  };
  for (const field of error.fields ?? []) {
    const key = aliases[field] ?? field;
    if (!result[key] && reasons[error.code]) result[key] = reasons[error.code];
  }
  return result;
}

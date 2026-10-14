import type { SurveillanceCaseDraft } from "./types";

export const validationMessages = {
  required: true,
  selection: true,
  dateFormat: true,
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
  "surveillanceType",
  "onsetDate",
  "investigationDate",
  "notificationDate",
  "deathDate",
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
  value: Pick<
    SurveillanceCaseDraft,
    "onsetDate" | "investigationDate" | "notificationDate" | "deathDate"
  >,
  today: string,
  birth?: string,
  care?: string,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of [
    "onsetDate",
    "investigationDate",
    "notificationDate",
    "deathDate",
  ] as const) {
    const date = value[key];
    if (date && !isCalendarDate(date)) errors[key] = "dateFormat";
  }
  const set = (key: string, reason: ValidationReason) => {
    if (!errors[key]) errors[key] = reason;
  };
  if (!value.investigationDate) set("investigationDate", "required");
  for (const key of [
    "onsetDate",
    "investigationDate",
    "notificationDate",
  ] as const) {
    if (isCalendarDate(value[key]) && value[key] > today) set(key, "future");
  }
  if (isCalendarDate(value.onsetDate)) {
    if (birth && value.onsetDate < birth) set("onsetDate", "beforeBirth");
    if (
      (care && value.onsetDate > care) ||
      (isCalendarDate(value.investigationDate) &&
        value.onsetDate > value.investigationDate)
    )
      set("onsetDate", "afterCare");
    for (const key of ["notificationDate", "deathDate"] as const) {
      if (isCalendarDate(value[key]) && value[key] < value.onsetDate)
        set(key, "beforeOnset");
    }
  }
  if (
    isCalendarDate(value.notificationDate) &&
    isCalendarDate(value.investigationDate) &&
    value.notificationDate < value.investigationDate
  )
    set("notificationDate", "notificationBeforeInvestigation");
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

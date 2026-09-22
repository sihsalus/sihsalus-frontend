import type { CaseRequest, Catalogue } from "./types";
export const catalogue: Catalogue = {
  events: [
    {
      uuid: "event",
      name: "Synthetic disease",
      conceptUuid: "event-concept",
      periodicity: "semanal",
      deadlineDays: 7,
    },
  ],
  catalog: {
    version: 1,
    encounterRoleUuid: "role",
    trueConceptUuid: "true",
    falseConceptUuid: "false",
    surveillanceStartDate: "2020-01-01",
    timezone: "America/Lima",
    questions: {
      onset: "onset",
      status: "status",
      origin: "origin",
      severity: "severity",
      species: "species",
      event: "event-question",
      pregnancy: "pregnancy",
    },
    statuses: [
      { key: "SUSPECTED", conceptUuid: "suspect", label: "Suspected" },
      { key: "CONFIRMED", conceptUuid: "confirmed", label: "Confirmed" },
    ],
    origins: [
      { key: "AUTOCHTHONOUS", conceptUuid: "local", label: "Autochthonous" },
    ],
    diseases: [
      {
        eventUuid: "event",
        severities: [{ key: "MILD", conceptUuid: "mild", label: "Mild" }],
        species: [],
        diagnoses: [{ severity: "MILD", diagnosisConceptUuid: "diagnosis", icd10Code: "A90" }],
        laboratoryTests: [],
      },
    ],
  },
};
export const request: CaseRequest = {
  uuid: "case",
  patientUuid: "patient",
  sourceEncounterUuid: "source",
  providerUuid: "provider",
  locationUuid: "location",
  eventUuid: "event",
  status: "SUSPECTED",
  severity: "MILD",
  origin: "AUTOCHTHONOUS",
  onsetDate: "2026-01-19",
};

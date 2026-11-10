import type { CaseRequest, Catalogue } from "./types";
export const catalogue: Catalogue = {
  events: [
    {
      uuid: "event",
      conceptUuid: "event-concept",
      conceptDisplay: "Synthetic disease",
      periodicity: "SEMANAL",
      referenceRegulation: "NTS de prueba",
      diagnosisConceptUuids: ["event-concept", "diagnosis"],
      validFrom: "2026-01-01",
    },
  ],
  catalog: {
    trueConceptUuid: "true",
    falseConceptUuid: "false",
    surveillanceStartDate: "2020-01-01",
    timezone: "America/Lima",
  },
};
export const request: CaseRequest = {
  vaccinationStatus: "IGN",
  surveillanceType: "PASIVA",
  investigationForm: false,
  habitualResidence: "1",
  uuid: "case",
  patientUuid: "patient",
  sourceEncounterUuid: "source",
  providerUuid: "provider",
  locationUuid: "location",
  eventUuid: "event",
  status: "SUSPECTED",
  origin: "AUTOCTONO",
  onsetDate: "2026-01-19",
  investigationDate: "2026-01-20",
};

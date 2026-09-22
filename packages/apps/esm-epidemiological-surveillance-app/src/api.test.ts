import { openmrsFetch } from "@openmrs/esm-framework";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  encountersForPatient,
  getCatalogue,
  getEncounterDiagnoses,
  getEncounterObservations,
  references,
  safeError,
  searchPatients,
} from "./api";
vi.mock("@openmrs/esm-framework", () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: "/ws/rest/v1",
  fhirBaseUrl: "/ws/fhir2/R4",
}));
describe("surveillance API", () => {
  it("reads the fixed catalog contract", async () => {
    const response = { catalog: { version: 1 }, events: [] };
    vi.mocked(openmrsFetch).mockResolvedValue({ data: response } as never);
    expect(await getCatalogue()).toEqual(response);
    expect(openmrsFetch).toHaveBeenCalledWith(
      "/ws/rest/v1/sihsalusepidemiologicalsurveillance/catalog",
      expect.any(Object),
    );
  });
  it("searches patients through the native patient index", async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: {
        results: [
          {
            uuid: "patient",
            identifiers: [{ identifier: "SYN-001" }],
            person: {
              display: "Synthetic Patient",
              gender: "F",
              birthdate: "2000-01-01",
            },
          },
        ],
      },
    } as never);

    await expect(searchPatients("Synthetic")).resolves.toEqual([
      {
        resourceType: "Patient",
        id: "patient",
        name: [{ text: "Synthetic Patient" }],
        identifier: [{ value: "SYN-001" }],
        gender: "F",
        birthDate: "2000-01-01",
      },
    ]);
    expect(openmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining("/patient?q=Synthetic"),
      expect.any(Object),
    );
  });
  it("reads only active coded native diagnoses for the verified patient", async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: {
        uuid: "source",
        patient: { uuid: "patient" },
        diagnoses: [
          { diagnosis: { coded: { uuid: "diagnosis" } } },
          { voided: true, diagnosis: { coded: { uuid: "discarded" } } },
          { diagnosis: { nonCoded: "Synthetic narrative" } },
        ],
      },
    } as never);
    expect(await getEncounterDiagnoses("source", "patient")).toEqual([
      "diagnosis",
    ]);
    await expect(
      getEncounterDiagnoses("source", "another-patient"),
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_ENCOUNTER" });
  });
  beforeEach(() => {
    vi.mocked(openmrsFetch).mockReset();
  });
  it("does not expose raw backend messages", () => {
    const failure = safeError({
      status: 500,
      message: "sensitive stack",
      responseBody: { code: "sensitive SQL" },
    });
    expect(failure.code).toBe("SERVICE_UNAVAILABLE");
    expect(failure.message).not.toContain("sensitive");
  });
  it.each([401, 403])(
    "preserves denied status %s without a fallback",
    async (status) => {
      vi.mocked(openmrsFetch).mockRejectedValue({ status });
      await expect(
        searchPatients("Synthetic"),
      ).rejects.toMatchObject({ status });
    },
    );
  });
  it("lists the patient's active encounters through the native REST endpoint", async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: {
        results: [
          {
            uuid: "encounter",
            patient: { uuid: "patient" },
            encounterDatetime: "2026-01-20T10:00:00.000+0000",
            encounterType: { name: "Consulta externa" },
            location: { uuid: "location", display: "Main clinic" },
          },
          { uuid: "voided", voided: true, patient: { uuid: "patient" } },
        ],
      },
    } as never);

    await expect(encountersForPatient("patient")).resolves.toEqual([
      {
        resourceType: "Encounter",
        id: "encounter",
        subject: { reference: "Patient/patient" },
        period: { start: "2026-01-20T10:00:00.000+0000" },
        location: [{ location: { reference: "Location/location", display: "Main clinic" } }],
        type: [{ text: "Consulta externa" }],
      },
    ]);
    expect(openmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining("/encounter?patient=patient"),
      expect.any(Object),
    );
  });
  it("reads observations from the selected native encounter", async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: {
        uuid: "encounter",
        patient: { uuid: "patient" },
        obs: [
          {
            uuid: "group",
            obsDatetime: "2026-01-20T10:00:00.000+0000",
            concept: { uuid: "group-question", display: "Group" },
            groupMembers: [
              {
                uuid: "observation",
                obsDatetime: "2026-01-20T10:00:00.000+0000",
                concept: { uuid: "question", display: "Question" },
                value: { uuid: "answer", display: "Answer" },
              },
            ],
          },
        ],
      },
    } as never);

    const observations = await getEncounterObservations("encounter", "patient");
    expect(observations.some((observation) => observation.id === "observation")).toBe(true);
    expect(observations.find((observation) => observation.id === "observation")).toMatchObject({
      code: { coding: [{ code: "question" }] },
      valueCodeableConcept: { coding: [{ code: "answer" }] },
    });
  });
  it("loads professionals from the native provider endpoint", async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: {
        results: [
          {
            uuid: "provider",
            display: "Synthetic professional",
            person: { uuid: "person" },
          },
        ],
      },
    } as never);

    await expect(references("provider")).resolves.toEqual([
      {
        uuid: "provider",
        display: "Synthetic professional",
        person: { uuid: "person" },
      },
    ]);
    expect(openmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining("/provider?v=custom%3A%28uuid%2Cdisplay%2Cperson%3A%28uuid%29%29"),
      expect.any(Object),
    );
  });

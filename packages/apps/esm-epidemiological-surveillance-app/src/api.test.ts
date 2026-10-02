import { openmrsFetch } from "@openmrs/esm-framework";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  encountersForPatient,
  getCatalogue,
  getReport,
  getEncounterDiagnoses,
  getEncounterObservations,
  references,
  safeError,
  searchPatients,
  getPatient,
  getSurveillanceCase,
  updateSurveillanceCase,
  updateEvent,
} from "./api";
vi.mock("@openmrs/esm-framework", () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: "/ws/rest/v1",
  fhirBaseUrl: "/ws/fhir2/R4",
}));
describe("surveillance API", () => {
  it("updates all event attributes at the existing event URL", async () => {
    const event = { conceptUuid: "concept", periodicity: "INMEDIATA" as const, referenceRegulation: "NTS", validFrom: "2026-01-01", validTo: null };
    vi.mocked(openmrsFetch).mockResolvedValue({ data: event } as never);
    await updateEvent("synthetic/event", event);
    expect(openmrsFetch).toHaveBeenLastCalledWith("/ws/rest/v1/sihsalusepidemiologicalsurveillance/events/synthetic%2Fevent", expect.objectContaining({ method: "PUT", body: event }));
  });
  it("loads the patient's preferred residence for case details", async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({ data: { uuid: "synthetic-patient", person: { preferredAddress: { stateProvince: "Provincia", countyDistrict: "Distrito", cityVillage: "Centro" } } } } as never);
    expect((await getPatient("synthetic-patient")).residence).toBe("Provincia → Distrito → Centro");
    expect(openmrsFetch).toHaveBeenLastCalledWith(expect.stringContaining("preferredAddress:(stateProvince,countyDistrict,cityVillage)"), expect.any(Object));
  });
  it("reads and updates an existing case without creating a new case", async () => {
    const draft = { patientUuid: "p", encounterUuid: "e", providerUuid: "provider", locationUuid: "location", diagnosisUuid: "diagnosis", diagnosisType: "PROBABLE" as const };
    vi.mocked(openmrsFetch).mockResolvedValue({ data: { ...draft, uuid: "synthetic-case" } } as never);
    await getSurveillanceCase("synthetic-case");
    await updateSurveillanceCase("synthetic-case", draft);
    expect(openmrsFetch).toHaveBeenLastCalledWith("/ws/rest/v1/sihsalusepidemiologicalsurveillance/cases/synthetic-case", expect.objectContaining({ method: "PUT", body: draft }));
    expect(safeError({ status: 409, responseBody: { code: "CASE_CLOSED" } }).code).toBe("CASE_CLOSED");
  });
  it("sends confirmed populated-center defaults and encodes explicit report filters", async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({ data: {} } as never);
    await getReport("event", "2026-01-01", "2026-01-03", "semana");
    expect(openmrsFetch).toHaveBeenLastCalledWith(
      expect.stringContaining(
        "zoneLevel=CENTRO_POBLADO&diagnosisType=CONFIRMADO",
      ),
      expect.any(Object),
    );
    await getReport("event", "2026-01-01", "2026-01-03", "mes", undefined, {
      zoneLevel: "DISTRITO",
      diagnosisType: "TODOS",
      address: "synthetic&zone",
    });
    expect(openmrsFetch).toHaveBeenLastCalledWith(
      expect.stringContaining(
        "zoneLevel=DISTRITO&diagnosisType=TODOS&address=synthetic%26zone",
      ),
      expect.any(Object),
    );
  });
  it.each([
    "INVALID_ZONE_LEVEL",
    "INVALID_DIAGNOSIS_TYPE",
    "INVALID_REPORT_ADDRESS",
  ])("preserves safe report validation code %s", (code) => {
    expect(safeError({ status: 422, responseBody: { code } }).code).toBe(code);
  });
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
          { uuid: "encounter-diagnosis", diagnosis: { coded: { uuid: "diagnosis" } } },
          { uuid: "discarded-diagnosis", voided: true, diagnosis: { coded: { uuid: "discarded" } } },
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
      await expect(searchPatients("Synthetic")).rejects.toMatchObject({
        status,
      });
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
      location: [
        {
          location: { reference: "Location/location", display: "Main clinic" },
        },
      ],
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
  expect(
    observations.some((observation) => observation.id === "observation"),
  ).toBe(true);
  expect(
    observations.find((observation) => observation.id === "observation"),
  ).toMatchObject({
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
    expect.stringContaining(
      "/provider?v=custom%3A%28uuid%2Cdisplay%2Cperson%3A%28uuid%29%29",
    ),
    expect.any(Object),
  );
});

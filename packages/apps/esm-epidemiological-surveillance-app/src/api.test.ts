import { openmrsFetch } from "@openmrs/esm-framework";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fhirSearch,
  getEncounterDiagnoses,
  safeError,
  SurveillanceApiError,
} from "./api";
vi.mock("@openmrs/esm-framework", () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: "/ws/rest/v1",
  fhirBaseUrl: "/ws/fhir2/R4",
}));
describe("surveillance API", () => {
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
  it("loads all FHIR pages", async () => {
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({
        data: {
          entry: [{ resource: { resourceType: "Patient", id: "one" } }],
          link: [
            { relation: "next", url: "/openmrs/ws/fhir2/R4/Patient?page=2" },
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        data: { entry: [{ resource: { resourceType: "Patient", id: "two" } }] },
      } as never);
    expect(
      (await fhirSearch("Patient", { name: "Synthetic" })).map(
        (resource) => resource.id,
      ),
    ).toEqual(["one", "two"]);
  });
  it("rejects pagination to a foreign host", async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: {
        link: [{ relation: "next", url: "https://external.invalid/patient" }],
      },
    } as never);
    await expect(
      fhirSearch("Patient", { name: "Synthetic" }),
    ).rejects.toBeInstanceOf(SurveillanceApiError);
    expect(openmrsFetch).toHaveBeenCalledTimes(1);
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
        fhirSearch("Patient", { name: "Synthetic" }),
      ).rejects.toMatchObject({ status });
    },
  );
});

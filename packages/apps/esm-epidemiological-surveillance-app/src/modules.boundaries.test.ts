import { openmrsFetch } from "@openmrs/esm-framework";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { patientDni, referenceId, toSurveillanceCaseDraft, validateCase } from "./case-form.utils";
import { getAgeGroups } from "./demographic.resource";
import { demographicPeriodLabel } from "./demographic-period";
import { caseDateErrors } from "./field-validation";
import { getRiskThresholds, saveRiskThresholds } from "./geographic.resource";
import { searchInfectionAddresses } from "./infection-address.resource";
import { classifyLaboratoryObservation } from "./laboratory.utils";
import { getOutbreakRules, saveOutbreakRules } from "./outbreak-rules.resource";
import { reloadSurveillancePage } from "./reload-surveillance";
import { weeklyCells, type WeeklyRow } from "./weekly-records";
import type { CaseRequest, ClinicalCatalog, FhirResource } from "./types";

vi.mock("@openmrs/esm-framework", () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: "/ws/rest/v1",
  fhirBaseUrl: "/ws/fhir2/R4",
}));

const rejected = { status: 422, responseBody: { code: "INVALID_RISK_LEVELS" } };

describe("module boundaries", () => {
  beforeEach(() => vi.mocked(openmrsFetch).mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("requires a classification and diagnosis before building a draft", () => {
    expect(() => toSurveillanceCaseDraft({ status: "SUSPECTED" } as CaseRequest, "")).toThrow(
      "A diagnosis and classification are required.",
    );
  });

  it("prefers a DNI identifier type, then an eight-digit value", () => {
    expect(
      patientDni({ identifier: [{ value: "HC-1" }, { value: "00123456", type: { text: "dni" } }] } as FhirResource),
    ).toBe("00123456");
    expect(patientDni({ identifier: [{ value: "HC-1" }, { value: "87654321" }] } as FhirResource)).toBe("87654321");
    expect(referenceId()).toBe("");
    expect(referenceId("Patient/abc/")).toBe("abc");
  });

  it("flags an investigation date that differs from the source encounter", () => {
    const catalog = { timezone: "America/Lima" } as ClinicalCatalog;
    const source = { period: { start: "2026-01-20T10:00:00-05:00" } } as FhirResource;
    expect(validateCase({ investigationDate: "2026-01-19" }, catalog, undefined, source)).toContain(
      "investigationDate",
    );
  });

  it("rejects notification timestamps that are not calendar dates", () => {
    expect(caseDateErrors({ notificationDate: "2026-02-30T10:00-05:00" } as never, "2026-03-01")).toMatchObject({
      notificationDate: "dateTimeFormat",
    });
  });

  it("keeps the label of unknown periods and maps every weekly code", () => {
    expect(demographicPeriodLabel({ key: "2026-01-01", label: "Etiqueta" }, "decada", {} as never)).toBe("Etiqueta");
    const row = {
      id: "row",
      diagnosisType: "OTRO",
      vaccinationStatus: "OTRO",
      surveillanceType: "OTRA",
      investigationForm: false,
    } as unknown as WeeklyRow;
    const cells = weeklyCells(row);
    expect(cells).toContain("OTRO");
    expect(cells).toContain("N");
  });

  it("classifies a negative laboratory result as discarded", () => {
    expect(
      classifyLaboratoryObservation(
        { valueCodeableConcept: { coding: [{ code: "no" }] } } as FhirResource,
        { trueConceptUuid: "yes", falseConceptUuid: "no" } as ClinicalCatalog,
      ),
    ).toBe("DISCARDED");
  });

  it("reads and writes configuration resources and maps failures", async () => {
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({ data: [{ key: "INFANTS" }] } as never)
      .mockResolvedValueOnce({ data: [10, 20, 50] } as never)
      .mockRejectedValueOnce(rejected)
      .mockResolvedValueOnce({ data: [] } as never)
      .mockResolvedValueOnce({ data: [{ id: "rule" }] } as never)
      .mockRejectedValueOnce(rejected);
    await expect(getAgeGroups()).resolves.toEqual([{ key: "INFANTS" }]);
    await expect(getRiskThresholds()).resolves.toEqual([10, 20, 50]);
    await expect(saveRiskThresholds([1, 2, 3])).rejects.toMatchObject({ code: "INVALID_RISK_LEVELS" });
    await expect(getOutbreakRules()).resolves.toEqual([]);
    await expect(saveOutbreakRules([])).resolves.toEqual([{ id: "rule" }]);
    await expect(saveOutbreakRules([])).rejects.toMatchObject({ code: "INVALID_RISK_LEVELS" });
  });

  it("sorts infection places and refuses searches that need too many requests", async () => {
    const district = { uuid: "d", name: "Napo", parent: { uuid: "p", name: "Maynas", parent: { uuid: "x", name: "Loreto" } } };
    vi.mocked(openmrsFetch).mockImplementation(async (url: string) => {
      const field = new URL(url, "http://local").searchParams.get("addressField");
      const parent = new URL(url, "http://local").searchParams.get("parentUuid");
      if (field === "cityVillage" && !parent)
        return {
          data: [
            { uuid: "b", name: "Santa Clotilde", userGeneratedId: "1601070001", parent: district },
            { uuid: "a", name: "Angoteros", userGeneratedId: "1601070002", parent: district },
          ],
        } as never;
      if (field === "stateProvince")
        return { data: Array.from({ length: 60 }, (_, i) => ({ uuid: `p${i}`, name: `Provincia ${i}` })) } as never;
      return { data: [] } as never;
    });
    await expect(searchInfectionAddresses("santa")).rejects.toMatchObject({ code: "ADDRESS_SEARCH_TOO_BROAD" });
    vi.mocked(openmrsFetch).mockImplementation(async (url: string) => {
      const field = new URL(url, "http://local").searchParams.get("addressField");
      const parent = new URL(url, "http://local").searchParams.get("parentUuid");
      if (field === "cityVillage" && !parent)
        return {
          data: [
            { uuid: "b", name: "Santa Clotilde", userGeneratedId: "1601070001", parent: district },
            { uuid: "a", name: "Angoteros", userGeneratedId: "1601070002", parent: district },
          ],
        } as never;
      return { data: [] } as never;
    });
    const places = await searchInfectionAddresses("napo");
    expect(places.map((place) => place.uuid)).toEqual(["a", "b"]);
  });

  it("reloads the surveillance page", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    reloadSurveillancePage();
    expect(reload).toHaveBeenCalled();
  });
});

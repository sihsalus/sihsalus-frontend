import { openmrsFetch } from "@openmrs/esm-framework";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSurveillanceCase,
  encountersForPatient,
  getEncounterDiagnosesDetails,
  getEncounterObservations,
  localPage,
  references,
  searchPatients,
} from "./api";
import { findNotifiableEvent, patientName, valueConcepts } from "./case-form.utils";
import { demographicPeriodLabel } from "./demographic-period";
import { conceptIcd10, diagnosisLabel } from "./diagnosis-display";
import { searchInfectionAddresses } from "./infection-address.resource";
import { classifyLaboratoryObservation, laboratoryLabel } from "./laboratory.utils";
import type { Catalogue, FhirResource, SurveillanceCaseDraft } from "./types";

vi.mock("@openmrs/esm-framework", () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: "/ws/rest/v1",
  fhirBaseUrl: "/ws/fhir2/R4",
}));

const respond = (data: unknown) => vi.mocked(openmrsFetch).mockResolvedValueOnce({ data } as never);

describe("optional data in REST resources", () => {
  beforeEach(() => vi.mocked(openmrsFetch).mockReset());
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as { openmrsBase?: string }).openmrsBase;
  });

  it("accepts encounters without diagnoses and cases without generated alerts", async () => {
    respond({ uuid: "encounter", patient: { uuid: "patient" } });
    await expect(getEncounterDiagnosesDetails("encounter", "patient")).resolves.toEqual([]);
    respond({ uuid: "case" });
    const dispatched = vi.spyOn(window, "dispatchEvent");
    await createSurveillanceCase({} as SurveillanceCaseDraft);
    expect((dispatched.mock.calls[0][0] as CustomEvent).detail).toEqual([]);
  });

  it("maps patients with partial identifiers and addresses", async () => {
    respond({
      results: [
        {
          uuid: "patient",
          display: "Paciente",
          identifiers: [{ identifier: "" }, { identifier: "12345678", identifierType: { name: "DNI" } }],
          person: { preferredAddress: { address1: "", stateProvince: "", countyDistrict: "", cityVillage: "" } },
        },
      ],
    });
    const [patient] = await searchPatients("Paciente");
    expect(patient.identifier).toEqual([{ value: "12345678", type: { text: "DNI" } }]);
    expect(patient.residence).toBe("— → — → — → —");
  });

  it("maps encounters and observations with missing optional fields", async () => {
    respond({
      results: [
        { uuid: "bare", patient: { uuid: "patient" } },
        { uuid: "typed", patient: { uuid: "patient" }, encounterType: { display: "Atención" } },
      ],
    });
    const encounters = await encountersForPatient("patient");
    expect(encounters[0]).toMatchObject({ id: "bare", period: undefined, location: undefined, type: undefined });
    expect(encounters[1].type).toEqual([{ text: "Atención" }]);

    respond({
      uuid: "encounter",
      patient: { uuid: "patient" },
      obs: [
        { uuid: "text", value: "Positivo" },
        { uuid: "voided", voided: true },
      ],
    });
    const observations = await getEncounterObservations("encounter", "patient");
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ valueString: "Positivo", valueDateTime: "Positivo", code: undefined });
    respond({ uuid: "encounter", patient: { uuid: "patient" } });
    await expect(getEncounterObservations("encounter", "patient")).resolves.toEqual([]);
  });

  it("reads locations and follows pages under a configured OpenMRS base", async () => {
    respond({ results: [{ uuid: "location", display: "Sede" }] });
    await expect(references("location")).resolves.toEqual([{ uuid: "location", display: "Sede" }]);
    expect(vi.mocked(openmrsFetch).mock.calls[0][0]).not.toContain("person");
    (globalThis as { openmrsBase?: string }).openmrsBase = "/clinica";
    expect(localPage("/clinica/ws/rest/v1/location?startIndex=100", "/ws/rest/v1")).toBe(
      "/ws/rest/v1/location?startIndex=100",
    );
  });

  it("ignores short numeric place codes", async () => {
    await expect(searchInfectionAddresses("16010")).resolves.toEqual([]);
    expect(openmrsFetch).not.toHaveBeenCalled();
  });
});

describe("display helpers with incomplete data", () => {
  it("builds patient names from parts or identifiers", () => {
    expect(patientName({ name: [{ given: ["Ana"], family: "Ríos" }] } as FhirResource)).toBe("Ana Ríos");
    expect(patientName({ name: [{}], identifier: [{ value: "HC-1" }] } as FhirResource)).toBe("HC-1");
    expect(patientName({} as FhirResource)).toBe("");
    expect(valueConcepts({ valueCodeableConcept: { coding: [{ display: "Sin código" }] } } as FhirResource)).toEqual([]);
  });

  it("names notifiable events by concept when no display is stored", () => {
    const catalogue = {
      events: [{ uuid: "event", conceptUuid: "concept", diagnosisConceptUuids: [] }],
    } as unknown as Catalogue;
    expect(findNotifiableEvent("concept", catalogue)?.eventName).toBe("concept");
  });

  it("resolves ICD-10 codes by source name and short display names", () => {
    expect(
      conceptIcd10([{ conceptReferenceTerm: { code: "A90", conceptSource: { name: "ICD-10" } } }, {}]),
    ).toBe("A90");
    expect(conceptIcd10(undefined, undefined, [{ display: "a91", conceptNameType: "SHORT" }])).toBe("A91");
    expect(diagnosisLabel(undefined, "A90")).toBe("A90");
  });

  it("labels laboratory results from coded displays and plain text", () => {
    const coded = { valueCodeableConcept: { coding: [{ display: "Reactivo" }] } } as FhirResource;
    expect(classifyLaboratoryObservation(coded, {} as Catalogue["catalog"])).toBe("CONFIRMED");
    expect(classifyLaboratoryObservation({ valueString: "No reactivo" } as FhirResource, {} as Catalogue["catalog"])).toBe(
      "DISCARDED",
    );
    expect(laboratoryLabel({ code: { coding: [{ display: "Prueba rápida" }] }, valueString: "Positivo" } as FhirResource)).toBe(
      "Prueba rápida · Positivo",
    );
  });

  it("keeps labels of non-date keys and assigns late December to the next epidemiological year", () => {
    const calendar = {} as Catalogue["catalog"];
    expect(demographicPeriodLabel({ key: "F", label: "Femenino" }, "semana", calendar)).toBe("Femenino");
    expect(demographicPeriodLabel({ key: "2026-13-45", label: "Inválida" }, "semana", calendar)).toBe("Inválida");
    expect(demographicPeriodLabel({ key: "2024-12-30", label: "" }, "semana", calendar)).toBe("2025-S01");
  });
});

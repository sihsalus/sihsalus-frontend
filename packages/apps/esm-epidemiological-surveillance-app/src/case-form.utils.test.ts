import { describe, expect, it } from "vitest";
import {
  findDiagnosisMapping,
  dateInZone,
  prefill,
  validateCase,
  patientAge,
  pregnancyEligible,
  invalidCaseDates,
  encounterDate,
} from "./case-form.utils";
import { catalogue, request } from "./test-fixtures";
describe("case form validation", () => {
  it.each(["vaccinationStatus", "surveillanceType", "investigationForm"] as const)("requires %s before registering", (field) => {
    expect(validateCase({ ...request, [field]: undefined }, catalogue.catalog)).toContain(field);
  });
  it.each([
    ["2016-01-21", 9, false],
    ["2016-01-20", 10, true],
    ["1970-01-21", 55, true],
    ["1970-01-20", 56, false],
  ])("uses completed age for pregnancy at birth %s", (birth, age, eligible) => {
    expect(patientAge(birth, "2026-01-20")).toBe(age);
    expect(pregnancyEligible("female", age)).toBe(eligible);
    expect(pregnancyEligible("M", age)).toBe(false);
  });
  it("disables pregnancy for unknown age or sex", () => {
    expect(pregnancyEligible("F")).toBe(false);
    expect(pregnancyEligible(undefined, 25)).toBe(false);
  });
  it("validates date ordering and accepts equality with today", () => {
    expect(
      invalidCaseDates(
        { investigationDate: "2026-01-20", notificationDate: "2026-01-20T12:00:00-05:00" },
        "2026-01-20",
      ),
    ).toEqual([]);
    expect(
      invalidCaseDates(
        { investigationDate: "2026-01-20", notificationDate: "2026-01-19T12:00:00-05:00" },
        "2026-01-20",
      ),
    ).toContain("notificationDate");
    expect(
      invalidCaseDates(
        { investigationDate: "2026-01-21", notificationDate: "2026-01-22T12:00:00-05:00" },
        "2026-01-20",
      ),
    ).toEqual(["investigationDate", "notificationDate"]);
  });
  it("derives the encounter date in the catalogue timezone", () => {
    expect(
      encounterDate(
        {
          resourceType: "Encounter",
          id: "synthetic",
          period: { start: "2026-01-21T01:00:00Z" },
        },
        "America/Lima",
      ),
    ).toBe("2026-01-20");
  });
  it("requires patient and clinical context", () => {
    expect(validateCase({}, catalogue.catalog)).toEqual(
      expect.arrayContaining([
        "patientUuid",
        "sourceEncounterUuid",
        "providerUuid",
        "eventUuid",
      ]),
    );
  });
  it("requires a result for a confirmed case", () => {
    expect(
      validateCase({ ...request, status: "CONFIRMED" }, catalogue.catalog),
    ).toContain("laboratoryResultUuid");
  });
  it.each(["2026-02-30", "2999-01-01", "yesterday"])(
    "rejects invalid onset %s",
    (onsetDate) => {
      expect(
        validateCase({ ...request, onsetDate }, catalogue.catalog),
      ).toContain("onsetDate");
    },
  );
  it("accepts a complete suspected case", () =>
    expect(validateCase(request, catalogue.catalog)).toEqual([]));
  it("uses the configured time zone at UTC day boundary", () => {
    expect(dateInZone("America/Lima", new Date("2026-01-02T01:00:00Z"))).toBe(
      "2026-01-01",
    );
  });
  it("prefills coded data only from exact concept references", () => {
    const result = prefill(
      [
        {
          resourceType: "Observation",
          id: "obs",
          code: { coding: [{ code: "status" }] },
          valueCodeableConcept: { coding: [{ code: "confirmed" }] },
        },
        {
          resourceType: "Observation",
          id: "onset",
          code: { coding: [{ code: "onset" }] },
          valueDateTime: "2026-01-19T00:00:00Z",
        },
      ],
      ["diagnosis"],
      catalogue,
    );
    expect(result).toMatchObject({
      status: "CONFIRMED",
      onsetDate: "2026-01-19",
      eventUuid: "event",
    });
  });
  it("excludes inactive diagnoses and event prefills", () => {
    const inactive = {
      ...catalogue,
      events: catalogue.events.map((event) => ({ ...event, active: false })),
    };
    expect(findDiagnosisMapping("diagnosis", inactive)).toBeUndefined();
    expect(
      findDiagnosisMapping(inactive.events[0].conceptUuid, inactive),
    ).toBeUndefined();
    expect(prefill([], ["diagnosis"], inactive).eventUuid).toBeUndefined();
  });
  it("does not pick among ambiguous observations", () => {
    const obs = {
      resourceType: "Observation",
      id: "one",
      code: { coding: [{ code: "onset" }] },
      valueDateTime: "2026-01-19",
    };
    expect(
      prefill([obs, { ...obs, id: "two" }], [], catalogue).onsetDate,
    ).toBeUndefined();
  });
});

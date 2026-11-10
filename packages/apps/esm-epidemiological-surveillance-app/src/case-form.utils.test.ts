import { describe, expect, it } from "vitest";
import {
  findNotifiableEvent,
  dateInZone,
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
  it("matches a diagnosis configured directly as the event before set membership", () => {
    const withDirect = {
      ...catalogue,
      events: [
        ...catalogue.events,
        { ...catalogue.events[0], uuid: "direct", conceptUuid: "diagnosis", icd10: "B50.0", diagnosisConceptUuids: ["diagnosis"] },
      ],
    };
    expect(findNotifiableEvent("diagnosis", catalogue)?.eventUuid).toBe("event");
    expect(findNotifiableEvent("diagnosis", withDirect)).toMatchObject({ eventUuid: "direct", icd10Code: "B50.0" });
    expect(findNotifiableEvent("other", catalogue)).toBeUndefined();
  });
  it("excludes diagnoses of inactive events", () => {
    const inactive = {
      ...catalogue,
      events: catalogue.events.map((event) => ({ ...event, active: false })),
    };
    expect(findNotifiableEvent("diagnosis", inactive)).toBeUndefined();
    expect(
      findNotifiableEvent(inactive.events[0].conceptUuid, inactive),
    ).toBeUndefined();
  });
});

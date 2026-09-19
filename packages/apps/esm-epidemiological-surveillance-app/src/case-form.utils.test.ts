import { describe, expect, it } from "vitest";
import { dateInZone, prefill, validateCase } from "./case-form.utils";
import { catalogue, request } from "./test-fixtures";
describe("case form validation", () => {
  it("requires patient and clinical context", () => {
    expect(validateCase({}, catalogue.metadata)).toEqual(
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
      validateCase({ ...request, status: "CONFIRMED" }, catalogue.metadata),
    ).toContain("laboratoryResultUuid");
  });
  it.each(["2026-02-30", "2999-01-01", "yesterday"])(
    "rejects invalid onset %s",
    (onsetDate) => {
      expect(
        validateCase({ ...request, onsetDate }, catalogue.metadata),
      ).toContain("onsetDate");
    },
  );
  it("accepts a complete suspected case", () =>
    expect(validateCase(request, catalogue.metadata)).toEqual([]));
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

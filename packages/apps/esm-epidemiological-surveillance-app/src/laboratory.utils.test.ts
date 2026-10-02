import { expect, it } from "vitest";
import { classifyLaboratoryObservation } from "./laboratory.utils";
import { catalogue } from "./test-fixtures";

it.each([
  ["Positivo", "CONFIRMED"],
  ["No reactivo", "DISCARDED"],
  ["Negativo", "DISCARDED"],
  ["Pendiente", null],
] as const)("uses registration text rules for %s", (text, expected) => {
  expect(
    classifyLaboratoryObservation(
      {
        resourceType: "Observation",
        id: "synthetic-result",
        valueString: text,
      },
      catalogue.catalog,
    ),
  ).toBe(expected);
});
it("excludes voided results and honors the catalogue's boolean concepts", () => {
  const obs = {
    resourceType: "Observation",
    id: "synthetic-result",
    valueCodeableConcept: {
      coding: [{ code: catalogue.catalog.trueConceptUuid ?? "true" }],
    },
  };
  expect(classifyLaboratoryObservation(obs, catalogue.catalog)).toBe(
    "CONFIRMED",
  );
  expect(
    classifyLaboratoryObservation(
      { ...obs, status: "entered-in-error" },
      catalogue.catalog,
    ),
  ).toBeNull();
});

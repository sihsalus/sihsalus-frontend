import { expect, it } from "vitest";
import { conceptIcd10, diagnosisLabel } from "./diagnosis-display";

it("reads MINSA SHORT codes without mappings and rejects ambiguous or voided names", () => {
  const name = { name: "A972", conceptNameType: "SHORT" };
  expect(diagnosisLabel("DENGUE GRAVE", conceptIcd10([], "icd", [name]))).toBe("A972 - DENGUE GRAVE");
  expect(conceptIcd10([], "icd", [{ ...name, voided: true }])).toBeUndefined();
  expect(conceptIcd10([], "icd", [name, { ...name, name: "A971" }])).toBeUndefined();
  expect(conceptIcd10([], "icd", [{ ...name, conceptNameType: "FULLY_SPECIFIED" }])).toBeUndefined();
});

it("shows code and diagnosis without duplicating the prefix", () => {
  expect(diagnosisLabel("DENGUE GRAVE", "A972")).toBe("A972 - DENGUE GRAVE");
  expect(diagnosisLabel("A972 - DENGUE GRAVE", "A972")).toBe(
    "A972 - DENGUE GRAVE",
  );
  expect(diagnosisLabel("Diagnosis")).toBe("Diagnosis");
});

it("uses only the configured source and declines ambiguous mappings", () => {
  const mapping = (code: string, source = "icd") => ({
    conceptReferenceTerm: { code, conceptSource: { uuid: source } },
  });
  expect(conceptIcd10([mapping("A972"), mapping("123", "other")], "icd")).toBe(
    "A972",
  );
  expect(
    conceptIcd10([mapping("A972"), mapping("A971")], "icd"),
  ).toBeUndefined();
  expect(
    conceptIcd10(
      [
        {
          ...mapping("A972"),
          conceptReferenceTerm: {
            ...mapping("A972").conceptReferenceTerm,
            retired: true,
          },
        },
      ],
      "icd",
    ),
  ).toBeUndefined();
});

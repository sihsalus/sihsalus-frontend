import type { ClinicalCatalog, Disease, FhirResource } from "./types";
import { hasConcept, valueConcepts } from "./case-form.utils";

/** Shared by registration and editing: preserve the existing classification rules. */
export function classifyLaboratoryObservation(
  obs: FhirResource,
  catalog: ClinicalCatalog,
  disease?: Disease,
): "CONFIRMED" | "DISCARDED" | null {
  if (["cancelled", "entered-in-error"].includes(obs.status ?? "")) return null;
  const test = disease?.laboratoryTests.find((item) =>
    hasConcept(obs, item.resultConceptUuid),
  );
  const codes = valueConcepts(obs);
  if (test?.positiveAnswerUuids.some((code) => codes.includes(code)))
    return "CONFIRMED";
  if (test?.negativeAnswerUuids.some((code) => codes.includes(code)))
    return "DISCARDED";
  if (catalog.trueConceptUuid && codes.includes(catalog.trueConceptUuid))
    return "CONFIRMED";
  if (catalog.falseConceptUuid && codes.includes(catalog.falseConceptUuid))
    return "DISCARDED";
  const text = (
    obs.valueCodeableConcept?.text ||
    obs.valueCodeableConcept?.coding?.[0]?.display ||
    obs.valueString ||
    ""
  ).toLowerCase();
  if (
    ["no reactiv", "non-reactive", "negativ", "no detectad", "ausent"].some(
      (term) => text.includes(term),
    )
  )
    return "DISCARDED";
  if (
    ["reactiv", "positiv", "detectad", "present"].some((term) =>
      text.includes(term),
    )
  )
    return "CONFIRMED";
  return null;
}

export function laboratoryLabel(obs: FhirResource): string {
  return [
    obs.orderDisplay || obs.code?.text || obs.code?.coding?.[0]?.display,
    obs.effectiveDateTime?.slice(0, 10),
    obs.valueCodeableConcept?.text ||
      obs.valueCodeableConcept?.coding?.[0]?.display ||
      obs.valueString,
  ]
    .filter(Boolean)
    .join(" · ");
}

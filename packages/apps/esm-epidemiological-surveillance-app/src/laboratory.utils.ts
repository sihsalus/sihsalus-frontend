import { displayDate } from "./date-display";
import type { ClinicalCatalog, FhirResource } from "./types";
import { valueConcepts } from "./case-form.utils";

/**
 * Generic classification shared by registration and editing. Laboratory tests are not mapped
 * per notifiable event: the true/false concepts or the answer name decide the classification.
 */
export function classifyLaboratoryObservation(
  obs: FhirResource,
  catalog: ClinicalCatalog,
): "CONFIRMED" | "DISCARDED" | null {
  if (["cancelled", "entered-in-error"].includes(obs.status ?? "")) return null;
  const codes = valueConcepts(obs);
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
    displayDate(obs.effectiveDateTime),
    obs.valueCodeableConcept?.text ||
      obs.valueCodeableConcept?.coding?.[0]?.display ||
      obs.valueString,
  ]
    .filter(Boolean)
    .join(" · ");
}

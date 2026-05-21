import {
  type FhirImmunizationConceptMappingKey,
  type FhirImmunizationConceptMappings,
} from '../types/fhir-immunization-domain';

export const defaultFhirImmunizationConceptMappings: FhirImmunizationConceptMappings = {
  immunizationResourceConcept: 'CIEL:1421',
  vaccineConcept: 'CIEL:984',
  vaccinationDateConcept: 'CIEL:1410',
  doseNumberConcept: 'CIEL:1418',
  manufacturerConcept: 'CIEL:1419',
  lotNumberConcept: 'CIEL:1420',
  expirationDateConcept: 'CIEL:165907',
  commentConcept: 'CIEL:161011',
  nextDoseDateConcept: 'CIEL:170000',
};

export const fhirImmunizationConceptMappingLabels: Record<FhirImmunizationConceptMappingKey, string> = {
  immunizationResourceConcept: 'fhirConceptMappings.immunizationResourceConcept',
  vaccineConcept: 'fhirConceptMappings.vaccineConcept',
  vaccinationDateConcept: 'fhirConceptMappings.vaccinationDateConcept',
  doseNumberConcept: 'fhirConceptMappings.doseNumberConcept',
  manufacturerConcept: 'fhirConceptMappings.manufacturerConcept',
  lotNumberConcept: 'fhirConceptMappings.lotNumberConcept',
  expirationDateConcept: 'fhirConceptMappings.expirationDateConcept',
  commentConcept: 'fhirConceptMappings.commentConcept',
  nextDoseDateConcept: 'fhirConceptMappings.nextDoseDateConcept',
};

export function getFhirImmunizationConceptMappings(
  configuredMappings?: Partial<FhirImmunizationConceptMappings>,
): FhirImmunizationConceptMappings {
  return {
    ...defaultFhirImmunizationConceptMappings,
    ...(configuredMappings ?? {}),
  };
}

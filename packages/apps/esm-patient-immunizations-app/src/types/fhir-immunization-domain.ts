export type OpenmrsConcept = {
  uuid: string;
  display: string;
  setMembers?: Array<OpenmrsConcept>;
  answers?: Array<OpenmrsConcept>;
};

export type Code = {
  code: string;
  system?: string;
  display: string;
};

export type Reference = {
  type: string;
  reference: string;
};

export interface FHIRImmunizationResource {
  resourceType: 'Immunization';
  status: 'completed' | 'not-done' | 'entered-in-error';
  statusReason?: { text?: string };
  id?: string;
  vaccineCode: { coding: Array<Code> };
  patient: Reference | null;
  encounter: Reference | null;
  occurrenceDateTime: string;
  expirationDate?: string;
  extension?: Array<{
    url: string;
    valueDateTime?: string;
    valueString?: string;
  }>;
  note?: Array<{ text: string }>;
  location?: Reference | null;
  performer?: Array<{ actor: Reference | null }>;
  manufacturer?: { display: string };
  lotNumber?: string;
  protocolApplied?: Array<{ doseNumberPositiveInt: number; series?: string }>;
}

export type FhirImmunizationConceptMappings = {
  immunizationResourceConcept: string;
  vaccineConcept: string;
  vaccinationDateConcept: string;
  doseNumberConcept: string;
  manufacturerConcept: string;
  lotNumberConcept: string;
  expirationDateConcept: string;
  commentConcept: string;
  nextDoseDateConcept: string;
};

export type FhirImmunizationConceptMappingKey = keyof FhirImmunizationConceptMappings;

export type FHIRImmunizationBundleEntry = {
  fullUrl: string;
  resource: FHIRImmunizationResource;
};

export type FHIRImmunizationBundle = {
  resourceType: 'Bundle';
  entry: Array<FHIRImmunizationBundleEntry>;
};

export type ImmunizationSequence = {
  sequenceLabel: string;
  sequenceNumber: number;
  intervalInDaysAfterPreviousDose?: number;
  minAgeInDays?: number;
  maxAgeInDays?: number;
  minsaLabel?: string;
  minsaPopulation?: string;
};

export type ImmunizationSequenceDefinition = {
  vaccineConceptUuid: string;
  sequences: Array<ImmunizationSequence>;
};

export type ImmunizationWidgetConfigObject = {
  minsaReference?: {
    nts: string;
    approvedBy: string;
    latestModification: string;
    vaccineCount: number;
    protectedDiseaseCount: number;
    notes?: string;
  };
  immunizationConceptSet: string;
  fhirConceptMappings: Partial<FhirImmunizationConceptMappings>;
  supplementalVaccines?: Array<{
    uuid: string;
    display: string;
    minsaCategory?: string;
  }>;
  sequenceDefinitions: Array<ImmunizationSequenceDefinition>;
};

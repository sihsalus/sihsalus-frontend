import { type ExistingDoses, type ImmunizationFormData, type ImmunizationGrouped } from '../types';
import {
  type Code,
  type FHIRImmunizationBundle,
  type FHIRImmunizationResource,
  type Reference,
} from '../types/fhir-immunization-domain';

export const FHIR_NEXT_DOSE_DATE_EXTENSION_URL = 'http://hl7.eu/fhir/StructureDefinition/immunization-nextDoseDate';
export const FHIR_MINSA_PROGRAM_CONTEXT_EXTENSION_URL =
  'https://sihsalus.org/fhir/StructureDefinition/minsa-immunization-program-context';

const mapToImmunizationDoseFromResource = (immunizationResource: FHIRImmunizationResource): ExistingDoses | null => {
  if (!immunizationResource) {
    return null;
  }
  const immunizationObsUuid = immunizationResource?.id;
  const manufacturer = immunizationResource?.manufacturer?.display;
  const lotNumber = immunizationResource?.lotNumber;
  const protocolApplied = immunizationResource?.protocolApplied?.length > 0 && immunizationResource?.protocolApplied[0];
  const doseNumber = protocolApplied?.doseNumberPositiveInt;
  const occurrenceDateTime = immunizationResource?.occurrenceDateTime?.toString();

  const nextDoseDateExtension = immunizationResource?.extension?.find(
    (ext) => ext.url === FHIR_NEXT_DOSE_DATE_EXTENSION_URL,
  );
  const nextDoseDate = nextDoseDateExtension?.valueDateTime?.toString();

  // SIH.SALUS extension used to distinguish regular schedule, catch-up,
  // campaign and special-indication records without overloading the dose label.
  const programContextExtension = immunizationResource?.extension?.find(
    (ext) => ext.url === FHIR_MINSA_PROGRAM_CONTEXT_EXTENSION_URL,
  );
  const programContext = programContextExtension?.valueString?.toString();

  const expirationDate = immunizationResource?.expirationDate?.toString();
  const note = immunizationResource?.note?.length > 0 && immunizationResource?.note[0]?.text;
  return {
    immunizationObsUuid,
    manufacturer,
    lotNumber,
    nextDoseDate,
    doseNumber,
    note: note ? [{ text: note }] : [],
    occurrenceDateTime,
    expirationDate,
    programContext,
    status: immunizationResource.status === 'not-done' ? 'not-done' : 'completed',
    statusReason: immunizationResource.statusReason?.text,
    visitUuid: fromReference(immunizationResource?.encounter),
  };
};

const findCodeWithoutSystem = function (immunizationResource: FHIRImmunizationResource): Code | null {
  if (!immunizationResource?.vaccineCode?.coding) {
    return null;
  }
  return immunizationResource.vaccineCode.coding.find((code: Code) => code.system === undefined) ?? null;
};

export const mapFromFHIRImmunizationBundle = (
  immunizationData: FHIRImmunizationBundle | FHIRImmunizationResource[],
): Array<ImmunizationGrouped> => {
  if (!immunizationData) {
    return [];
  }

  let immunizations: FHIRImmunizationResource[] = [];

  if (Array.isArray(immunizationData)) {
    immunizations = immunizationData.filter(
      (item) => item && typeof item === 'object' && item.resourceType === 'Immunization',
    );
  } else if (immunizationData?.entry) {
    immunizations = immunizationData.entry
      .filter((entry) => entry?.resource?.resourceType === 'Immunization')
      .map((entry) => entry.resource);
  }

  if (!immunizations.length) {
    return [];
  }

  const groupByImmunization = immunizations.reduce<Record<string, FHIRImmunizationResource[]>>((acc, item) => {
    const key = findCodeWithoutSystem(item)?.code ?? '';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const validGroups = Object.entries(groupByImmunization).filter(([key]) => key);

  const groups = validGroups.map(([_key, immunizationsForOneVaccine]) => {
    const existingDoses: Array<ExistingDoses> = immunizationsForOneVaccine
      .map(mapToImmunizationDoseFromResource)
      .filter((dose) => dose !== null);

    const codeWithoutSystem = findCodeWithoutSystem(immunizationsForOneVaccine[0]);

    return {
      vaccineName: codeWithoutSystem?.display,
      vaccineUuid: codeWithoutSystem?.code,
      existingDoses: existingDoses
        .slice()
        .sort((a, b) => (b.occurrenceDateTime ?? '').localeCompare(a.occurrenceDateTime ?? '')),
    };
  });

  return groups
    .slice()
    .sort((a, b) =>
      (b.existingDoses?.[0]?.occurrenceDateTime ?? '').localeCompare(a.existingDoses?.[0]?.occurrenceDateTime ?? ''),
    );
};

function toReferenceOfType(type: string, referenceValue: string): Reference | null {
  if (!referenceValue) {
    return null;
  }
  const reference = `${type}/${referenceValue}`;
  return { type, reference };
}

function fromReference(reference: Reference | null): string | null {
  if (!reference || !reference.reference) {
    return null;
  }
  return reference.reference.split('/')[1];
}

export const mapToFHIRImmunizationResource = (
  immunizationFormData: ImmunizationFormData,
  visitUuid: string,
  locationUuid: string,
  providerUuid: string,
): FHIRImmunizationResource => {
  const resource: FHIRImmunizationResource = {
    resourceType: 'Immunization',
    status: immunizationFormData.status ?? 'completed',
    id: immunizationFormData.immunizationId,
    vaccineCode: {
      coding: [
        {
          code: immunizationFormData.vaccineUuid,
          display: immunizationFormData.vaccineName,
        },
      ],
    },
    patient: toReferenceOfType('Patient', immunizationFormData.patientUuid),
    encounter: toReferenceOfType('Encounter', visitUuid),
    occurrenceDateTime: immunizationFormData.vaccinationDate,
    expirationDate: immunizationFormData.expirationDate || undefined,
    extension: [
      ...(immunizationFormData.nextDoseDate
        ? [
            {
              url: FHIR_NEXT_DOSE_DATE_EXTENSION_URL,
              valueDateTime: immunizationFormData.nextDoseDate,
            },
          ]
        : []),
      // Routine schedule is the default and is intentionally omitted to avoid
      // storing redundant extensions in FHIR resources.
      ...(immunizationFormData.programContext && immunizationFormData.programContext !== 'routine'
        ? [
            {
              url: FHIR_MINSA_PROGRAM_CONTEXT_EXTENSION_URL,
              valueString: immunizationFormData.programContext,
            },
          ]
        : []),
    ],
    note: immunizationFormData.note?.trim() ? [{ text: immunizationFormData.note.trim() }] : [],
    location: toReferenceOfType('Location', locationUuid),
  };

  const statusReason = immunizationFormData.statusReason?.trim();
  if (statusReason) {
    resource.statusReason = { text: statusReason };
  }

  // performer: only when provider is present
  if (providerUuid) {
    resource.performer = [{ actor: toReferenceOfType('Practitioner', providerUuid) }];
  }

  // manufacturer: only when non-empty
  const manufacturer = immunizationFormData.manufacturer?.trim();
  if (manufacturer) {
    resource.manufacturer = {
      display: manufacturer,
    };
  }

  // lotNumber: only when non-empty
  const lotNumber = immunizationFormData.lotNumber?.trim();
  if (lotNumber) {
    resource.lotNumber = lotNumber;
  }

  // protocolApplied: only when dose is a number >= 1
  const dose = immunizationFormData.doseNumber;
  if (typeof dose === 'number' && dose >= 1) {
    resource.protocolApplied = [{ doseNumberPositiveInt: dose }];
  }
  // if dose is null/undefined, omit protocolApplied entirely to clear backend dose

  return resource;
};

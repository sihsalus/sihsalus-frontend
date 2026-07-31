import type { Identifier } from '../types';

type ExportIdentifier = {
  label: string;
  value: string;
  order: number;
};

function normalizeIdentifierType(value?: string): string {
  return (
    value
      ?.trim()
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '') ?? ''
  );
}

function resolveIdentifierType(values: Array<string | undefined>): Pick<ExportIdentifier, 'label' | 'order'> | null {
  for (const value of values) {
    const normalized = normalizeIdentifierType(value);

    if (/^(hc|hce)$/.test(normalized) || normalized.includes('historia clinica')) {
      return { label: 'HC', order: 0 };
    }
    if (normalized === 'dni' || normalized.includes('documento nacional de identidad')) {
      return { label: 'DNI', order: 1 };
    }
    if (normalized === 'ce' || normalized.includes('carne de extranjeria')) {
      return { label: 'CE', order: 2 };
    }
    if (normalized === 'pass' || normalized.includes('pasaporte')) {
      return { label: 'PASS', order: 3 };
    }
    // Some external integrations use CV as their document code. Preserve it
    // instead of discarding a valid identifier that is unknown to OpenMRS.
    if (normalized === 'cv') {
      return { label: 'CV', order: 4 };
    }
    if (
      normalized === 'die' ||
      normalized.includes('documento de identidad extranjero') ||
      normalized.includes('cedula de identidad')
    ) {
      return { label: 'DIE', order: 4 };
    }
    if (normalized === 'cnv' || normalized.includes('nacido vivo')) {
      return { label: 'CNV', order: 5 };
    }
  }

  return null;
}

function fromOpenmrsIdentifier(identifier: Identifier): ExportIdentifier | null {
  const value = identifier.identifier?.trim();
  const type = resolveIdentifierType([
    identifier.identifierName,
    identifier.identifierType?.name,
    identifier.identifierType?.display,
  ]);

  return value && type ? { ...type, value } : null;
}

function fromFhirIdentifier(identifier: fhir.Identifier): ExportIdentifier | null {
  const value = identifier.value?.trim();
  const type = resolveIdentifierType([
    identifier.type?.text,
    ...(identifier.type?.coding?.flatMap((coding) => [coding.display, coding.code]) ?? []),
  ]);

  return value && type ? { ...type, value } : null;
}

/**
 * Formats the clinical-history and civil-document identifiers used by SIHSALUS.
 * The appointment API does not always return the same identifier representation,
 * so values from its OpenMRS payload and from the complete FHIR patient are merged.
 */
export function formatPatientIdentifiers(
  openmrsIdentifiers: Array<Identifier> | null | undefined = [],
  fhirIdentifiers: Array<fhir.Identifier> | null | undefined = [],
  fallbackIdentifier?: string | null,
): string {
  const identifiers = [
    ...(openmrsIdentifiers ?? []).map(fromOpenmrsIdentifier),
    ...(fhirIdentifiers ?? []).map(fromFhirIdentifier),
  ].filter((identifier): identifier is ExportIdentifier => Boolean(identifier));
  const uniqueIdentifiers = Array.from(
    identifiers.reduce((byValue, identifier) => {
      if (!byValue.has(identifier.value)) {
        byValue.set(identifier.value, identifier);
      }
      return byValue;
    }, new Map<string, ExportIdentifier>()),
  )
    .map(([, identifier]) => identifier)
    .sort((left, right) => left.order - right.order);

  if (uniqueIdentifiers.length) {
    return uniqueIdentifiers.map(({ label, value }) => `${label}: ${value}`).join('; ');
  }

  return fallbackIdentifier?.trim() ?? '';
}

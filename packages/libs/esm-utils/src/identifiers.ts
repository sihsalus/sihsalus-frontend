export interface MinimalIdentifier {
  identifier?: string | null;
  preferred?: boolean | null;
  identifierType?: {
    uuid?: string | null;
    name?: string | null;
    display?: string | null;
  } | null;
}

export interface PreferredIdentifierOption {
  uuid?: string;
  name?: string;
  display?: string;
}

export interface GetPreferredIdentifierOptions {
  priority?: Array<PreferredIdentifierOption | string>;
  useOpenmrsPreferred?: boolean;
}

export const preferredIdentifierNames = ['DNI', 'CE', 'Pasaporte', 'PASS', 'DIE', 'CNV', 'N° Historia Clínica'];

const normalize = (value?: string | null) =>
  value
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const asOption = (option: PreferredIdentifierOption | string): PreferredIdentifierOption =>
  typeof option === 'string' ? { name: option, display: option } : option;

const matchesIdentifierType = (identifier: MinimalIdentifier, option: PreferredIdentifierOption | string): boolean => {
  const identifierType = identifier.identifierType;
  if (!identifierType) {
    return false;
  }

  const preferred = asOption(option);

  if (preferred.uuid && identifierType.uuid === preferred.uuid) {
    return true;
  }

  const preferredName = normalize(preferred.name);
  const preferredDisplay = normalize(preferred.display);
  const identifierName = normalize(identifierType.name);
  const identifierDisplay = normalize(identifierType.display);

  return (
    (!!preferredName && (identifierName === preferredName || identifierDisplay === preferredName)) ||
    (!!preferredDisplay && (identifierName === preferredDisplay || identifierDisplay === preferredDisplay))
  );
};

export function getPreferredIdentifier<T extends MinimalIdentifier>(
  identifiers: ReadonlyArray<T> = [],
  options: GetPreferredIdentifierOptions = {},
): T | undefined {
  const { priority = preferredIdentifierNames, useOpenmrsPreferred = true } = options;

  if (!identifiers.length) {
    return undefined;
  }

  for (const option of priority) {
    const match = identifiers.find((identifier) => matchesIdentifierType(identifier, option));
    if (match) {
      return match;
    }
  }

  if (useOpenmrsPreferred) {
    const preferredIdentifier = identifiers.find((identifier) => identifier.preferred);
    if (preferredIdentifier) {
      return preferredIdentifier;
    }
  }

  return identifiers[0];
}

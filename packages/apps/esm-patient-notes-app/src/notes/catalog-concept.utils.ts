import type { Concept, ConceptReferenceMapping } from "../types";

type CatalogConcept = Pick<Concept, "conceptMappings" | "display" | "mappings">;

export interface CatalogDisplayParts {
  code?: string;
  name: string;
}

const cie10CodePattern = /^[A-Z][0-9][A-Z0-9.]{1,5}$/i;
const cie10SourcePattern = /icd[-\s]?10|cie[-\s]?10/i;
const prestacionalCodePattern = /^\d{1,4}[A-Z]?$/i;
const prestacionalSourcePattern =
  /(?:^|\b)(?:sis|fua)(?:\b|$)|prestacion|codigo.*servicio/i;

const cie10PrefixPattern =
  /^\s*(?<code>[A-Z][0-9][A-Z0-9.]{1,5})\s*(?:[-–—:]\s*|\s+)(?<name>.+?)\s*$/i;
const cie10SuffixPattern =
  /^\s*(?<name>.+?)\s*\((?<code>[A-Z][0-9][A-Z0-9.]{1,5})\)\s*$/i;
const prestacionalPrefixPattern =
  /^\s*(?<code>\d{1,4}[A-Z]?)\s*(?:[-–—:]\s*|\s+)(?<name>.+?)\s*$/i;
const prestacionalSuffixPattern =
  /^\s*(?<name>.+?)\s*\((?<code>\d{1,4}[A-Z]?)\)\s*$/i;

function getMappingSource(mapping: ConceptReferenceMapping) {
  const configuredSource =
    mapping.conceptReferenceTerm?.conceptSource?.name ??
    mapping.conceptReferenceTerm?.conceptSource?.display;
  if (configuredSource) {
    return configuredSource.trim();
  }

  return mapping.display?.split(":", 1)[0]?.trim() ?? "";
}

function getMappingCode(mapping: ConceptReferenceMapping) {
  const configuredCode = mapping.conceptReferenceTerm?.code?.trim();
  if (configuredCode) {
    return configuredCode;
  }

  const display =
    mapping.conceptReferenceTerm?.display?.trim() ?? mapping.display?.trim();
  if (!display) {
    return undefined;
  }

  const separatorIndex = display.lastIndexOf(":");
  return (
    separatorIndex >= 0 ? display.slice(separatorIndex + 1) : display
  ).trim();
}

function findMappedCode(
  concept: CatalogConcept,
  sourcePattern: RegExp,
  codePattern: RegExp,
) {
  const mappings = concept.conceptMappings ?? concept.mappings ?? [];
  const candidates = mappings.flatMap((mapping) => {
    const code = getMappingCode(mapping);
    return code && codePattern.test(code)
      ? [{ code, source: getMappingSource(mapping) }]
      : [];
  });
  const sourceMatch = candidates.find(({ source }) =>
    sourcePattern.test(source),
  );

  if (sourceMatch) {
    return sourceMatch.code;
  }

  return candidates.length === 1 ? candidates[0].code : undefined;
}

function parseDisplayedCode(
  display: string,
  prefixPattern: RegExp,
  suffixPattern: RegExp,
): CatalogDisplayParts {
  const match = display.match(prefixPattern) ?? display.match(suffixPattern);

  return {
    code: match?.groups?.code,
    name: (match?.groups?.name ?? display).trim(),
  };
}

export function getCie10DisplayParts(
  concept: CatalogConcept,
): CatalogDisplayParts {
  const display = concept.display?.trim() ?? "";
  const displayedParts = parseDisplayedCode(
    display,
    cie10PrefixPattern,
    cie10SuffixPattern,
  );
  const code =
    findMappedCode(concept, cie10SourcePattern, cie10CodePattern) ??
    displayedParts.code;

  return {
    code: code?.toLocaleUpperCase("es-PE"),
    name: displayedParts.name,
  };
}

export function getPrestacionalDisplayParts(
  concept: CatalogConcept,
): CatalogDisplayParts {
  const display = concept.display?.trim() ?? "";
  const displayedParts = parseDisplayedCode(
    display,
    prestacionalPrefixPattern,
    prestacionalSuffixPattern,
  );
  const code =
    findMappedCode(
      concept,
      prestacionalSourcePattern,
      prestacionalCodePattern,
    ) ?? displayedParts.code;

  return {
    code: code?.toLocaleUpperCase("es-PE"),
    name: displayedParts.name,
  };
}

export function formatPrestacionalDisplay(concept: CatalogConcept) {
  const { code, name } = getPrestacionalDisplayParts(concept);
  return code ? `${code} - ${name}` : name;
}

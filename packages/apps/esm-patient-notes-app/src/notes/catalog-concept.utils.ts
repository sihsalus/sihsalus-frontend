import type { Concept, ConceptReferenceMapping } from "../types";

type CatalogConcept = Pick<
  Concept,
  "conceptMappings" | "display" | "mappings" | "names"
>;

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

/**
 * The MINSA CIE-10 catalog loaded by content stores each code as the concept's
 * SHORT name (`C020` for "TUMOR MALIGNO DE LA CARA DORSAL DE LA LENGUA") and
 * ships no concept mappings at all. A SHORT name is a structured catalog field
 * maintained with the concept, not free display text, so it is accepted as
 * authority next to an explicit mapping.
 */
function getCatalogShortNameCode(
  concept: CatalogConcept,
  codePattern: RegExp,
): string | undefined {
  const shortName = (concept.names ?? []).find((name) => {
    const text = (name.display ?? name.name)?.trim();
    return name.conceptNameType === "SHORT" && text && codePattern.test(text);
  });

  return (shortName?.display ?? shortName?.name)?.trim() || undefined;
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
    getCatalogShortNameCode(concept, cie10CodePattern) ??
    displayedParts.code;

  return {
    code: code?.toLocaleUpperCase("es-PE"),
    name: displayedParts.name,
  };
}

/**
 * Returns a code backed by the catalog itself: an explicit CIE-10/ICD-10
 * concept mapping, or the catalog's SHORT name when it carries the code.
 * Display text is intentionally not treated as authority: a legacy display
 * can merely look like a CIE-10 code.
 */
export function getCie10MappedCode(
  concept: CatalogConcept,
): string | undefined {
  const mappings = concept.conceptMappings ?? concept.mappings ?? [];
  const mappedCode = mappings.find((mapping) => {
    const source =
      mapping.conceptReferenceTerm?.conceptSource?.name?.trim() ||
      mapping.conceptReferenceTerm?.conceptSource?.display?.trim() ||
      "";
    const code = mapping.conceptReferenceTerm?.code?.trim();
    return cie10SourcePattern.test(source) && code;
  });
  const code =
    mappedCode?.conceptReferenceTerm?.code?.trim() ||
    getCatalogShortNameCode(concept, cie10CodePattern);

  return code ? code.toLocaleUpperCase("es-PE") : undefined;
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

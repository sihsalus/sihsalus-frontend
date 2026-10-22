export interface ConceptMapping {
  conceptReferenceTerm?: {
    code?: string;
    retired?: boolean;
    conceptSource?: { uuid?: string; name?: string };
  };
}

export interface DiagnosisConceptName {
  name?: string;
  display?: string;
  conceptNameType?: string;
  voided?: boolean;
}

export function conceptIcd10(
  mappings: ConceptMapping[] | undefined,
  sourceUuid?: string,
  names?: DiagnosisConceptName[],
): string | undefined {
  const codes = new Set(
    (mappings ?? []).flatMap(({ conceptReferenceTerm: term }) => {
      const source = term?.conceptSource;
      const matches = sourceUuid
        ? source?.uuid === sourceUuid
        : /^ICD-?10$/i.test(source?.name ?? "");
      return matches && !term?.retired && term?.code ? [term.code] : [];
    }),
  );
  if (codes.size) return codes.size === 1 ? [...codes][0] : undefined;
  // MINSA/OCL diagnoses can store the code as a SHORT name without mappings.
  const shortCodes = new Set((names ?? []).flatMap((entry) => {
    const code = (entry.name ?? entry.display)?.trim().toUpperCase();
    return !entry.voided && entry.conceptNameType === "SHORT" && code && /^[A-Z][0-9][A-Z0-9.]{1,5}$/.test(code) ? [code] : [];
  }));
  return shortCodes.size === 1 ? [...shortCodes][0] : undefined;
}

export function diagnosisLabel(
  name?: string | null,
  code?: string | null,
): string {
  if (!code) return name ?? "";
  if (!name) return code;
  return name.startsWith(`${code} - `) ? name : `${code} - ${name}`;
}

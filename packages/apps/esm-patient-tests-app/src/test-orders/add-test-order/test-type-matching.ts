export interface SearchableTestType {
  label: string;
  conceptUuid: string;
  synonyms: Array<string>;
  groupLabel?: string;
  matchedName?: string;
  approximateMatch?: boolean;
}

export interface OrderableTestConcept {
  uuid: string;
  display?: string;
  retired?: boolean;
  names?: Array<{ display?: string; name?: string; voided?: boolean }>;
  synonyms?: Array<string>;
  setMembers?: Array<OrderableTestConcept>;
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
const connectingWords = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'of', 'the']);
const tokens = (text: string) =>
  normalize(text)
    .split(/[\s,;()[\]]+/)
    .filter((word) => word && !connectingWords.has(word));

// One insertion/deletion/substitution or adjacent transposition, only in long
// alphabetic words. Never approximate short codes, numbers, or method markers.
function isSingleTypo(query: string, candidate: string): boolean {
  if (!/^[a-z]{6,}$/.test(query) || !/^[a-z]{6,}$/.test(candidate)) return false;
  if (Math.abs(query.length - candidate.length) > 1) return false;
  let index = 0;
  while (query[index] === candidate[index] && index < Math.min(query.length, candidate.length)) index++;
  if (query.length !== candidate.length) {
    return query.length > candidate.length
      ? query.slice(index + 1) === candidate.slice(index)
      : query.slice(index) === candidate.slice(index + 1);
  }
  return (
    query.slice(index + 1) === candidate.slice(index + 1) ||
    (query[index] === candidate[index + 1] &&
      query[index + 1] === candidate[index] &&
      query.slice(index + 2) === candidate.slice(index + 2))
  );
}

function matchesToken(query: string, candidate: string) {
  // Do not let e.g. a requested 24-hour test match a 124-hour test.
  return /\d/.test(query) ? query === candidate : candidate.includes(query);
}

export function collectTestTypes(
  concepts: Array<OrderableTestConcept>,
  aliases: Record<string, Array<string>>,
): Array<SearchableTestType> {
  const unique = new Map<string, SearchableTestType>();
  const visit = (concept: OrderableTestConcept, groupLabel?: string) => {
    if (concept.retired) return;
    if (concept.setMembers?.length) {
      concept.setMembers.forEach((member) => {
        visit(member, groupLabel ?? concept.display);
      });
      return;
    }
    const firstName = concept.names?.find((name) => !name.voided && (name.display || name.name));
    const label = concept.display || firstName?.display || firstName?.name;
    if (!label) return;
    const previous = unique.get(concept.uuid);
    const synonyms = [
      ...(previous?.synonyms ?? []),
      ...(concept.names?.filter((name) => !name.voided).map((name) => name.display ?? name.name ?? '') ?? []),
      ...(concept.synonyms ?? []),
      ...(aliases[concept.uuid] ?? []),
    ].filter((name) => name.trim());
    unique.set(concept.uuid, {
      label: previous?.label ?? label,
      conceptUuid: concept.uuid,
      synonyms: Array.from(new Set(synonyms)),
      groupLabel: previous?.groupLabel ?? groupLabel,
    });
  };
  concepts.forEach((concept) => {
    visit(concept);
  });
  return Array.from(unique.values()).sort(
    (a, b) => (a.groupLabel ?? '').localeCompare(b.groupLabel ?? '') || a.label.localeCompare(b.label),
  );
}

export function searchTestTypes(tests: Array<SearchableTestType>, searchTerm: string): Array<SearchableTestType> {
  if (!searchTerm.trim()) return tests;
  const query = tokens(searchTerm);
  if (!query.length) return [];
  const findMatches = (approximate: boolean) =>
    tests.flatMap((test) => {
      const matchedName = [test.label, ...test.synonyms].find((name) => {
        const candidate = tokens(name);
        return query.every((word) =>
          candidate.some((term) => matchesToken(word, term) || (approximate && isSingleTypo(word, term))),
        );
      });
      return matchedName
        ? [
            {
              ...test,
              matchedName,
              ...(approximate ? { approximateMatch: true } : {}),
            },
          ]
        : [];
    });
  const direct = findMatches(false);
  // Suggestions are a fallback, never silently mixed into catalog-name matches.
  return direct.length ? direct : findMatches(true);
}

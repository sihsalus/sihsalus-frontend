const lowercaseNameParticles = new Set([
  'da',
  'das',
  'de',
  'del',
  'do',
  'dos',
  'e',
  'la',
  'las',
  'los',
  'van',
  'von',
  'y',
]);

const preservedAcronyms = new Map(
  ['AFOCAT', 'CNE', 'DNI', 'EPS', 'ESSALUD', 'FOSPOLI', 'FUA', 'IMC', 'SIS', 'SOAT', 'UPSS'].map((value) => [
    value.toLocaleLowerCase('es'),
    value,
  ]),
);

function capitalizeWordPart(value: string, locale: string) {
  const lowerCaseValue = value.toLocaleLowerCase(locale);
  const firstLetterIndex = lowerCaseValue.search(/\p{L}/u);

  if (firstLetterIndex < 0) {
    return lowerCaseValue;
  }

  return `${lowerCaseValue.slice(0, firstLetterIndex)}${lowerCaseValue[firstLetterIndex].toLocaleUpperCase(locale)}${lowerCaseValue.slice(firstLetterIndex + 1)}`;
}

function capitalizeFirstLetter(value: string, locale: string) {
  const firstLetterIndex = value.search(/\p{L}/u);
  if (firstLetterIndex < 0) {
    return value;
  }

  return `${value.slice(0, firstLetterIndex)}${value[firstLetterIndex].toLocaleUpperCase(locale)}${value.slice(firstLetterIndex + 1)}`;
}

/**
 * Formats a person's display name without changing its stored value.
 * Supports accented characters, Ñ, apostrophes and hyphenated names.
 */
export function formatPersonName(value: string | null | undefined, locale = 'es'): string {
  const normalizedValue = value?.trim().replace(/\s+/g, ' ') ?? '';
  if (!normalizedValue) {
    return '';
  }

  return normalizedValue
    .split(' ')
    .map((word, wordIndex) => {
      const normalizedWord = word.toLocaleLowerCase(locale).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      if (wordIndex > 0 && lowercaseNameParticles.has(normalizedWord)) {
        return word.toLocaleLowerCase(locale);
      }
      if (wordIndex > 0 && /^[ivxlcdm]{1,4}$/u.test(normalizedWord)) {
        return word.toLocaleUpperCase(locale);
      }

      return word
        .split(/([-\u2019'])/u)
        .map((part) =>
          part === '-' || part === "'" || part === '\u2019' ? part : capitalizeWordPart(part, locale),
        )
        .join('');
    })
    .join(' ');
}

/** Converts a UI label to sentence case while preserving common healthcare acronyms. */
export function formatSentenceCase(value: string | null | undefined, locale = 'es'): string {
  const normalizedValue = value?.trim().replace(/\s+/g, ' ') ?? '';
  if (!normalizedValue) {
    return '';
  }

  const sentence = normalizedValue
    .toLocaleLowerCase(locale)
    .split(' ')
    .map((word) => {
      const wordWithoutPunctuation = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      const acronym = preservedAcronyms.get(wordWithoutPunctuation);
      return acronym ? word.replace(wordWithoutPunctuation, acronym) : word;
    })
    .join(' ');

  return capitalizeFirstLetter(sentence, locale);
}

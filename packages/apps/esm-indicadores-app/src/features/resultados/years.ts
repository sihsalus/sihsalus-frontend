export const MIN_INDICATOR_YEAR = 2000;

/**
 * Upper bound for meta (annual target) years. Metas may target future years,
 * unlike result queries which stop at the current year.
 */
export const MAX_META_YEAR = 2100;

export const currentYear = () => new Date().getFullYear();

export const isSelectableYear = (year: number) =>
  Number.isInteger(year) && year >= MIN_INDICATOR_YEAR && year <= currentYear();

/**
 * Number of past years offered in the year selectors (plus the current year).
 * Kept short on purpose: there is no data going that far back, and a longer list
 * only offers empty years.
 */
export const YEAR_OPTIONS_LOOKBACK = 10;

export function indicatorYearOptions(): Array<number> {
  const years: Array<number> = [];
  const earliest = Math.max(MIN_INDICATOR_YEAR, currentYear() - YEAR_OPTIONS_LOOKBACK);
  for (let year = currentYear(); year >= earliest; year -= 1) {
    years.push(year);
  }
  return years;
}

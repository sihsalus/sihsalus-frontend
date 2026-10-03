export const MIN_INDICATOR_YEAR = 2000;

export const currentYear = () => new Date().getFullYear();

export const isSelectableYear = (year: number) =>
  Number.isInteger(year) && year >= MIN_INDICATOR_YEAR && year <= currentYear();

export function indicatorYearOptions(): Array<number> {
  const years: Array<number> = [];
  for (let year = currentYear(); year >= MIN_INDICATOR_YEAR; year -= 1) {
    years.push(year);
  }
  return years;
}

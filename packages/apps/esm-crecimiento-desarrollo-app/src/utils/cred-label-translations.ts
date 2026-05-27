type Translate = (key: string, fallback: string, options?: Record<string, unknown>) => string;

const ageGroupLabelKeys: Record<string, [string, string]> = {
  'RN - 3 a 6d': ['credAgeGroupNewborn3To6Days', 'Newborn - 3 to 6d'],
  'RN - 7 a 14d': ['credAgeGroupNewborn7To14Days', 'Newborn - 7 to 14d'],
  'RN - 14 a 21d': ['credAgeGroupNewborn14To21Days', 'Newborn - 14 to 21d'],
  '0 AÑOS': ['credAgeGroup0Years', '0 years'],
  '1 AÑO': ['credAgeGroup1Year', '1 year'],
  '2 AÑOS': ['credAgeGroup2Years', '2 years'],
  '3 AÑOS': ['credAgeGroup3Years', '3 years'],
  '4 AÑOS': ['credAgeGroup4Years', '4 years'],
  '5 AÑOS': ['credAgeGroup5Years', '5 years'],
  '6 AÑOS': ['credAgeGroup6Years', '6 years'],
  '7 AÑOS': ['credAgeGroup7Years', '7 years'],
  '8 AÑOS': ['credAgeGroup8Years', '8 years'],
  '9 AÑOS': ['credAgeGroup9Years', '9 years'],
  '10 AÑOS': ['credAgeGroup10Years', '10 years'],
  '11 AÑOS': ['credAgeGroup11Years', '11 years'],
};

const ageGroupSublabelKeys: Record<string, [string, string]> = {
  'CONTROL 1 (3 A 6 DÍAS)': ['credControl1Sublabel', 'CONTROL 1 (3 TO 6 DAYS)'],
  'CONTROL 2 (7 A 13 DÍAS)': ['credControl2Sublabel', 'CONTROL 2 (7 TO 13 DAYS)'],
  'CONTROL 3 (14 A 21 DÍAS)': ['credControl3Sublabel', 'CONTROL 3 (14 TO 21 DAYS)'],
  '1 A 11 MESES': ['credAgeGroup1To11Months', '1 TO 11 MONTHS'],
  '12 A 23 MESES': ['credAgeGroup12To23Months', '12 TO 23 MONTHS'],
  '24 A 35 MESES': ['credAgeGroup24To35Months', '24 TO 35 MONTHS'],
  '36 A 47 MESES': ['credAgeGroup36To47Months', '36 TO 47 MONTHS'],
  '48 A 59 MESES': ['credAgeGroup48To59Months', '48 TO 59 MONTHS'],
};

const newbornControlLabelKeys: Record<string, [string, string]> = {
  'RN - 3 a 6 días': ['credControlNewborn3To6Days', 'Newborn - 3 to 6 days'],
  'RN - 7 a 14 días': ['credControlNewborn7To14Days', 'Newborn - 7 to 14 days'],
  'RN - 14 a 21 días': ['credControlNewborn14To21Days', 'Newborn - 14 to 21 days'],
};

export function translateCredAgeGroupLabel(t: Translate, label: string): string {
  const entry = ageGroupLabelKeys[label];
  return entry ? t(entry[0], entry[1]) : label;
}

export function translateCredAgeGroupSublabel(t: Translate, sublabel?: string): string | undefined {
  if (!sublabel) {
    return undefined;
  }

  const entry = ageGroupSublabelKeys[sublabel];
  return entry ? t(entry[0], entry[1]) : sublabel;
}

export function translateCredControlLabel(t: Translate, label: string): string {
  const newbornEntry = newbornControlLabelKeys[label];
  if (newbornEntry) {
    return t(newbornEntry[0], newbornEntry[1]);
  }

  const monthsMatch = /^(\d+) meses$/.exec(label);
  if (monthsMatch) {
    return t('ageMonths', '{{count}} months', { count: Number(monthsMatch[1]) });
  }

  const yearsMatch = /^(\d+) años$/.exec(label);
  if (yearsMatch) {
    return t('ageYears', '{{count}} years', { count: Number(yearsMatch[1]) });
  }

  return label;
}

type Translate = (key: string, fallback: string, options?: Record<string, unknown>) => string;

const ageGroupLabelKeys: Record<string, [string, string]> = {
  'RN - 3 a 6d': ['credAgeGroupNewborn3To6Days', 'Recién nacido - 3 a 6 días'],
  'RN - 7 a 13d': ['credAgeGroupNewborn7To14Days', 'Recién nacido - 7 a 13 días'],
  'RN - 14 a 21d': ['credAgeGroupNewborn14To21Days', 'Recién nacido - 14 a 21 días'],
  '0 AÑOS': ['credAgeGroup0Years', '0 años'],
  '1 AÑO': ['credAgeGroup1Year', '1 año'],
  '2 AÑOS': ['credAgeGroup2Years', '2 años'],
  '3 AÑOS': ['credAgeGroup3Years', '3 años'],
  '4 AÑOS': ['credAgeGroup4Years', '4 años'],
  '5 AÑOS': ['credAgeGroup5Years', '5 años'],
  '6 AÑOS': ['credAgeGroup6Years', '6 años'],
  '7 AÑOS': ['credAgeGroup7Years', '7 años'],
  '8 AÑOS': ['credAgeGroup8Years', '8 años'],
  '9 AÑOS': ['credAgeGroup9Years', '9 años'],
  '10 AÑOS': ['credAgeGroup10Years', '10 años'],
  '11 AÑOS': ['credAgeGroup11Years', '11 años'],
};

const ageGroupSublabelKeys: Record<string, [string, string]> = {
  'CONTROL 1 (3 A 6 DÍAS)': ['credControl1Sublabel', 'Control 1 (3 a 6 días)'],
  'CONTROL 2 (7 A 13 DÍAS)': ['credControl2Sublabel', 'Control 2 (7 a 13 días)'],
  'CONTROL 3 (14 A 21 DÍAS)': ['credControl3Sublabel', 'Control 3 (14 a 21 días)'],
  '1 A 11 MESES': ['credAgeGroup1To11Months', '1 a 11 meses'],
  '12 A 23 MESES': ['credAgeGroup12To23Months', '12 a 23 meses'],
  '24 A 35 MESES': ['credAgeGroup24To35Months', '24 a 35 meses'],
  '36 A 47 MESES': ['credAgeGroup36To47Months', '36 a 47 meses'],
  '48 A 59 MESES': ['credAgeGroup48To59Months', '48 a 59 meses'],
};

const newbornControlLabelKeys: Record<string, [string, string]> = {
  'RN - 3 a 6 días': ['credControlNewborn3To6Days', 'Recién nacido - 3 a 6 días'],
  'RN - 7 a 13 días': ['credControlNewborn7To14Days', 'Recién nacido - 7 a 13 días'],
  'RN - 14 a 21 días': ['credControlNewborn14To21Days', 'Recién nacido - 14 a 21 días'],
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
    return t('ageMonths', '{{count}} meses', { count: Number(monthsMatch[1]) });
  }

  const yearsMatch = /^(\d+) años$/.exec(label);
  if (yearsMatch) {
    return t('ageYears', '{{count}} años', { count: Number(yearsMatch[1]) });
  }

  return label;
}

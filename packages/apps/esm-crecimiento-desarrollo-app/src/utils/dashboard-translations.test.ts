import enTranslations from '../../translations/en.json';
import esTranslations from '../../translations/es.json';

const dashboardTranslationKeys = [
  'earlyStimulation',
  'earlyStimulationTabs',
  'stimulationSessions',
  'stimulationFollowUp',
  'stimulationCounseling',
  'childNutrition',
  'childNutritionTabs',
  'nutritionalAssessment',
  'feedingCounseling',
  'nutritionFollowUp',
  'neonatalCare',
  'neonatalCareTabs',
  'wellChildCare',
  'wellChildCareTabs',
] as const;

const locales = [
  ['es', esTranslations],
  ['en', enTranslations],
] as const;

describe('dashboard translations', () => {
  it.each(locales)('defines dashboard translation keys for %s', (_locale, translations) => {
    const table = translations as Record<string, string>;

    for (const key of dashboardTranslationKeys) {
      expect(table[key]).toBeTruthy();
      expect(table[key]).not.toBe(key);
    }
  });
});

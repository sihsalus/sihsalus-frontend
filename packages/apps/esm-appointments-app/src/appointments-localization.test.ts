import { ValidationError } from 'yup';

import enTranslations from '../translations/en.json';
import esTranslations from '../translations/es.json';
import frTranslations from '../translations/fr.json';
import ptTranslations from '../translations/pt.json';
import ptBrTranslations from '../translations/pt_BR.json';
import { validationSchema } from './admin/appointment-services/appointment-services-validation';
import { weekDays } from './constants';

const english = enTranslations as Record<string, string>;
const spanish = esTranslations as Record<string, string>;
const supportedTranslations = [
  enTranslations,
  esTranslations,
  frTranslations,
  ptTranslations,
  ptBrTranslations,
] as Array<Record<string, string>>;
const expectedSpanishWeekDays: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

describe('appointments Spanish localization', () => {
  it.each([
    'appointmentProviderUnavailable',
    'appointmentDailyBoundaryErrorMessage',
  ] as const)('defines the %s safety message in every supported locale', (translationKey) => {
    for (const translations of supportedTranslations) {
      expect(translations[translationKey]?.trim()).toBeTruthy();
    }
  });

  it('defines localized labels for every recurring weekday', () => {
    for (const weekDay of weekDays) {
      expect(spanish[weekDay.labelCode]).toBe(expectedSpanishWeekDays[weekDay.labelCode]);
      expect(english[weekDay.labelCode]).toBe(weekDay.label);
    }
  });

  it('provides a Spanish message for every administrative validation error', async () => {
    let validationErrors: Array<ValidationError> = [];

    try {
      await validationSchema.validate(
        {
          color: '',
          durationMins: undefined,
          endTime: '',
          endTimeTimeFormat: '',
          location: { display: '', uuid: '' },
          maxAppointmentsLimit: undefined,
          name: '',
          startTime: '',
          startTimeTimeFormat: '',
        },
        { abortEarly: false },
      );
    } catch (error) {
      validationErrors = error instanceof ValidationError ? error.inner : [];
    }

    expect(validationErrors.length).toBeGreaterThan(0);
    for (const { message } of validationErrors) {
      expect(spanish[message]).toBeTruthy();
      expect(spanish[message]).not.toBe(message);
    }
  });
});

import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import { describe, expect, it, vi } from 'vitest';

import { getIndicadorSaveErrorMessage, indicatorsErrorMessageOptions } from './error-handling';

vi.mock('@openmrs/esm-framework', () => ({
  getUserFacingErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
}));

const mockedGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);

describe('indicatorsErrorMessageOptions', () => {
  it('uses the active locale for HTTP status messages', () => {
    const englishMessages: Record<string, string> = {
      indicatorsError400: 'The submitted data is invalid.',
      indicatorsError401: 'Your session expired.',
      indicatorsError403: 'You do not have permission.',
      indicatorsError404: 'The requested record no longer exists.',
      indicatorsError409: 'The record was modified.',
      indicatorsError422: 'The submitted data is not valid for the indicator.',
      indicatorsError500: 'The indicators service encountered an error.',
      indicatorsError502: 'The indicators service is unavailable.',
      indicatorsError503: 'The indicators service is unavailable.',
      indicatorsError504: 'The indicators service timed out.',
    };
    const t = (key: string, defaultValue: string) => englishMessages[key] ?? defaultValue;

    const options = indicatorsErrorMessageOptions(t);

    expect(options.statusMessages).toEqual({
      400: englishMessages.indicatorsError400,
      401: englishMessages.indicatorsError401,
      403: englishMessages.indicatorsError403,
      404: englishMessages.indicatorsError404,
      409: englishMessages.indicatorsError409,
      422: englishMessages.indicatorsError422,
      500: englishMessages.indicatorsError500,
      502: englishMessages.indicatorsError502,
      503: englishMessages.indicatorsError503,
      504: englishMessages.indicatorsError504,
    });
  });
});

describe('getIndicadorSaveErrorMessage', () => {
  const t = (key: string, defaultValue: string, options?: { uuids: string }) =>
    key === 'encounterTypesUnknownUuids'
      ? `custom: ${defaultValue.replace('{{uuids}}', options?.uuids ?? '')}`
      : defaultValue;

  beforeEach(() => {
    mockedGetUserFacingErrorMessage.mockClear();
  });

  it('surfaces the unknown encounter-type uuids from the 422 detail', () => {
    const error = Object.assign(new Error('validation'), {
      responseBody: {
        detail: { field: 'encounter_type_uuids', unknown_uuids: ['enc-ghost-1', 'enc-ghost-2'] },
      },
    });

    const message = getIndicadorSaveErrorMessage(error, t, 'fallback');

    expect(message).toContain('enc-ghost-1, enc-ghost-2');
    expect(mockedGetUserFacingErrorMessage).not.toHaveBeenCalled();
  });

  it('ignores a 422 detail for a different field', () => {
    const error = Object.assign(new Error('validation'), {
      responseBody: {
        detail: { field: 'location_uuids', unknown_uuids: ['loc-ghost'] },
      },
    });

    const message = getIndicadorSaveErrorMessage(error, t, 'fallback');

    expect(message).toBe('fallback');
    expect(mockedGetUserFacingErrorMessage).toHaveBeenCalledTimes(1);
  });

  it('ignores a detail without unknown_uuids', () => {
    const error = Object.assign(new Error('validation'), {
      responseBody: { detail: { field: 'encounter_type_uuids' } },
    });

    const message = getIndicadorSaveErrorMessage(error, t, 'fallback');

    expect(message).toBe('fallback');
  });

  it('delegates to getUserFacingErrorMessage for 502 gateway failures', () => {
    const error = Object.assign(new Error('gateway'), { response: { status: 502 } });
    mockedGetUserFacingErrorMessage.mockReturnValueOnce(
      'El servicio de indicadores no está disponible en este momento.',
    );

    const message = getIndicadorSaveErrorMessage(error, t, 'fallback');

    expect(message).toBe('El servicio de indicadores no está disponible en este momento.');
    expect(mockedGetUserFacingErrorMessage).toHaveBeenCalledWith(
      error,
      'fallback',
      expect.objectContaining({ statusMessages: expect.any(Object) }),
    );
  });
});

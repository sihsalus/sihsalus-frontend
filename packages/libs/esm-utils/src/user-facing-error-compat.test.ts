import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCompatibleUserFacingErrorMessage } from './user-facing-error-compat';

type UserFacingErrorMessageNormalizer = NonNullable<Parameters<typeof getCompatibleUserFacingErrorMessage>[3]>;

describe('getCompatibleUserFacingErrorMessage', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('uses a safe fallback and logs the original error when the host normalizer is unavailable', () => {
    const error = new Error('Technical backend details');

    expect(
      getCompatibleUserFacingErrorMessage(error, 'No se pudo guardar la consulta.', {
        logContext: 'Save visit',
      }),
    ).toBe('No se pudo guardar la consulta.');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Save visit:', error);
  });

  it.each([
    {
      code: 'VISIT_SAVE_OUTCOME_UNKNOWN',
      expected: 'No repita la admisión. Verifique la consulta antes de continuar.',
    },
    {
      code: 'VISIT_PERSISTENCE_CORRELATION_CONFLICT',
      expected: 'Regularice las consultas inconsistentes antes de continuar.',
    },
  ])('preserves the mapped anti-duplication message for $code with a legacy host', ({ code, expected }) => {
    const error = { code, message: 'Untrusted technical detail' };
    expect(
      getCompatibleUserFacingErrorMessage(
        error,
        'Fallback',
        {
          codeMessages: {
            VISIT_SAVE_OUTCOME_UNKNOWN: 'No repita la admisión. Verifique la consulta antes de continuar.',
            VISIT_PERSISTENCE_CORRELATION_CONFLICT: 'Regularice las consultas inconsistentes antes de continuar.',
          },
          log: false,
        },
        undefined,
      ),
    ).toBe(expected);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('delegates to the framework helper when the host provides it', () => {
    const error = new Error('Technical backend details');
    const options = { statusMessages: { 403: 'No tiene permisos.' }, logContext: 'Save visit' };
    const runtimeNormalizer = vi.fn<UserFacingErrorMessageNormalizer>().mockReturnValue('Mensaje normalizado');

    expect(getCompatibleUserFacingErrorMessage(error, 'Fallback', options, runtimeNormalizer)).toBe(
      'Mensaje normalizado',
    );
    expect(runtimeNormalizer).toHaveBeenCalledWith(error, 'Fallback', options);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('prioritizes a known local code over a legacy host fallback', () => {
    const error = { code: 'QUEUE_MAPPING_MISSING', message: 'Technical configuration detail' };
    const runtimeNormalizer = vi.fn<UserFacingErrorMessageNormalizer>().mockReturnValue('Fallback');

    expect(
      getCompatibleUserFacingErrorMessage(
        error,
        'Fallback',
        { codeMessages: { QUEUE_MAPPING_MISSING: 'Falta configurar la cola.' }, log: false },
        runtimeNormalizer,
      ),
    ).toBe('Falta configurar la cola.');
    expect(runtimeNormalizer).not.toHaveBeenCalled();
  });

  it('does not mask the original error when the host normalizer itself fails', () => {
    const error = new Error('Original visit failure');
    const normalizerError = new TypeError('Host normalizer failure');
    const runtimeNormalizer = vi.fn<UserFacingErrorMessageNormalizer>().mockImplementation(() => {
      throw normalizerError;
    });

    expect(getCompatibleUserFacingErrorMessage(error, 'No se pudo guardar la consulta.', {}, runtimeNormalizer)).toBe(
      'No se pudo guardar la consulta.',
    );
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, 'The host error normalizer failed:', normalizerError);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, 'Error técnico:', error);
  });
});

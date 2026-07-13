import { dispatchToastShown } from '@openmrs/esm-globals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserFacingErrorMessage, logError, reportError } from './index';

vi.mock('@openmrs/esm-globals', () => ({
  dispatchToastShown: vi.fn(),
}));

vi.useFakeTimers();

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  document.documentElement.lang = 'es';
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('getUserFacingErrorMessage', () => {
  it.each([
    new Error('Technical Error message'),
    'Raw rejection reason',
    { message: 'Backend message', rawMessage: 'Backend raw message', translatedMessage: 'Untrusted translation' },
    null,
    undefined,
    42,
  ])('returns the caller-provided fallback instead of exposing technical input %#', (error) => {
    expect(getUserFacingErrorMessage(error, 'No se pudo completar la operación.', { log: false })).toBe(
      'No se pudo completar la operación.',
    );
  });

  it('logs the complete technical error by default', () => {
    const error = Object.assign(new Error('Technical details'), { rawMessage: 'Raw backend details' });

    expect(getUserFacingErrorMessage(error, 'Mensaje seguro', { logContext: 'Saving patient' })).toBe('Mensaje seguro');
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Saving patient:', error);
  });

  it('does not log when logging is disabled', () => {
    expect(getUserFacingErrorMessage(new Error('Technical details'), 'Mensaje seguro', { log: false })).toBe(
      'Mensaje seguro',
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it.each([
    { code: 'PATIENT_ALREADY_EXISTS' },
    { error: { code: 'PATIENT_ALREADY_EXISTS' } },
    { responseBody: { code: 'PATIENT_ALREADY_EXISTS' } },
    {
      responseBody: {
        error: {
          code: 'PATIENT_ALREADY_EXISTS',
          message: 'Patient already exists',
          rawMessage: 'Raw duplicate patient details',
          translatedMessage: 'Patient already exists',
        },
      },
    },
  ])('maps known error codes without exposing response messages %#', (error) => {
    expect(
      getUserFacingErrorMessage(error, 'No se pudo guardar.', {
        codeMessages: { PATIENT_ALREADY_EXISTS: 'El paciente ya está registrado.' },
        log: false,
      }),
    ).toBe('El paciente ya está registrado.');
  });

  it('supports numeric error codes', () => {
    const error = { responseBody: { error: { code: 40901 } } };

    expect(
      getUserFacingErrorMessage(error, 'No se pudo guardar.', {
        codeMessages: { 40901: 'El registro ya existe.' },
        log: false,
      }),
    ).toBe('El registro ya existe.');
  });

  it.each([
    { response: { status: 403 } },
    { status: 403 },
    { statusCode: '403' },
    { responseBody: { status: 403 } },
    { responseBody: { error: { status: '403' } } },
  ])('maps HTTP statuses from supported error shapes %#', (error) => {
    expect(
      getUserFacingErrorMessage(error, 'No se pudo completar la operación.', {
        log: false,
        statusMessages: { 403: 'No tienes permisos para realizar esta acción.' },
      }),
    ).toBe('No tienes permisos para realizar esta acción.');
  });

  it('recognizes the OpenmrsFetchError response and responseBody shape', () => {
    const error = {
      message: 'Server responded with 409 (Conflict) for url /ws/rest/v1/patient',
      response: { status: 409, statusText: 'Conflict' },
      responseBody: {
        error: {
          code: 'DUPLICATE_IDENTIFIER',
          message: 'Identifier already in use',
        },
      },
    };

    expect(
      getUserFacingErrorMessage(error, 'No se pudo guardar el paciente.', {
        codeMessages: { DUPLICATE_IDENTIFIER: 'El identificador ya está en uso.' },
        log: false,
        statusMessages: { 409: 'El registro entra en conflicto con otro existente.' },
      }),
    ).toBe('El identificador ya está en uso.');
  });

  it('prefers a known error code over a known HTTP status', () => {
    const error = {
      response: { status: 409 },
      responseBody: { error: { code: 'DUPLICATE_IDENTIFIER' } },
    };

    expect(
      getUserFacingErrorMessage(error, 'Fallback', {
        codeMessages: { DUPLICATE_IDENTIFIER: 'Mensaje por código' },
        log: false,
        statusMessages: { 409: 'Mensaje por estado' },
      }),
    ).toBe('Mensaje por código');
  });

  it('ignores unknown codes, statuses, and backend-provided messages', () => {
    const error = {
      response: { status: 418, statusText: "I'm a teapot" },
      responseBody: {
        error: {
          code: 'UNKNOWN',
          message: 'English backend message',
          rawMessage: 'Raw backend message',
          translatedMessage: 'Untrusted backend translation',
        },
      },
    };

    expect(
      getUserFacingErrorMessage(error, 'Mensaje seguro', {
        codeMessages: { KNOWN: 'Mensaje conocido' },
        log: false,
        statusMessages: { 500: 'Error del servidor' },
      }),
    ).toBe('Mensaje seguro');
  });

  it('ignores empty mapped messages', () => {
    const error = { code: 'EMPTY', response: { status: 500 } };

    expect(
      getUserFacingErrorMessage(error, 'Mensaje seguro', {
        codeMessages: { EMPTY: ' ' },
        log: false,
        statusMessages: { 500: '' },
      }),
    ).toBe('Mensaje seguro');
  });

  it('does not read inherited mapping properties', () => {
    const codeMessages = Object.create({ INHERITED_CODE: 'Mensaje heredado inseguro' });

    expect(
      getUserFacingErrorMessage({ code: 'INHERITED_CODE' }, 'Mensaje seguro', {
        codeMessages,
        log: false,
      }),
    ).toBe('Mensaje seguro');
  });

  it('uses a safe Spanish default when the fallback is empty', () => {
    expect(getUserFacingErrorMessage(new Error('Technical details'), ' ', { log: false })).toBe(
      'Ocurrió un error inesperado.',
    );
  });

  it.each([
    "application '@sihsalus/esm-patient-chart-app-page-0' died in status LOADING_SOURCE_CODE",
    new Error("Shared module single-spa-react doesn't exist in shared scope default"),
  ])('preserves the dedicated microfrontend loading message %#', (error) => {
    expect(getUserFacingErrorMessage(error, 'Fallback', { log: false })).toBe(
      'No se pudo cargar un módulo de la aplicación. Recargue la página. Si el problema continúa, contacte a soporte.',
    );
  });

  it('uses English safe messages when the document locale is English', () => {
    document.documentElement.lang = 'en';

    expect(getUserFacingErrorMessage(new Error('Technical details'), ' ', { log: false })).toBe(
      'An unexpected error occurred.',
    );
    expect(
      getUserFacingErrorMessage(new Error('application died in status LOADING_SOURCE_CODE'), 'Fallback', {
        log: false,
      }),
    ).toBe('An application module could not be loaded. Reload the page. If the problem continues, contact support.');
  });
});

describe('logError', () => {
  it('logs an error with the default technical context', () => {
    const error = new Error('Technical details');

    logError(error);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error técnico:', error);
  });

  it('logs an error with custom context', () => {
    const error = { responseBody: { error: { message: 'Technical details' } } };

    logError(error, 'Loading patient');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Loading patient:', error);
  });
});

describe('global error handler', () => {
  it('transforms non-Error inputs into valid Error objects', () => {
    expect(() => {
      reportError('error');
      vi.runAllTimers();
    }).toThrow('error');

    expect(() => {
      reportError({ error: 'error' });
      vi.runAllTimers();
    }).toThrow('Object thrown as error: {"error":"error"}');

    expect(() => {
      reportError(null);
      vi.runAllTimers();
    }).toThrow("'null' was thrown as an error");

    expect(() => {
      reportError(undefined);
      vi.runAllTimers();
    }).toThrow("'undefined' was thrown as an error");
  });

  it('shows a user-facing message for microfrontend load failures', () => {
    const errorMessage =
      "application '@sihsalus/esm-patient-chart-app-page-0' died in status LOADING_SOURCE_CODE: Shared module single-spa-react doesn't exist in shared scope default";

    window.onerror?.(errorMessage, '', 0, 0, undefined);

    expect(dispatchToastShown).toHaveBeenCalledWith({
      description:
        'No se pudo cargar un módulo de la aplicación. Recargue la página. Si el problema continúa, contacte a soporte.',
      kind: 'error',
      title: 'No se pudo cargar la página',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error:', errorMessage);
  });

  it('does not expose regular rejection messages', () => {
    const error = new Error('Regular failure');

    window.onunhandledrejection?.({ reason: error } as PromiseRejectionEvent);

    expect(dispatchToastShown).toHaveBeenCalledWith({
      description: 'Ocurrió un error inesperado.',
      kind: 'error',
      title: 'Error',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unhandled rejection:', error);
  });
});

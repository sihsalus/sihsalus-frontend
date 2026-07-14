/** @module @category Error Handling */
import { dispatchToastShown } from '@openmrs/esm-globals';

const localizedErrorMessages = {
  en: {
    microfrontendLoad:
      'An application module could not be loaded. Reload the page. If the problem continues, contact support.',
    microfrontendLoadTitle: 'The page could not be loaded',
    unexpected: 'An unexpected error occurred.',
  },
  es: {
    microfrontendLoad:
      'No se pudo cargar un módulo de la aplicación. Recargue la página. Si el problema continúa, contacte a soporte.',
    microfrontendLoadTitle: 'No se pudo cargar la página',
    unexpected: 'Ocurrió un error inesperado.',
  },
} as const;

export type UserFacingErrorMessageMap = Readonly<Record<string | number, string>>;

export interface UserFacingErrorMessageOptions {
  /** User-facing messages keyed by an application or backend error code. */
  codeMessages?: UserFacingErrorMessageMap;
  /** User-facing messages keyed by an HTTP status code. */
  statusMessages?: UserFacingErrorMessageMap;
  /** Whether to write the complete technical error to the console. Defaults to true. */
  log?: boolean;
  /** Context included with the technical console error. */
  logContext?: string;
}

window.onerror = function (message, _source, _lineno, _colno, error) {
  const reason = error ?? message;
  dispatchToastShown({
    description: getUserFacingErrorMessage(reason, getLocalizedErrorMessages().unexpected, {
      logContext: 'Unexpected error',
    }),
    kind: 'error',
    title: getUserFacingErrorTitle(reason),
  });
  return false;
};

window.onunhandledrejection = function (event: PromiseRejectionEvent) {
  dispatchToastShown({
    description: getUserFacingErrorMessage(event.reason, getLocalizedErrorMessages().unexpected, {
      logContext: 'Unhandled rejection',
    }),
    kind: 'error',
    title: getUserFacingErrorTitle(event.reason),
  });
};

/**
 * Reports an error to the global error handler. The error will be displayed
 * to the user as a toast notification. This function ensures the error is
 * converted to an Error object if it isn't already one.
 *
 * The error is thrown asynchronously (via setTimeout) to ensure it's caught
 * by the global window.onerror handler.
 *
 * @param err The error to report. Can be an Error object, string, or any other value.
 *
 * @example
 * ```ts
 * import { reportError } from '@openmrs/esm-framework';
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   reportError(error);
 * }
 * ```
 */
export function reportError(err: unknown) {
  const error = ensureErrorObject(err);
  setTimeout(() => {
    throw error;
  });
}

/**
 * Creates an error handler function that captures the current stack trace at
 * the time of creation. When the returned handler is invoked with an error,
 * it appends the captured stack trace to provide better debugging information
 * for asynchronous operations.
 *
 * This is particularly useful for handling errors in Promise chains or
 * callback-based APIs where the original call site would otherwise be lost.
 *
 * @returns A function that accepts an error and reports it with an enhanced stack trace.
 *
 * @example
 * ```ts
 * import { createErrorHandler } from '@openmrs/esm-framework';
 * const handleError = createErrorHandler();
 * someAsyncOperation()
 *   .then(processResult)
 *   .catch(handleError);
 * ```
 */
export function createErrorHandler() {
  const outgoingErr = Error();
  return (incomingErr: unknown) => {
    const finalErr = ensureErrorObject(incomingErr);
    finalErr.stack += `\nAsync stacktrace:\n${outgoingErr.stack}`;
    reportError(incomingErr);
  };
}

function ensureErrorObject(thing: unknown) {
  let message: string;

  if (thing instanceof Error) {
    return thing;
  } else if (thing === null) {
    return Error(`'null' was thrown as an error`);
  } else if (typeof thing === 'object') {
    try {
      message = `Object thrown as error: ${JSON.stringify(thing)}`;
    } catch (_e) {
      message = `Object thrown as error with the following properties: ${Object.keys(thing)}`;
    }
    return Error(message);
  } else if (thing === undefined) {
    return Error(`'undefined' was thrown as an error`);
  } else {
    return Error(String(thing));
  }
}

function getUserFacingErrorTitle(error: unknown) {
  return isMicrofrontendLoadError(error) ? getLocalizedErrorMessages().microfrontendLoadTitle : 'Error';
}

/**
 * Returns a safe, localized message for an unknown error.
 *
 * Technical messages received from the browser or backend are never returned.
 * They are written to the console and are only inspected to identify a known
 * error code, HTTP status, or microfrontend loading failure.
 */
export function getUserFacingErrorMessage(
  error: unknown,
  fallback: string,
  options: UserFacingErrorMessageOptions = {},
): string {
  if (options.log !== false) {
    logError(error, options.logContext);
  }

  if (isMicrofrontendLoadError(error)) {
    return getLocalizedErrorMessages().microfrontendLoad;
  }

  const codeMessage = getMappedMessage(options.codeMessages, getErrorCode(error));
  if (codeMessage) {
    return codeMessage;
  }

  const statusMessage = getMappedMessage(options.statusMessages, getHttpStatus(error));
  if (statusMessage) {
    return statusMessage;
  }

  return isNonEmptyString(fallback) ? fallback : getLocalizedErrorMessages().unexpected;
}

/** Writes the complete technical error to the console without exposing it to the user. */
export function logError(error: unknown, context?: string): void {
  console.error(isNonEmptyString(context) ? `${context}:` : 'Error técnico:', error);
}

function isMicrofrontendLoadError(error: unknown) {
  const message = getTechnicalMessage(error);
  return (
    message.includes('died in status LOADING_SOURCE_CODE') ||
    message.includes("doesn't exist in shared scope") ||
    message.includes('Shared module')
  );
}

function getErrorCode(error: unknown): string | number | undefined {
  const errorRecord = asRecord(error);
  const responseBody = asRecord(errorRecord?.responseBody);
  const responseBodyError = asRecord(responseBody?.error);
  const nestedError = asRecord(errorRecord?.error);

  return (
    asStringOrNumber(responseBodyError?.code) ??
    asStringOrNumber(responseBody?.code) ??
    asStringOrNumber(nestedError?.code) ??
    asStringOrNumber(errorRecord?.code)
  );
}

function getHttpStatus(error: unknown): string | number | undefined {
  const errorRecord = asRecord(error);
  const response = asRecord(errorRecord?.response);
  const responseBody = asRecord(errorRecord?.responseBody);
  const responseBodyError = asRecord(responseBody?.error);

  return (
    asHttpStatus(response?.status) ??
    asHttpStatus(errorRecord?.status) ??
    asHttpStatus(errorRecord?.statusCode) ??
    asHttpStatus(responseBody?.status) ??
    asHttpStatus(responseBodyError?.status)
  );
}

function getMappedMessage(
  messages: UserFacingErrorMessageMap | undefined,
  key: string | number | undefined,
): string | undefined {
  if (!messages || key === undefined || !Object.getOwnPropertyDescriptor(messages, key)) {
    return undefined;
  }

  const message = messages[key];
  return isNonEmptyString(message) ? message : undefined;
}

function getTechnicalMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  const message = asRecord(error)?.message;
  return typeof message === 'string' ? message : '';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function asStringOrNumber(value: unknown): string | number | undefined {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? value : undefined;
}

function asHttpStatus(value: unknown): string | number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  return typeof value === 'string' && /^\d{3}$/.test(value) ? value : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getLocalizedErrorMessages() {
  const locale = document.documentElement.lang || document.documentElement.dataset.defaultLang || 'es';
  return locale.toLowerCase().startsWith('es') ? localizedErrorMessages.es : localizedErrorMessages.en;
}

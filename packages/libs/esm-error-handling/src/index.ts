/** @module @category Error Handling */
import { dispatchToastShown } from '@openmrs/esm-globals';

window.onerror = function (message, _source, _lineno, _colno, error) {
  const reason = error ?? message;
  console.error('Unexpected error: ', reason);
  dispatchToastShown({
    description: getUserFacingErrorMessage(reason, 'Oops! An unexpected error occurred.'),
    kind: 'error',
    title: getUserFacingErrorTitle(reason),
  });
  return false;
};

window.onunhandledrejection = function (event: PromiseRejectionEvent) {
  console.error('Unhandled rejection: ', event.reason);
  dispatchToastShown({
    description: getUserFacingErrorMessage(event.reason, 'Oops! An unhandled promise rejection occurred.'),
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

function ensureErrorObject(thing: any) {
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
    return Error(thing.toString());
  }
}

function getUserFacingErrorTitle(error: unknown) {
  return isMicrofrontendLoadError(error) ? 'No se pudo cargar la página' : 'Error';
}

function getUserFacingErrorMessage(error: unknown, fallback: string) {
  if (isMicrofrontendLoadError(error)) {
    return 'No se pudo cargar un módulo de la aplicación. Recarga la página. Si el problema continúa, contacta a soporte.';
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'string') {
    return error || fallback;
  }

  return fallback;
}

function isMicrofrontendLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return (
    message.includes('died in status LOADING_SOURCE_CODE') ||
    message.includes("doesn't exist in shared scope") ||
    message.includes('Shared module')
  );
}

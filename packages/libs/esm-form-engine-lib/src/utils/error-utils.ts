import { type SnackbarDescriptor, showSnackbar } from '@openmrs/esm-framework';

interface ErrorResponseDetail {
  message?: string;
}

interface ErrorResponseBody {
  responseBody?: {
    error?: {
      message?: string;
      fieldErrors?: Record<string, ErrorResponseDetail[]>;
      globalErrors?: ErrorResponseDetail[];
    };
  };
  message?: string;
}

export class FormSubmissionError extends Error {
  descriptor: SnackbarDescriptor;

  constructor(descriptor: SnackbarDescriptor) {
    const message =
      typeof descriptor.subtitle === 'string'
        ? descriptor.subtitle
        : typeof descriptor.title === 'string'
          ? descriptor.title
          : 'Form submission failed';
    super(message);
    this.name = 'FormSubmissionError';
    this.descriptor = descriptor;
  }
}

export function reportError(error: Error, title: string): void {
  if (error) {
    const errorMessage = extractErrorMessagesFromResponse(error).join(', ');
    console.error(error);
    showSnackbar({
      subtitle: errorMessage,
      title: title,
      kind: 'error',
      isLowContrast: false,
    });
  }
}

/**
 * Extracts error messages from a given error response object.
 * If fieldErrors are present, it extracts the error messages from each field.
 * Otherwise, it returns the top-level error message.
 *
 * @param {object} errorObject - The error response object.
 * @returns {string[]} An array of error messages.
 */
export function extractErrorMessagesFromResponse(errorObject: unknown): string[] {
  const normalizedError = errorObject as ErrorResponseBody | undefined;
  const fieldErrors = normalizedError?.responseBody?.error?.fieldErrors;
  const globalErrors = normalizedError?.responseBody?.error?.globalErrors;
  const topLevelMessage = normalizedError?.responseBody?.error?.message ?? normalizedError?.message;

  if ((!fieldErrors || Object.keys(fieldErrors).length === 0) && !globalErrors?.length) {
    return typeof topLevelMessage === 'string' && topLevelMessage.length > 0 ? [topLevelMessage] : ['Unknown error'];
  }

  if (globalErrors?.length) {
    return globalErrors
      .map((error) => error.message)
      .filter((message): message is string => typeof message === 'string' && message.length > 0);
  }

  return Object.values(fieldErrors ?? {}).flatMap((errors) =>
    errors
      .map((error) => error.message)
      .filter((message): message is string => typeof message === 'string' && message.length > 0),
  );
}

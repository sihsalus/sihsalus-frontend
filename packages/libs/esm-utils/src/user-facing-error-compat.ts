type UserFacingErrorMessageMap = Readonly<Record<string | number, string>>;

interface UserFacingErrorMessageOptions {
  codeMessages?: UserFacingErrorMessageMap;
  statusMessages?: UserFacingErrorMessageMap;
  log?: boolean;
  logContext?: string;
}

type UserFacingErrorMessageNormalizer = (
  error: unknown,
  fallback: string,
  options?: UserFacingErrorMessageOptions,
) => string;

/**
 * Normalizes an error without assuming that the host App Shell exposes the
 * latest framework helper. Microfrontends consume the host framework as a
 * singleton, so the imported normalizer can legitimately be undefined when a
 * newer microfrontend runs against an older App Shell.
 */
export function getCompatibleUserFacingErrorMessage(
  error: unknown,
  fallback: string,
  options: UserFacingErrorMessageOptions = {},
  runtimeNormalizer?: UserFacingErrorMessageNormalizer,
): string {
  const mappedMessage =
    getMappedMessage(options.codeMessages, getErrorCode(error)) ??
    getMappedMessage(options.statusMessages, getHttpStatus(error));
  if (mappedMessage) {
    if (options.log !== false) {
      console.error(isNonEmptyString(options.logContext) ? `${options.logContext}:` : 'Error técnico:', error);
    }
    return mappedMessage;
  }

  if (typeof runtimeNormalizer === 'function') {
    try {
      const message = runtimeNormalizer(error, fallback, options);
      if (isNonEmptyString(message)) {
        return message;
      }
    } catch (normalizerError) {
      if (options.log !== false) {
        console.error('The host error normalizer failed:', normalizerError);
      }
    }
  }

  if (options.log !== false) {
    console.error(isNonEmptyString(options.logContext) ? `${options.logContext}:` : 'Error técnico:', error);
  }

  return isNonEmptyString(fallback) ? fallback : getUnexpectedErrorMessage();
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

function getUnexpectedErrorMessage(): string {
  const locale =
    typeof document === 'undefined'
      ? 'es'
      : document.documentElement.lang || document.documentElement.dataset.defaultLang || 'es';
  return locale.toLowerCase().startsWith('es') ? 'Ocurrió un error inesperado.' : 'An unexpected error occurred.';
}

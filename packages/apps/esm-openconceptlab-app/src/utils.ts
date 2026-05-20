import type { TFunction } from 'i18next';

import { OclErrorCode } from './types';

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export function extractOclErrorMessage(response: { status: number; data?: unknown }, t: TFunction): string {
  switch (response.status as OclErrorCode) {
    case OclErrorCode.UNAUTHORIZED:
      return t('oclErrorUnauthorized', 'Invalid or expired token — check your subscription settings');
    case OclErrorCode.FORBIDDEN:
      return t('oclErrorForbidden', 'Access denied — the collection may be private');
    case OclErrorCode.CONFLICT:
      return t('oclErrorConflict', 'An import is already in progress');
    case OclErrorCode.UNAVAILABLE:
      return t('oclErrorUnavailable', 'OCL service is unavailable — try again later');
    default: {
      const data = response.data as Record<string, unknown> | null | undefined;
      return (
        (data?.error as string) ?? (data?.message as string) ?? t('oclErrorGeneric', 'An unexpected error occurred')
      );
    }
  }
}

const NUMBER_OF_SLASHES_AFTER_BASE_URL = 5;

/*
 * This checks if collection version has been passed to subscription url by checking number of forward slashes after base url
 * If the number is 5, such as with https://api.openconceptlab.org/users/username/collections/collectionname/v1.0
 * that means collection version was passed and isVersionDefinedInUrl() will return true
 * Also returns false if the string is not a valid URL
 */
export const isVersionDefinedInUrl = (subscriptionUrl: string) => {
  if (subscriptionUrl.endsWith('/')) {
    subscriptionUrl = subscriptionUrl.substring(0, subscriptionUrl.lastIndexOf('/'));
  }

  let url: URL | undefined;
  try {
    url = new URL(subscriptionUrl);
  } catch {
    return false;
  }

  const count = url.pathname.match(/\//g)?.length ?? 0;
  if (count === NUMBER_OF_SLASHES_AFTER_BASE_URL) {
    return true;
  } else {
    return false;
  }
};

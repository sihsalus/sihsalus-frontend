import { makeUrl } from '@openmrs/esm-framework';
import type { OrthancConfiguration } from '../../types';
import { imagingUrl } from '../constants';

/** DICOM DA for ScheduledProcedureStepStartDate; time is sent separately as TM. */
export function toDicomDate(date: Date): string {
  if (
    !(date instanceof Date) ||
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() < 1 ||
    date.getFullYear() > 9999
  )
    throw new Error('Invalid scheduled date');
  return `${date.getFullYear().toString().padStart(4, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

/** Accession Number is DICOM SH (at most 16 characters). */
export function generateAccessionNumber(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 *
 * @param time The selected time
 * @param period
 */
export function toDicomTimeString(time: string, period: 'AM' | 'PM'): string {
  if (!/^(0?[1-9]|1[0-2]):[0-5][0-9]$/.test(time) || !['AM', 'PM'].includes(period)) {
    throw new Error('Invalid scheduled time');
  }
  const [hourStr, minuteStr] = time.split(':');

  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  if (period === 'PM' && hour < 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }

  const hourStr24 = hour.toString().padStart(2, '0');
  const minuteStrPadded = minute.toString().padStart(2, '0');

  return `${hourStr24}${minuteStrPadded}00`; // HHMMSS format
}

/**
 *
 * @param configurationUrl The configuration url for the orthanc server
 * @param specialUrl Part of the url for dicom view or ohif view
 * @param params
 */
export function buildURL(
  configurationUrl: string,
  specialUrl: string,
  params: Array<{ code: string; value: string }>,
): string {
  if (!configurationUrl) {
    return '';
  }

  const normalizedBaseUrl = `${trimTrailingSlash(configurationUrl)}/`;
  const normalizedSpecialUrl = specialUrl.replace(/^\/+/, '');
  const basicUrl = new URL(normalizedSpecialUrl, normalizedBaseUrl);
  for (const { code, value } of params) {
    basicUrl.searchParams.set(code, value);
  }
  return basicUrl.toString();
}

function getSafeHttpUrl(url: string | undefined | null): URL | null {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    if (
      (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      return null;
    }
    return parsedUrl;
  } catch {
    return null;
  }
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function getBrowserOrigin(): URL | null {
  const origin = globalThis.location?.origin;
  return getSafeHttpUrl(origin);
}

export function getOrthancPublicRoot(configuration: OrthancConfiguration): string {
  // The proxy is the explicit browser mapping; the backend URL may be private.
  const configuredRoot = getSafeHttpUrl(configuration?.orthancProxyUrl);
  return configuredRoot ? trimTrailingSlash(configuredRoot.toString()) : '';
}

export function getOhifPublicRoot(): string {
  const browserOrigin = getBrowserOrigin();
  return browserOrigin ? `${trimTrailingSlash(browserOrigin.toString())}/imaging` : '';
}

export function buildOrthancExplorerUrl(
  configuration: OrthancConfiguration,
  params: Array<{ code: string; value: string }>,
): string {
  const orthancRoot = getOrthancPublicRoot(configuration);
  if (!orthancRoot) {
    return '';
  }

  const searchParams = new URLSearchParams();
  for (const { code, value } of params) {
    searchParams.set(code, value);
  }

  const queryString = searchParams.toString();
  return `${orthancRoot}/ui/app/#/filtered-studies${queryString ? `?${queryString}` : ''}`;
}

export function buildOrthancInstancePreviewUrl(
  configuration: OrthancConfiguration,
  orthancInstanceUID: string,
): string {
  return buildURL(
    getOrthancPublicRoot(configuration),
    `/instances/${encodeURIComponent(orthancInstanceUID)}/preview`,
    [],
  );
}

export function buildLocalInstancePreviewUrl(studyId: number, orthancInstanceUID: string): string {
  const browserOrigin = getBrowserOrigin();
  if (!browserOrigin) return '';
  return buildURL(new URL(makeUrl(imagingUrl), browserOrigin).toString(), '/previewinstance', [
    { code: 'orthancInstanceUID', value: orthancInstanceUID },
    { code: 'studyId', value: String(studyId) },
  ]);
}

export function buildOhifViewerUrl(
  params: Array<{ code: string; value: string }>,
  configuration: OrthancConfiguration,
): string {
  const origin = getBrowserOrigin();
  const root = getOrthancPublicRoot(configuration);
  // SIHSALUS OHIF serves exactly this Orthanc. Never silently query another PACS.
  if (!origin || root !== `${trimTrailingSlash(origin.toString())}/orthanc`) return '';
  return buildURL(getOhifPublicRoot(), '/viewer', params);
}

export function openInNewWindow(url: string): void {
  if (!url) {
    return;
  }

  globalThis.open(url, '_blank', 'noopener,noreferrer');
}

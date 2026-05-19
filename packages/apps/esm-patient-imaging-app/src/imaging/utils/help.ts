import { useTranslation } from 'react-i18next';

/**
 *
 * @param date
 * @returns The data time based on the dicom format for datetime
 */
export function toDICOMDateTime(date: Date): string {
  // Dicom DT format: YYYYMMDDHHMMSS.FFFFFF&ZZXX
  const pad = (num: number, size: number = 2) => num.toString().padStart(size, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1); // Months are zero-based
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());

  const timezoneOffset = -date.getTimezoneOffset(); // in minutes
  // const tzSign = timezoneOffset >= 0 ? '+' : '-';
  // const tzHours = pad(Math.floor(Math.abs(timezoneOffset) / 60));
  // const tzMinutes = pad(Math.abs(timezoneOffset) % 60);

  return `${year}${month}${day}${hour}${minute}${second}`;
}

/**
 *
 * @returns The generated access number
 */
export function generateAccessionNumber(): string {
  const date: Date = new Date();

  const formattedDate: string =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0') +
    String(date.getHours()).padStart(2, '0') +
    String(date.getMinutes()).padStart(2, '0') +
    String(date.getSeconds()).padStart(2, '0');

  const randomPart = crypto.getRandomValues(new Uint32Array(1))[0].toString().padStart(10, '0').slice(0, 5);

  const accessionNumber: string = formattedDate + randomPart;

  const inputElement = document.getElementById('accessionNumber') as HTMLInputElement | null;

  if (inputElement) {
    inputElement.value = accessionNumber;
  } else {
    console.warn('Element with ID "accessionNumber" not found.');
  }
  return accessionNumber;
}

/**
 *
 * @param time The selected time
 * @param period
 */
export function toDicomTimeString(time: string, period: 'AM' | 'PM'): string {
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
  const basicUrl = new URL(specialUrl, configurationUrl);
  for (const { code, value } of params) {
    basicUrl.searchParams.set(code, value);
  }
  return basicUrl.toString();
}

import { type TFunction } from 'i18next';

function normalizeTranslationKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function translateStockOperationType(t: TFunction, operationTypeName?: string) {
  return operationTypeName
    ? t(
        [
          `stockOperationType.${normalizeTranslationKey(operationTypeName)}`,
          `operationType.${operationTypeName}`,
          operationTypeName,
        ],
        operationTypeName,
      )
    : '';
}

export function translateStockOperationStatus(t: TFunction, status?: string) {
  return status
    ? t(
        [
          `stockOperationStatus.${normalizeTranslationKey(status)}`,
          status,
          normalizeTranslationKey(status),
        ],
        status,
      )
    : '';
}

export function translateStockLocation(t: TFunction, locationName?: string) {
  return locationName ? t(`location.${locationName}`, locationName) : '';
}

export function translateFromGlobal(key: string, defaultValue: string) {
  const i18next = (
    globalThis as typeof globalThis & {
      i18next?: { t?: (key: string, options?: { defaultValue?: string }) => string };
    }
  ).i18next;

  return i18next?.t?.(key, { defaultValue }) ?? defaultValue;
}

/**
 * Minimal runtime shape validation for the reportes-sql contract.
 *
 * TypeScript casts (`as FetchResponse<T>`) erase at compile time; these
 * guards keep the trust boundary explicit so a backend contract change
 * surfaces as a clear error instead of a confusing crash (or, worse,
 * silently misrendered data) further up the stack.
 */

import { translate } from '../i18n';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPaginatedResponse(
  value: unknown,
): value is { items: Array<unknown>; total: number; page: number; size: number; pages: number } {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    typeof value.total === 'number' &&
    typeof value.page === 'number' &&
    typeof value.size === 'number' &&
    typeof value.pages === 'number'
  );
}

export function isSeriesResponse(
  value: unknown,
): value is { items: Array<unknown>; indicador_id: string; anio: number; granularity: string } {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    typeof value.indicador_id === 'string' &&
    typeof value.anio === 'number' &&
    typeof value.granularity === 'string'
  );
}

export function isSQLPreview(value: unknown): value is {
  sql: string;
  params: Record<string, unknown>;
  periodo_inicio: string;
  periodo_fin: string;
  version_id: string;
  version_num: number;
} {
  return (
    isRecord(value) &&
    typeof value.sql === 'string' &&
    isRecord(value.params) &&
    typeof value.periodo_inicio === 'string' &&
    typeof value.periodo_fin === 'string' &&
    typeof value.version_id === 'string' &&
    typeof value.version_num === 'number'
  );
}

export function isIndicadorDetail(value: unknown): value is {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creado_en: string;
  versiones: Array<{
    id: string;
    indicador_id: string;
    version: number;
    creado_en: string;
    definicion: Record<string, unknown>;
  }>;
} {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.nombre !== 'string' ||
    (value.descripcion !== null && typeof value.descripcion !== 'string') ||
    typeof value.activo !== 'boolean' ||
    typeof value.creado_en !== 'string' ||
    !Array.isArray(value.versiones)
  ) {
    return false;
  }

  return value.versiones.every(
    (version) =>
      isRecord(version) &&
      typeof version.id === 'string' &&
      typeof version.indicador_id === 'string' &&
      typeof version.version === 'number' &&
      typeof version.creado_en === 'string' &&
      isRecord(version.definicion),
  );
}

export function assertShape<T>(value: T, guard: (value: unknown) => boolean, resource: string): T {
  if (!guard(value)) {
    const template = translate(
      'unexpectedResponseError',
      'reportes-sql devolvió una respuesta inesperada para {{resource}}.',
    );
    throw new Error(template.replace('{{resource}}', resource));
  }
  return value;
}

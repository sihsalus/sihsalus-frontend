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
): value is { items: Array<unknown>; indicador_id: number; anio: number; granularity: string } {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    typeof value.indicador_id === 'number' &&
    typeof value.anio === 'number' &&
    typeof value.granularity === 'string'
  );
}

export function isIndicadorDetail(value: unknown): value is {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creado_en: string;
  versiones: Array<{
    id: number;
    indicador_id: number;
    version: number;
    creado_en: string;
    definicion: Record<string, unknown>;
  }>;
} {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
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
      typeof version.id === 'number' &&
      typeof version.indicador_id === 'number' &&
      typeof version.version === 'number' &&
      typeof version.creado_en === 'string' &&
      isRecord(version.definicion),
  );
}

export function isIndicadorResultado(value: unknown): value is { id: number; periodo_inicio: string; periodo_fin: string; valor: number; calculado_en: string } {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.periodo_inicio === 'string' &&
    typeof value.periodo_fin === 'string' &&
    typeof value.valor === 'number' &&
    typeof value.calculado_en === 'string'
  );
}

export function isSerieRow(value: unknown): value is { periodo_label: string; valor: number; meses_disponibles: number; anio: number } {
  return (
    isRecord(value) &&
    typeof value.periodo_label === 'string' &&
    typeof value.valor === 'number' &&
    typeof value.meses_disponibles === 'number' &&
    typeof value.anio === 'number'
  );
}

export function isIndicadorMeta(value: unknown): value is { id: number; indicador_version_id: number; anio: number; valor_meta: number; creado_en: string } {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.indicador_version_id === 'number' &&
    typeof value.anio === 'number' &&
    typeof value.valor_meta === 'number' &&
    typeof value.creado_en === 'string'
  );
}

export function isIdentifiedResource(value: unknown): value is { id: number } {
  return isRecord(value) && typeof value.id === 'number';
}

export function isOptionList(value: unknown): value is Array<{ uuid: string }> {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.uuid === 'string');
}

export function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

export function isCalcularNowResponse(value: unknown): value is {
  calculados: number;
  errores: Array<unknown>;
  total: number;
} {
  return (
    isRecord(value) &&
    typeof value.calculados === 'number' &&
    Array.isArray(value.errores) &&
    typeof value.total === 'number'
  );
}

export function isRecalcularAnioResponse(value: unknown): value is {
  anio: number;
  indicador_id: number | null;
  meses_procesados: number;
  indicadores_considerados: number;
  recalculados: number;
  errores: Array<unknown>;
  total: number;
} {
  return (
    isRecord(value) &&
    typeof value.anio === 'number' &&
    (value.indicador_id === null || typeof value.indicador_id === 'number') &&
    typeof value.meses_procesados === 'number' &&
    typeof value.indicadores_considerados === 'number' &&
    typeof value.recalculados === 'number' &&
    Array.isArray(value.errores) &&
    typeof value.total === 'number'
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
